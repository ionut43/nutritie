import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Modal, Platform, Pressable, Share, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Line as SvgLine } from 'react-native-svg';
import { ING } from '../data/ingredients';
import { RECIPE } from '../data/recipes';
import { addDays, daysBetween, fmtDate, fromISO, todayISO, toISO, weekdayMon } from '../logic/dates';
import { adaptiveSuggestion, computeTargets, weeksToTarget, weightTrend } from '../logic/energy';
import { fmtRon, nf } from '../logic/format';
import { buildTaste, topIngredients } from '../logic/taste';
import type { WeightEntry } from '../logic/types';
import { FEATURES, featureOn } from '../logic/features';
import { ownedBy, useActiveMember, useStore } from '../store/useStore';
import { autoBackups, exportBackup, pickBackup, readBackup } from '../ui/backup';
import { ToggleRow } from '../ui/forms';
import { Btn, Card, DISPLAY, Divider, FoodImage, Header, Icon, type IconName, NumberField, Pill, Row, Screen, Section, T, useTheme } from '../ui/kit';
import { biometricsAvailable, confirmIdentity } from '../ui/LockGate';
import { AppVersionRow } from '../ui/UpdateBanner';
import { ensurePermission } from '../ui/notify';
import { Avatar } from '../ui/shared';
import { ThemePicker } from '../ui/ThemePicker';

const GOAL_SHORT = { slabire: 'Slăbesc', mentinere: 'Mă mențin', masa: 'Iau în greutate' } as const;

