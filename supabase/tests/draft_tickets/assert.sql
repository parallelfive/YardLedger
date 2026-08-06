-- ===== Seed (as superuser) =====
insert into public.companies(id, name, prefix) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Yard A', 'YA-2026'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Yard B', 'YB-2026');

insert into public.users(id, supabase_id, company_id, role, is_active, name) values
  ('11111111-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a1',
     'aaaaaaaa-0000-0000-0000-000000000001', 'owner',  true, 'Owner A (session)'),
  ('22222222-0000-0000-0000-0000000000a2', null,
     'aaaaaaaa-0000-0000-0000-000000000001', 'worker', true, 'Worker A'),
  ('33333333-0000-0000-0000-0000000000b3', null,
     'bbbbbbbb-0000-0000-0000-000000000002', 'worker', true, 'Worker B (other tenant)');

insert into public.receipts(id, company_id) values
  ('44444444-0000-0000-0000-0000000000a4', 'aaaaaaaa-0000-0000-0000-000000000001');

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.draft_tickets to authenticated;
grant select on public.users, public.companies, public.receipts to authenticated;

-- ===== Become the shared terminal: session = Owner A (company A) =====
set role authenticated;
select set_config('app.current_uid', '00000000-0000-0000-0000-0000000000a1', false);

-- ===== Tests =====

-- T1: claim numbers auto-assign sequentially (#112 trigger)
do $$
declare c1 text; c2 text;
begin
  insert into public.draft_tickets(worker_id, subtotal, weight)
    values ('22222222-0000-0000-0000-0000000000a2', 10, 5) returning claim_number into c1;
  insert into public.draft_tickets(worker_id, subtotal, weight)
    values ('22222222-0000-0000-0000-0000000000a2', 20, 8) returning claim_number into c2;
  if c1 = 'T-1' and c2 = 'T-2'
    then raise notice 'PASS T1: claim numbers auto-assign (% then %)', c1, c2;
    else raise notice 'FAIL T1: expected T-1/T-2, got %/%', c1, c2;
  end if;
end $$;

-- T2: duplicate claim number blocked by the unique index (#112 belt-and-suspenders)
do $$
begin
  begin
    insert into public.draft_tickets(worker_id, claim_number, subtotal, weight)
      values ('22222222-0000-0000-0000-0000000000a2', 'T-1', 1, 1);
    raise notice 'FAIL T2: duplicate claim number T-1 was ACCEPTED';
  exception when unique_violation then
    raise notice 'PASS T2: duplicate claim number rejected (unique_violation)';
  end;
end $$;

-- T3: cross-tenant / bogus worker_id rejected by the INSERT policy (#114)
do $$
begin
  begin
    insert into public.draft_tickets(worker_id, subtotal, weight)
      values ('33333333-0000-0000-0000-0000000000b3', 5, 5);  -- Worker B, company B
    raise notice 'FAIL T3: another tenant''s worker_id was ACCEPTED';
  exception when others then
    raise notice 'PASS T3: cross-tenant worker_id rejected (%)', sqlstate;
  end;
end $$;

-- T4: negative financial payload rejected (#114b)
do $$
begin
  begin
    insert into public.draft_tickets(worker_id, subtotal, weight)
      values ('22222222-0000-0000-0000-0000000000a2', -5, 5);
    raise notice 'FAIL T4: negative subtotal was ACCEPTED';
  exception when others then
    raise notice 'PASS T4: negative subtotal rejected (%)', sqlerrm;
  end;
end $$;

-- T5: finalize allowed (pending->finalized), then the finalized row is frozen (#113)
do $$
declare d uuid;
begin
  insert into public.draft_tickets(worker_id, subtotal, weight)
    values ('22222222-0000-0000-0000-0000000000a2', 30, 12) returning id into d;
  update public.draft_tickets
    set status = 'finalized', receipt_id = '44444444-0000-0000-0000-0000000000a4', updated_at = now()
    where id = d;
  raise notice 'PASS T5a: finalize (pending->finalized + receipt link) accepted';
  begin
    update public.draft_tickets set subtotal = 999 where id = d;
    raise notice 'FAIL T5b: editing a FINALIZED ticket was accepted';
  exception when others then
    raise notice 'PASS T5b: editing a finalized ticket rejected';
  end;
exception when others then
  raise notice 'FAIL T5a: legit finalize was rejected (%)', sqlerrm;
end $$;

-- T6: void allowed (pending->voided), then the voided row is frozen (#113)
do $$
declare e uuid;
begin
  insert into public.draft_tickets(worker_id, subtotal, weight)
    values ('22222222-0000-0000-0000-0000000000a2', 7, 3) returning id into e;
  update public.draft_tickets set status = 'voided', updated_at = now() where id = e;
  raise notice 'PASS T6a: void (pending->voided) accepted';
  begin
    update public.draft_tickets set status = 'pending' where id = e;
    raise notice 'FAIL T6b: reviving a VOIDED ticket was accepted';
  exception when others then
    raise notice 'PASS T6b: editing a voided ticket rejected';
  end;
exception when others then
  raise notice 'FAIL T6a: legit void was rejected (%)', sqlerrm;
end $$;

-- T7: pending drafts deletable; finalized (audit) rows are not (#113b DELETE policy)
do $$
declare f uuid; g uuid; n int;
begin
  insert into public.draft_tickets(worker_id, subtotal, weight)
    values ('22222222-0000-0000-0000-0000000000a2', 4, 2) returning id into f;
  delete from public.draft_tickets where id = f;
  get diagnostics n = row_count;
  if n = 1 then raise notice 'PASS T7a: pending draft deletable';
  else raise notice 'FAIL T7a: pending draft NOT deletable (rows=%)', n; end if;

  insert into public.draft_tickets(worker_id, subtotal, weight)
    values ('22222222-0000-0000-0000-0000000000a2', 9, 4) returning id into g;
  update public.draft_tickets set status = 'finalized',
    receipt_id = '44444444-0000-0000-0000-0000000000a4' where id = g;
  delete from public.draft_tickets where id = g;
  get diagnostics n = row_count;
  if n = 0 then raise notice 'PASS T7b: finalized (audit) row NOT deletable';
  else raise notice 'FAIL T7b: finalized row was deleted (rows=%)', n; end if;
end $$;

-- T8: created_by_session stamped from the session, not the client (#114a)
do $$
declare sess uuid;
begin
  insert into public.draft_tickets(worker_id, subtotal, weight)
    values ('22222222-0000-0000-0000-0000000000a2', 6, 6) returning created_by_session into sess;
  if sess = '11111111-0000-0000-0000-0000000000a1'
    then raise notice 'PASS T8: created_by_session stamped to the session user (Owner A)';
    else raise notice 'FAIL T8: created_by_session = % (expected Owner A id)', sess;
  end if;
end $$;

reset role;
