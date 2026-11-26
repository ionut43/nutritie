import type { RealtimeChannel } from '@supabase/supabase-js';
import { addDays, fromISO, todayISO, toISO } from '../logic/dates';
import type { WeekPlan } from '../logic/types';
import { useStore, type FamilyInfo } from '../store/useStore';
import { supabase } from './client';
import { applyDocs, type Doc, docsFromState, hash, type SyncSlice } from './docs';

/*
 * Sincronizarea familiei: fiecare telefon are toate datele (merge și fără internet);
 * serverul doar le duce de la un telefon la altul. Ce schimbi aici pleacă după o secundă,
 * ce schimbă ceilalți vine imediat (timp real) sau când deschizi aplicația.
 */

const slice = (): SyncSlice => {
  const s = useStore.getState();
  return { members: s.members, plans: s.plans, pantry: s.pantry, settings: s.settings, customRecipes: s.customRecipes, customIngredients: s.customIngredients };
};
const selfId = () => useStore.getState().members.find((m) => m.isMain)?.id ?? 'me';
const status = (state: 'syncing' | 'ok' | 'offline' | 'error', msg?: string) =>
  useStore.getState().setSyncStatus({ state, msg, atISO: state === 'ok' ? new Date().toISOString() : useStore.getState().syncStatus.atISO });

/** mesaj pe înțeles pentru erorile de rețea și de server */
export function friendly(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e);
  if (/anonymous sign-ins are disabled/i.test(m)) return 'Serverul nu acceptă încă intrarea fără cont (Supabase → Authentication → Allow anonymous sign-ins).';
  if (/cod greșit/.test(m)) return 'Codul nu e bun. Verifică literele (fără 0 și O, fără 1 și I).';
  if (/familie plină/.test(m)) return 'Familia are deja 12 telefoane.';
  if (/fetch|network|Failed to fetch|timeout/i.test(m)) return 'Nu e internet. Încerc din nou când revine.';
  if (/does not exist|schema cache|relation/i.test(m)) return 'Serverul nu e pregătit (lipsește structura bazei de date).';
  return m;
}

/** contul telefonului (fără email și parolă); îl face o singură dată */
export async function ensureUser(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: d, error } = await supabase.auth.signInAnonymously();
  if (error || !d.user) throw error ?? new Error('fără cont');
  return d.user.id;
}

const memberIdFor = (userId: string) => `u_${userId.replace(/-/g, '').slice(0, 10)}`;
const myName = () => useStore.getState().members.find((m) => m.isMain)?.name.trim() || 'Eu';

async function loadInfo(householdId: string, userId: string): Promise<FamilyInfo> {
  const [{ data: h, error: e1 }, { data: ppl, error: e2 }] = await Promise.all([
    supabase.from('households').select('id,name,invite_code').eq('id', householdId).single(),
    supabase.from('household_members').select('user_id,name').eq('household_id', householdId).order('joined_at'),
  ]);
  if (e1 || !h) throw e1 ?? new Error('familia nu mai există');
  if (e2) throw e2;
  return { id: h.id, name: h.name, code: h.invite_code, userId, people: (ppl ?? []).map((p) => ({ userId: p.user_id, name: p.name })) };
}

// ── trimitere și primire ──────────────────────────────────────────────────

let pushTimer: ReturnType<typeof setTimeout> | undefined;
let pulling = false;
let lastPullISO: string | undefined;

/** ce s-a schimbat pe telefon de la ultima sincronizare */
function pendingIds(): Set<string> {
  const base = useStore.getState().syncBase;
  const out = new Set<string>();
  for (const [id, d] of docsFromState(slice())) if (base[id] !== hash(d.json)) out.add(id);
  for (const id of Object.keys(base)) if (!docsFromState(slice()).has(id)) out.add(id);
  return out;
}

export async function push(): Promise<void> {
  const fam = useStore.getState().family;
  if (!fam) return;
  const base = { ...useStore.getState().syncBase };
  const now = docsFromState(slice());
  const rows: { household_id: string; kind: string; key: string; data: unknown; deleted: boolean }[] = [];
  const next: Record<string, string> = { ...base };
  for (const [id, d] of now) {
    const h = hash(d.json);
    if (base[id] === h) continue;
    rows.push({ household_id: fam.id, kind: d.kind, key: d.key, data: JSON.parse(d.json), deleted: false });
    next[id] = h;
  }
  // planurile foarte vechi nu le șterg de pe server când dispar de pe un telefon (ceilalți le pot păstra)
  for (const id of Object.keys(base)) {
    if (now.has(id)) continue;
    const [kind, ...k] = id.split(':');
    rows.push({ household_id: fam.id, kind, key: k.join(':'), data: null, deleted: true });
    delete next[id];
  }
  if (!rows.length) return;
  status('syncing');
  for (let i = 0; i < rows.length; i += 20) {
    const { error } = await supabase.from('household_docs').upsert(rows.slice(i, i + 20), { onConflict: 'household_id,kind,key' });
    if (error) throw error;
  }
  // ce s-a schimbat cât trimiteam rămâne de trimis data viitoare (amprenta e cea trimisă, nu cea de acum)
  const after = { ...useStore.getState().syncBase };
  for (const r of rows) {
    const id = `${r.kind}:${r.key}`;
    if (r.deleted) delete after[id];
    else after[id] = next[id];
  }
  useStore.getState().setSyncBase(after);
  status('ok');
}

