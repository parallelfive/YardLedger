-- Harden the mandatory-hold enforcement (NM 57-30-11 / 57-30-2.4).
--
-- The original enforce_receipt_hold compared new.disposed_at against
-- new.hold_until in the SAME update — so a caller could simply lower
-- hold_until (or null it) in the same statement that sets disposed_at and
-- walk right past the hold. Pin hold_until immutable after creation and
-- compare disposal against the ORIGINAL (old) hold window.

create or replace function public.enforce_receipt_hold()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- hold_until is set once at insert by set_receipt_compliance and may not
  -- be edited afterward — otherwise the hold is trivially bypassable.
  if new.hold_until is distinct from old.hold_until then
    raise exception
      'hold_until is immutable once a receipt is created (NM 57-30).';
  end if;

  if new.disposed_at is not null
     and old.disposed_at is null
     and old.hold_until is not null
     and new.disposed_at < old.hold_until then
    raise exception
      'Material is on a mandatory hold until % and cannot be disposed/resold yet (NM 57-30-11 / 57-30-2.4).',
      old.hold_until;
  end if;

  return new;
end;
$$;
