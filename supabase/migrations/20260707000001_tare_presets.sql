-- Saved tare weights ("the empty weight of a regular truck/container").
--
-- When a yard weighs a vehicle on the scale, net = gross − tare. Regulars come
-- back repeatedly with the same rig, so operators save the tare once and pick
-- it on the next buy instead of re-weighing empty. Purely operational data —
-- any staffer in the company can create/edit/remove presets (no admin gate),
-- so direct client CRUD via RLS is fine; there's no server-computed value to
-- protect the way the cash drawer has.

create table if not exists public.tare_presets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default public.current_company_id()
    references public.companies(id) on delete cascade,
  name text not null,
  tare_weight numeric(10, 2) not null,
  created_by uuid references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tare_presets_company_idx
  on public.tare_presets (company_id, name);

-- One preset name per company (case-insensitive) so "Blue Peterbilt" can't be
-- saved twice.
create unique index if not exists tare_presets_company_name_key
  on public.tare_presets (company_id, lower(name));

alter table public.tare_presets enable row level security;

-- Every policy is scoped to the caller's company via current_company_id(), so a
-- yard only ever sees and mutates its own presets.
create policy "Staff read tare presets in their company"
  on public.tare_presets for select
  to authenticated
  using (company_id = public.current_company_id());

create policy "Staff create tare presets in their company"
  on public.tare_presets for insert
  to authenticated
  with check (company_id = public.current_company_id());

create policy "Staff update tare presets in their company"
  on public.tare_presets for update
  to authenticated
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

create policy "Staff delete tare presets in their company"
  on public.tare_presets for delete
  to authenticated
  using (company_id = public.current_company_id());