export async function pull(full = false): Promise<void> {
  const fam = useStore.getState().family;
  if (!fam || pulling) return;
  pulling = true;
  try {
    status('syncing');
    let q = supabase.from('household_docs').select('kind,key,data,deleted,updated_at').eq('household_id', fam.id);
    // după prima dată: doar ce s-a schimbat (cu o marjă, pentru ceasuri și întârzieri)
    if (!full && lastPullISO) q = q.gt('updated_at', new Date(Date.parse(lastPullISO) - 10_000).toISOString());
    const { data, error } = await q;
    if (error) throw error;
    const docs = (data ?? []) as Doc[];
    const startedISO = docs.reduce((a, d) => (d.updated_at && d.updated_at > a ? d.updated_at : a), lastPullISO ?? '');
    if (docs.length) applyIncoming(docs);
    lastPullISO = startedISO || lastPullISO;
    status('ok');
  } finally {
    pulling = false;
  }
}

function applyIncoming(docs: Doc[]) {
  const pending = pendingIds();
  const { patch, added, removed } = applyDocs(slice(), docs, selfId(), pending);
  const st = useStore.getState();
  if (Object.keys(patch).length) st.applyRemote(patch);
  // ce a venit devine „sincronizat”; ce aveai netrimis rămâne de trimis
  const after = docsFromState(slice());
  const base = { ...useStore.getState().syncBase };
  for (const d of docs) {
    const id = `${d.kind}:${d.key}`;
    if (pending.has(id)) continue;
    const cur = after.get(id);
    if (cur) base[id] = hash(cur.json);
    else delete base[id];
  }
  useStore.getState().setSyncBase(base);
  // cine a intrat în familie mănâncă și din planul de acum; cine a ieșit nu mai are porții
  if (removed.length) {
    const today = todayISO();
    const plans = Object.fromEntries(Object.entries(useStore.getState().plans).map(([k, p]) => (
      toISO(addDays(fromISO(p.startISO), 6)) < today ? [k, p] : [k, { ...p, household: { ...p.household, memberIds: p.household.memberIds.filter((x) => !removed.includes(x)) } }]
    ))) as Record<string, WeekPlan>;
    useStore.getState().applyRemote({ plans });
    useStore.getState().refitPlans();
  }
  if (added.length) mergeSameNames(added);
  if (added.length || removed.length) void refreshInfo();
  if (pendingIds().size) schedulePush();
}

export function schedulePush(delay = 1200) {
  if (!useStore.getState().family) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    push().catch((e) => status(/fetch|network/i.test(String(e?.message ?? e)) ? 'offline' : 'error', friendly(e)));
  }, delay);
}

export async function refreshInfo() {
  const fam = useStore.getState().family;
  if (!fam) return;
  try {
    const info = await loadInfo(fam.id, fam.userId);
    useStore.getState().setFamily(info);
  } catch (e) {
    // te-a scos cineva sau familia nu mai există: datele rămân pe telefon
    if (/0 rows|JSON object requested|nu mai există/i.test(String((e as Error)?.message))) { stopSync(); useStore.getState().setFamily(undefined); }
  }
}

// ── pornire / oprire ──────────────────────────────────────────────────────

let channel: RealtimeChannel | undefined;
let unsub: (() => void) | undefined;
let pullTimer: ReturnType<typeof setTimeout> | undefined;

