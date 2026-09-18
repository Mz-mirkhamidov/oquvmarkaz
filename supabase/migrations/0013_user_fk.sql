-- Qalqon — 0013_user_fk.sql
-- Restores the foreign keys that used to reference app_users(id) and were
-- silently dropped by 0011_auth_extra.sql's `drop table app_users cascade`
-- (Postgres cascades a DROP TABLE to constraints that reference it, not just
-- to dependent tables). Found while fixing tests/security's resetDatabase()
-- to run cleanly against the post-auth-rebuild schema (A6) — these columns
-- had been quietly unconstrained since 0011.
--
-- All seven now point at "user"(id) instead, same on-delete semantics as
-- before. Verified against production (mxxsmgkpdgdexodvdpzb) first: zero
-- rows in any of these columns reference an id missing from "user".

alter table groups
  add constraint groups_teacher_id_fkey
  foreign key (teacher_id) references "user"(id) on delete set null;

alter table children
  add constraint children_photo_consent_by_fkey
  foreign key (photo_consent_by) references "user"(id);

alter table attendance_days
  add constraint attendance_days_closed_by_fkey
  foreign key (closed_by) references "user"(id);

alter table attendance_days
  add constraint attendance_days_reopened_by_fkey
  foreign key (reopened_by) references "user"(id);

alter table attendance_records
  add constraint attendance_records_marked_by_fkey
  foreign key (marked_by) references "user"(id);

alter table state_checks
  add constraint state_checks_checked_by_fkey
  foreign key (checked_by) references "user"(id);

alter table disputes
  add constraint disputes_created_by_fkey
  foreign key (created_by) references "user"(id);