export default function Profile() {
  const t = useTheme();
  const router = useRouter();
  const { members, weightLog: allWeights, addWeight, removeWeight, adjustKcal, resetAll, lockEnabled, setLock, notifyExpiry, setNotifyExpiry, ratings, importData, lastBackupISO, spend, settings, setFeature, updateSettings } = useStore();
  const st = useStore();
  const on = (f: Parameters<typeof featureOn>[1]) => featureOn(st, f);
  const main = useActiveMember();
  const mainMemberId = members.find((m) => m.isMain)?.id;
  const [w, setW] = useState(main?.weightKg ?? 70);
  const [fb, setFb] = useState(false);
  const [fbText, setFbText] = useState('');
  React.useEffect(() => { if (main) setW(main.weightKg); }, [main?.id]);
  if (!main) return null;
  const tg = computeTargets(main);
  const weightLog = allWeights.filter((e) => ownedBy(main.id, mainMemberId, e.memberId));
  const sug = adaptiveSuggestion(main, weightLog);
  const trend = weightTrend(weightLog);
  const eta = weeksToTarget(main);
  const others = members.filter((m) => !m.isMain);
  const copies = autoBackups();

  // cheltuieli pe ultimele 6 săptămâni
  const monday = addDays(fromISO(todayISO()), -weekdayMon(new Date()));
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const s = toISO(addDays(monday, -7 * (5 - i)));
    const e = toISO(addDays(monday, -7 * (5 - i) + 6));
    return { s, sum: spend.filter((x) => x.dateISO >= s && x.dateISO <= e).reduce((a, x) => a + x.amount, 0) };
  });
  const maxW = Math.max(settings.budgetRon, ...weeks.map((x) => x.sum)) || 1;

  return (
    <Screen>
      <Header onBack={() => router.back()} title="Eu" />
      <Card onPress={() => router.push({ pathname: '/membru/[id]', params: { id: main.id } })} style={{ gap: 14 }}>
        <Row gap={12}>
          <Avatar name={main.name} color={t.primary} size={52} />
          <View style={{ flex: 1 }}>
            <T v="h2">{main.name}</T>
            <T v="small">{tg.age} ani · {main.heightCm} cm · {nf(main.weightKg)} kg</T>
          </View>
          <Icon name="create-outline" color={t.muted} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <Stat label="Ținta zilnică" value={`${tg.kcal}`} unit="kcal" color={t.primary} />
          <Stat label="Proteine" value={`${tg.protein}`} unit="g" color={t.protein} />
          <Stat label="Obiectiv" value={GOAL_SHORT[tg.goal]} />
        </Row>
        {eta ? <Pill text={`~${eta} săptămâni până la ${nf(main.targetKg ?? 0)} kg`} icon="flag" color={t.accent} bg={t.accentSoft} /> : null}
        <T v="small">Metabolism bazal {tg.bmr} kcal · necesar de menținere {tg.tdee} kcal · {tg.method}</T>
        {tg.warnings.map((x) => <T key={x} v="small" color={t.warn}>{x}</T>)}
      </Card>
      {main.kcalAdjust !== 0 && (
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="small">Ajustare din evoluția greutății: {main.kcalAdjust > 0 ? '+' : ''}{main.kcalAdjust} kcal</T>
          <Btn title="Anulează" small variant="ghost" onPress={() => adjustKcal(-main.kcalAdjust)} />
        </Row>
      )}

      {on('cantar') && <Section title="Greutate">
        <Card style={{ gap: 12 }}>
          <WeightChart log={weightLog} target={main.targetKg} />
          {trend && <T v="small">Ultimele {trend.spanDays} zile: {trend.slope > 0 ? '+' : ''}{trend.slope.toFixed(2).replace('.', ',')} kg pe săptămână</T>}
          <Row>
            <View style={{ flex: 1 }}><NumberField value={w} onChange={setW} step={0.1} decimals={1} min={20} max={350} suffix="kg" /></View>
            <Btn title="Salvează" small onPress={() => addWeight(w)} />
          </Row>
          {weightLog.length > 0 && (
            <Row wrap gap={6}>
              {[...weightLog].reverse().slice(0, 5).map((e) => (
                <Pressable key={e.dateISO} onLongPress={() => removeWeight(e.dateISO)}>
                  <Pill text={`${e.dateISO === todayISO() ? 'azi' : fmtDate(fromISO(e.dateISO))}: ${nf(e.kg)} kg`} />
                </Pressable>
              ))}
            </Row>
          )}
          <T v="small">Cântărește-te dimineața, de 2–3 ori pe săptămână. După 2 săptămâni îți spun dacă ținta trebuie ajustată.</T>
        </Card>
        {sug && (
          <Card tone={sug.delta === 0 ? 'accent' : 'warn'} style={{ gap: 8 }}>
            <T v="small" color={t.text}>{sug.text}</T>
            {sug.delta !== 0 && <Btn title={`Aplică ${sug.delta > 0 ? '+' : ''}${sug.delta} kcal/zi`} small onPress={() => adjustKcal(sug.delta)} />}
          </Card>
        )}
      </Section>}

      <Section title="Cheltuieli" right={<Btn title="Toate" small variant="ghost" onPress={() => router.push('/cheltuieli')} />}>
        {spend.length === 0 ? (
          <Card onPress={() => router.push('/cheltuieli')} style={{ gap: 6 }}>
            <T style={{ fontFamily: DISPLAY }}>Încă nimic aici</T>
            <T v="small">După ce termini cumpărăturile din listă sau faci o poză bonului, aici vezi cât ai cheltuit în fiecare săptămână față de buget.</T>
          </Card>
        ) : (<>
        <Card onPress={() => router.push('/cheltuieli')} style={{ gap: 10 }}>
          <View style={{ height: 110, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            {weeks.map((x, i) => (
              <View key={x.s} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <T v="small" style={{ fontSize: 11 }}>{x.sum ? Math.round(x.sum) : ''}</T>
                <View style={{ width: '100%', height: Math.max(4, (x.sum / maxW) * 80), borderRadius: 8,
                  backgroundColor: x.sum > settings.budgetRon ? t.danger : i === weeks.length - 1 ? t.primary : t.accent }} />
              </View>
            ))}
          </View>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="small">ultimele 6 săptămâni</T>
            <T v="small">buget {fmtRon(settings.budgetRon)}/săpt.</T>
          </Row>
        </Card>
        <Btn title="Rezumatul săptămânii trecute" variant="secondary" icon="sparkles" small onPress={() => router.push('/recap')} />
        </>)}
      </Section>

      <TasteCard ratings={ratings} />

      <Section title="Cum arată">
        <ThemePicker value={settings.theme ?? 'email'} onChange={(theme) => updateSettings({ theme })} />
      </Section>

      <Section title="Funcții în plus" sub="Aplicația pornește simplă. Ce pornești aici apare în aplicație; ce e oprit nu apare nicăieri.">
        {FEATURES.map((f) => (
          <ToggleRow key={f.id} title={f.title} desc={f.desc} value={on(f.id)} onChange={(v) => setFeature(f.id, v)} />
        ))}
      </Section>

      <Section title="Setări">
        <Card style={{ gap: 0, paddingVertical: 4 }}>
          <LinkRow icon="person" title="Date personale, activitate, obiectiv" onPress={() => router.push({ pathname: '/membru/[id]', params: { id: main.id } })} />
          <Divider />
          <LinkRow icon="heart" title="Ce mănânc și ce nu" onPress={() => router.push('/preferinte')} />
          <Divider />
          <LinkRow icon="calendar" title="Plan: zile de gătit, mese, varietate, buget" onPress={() => router.push('/setari')} />
          <Divider />
          <LinkRow icon="storefront" title="Magazinele tale" onPress={() => router.push('/magazine')} />
          <Divider />
          <LinkRow icon="pricetag" title="Prețuri" onPress={() => router.push('/preturi')} />
        </Card>
      </Section>

      {on('familie') && <Section title="Familia" right={<Btn title="Adaugă" icon="add" small variant="ghost" onPress={() => router.push({ pathname: '/membru/[id]', params: { id: 'nou' } })} />}>
        {others.length === 0 ? <T v="small">Gătești doar pentru tine. Adaugă partenerul sau copiii și alege săptămânal cine mănâncă acasă. Fiecare are porția lui.</T> : (
          <Card style={{ gap: 0, paddingVertical: 4 }}>
            {others.map((m, i) => {
              const tgm = computeTargets(m);
              return (
                <View key={m.id}>
                  {i > 0 && <Divider />}
                  <Pressable onPress={() => router.push({ pathname: '/membru/[id]', params: { id: m.id } })} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                    <Avatar name={m.name} color={t.accent} size={38} />
                    <View style={{ flex: 1 }}>
                      <T style={{ fontWeight: '700' }}>{m.name}</T>
                      <T v="small">{tgm.age} ani · {tgm.kcal} kcal/zi</T>
                    </View>
                    <Icon name="chevron-forward" color={t.muted} size={18} />
                  </Pressable>
                </View>
              );
            })}
          </Card>
        )}
      </Section>}

      <Section title={Platform.OS === 'web' ? 'Siguranță' : 'Notificări și siguranță'}>
        {Platform.OS !== 'web' && <ToggleRow title="Când expiră alimentele" desc="Cu o zi înainte la 18:00 și în ziua expirării la 9:00."
          value={notifyExpiry} onChange={async (v) => {
            if (v && !(await ensurePermission())) { Alert.alert('Notificările sunt oprite', 'Pornește-le din Setările telefonului → Nutriție → Notificări.'); return; }
            setNotifyExpiry(v);
          }} />}
        <ToggleRow title="Blocare cu Face ID / amprentă" desc="Datele nu pleacă niciodată de pe telefon."
          value={lockEnabled} onChange={async (v) => {
            if (v && !(await biometricsAvailable())) { Alert.alert('Nu e disponibil', 'Activează Face ID, amprenta sau un cod în setările telefonului.'); return; }
            if (await confirmIdentity()) setLock(v);
          }} />
        {Platform.OS === 'android' && <Card style={{ gap: 6 }}><AppVersionRow /></Card>}
        <Card style={{ gap: 10 }}>
          <T v="h3">Backup</T>
          <T v="small">{lastBackupISO ? `Ultimul backup: acum ${Math.max(0, daysBetween(lastBackupISO.slice(0, 10), todayISO()))} zile` : 'Nu ai făcut încă niciun backup.'} Salvează-l în iCloud Drive, Google Drive sau pe e-mail.</T>
          {copies.length > 0 && (
            <Pressable onPress={() => Alert.alert('Restaurezi copia automată?', `Datele de acum se înlocuiesc cu cele din ${fmtDate(fromISO(copies[0].dateISO))}.`, [
              { text: 'Nu', style: 'cancel' },
              { text: 'Restaurează', style: 'destructive', onPress: async () => { const d = await readBackup(copies[0].uri); if (d && importData(d)) router.replace('/'); } },
            ])}>
              <T v="small">Copie automată pe telefon: {fmtDate(fromISO(copies[0].dateISO))}. <T v="small" color={t.primary} style={{ fontWeight: '700' }}>Restaureaz-o</T></T>
            </Pressable>
          )}
          <Row>
            <Btn title="Fă backup" icon="cloud-upload" small onPress={() => exportBackup().catch(() => Alert.alert('Nu am putut salva backup-ul'))} style={{ flex: 1 }} />
            <Btn title="Restaurează" icon="cloud-download" small variant="secondary" style={{ flex: 1 }} onPress={async () => {
              const d = await pickBackup();
              if (!d) { Alert.alert('Fișier invalid', 'Alege un fișier de backup făcut din aplicație.'); return; }
              Alert.alert('Restaurezi backup-ul?', 'Datele de acum de pe telefon se înlocuiesc cu cele din backup.', [
                { text: 'Nu', style: 'cancel' }, { text: 'Restaurează', style: 'destructive', onPress: () => { if (importData(d)) router.replace('/'); } },
              ]);
            }} />
          </Row>
        </Card>
      </Section>

      <Card onPress={() => setFb(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="chatbubble-ellipses-outline" color={t.primary} />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '600' }}>Spune-mi ce nu-ți place</T>
          <T v="small">Scrii cum îți vine și trimiți pe WhatsApp sau pe mail. Datele tale rămân pe telefon.</T>
        </View>
        <Icon name="chevron-forward" color={t.muted} size={18} />
      </Card>
      <Modal visible={fb} transparent animationType="slide" onRequestClose={() => setFb(false)}>
        <Pressable onPress={() => setFb(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable style={{ backgroundColor: t.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12, paddingBottom: 34 }}>
            <T v="h2">Ce nu-ți place?</T>
            <TextInput value={fbText} onChangeText={setFbText} multiline placeholder="ex. mi-e greu să găsesc unde adaug o masă" placeholderTextColor={t.muted}
              style={{ minHeight: 120, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 12, fontSize: 16, color: t.text, backgroundColor: t.card, textAlignVertical: 'top' }} />
            <Btn title="Trimite" icon="send" disabled={!fbText.trim()} onPress={() => {
              Share.share({ message: `Părere despre Nutriție:\n\n${fbText.trim()}` }).then(() => { setFb(false); setFbText(''); }).catch(() => {});
            }} />
          </Pressable>
        </Pressable>
      </Modal>

      <Card onPress={() => router.push('/problema')} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Icon name="bug-outline" color={t.primary} />
        <View style={{ flex: 1 }}>
          <T style={{ fontWeight: '600' }}>Raportează o problemă</T>
          <T v="small">Dacă aplicația s-a închis, aici vezi de ce și îmi poți trimite.</T>
        </View>
        <Icon name="chevron-forward" color={t.muted} />
      </Card>

      <Section title="Despre">
        <T v="small">
          Necesarul caloric: Mifflin-St Jeor (sau Katch-McArdle dacă știi procentul de grăsime), cu activitatea zilnică și sportul calculate separat; ecuațiile IOM pentru copii.
          Valori nutriționale: USDA FoodData Central. Poze rețete: TheMealDB. Aplicația nu înlocuiește sfatul unui medic sau nutriționist.
        </T>
        <Btn title="Șterge toate datele" variant="danger" icon="trash" small onPress={() => Alert.alert('Ștergi tot?', 'Profilul, planurile, cămara și istoricul se șterg de pe telefon.', [
          { text: 'Nu', style: 'cancel' }, { text: 'Șterge tot', style: 'destructive', onPress: () => { resetAll(); router.replace('/onboarding'); } },
        ])} />
      </Section>
    </Screen>
  );
}

function Stat({ label, value, unit, color }: { label: string; value: string; unit?: string; color?: string }) {
  return (
    <View style={{ gap: 2 }}>
      <T v="small">{label}</T>
      <T v="h2" color={color}>{value}{unit ? <T v="small"> {unit}</T> : null}</T>
    </View>
  );
}

function LinkRow({ icon, title, onPress }: { icon: IconName; title: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: t.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} color={t.primary} size={18} />
      </View>
      <T style={{ flex: 1, fontWeight: '600' }}>{title}</T>
      <Icon name="chevron-forward" color={t.muted} size={18} />
    </Pressable>
  );
}

function WeightChart({ log, target }: { log: WeightEntry[]; target?: number }) {
  const t = useTheme();
  const [w, setW] = useState(300);
  const pts = log.slice(-30);
  if (pts.length < 2) return <T v="small">Graficul apare după a doua cântărire.</T>;
  const vals = pts.map((p) => p.kg).concat(target ? [target] : []);
  const min = Math.min(...vals) - 0.5;
  const max = Math.max(...vals) + 0.5;
  const H = 120;
  const x0 = new Date(pts[0].dateISO).getTime();
  const span = Math.max(1, new Date(pts[pts.length - 1].dateISO).getTime() - x0);
  const X = (iso: string) => 6 + ((new Date(iso).getTime() - x0) / span) * (w - 12);
  const Y = (kg: number) => 8 + (1 - (kg - min) / (max - min)) * (H - 16);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.dateISO).toFixed(1)},${Y(p.kg).toFixed(1)}`).join(' ');
  // tendința: media netezită, ca apa și sarea din ziua de ieri să nu păcălească cifra de azi
  let ema = pts[0].kg;
  const smooth = pts.map((p, i) => { ema = i ? ema + 0.3 * (p.kg - ema) : p.kg; return { iso: p.dateISO, kg: ema }; });
  const ds = smooth.map((p, i) => `${i ? 'L' : 'M'}${X(p.iso).toFixed(1)},${Y(p.kg).toFixed(1)}`).join(' ');
  return (
    <View style={{ gap: 6 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="h2">{nf(Math.round(smooth[smooth.length - 1].kg * 10) / 10)} kg <T v="small">tendința</T></T>
        <T v="small">{fmtDate(fromISO(pts[0].dateISO))} → {fmtDate(fromISO(pts[pts.length - 1].dateISO))}</T>
      </Row>
      <Svg width={w} height={H}>
        {target ? <SvgLine x1={0} x2={w} y1={Y(target)} y2={Y(target)} stroke={t.accent} strokeDasharray="5 5" strokeWidth={1.5} /> : null}
        <Path d={d} stroke={t.border} strokeWidth={1.5} fill="none" strokeLinejoin="round" />
        {pts.map((p) => <Circle key={p.dateISO} cx={X(p.dateISO)} cy={Y(p.kg)} r={3} fill={t.card} stroke={t.muted} strokeWidth={1.5} />)}
        <Path d={ds} stroke={t.primary} strokeWidth={3.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
      <T v="small">Linia albastră e tendința; punctele gri sunt cântăririle.{target ? ` Linia verde: greutatea dorită (${nf(target)} kg).` : ''}</T>
    </View>
  );
}

function TasteCard({ ratings }: { ratings: Record<string, { up: number; down: number; skip: number }> }) {
  const t = useTheme();
  const router = useRouter();
  const taste = buildTaste(ratings, RECIPE);
  const { likes, dislikes } = topIngredients(taste);
  const fav = Object.entries(ratings).filter(([id, r]) => RECIPE[id] && r.up > r.down).sort((a, b) => b[1].up - a[1].up).slice(0, 4);
  return (
    <Section title="Gusturile tale">
      <Card style={{ gap: 10 }}>
        {taste.signals === 0 ? (
          <T v="small" color={t.text}>Bifează în ecranul Azi ce ai mâncat și apasă pe degetul sus sau jos. După câteva mese, planurile se potrivesc stilului tău.</T>
        ) : (
          <>
            <T v="small">Am învățat din {taste.signals} {taste.signals === 1 ? 'reacție' : 'reacții'} (note și schimbări din plan).</T>
            {fav.length > 0 && (
              <Row gap={10}>
                {fav.map(([id]) => (
                  <Pressable key={id} onPress={() => router.push({ pathname: '/reteta/[id]', params: { id } })} style={{ width: 70, gap: 4 }}>
                    <FoodImage recipe={RECIPE[id]} size={70} radius={16} />
                    <T v="small" numberOfLines={2} style={{ fontSize: 11 }}>{RECIPE[id].name}</T>
                  </Pressable>
                ))}
              </Row>
            )}
            {likes.length > 0 && <Row gap={6}><Icon name="thumbs-up" size={14} color={t.accent} /><T v="small" color={t.text} style={{ flex: 1 }}>{likes.map((id) => ING[id].name.toLowerCase()).join(', ')}</T></Row>}
            {dislikes.length > 0 && <Row gap={6}><Icon name="thumbs-down" size={14} color={t.danger} /><T v="small" color={t.text} style={{ flex: 1 }}>{dislikes.map((id) => ING[id].name.toLowerCase()).join(', ')}</T></Row>}
          </>
        )}
      </Card>
    </Section>
  );
}
