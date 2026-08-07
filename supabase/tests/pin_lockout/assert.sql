-- ===== Seed =====
insert into public.companies(id, name, prefix) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Yard A', 'YA-2026');
insert into public.users(id, supabase_id, company_id, role, is_active, name) values
  ('11111111-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
     'aaaaaaaa-0000-0000-0000-000000000001', 'owner', true, 'Owner A'),
  ('22222222-0000-0000-0000-0000000000a2', null,
     'aaaaaaaa-0000-0000-0000-000000000001', 'worker', true, 'Worker A');
-- set PINs: owner 9999, worker 1234
update public.users set pin_hash = extensions.crypt('9999', extensions.gen_salt('bf'))
  where id = '11111111-0000-0000-0000-0000000000a1';
update public.users set pin_hash = extensions.crypt('1234', extensions.gen_salt('bf'))
  where id = '22222222-0000-0000-0000-0000000000a2';

select set_config('app.current_uid', '00000000-0000-0000-0000-0000000000a1', false);

-- ===== PIN-T1: wrong shift-PIN attempts PERSIST across transactions, then lock out (#142) =====
-- 5 separate statements = 5 separate transactions, faithful to per-RPC calls.
-- (The original bug: the insert was rolled back by the raise, so the ledger
--  stayed empty and this count came back 0.)
delete from public.pin_attempts;
select count(*) from public.validate_pin('0000');
select count(*) from public.validate_pin('0000');
select count(*) from public.validate_pin('0000');
select count(*) from public.validate_pin('0000');
select count(*) from public.validate_pin('0000');
do $$
declare cnt int; locked boolean := false;
begin
  select count(*) into cnt from public.pin_attempts;
  begin
    perform * from public.validate_pin('0000');   -- 6th
    raise notice 'FAIL PIN-T1: 6th wrong attempt was NOT locked out (ledger=%)', cnt;
  exception when others then locked := true;
  end;
  if cnt = 5 and locked
    then raise notice 'PASS PIN-T1: 5 wrong attempts persisted across txns and the 6th locked out';
    else raise notice 'FAIL PIN-T1: ledger=% (want 5), locked=%', cnt, locked;
  end if;
end $$;

-- ===== PIN-T2: a correct PIN returns the identity and does NOT clear the ledger (anti-refill) =====
delete from public.pin_attempts;
select count(*) from public.validate_pin('0000');
select count(*) from public.validate_pin('0000');
do $$
declare rows int; cnt int;
begin
  select count(*) into rows from public.validate_pin('1234');   -- correct worker PIN
  select count(*) into cnt from public.pin_attempts;
  if rows = 1 and cnt = 2
    then raise notice 'PASS PIN-T2: correct PIN returns identity; ledger not cleared on success (anti-refill)';
    else raise notice 'FAIL PIN-T2: rows=% (want 1), ledger=% (want 2)', rows, cnt;
  end if;
end $$;

-- ===== PIN-T3: wrong admin PIN via admin_elevate persists + locks out (#142 admin path) =====
delete from public.pin_attempts;
select public.admin_elevate('0000', false);
select public.admin_elevate('0000', false);
select public.admin_elevate('0000', false);
select public.admin_elevate('0000', false);
select public.admin_elevate('0000', false);
do $$
declare cnt int; locked boolean := false;
begin
  select count(*) into cnt from public.pin_attempts;
  begin
    perform public.admin_elevate('0000', false);   -- 6th
    raise notice 'FAIL PIN-T3: 6th admin attempt was NOT locked out (ledger=%)', cnt;
  exception when others then locked := true;
  end;
  if cnt = 5 and locked
    then raise notice 'PASS PIN-T3: wrong admin PIN persists across txns and locks out';
    else raise notice 'FAIL PIN-T3: ledger=% (want 5), locked=%', cnt, locked;
  end if;
end $$;

-- ===== PIN-T4: a correct admin PIN opens an elevation window =====
delete from public.pin_attempts;
delete from public.admin_elevations;
do $$
declare exp timestamptz; nwin int;
begin
  select public.admin_elevate('9999', false) into exp;   -- correct owner PIN
  select count(*) into nwin from public.admin_elevations
    where company_id = public.current_company_id() and expires_at > now();
  if exp is not null and nwin = 1
    then raise notice 'PASS PIN-T4: correct admin PIN opens an elevation window';
    else raise notice 'FAIL PIN-T4: expiry=% windows=% (want non-null and 1)', exp, nwin;
  end if;
end $$;
