-- ===== Seed =====
insert into public.companies(id, name, prefix) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Yard A', 'YA-2026');
insert into public.users(id, supabase_id, company_id, role, is_active, name) values
  ('11111111-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
     'aaaaaaaa-0000-0000-0000-000000000001', 'owner', true, 'Owner A');
select set_config('app.current_uid', '00000000-0000-0000-0000-0000000000a1', false);

-- ===== RT1: writing reporting creds with NO elevation window is rejected (#44) =====
do $$
begin
  begin
    perform public.upsert_reporting_config('leadsonline','sftp.x.com',22,'user','secretpw','/in',true);
    raise notice 'FAIL RT1: reporting-config write allowed with NO owner elevation';
  exception when others then
    raise notice 'PASS RT1: write rejected without owner elevation';
  end;
end $$;

-- ===== RT2: with an OWNER elevation window, the write succeeds + password goes to vault =====
do $$
declare nrow int; nsec int;
begin
  insert into public.admin_elevations(company_id, user_id, expires_at, require_owner)
    values (public.current_company_id(), '11111111-0000-0000-0000-0000000000a1',
            now() + interval '5 min', true);
  perform public.upsert_reporting_config('leadsonline','sftp.x.com',22,'user','secretpw','/in',true);
  select count(*) into nrow from public.company_reporting_config
    where company_id = public.current_company_id() and sftp_host = 'sftp.x.com';
  select count(*) into nsec from vault.secrets;
  if nrow = 1 and nsec = 1
    then raise notice 'PASS RT2: owner-elevated write succeeds and password stored in vault';
    else raise notice 'FAIL RT2: config rows=% (want 1), vault secrets=% (want 1)', nrow, nsec;
  end if;
exception when others then
  raise notice 'FAIL RT2: owner-elevated write unexpectedly raised (%)', sqlerrm;
end $$;

-- ===== RT3: an ADMIN-only (non-owner) window is NOT enough — owner grade required =====
do $$
begin
  delete from public.admin_elevations;
  insert into public.admin_elevations(company_id, user_id, expires_at, require_owner)
    values (public.current_company_id(), '11111111-0000-0000-0000-0000000000a1',
            now() + interval '5 min', false);   -- admin-grade only
  begin
    perform public.upsert_reporting_config('leadsonline','h2',22,'u','pw','/in',true);
    raise notice 'FAIL RT3: an admin-only (non-owner) elevation was accepted';
  exception when others then
    raise notice 'PASS RT3: admin-only elevation rejected — owner grade required';
  end;
end $$;
