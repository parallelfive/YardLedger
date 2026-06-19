-- 1. Scope access-code uniqueness per company.
--
-- access_codes.code carried a GLOBAL unique constraint, so the 6-digit code
-- namespace was shared across every tenant. As companies multiply this couples
-- unrelated yards: create_access_code() retries on unique_violation and throws
-- after 10 collisions (a cross-tenant availability coupling), and a collision
-- leaks that *some* company already holds a given code. validate_access_code()
-- already filters by company_id, so per-company uniqueness is the correct and
-- safe scope. (invite_codes intentionally stays globally unique — the code is
-- the only thing a new signup provides and must resolve to exactly one company.)

alter table public.access_codes
  drop constraint if exists access_codes_code_key;
alter table public.access_codes
  add constraint access_codes_company_code_key unique (company_id, code);

-- 2. Tighten who can write the compliance upload log.
--
-- The log is an append-only record of "reported to the state." The old INSERT
-- policy let any authenticated member insert arbitrary rows — including a
-- forged status='success' / method='sftp' entry fabricating that an automated
-- transmission happened. Restrict client inserts to admins logging the MANUAL
-- workflow only; automated 'sftp' entries are written by the edge function
-- under the service role, which bypasses RLS.

drop policy if exists "Members log uploads for their company"
  on public.compliance_upload_log;

create policy "Admins log manual uploads for their company"
  on public.compliance_upload_log for insert
  to authenticated
  with check (
    public.is_admin()
    and company_id = public.current_company_id()
    and method = 'manual'
  );
