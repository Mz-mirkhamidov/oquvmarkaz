-- Qalqon — 0006_attendance_corrections.sql
--
-- §6.6/§11.6 give attendance_records a supersedes_id/is_current/
-- correction_note append-only correction chain, and say the only allowed
-- "change" is through a dedicated SECURITY DEFINER function. But two
-- things the TZ describes never quite meet:
--
--   - F-D2: tapping an already-marked child's card a second time changes
--     their status (same open day, no note).
--   - F-D8: a past/closed day can never be edited, only appended to with
--     a noted correction.
--
-- and §7.5's own `attendance.mark` pseudocode is a plain INSERT with no
-- supersede step, which can't be literally what happens: the
-- uq_record_current unique index allows only one is_current row per
-- (day_id, child_id), so a same-day re-tap would violate it otherwise.
--
-- Resolution implemented here: both cases go through the same
-- supersede_attendance_record() function below. attendance.mark calls it
-- with correction_note = null (a casual same-day re-tap, blocked once the
-- day is closed by guard_closed_day). attendance.correct calls it with a
-- required correction_note, and is the only path allowed to append to a
-- closed day.

create or replace function guard_closed_day() returns trigger
language plpgsql as $$
declare
  st day_status;
begin
  select status into st from attendance_days where id = new.day_id;
  if st = 'closed' and new.supersedes_id is null then
    raise exception 'DAY_CLOSED' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function supersede_attendance_record(
  p_new_id           uuid,
  p_org_id           uuid,
  p_day_id           uuid,
  p_child_id         uuid,
  p_status           attend_status,
  p_marked_by        uuid,
  p_device_id        uuid,
  p_client_marked_at timestamptz,
  p_note             text default null,
  p_correction_note  text default null
) returns attendance_records
language plpgsql
security definer
set search_path = public
as $$
declare
  old_id uuid;
  result attendance_records;
  claim_org uuid := nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', '')::uuid;
begin
  -- SECURITY DEFINER bypasses RLS entirely, so the org check has to be
  -- done by hand here (TZ §11.3's "two-layer defense" rule).
  if claim_org is null or claim_org is distinct from p_org_id then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from children where id = p_child_id and org_id = p_org_id
  ) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select id into old_id from attendance_records
    where day_id = p_day_id and child_id = p_child_id and is_current
    for update;

  if old_id is not null then
    update attendance_records set is_current = false where id = old_id;
  end if;

  insert into attendance_records (
    id, org_id, day_id, child_id, status, marked_by, device_id,
    client_marked_at, note, supersedes_id, correction_note, is_current
  ) values (
    p_new_id, p_org_id, p_day_id, p_child_id, p_status, p_marked_by, p_device_id,
    p_client_marked_at, p_note, old_id, p_correction_note, true
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function supersede_attendance_record(
  uuid, uuid, uuid, uuid, attend_status, uuid, uuid, timestamptz, text, text
) from public, anon;
grant execute on function supersede_attendance_record(
  uuid, uuid, uuid, uuid, attend_status, uuid, uuid, timestamptz, text, text
) to authenticated;
