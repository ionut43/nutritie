-- Nutriție: familia (listă, cămară, plan comune) și rețetele publice.
-- Se rulează o singură dată în Supabase → SQL Editor → New query → Run.
-- Se poate rula din nou fără să strice nimic.

-- ── Familii ────────────────────────────────────────────────────────────────
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Familia' check (char_length(name) <= 60),
  invite_code text not null unique,
  created_by uuid default auth.uid() references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  name text not null default '' check (char_length(name) <= 60),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index if not exists household_members_user on public.household_members (user_id);

-- planul, cămara, membrii, setările comune: câte un document JSON
create table if not exists public.household_docs (
  household_id uuid not null references public.households on delete cascade,
  kind text not null,
  key text not null check (char_length(key) <= 80),
  data jsonb,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (household_id, kind, key),
  check (octet_length(data::text) < 400000)
);

-- ce fel de documente: plan, cămară, membru, setări comune, rețete și ingrediente adăugate de voi
alter table public.household_docs drop constraint if exists household_docs_kind_check;
alter table public.household_docs add constraint household_docs_kind_check
  check (kind in ('plan', 'pantry', 'member', 'settings', 'recipe', 'ingredient'));

-- e membru al familiei? (security definer: nu intră în bucla politicilor)
create or replace function public.is_member(hid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.household_members where household_id = hid and user_id = auth.uid());
$$;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_docs enable row level security;

drop policy if exists "membrii văd familia" on public.households;
create policy "membrii văd familia" on public.households for select to authenticated using (public.is_member(id));
drop policy if exists "membrii redenumesc familia" on public.households;
create policy "membrii redenumesc familia" on public.households for update to authenticated using (public.is_member(id)) with check (public.is_member(id));

drop policy if exists "membrii se văd între ei" on public.household_members;
create policy "membrii se văd între ei" on public.household_members for select to authenticated using (public.is_member(household_id));
drop policy if exists "îți schimbi numele" on public.household_members;
create policy "îți schimbi numele" on public.household_members for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "ieși din familie" on public.household_members;
create policy "ieși din familie" on public.household_members for delete to authenticated using (user_id = auth.uid());

drop policy if exists "documentele familiei" on public.household_docs;
create policy "documentele familiei" on public.household_docs for all to authenticated
  using (public.is_member(household_id)) with check (public.is_member(household_id));

-- ora o pune serverul (telefoanele pot avea ceasul greșit)
create or replace function public.touch_doc() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
drop trigger if exists touch_doc on public.household_docs;
create trigger touch_doc before insert or update on public.household_docs for each row execute function public.touch_doc();

-- cod de invitație: 6 caractere ușor de dictat (fără 0/O, 1/I)
create or replace function public.new_invite_code() returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  c text;
begin
  loop
    c := '';
    for i in 1..6 loop c := c || substr(chars, 1 + floor(random() * length(chars))::int, 1); end loop;
    exit when not exists (select 1 from public.households where invite_code = c);
  end loop;
  return c;
end $$;

create or replace function public.create_household(p_name text, p_member_name text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'neautentificat'; end if;
  insert into public.households (name, invite_code, created_by)
    values (coalesce(nullif(trim(p_name), ''), 'Familia'), public.new_invite_code(), auth.uid()) returning * into h;
  insert into public.household_members (household_id, user_id, name) values (h.id, auth.uid(), coalesce(p_member_name, ''));
  return h;
end $$;

create or replace function public.join_household(p_code text, p_member_name text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'neautentificat'; end if;
  select * into h from public.households where invite_code = upper(trim(p_code));
  if h.id is null then raise exception 'cod greșit'; end if;
  if (select count(*) from public.household_members where household_id = h.id) >= 12 then raise exception 'familie plină'; end if;
  insert into public.household_members (household_id, user_id, name) values (h.id, auth.uid(), coalesce(p_member_name, ''))
    on conflict (household_id, user_id) do update set name = excluded.name;
  return h;
end $$;

-- cod nou (dacă cel vechi a ajuns unde nu trebuia)
create or replace function public.renew_invite_code(p_household uuid) returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not public.is_member(p_household) then raise exception 'nu ești în familie'; end if;
  c := public.new_invite_code();
  update public.households set invite_code = c where id = p_household;
  return c;
end $$;

-- ── Rețete publice ─────────────────────────────────────────────────────────
create table if not exists public.public_recipes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 60),
  name text not null check (char_length(name) between 2 and 120),
  moments text[] not null default '{}',
  recipe jsonb not null check (octet_length(recipe::text) < 60000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reports int not null default 0
);
create index if not exists public_recipes_created on public.public_recipes (created_at desc);
alter table public.public_recipes enable row level security;

drop policy if exists "oricine citește rețetele" on public.public_recipes;
create policy "oricine citește rețetele" on public.public_recipes for select to anon, authenticated using (reports < 5);
drop policy if exists "autorul publică" on public.public_recipes;
create policy "autorul publică" on public.public_recipes for insert to authenticated with check (author_id = auth.uid());
drop policy if exists "autorul modifică" on public.public_recipes;
create policy "autorul modifică" on public.public_recipes for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists "autorul șterge" on public.public_recipes;
create policy "autorul șterge" on public.public_recipes for delete to authenticated using (author_id = auth.uid());

-- „raportează”: o dată de la fiecare utilizator; de la 5 rapoarte rețeta nu se mai arată
create table if not exists public.recipe_reports (
  recipe_id uuid not null references public.public_recipes on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);
alter table public.recipe_reports enable row level security;

create or replace function public.report_recipe(p_recipe uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'neautentificat'; end if;
  insert into public.recipe_reports (recipe_id, user_id) values (p_recipe, auth.uid()) on conflict do nothing;
  update public.public_recipes set reports = (select count(*) from public.recipe_reports where recipe_id = p_recipe) where id = p_recipe;
end $$;

-- ── Drepturi (API-ul vede doar ce e aici) ──────────────────────────────────
grant usage on schema public to anon, authenticated;
grant select, update on public.households to authenticated;
grant select, update, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.household_docs to authenticated;
grant select on public.public_recipes to anon, authenticated;
grant insert, update, delete on public.public_recipes to authenticated;
revoke all on public.recipe_reports from anon, authenticated;
revoke execute on function public.new_invite_code() from public, anon, authenticated;
revoke execute on function public.touch_doc() from public, anon, authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.create_household(text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
grant execute on function public.renew_invite_code(uuid) to authenticated;
grant execute on function public.report_recipe(uuid) to authenticated;
revoke execute on function public.create_household(text, text) from anon, public;
revoke execute on function public.join_household(text, text) from anon, public;
revoke execute on function public.renew_invite_code(uuid) from anon, public;
revoke execute on function public.report_recipe(uuid) from anon, public;

-- ── Timp real: schimbările din familie ajung imediat pe celelalte telefoane ──
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'household_docs') then
    alter publication supabase_realtime add table public.household_docs;
  end if;
end $$;