export async function startSync() {
  const fam = useStore.getState().family;
  if (!fam || unsub) return;
  // orice schimbare la plan, cămară, membri, setări sau rețete pleacă singură
  unsub = useStore.subscribe((s, p) => {
    if (s.plans !== p.plans || s.pantry !== p.pantry || s.members !== p.members || s.settings !== p.settings || s.customRecipes !== p.customRecipes || s.customIngredients !== p.customIngredients) schedulePush();
  });
  channel = supabase.channel(`fam:${fam.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'household_docs', filter: `household_id=eq.${fam.id}` }, () => {
      clearTimeout(pullTimer);
      pullTimer = setTimeout(() => { pull().catch((e) => status('offline', friendly(e))); }, 400);
    })
    .subscribe();
  try {
    await ensureUser();
    await pull(true);
    await push();
    void refreshInfo();
  } catch (e) {
    status(/fetch|network/i.test(String((e as Error)?.message)) ? 'offline' : 'error', friendly(e));
  }
}

export function stopSync() {
  unsub?.(); unsub = undefined;
  if (channel) void supabase.removeChannel(channel);
  channel = undefined;
  clearTimeout(pushTimer);
  lastPullISO = undefined;
}

/** sincronizează acum (la deschiderea aplicației sau din buton) */
export async function syncNow() {
  try {
    await pull(!lastPullISO);
    await push();
    await refreshInfo();
  } catch (e) {
    status(/fetch|network/i.test(String((e as Error)?.message)) ? 'offline' : 'error', friendly(e));
    throw e;
  }
}

// ── familie: creează, intră, ieși ─────────────────────────────────────────

/** profilul tău primește id-ul contului, ca să nu se încurce cu „me” de pe alt telefon */
function adoptAccountId(userId: string) {
  useStore.getState().renameMember(selfId(), memberIdFor(userId));
}

/**
 * Cineva din familie pe care l-ai adăugat de mână (de ex. „Alexia”) intră cu telefonul lui:
 * îl păstrez o singură dată, cu profilul de pe telefonul lui, și planurile trec pe el.
 */
function mergeSameNames(newIds: string[]) {
  const norm = (x: string) => x.trim().toLowerCase();
  for (const id of newIds) {
    const st = useStore.getState();
    const m = st.members.find((x) => x.id === id);
    if (!m || !m.name.trim()) continue;
    const twin = st.members.find((x) => x.id !== id && !x.isMain && !x.id.startsWith('u_') && norm(x.name) === norm(m.name));
    if (twin) st.renameMember(twin.id, id);
  }
}

export async function createFamily(name: string): Promise<FamilyInfo> {
  const userId = await ensureUser();
  const { data, error } = await supabase.rpc('create_household', { p_name: name, p_member_name: myName() });
  if (error) throw error;
  adoptAccountId(userId);
  const info = await loadInfo((data as { id: string }).id, userId);
  useStore.getState().setFamily(info);
  useStore.getState().setSyncBase({});
  lastPullISO = undefined;
  await push();
  await startSync();
  return info;
}

export async function joinFamily(code: string): Promise<FamilyInfo> {
  const userId = await ensureUser();
  const { data, error } = await supabase.rpc('join_household', { p_code: code.trim().toUpperCase(), p_member_name: myName() });
  if (error) throw error;
  adoptAccountId(userId);
  const info = await loadInfo((data as { id: string }).id, userId);
  useStore.getState().setFamily(info);
  // ce are familia câștigă (plan, cămară, setări); membrii și rețetele tale se adaugă la ale lor
  useStore.getState().setSyncBase({});
  lastPullISO = undefined;
  const { data: rows, error: e2 } = await supabase.from('household_docs').select('kind,key,data,deleted,updated_at').eq('household_id', info.id);
  if (e2) throw e2;
  const remote = (rows ?? []) as Doc[];
  const { patch, added } = applyDocs(slice(), remote, selfId(), new Set());
  // planurile tale pentru săptămâni pe care familia nu le are rămân (și pleacă la ei)
  if (patch.plans) patch.plans = { ...useStore.getState().plans, ...patch.plans };
  useStore.getState().applyRemote(patch);
  mergeSameNames(added);
  const after = docsFromState(slice());
  const base: Record<string, string> = {};
  for (const d of remote) {
    const id = `${d.kind}:${d.key}`;
    const cur = after.get(id);
    if (cur && !d.deleted) base[id] = hash(cur.json);
  }
  useStore.getState().setSyncBase(base);
  // tu mănânci de acum din planurile familiei (de azi încolo)
  const me = selfId();
  const today = todayISO();
  const plans = Object.fromEntries(Object.entries(useStore.getState().plans).map(([k, p]) => (
    toISO(addDays(fromISO(p.startISO), 6)) < today || p.household.memberIds.includes(me) ? [k, p] : [k, { ...p, household: { ...p.household, memberIds: [...p.household.memberIds, me] } }]
  ))) as Record<string, WeekPlan>;
  useStore.getState().applyRemote({ plans });
  useStore.getState().refitPlans();
  await push();
  await startSync();
  return info;
}

export async function leaveFamily(): Promise<void> {
  const fam = useStore.getState().family;
  if (!fam) return;
  stopSync();
  try {
    await supabase.from('household_docs').upsert({ household_id: fam.id, kind: 'member', key: selfId(), data: null, deleted: true }, { onConflict: 'household_id,kind,key' });
    await supabase.from('household_members').delete().eq('household_id', fam.id).eq('user_id', fam.userId);
  } finally {
    // datele rămân pe telefon; doar nu se mai sincronizează
    useStore.getState().setFamily(undefined);
  }
}

export async function renewCode(): Promise<string> {
  const fam = useStore.getState().family;
  if (!fam) throw new Error('nu ești într-o familie');
  const { data, error } = await supabase.rpc('renew_invite_code', { p_household: fam.id });
  if (error) throw error;
  useStore.getState().setFamily({ ...fam, code: String(data) });
  return String(data);
}
