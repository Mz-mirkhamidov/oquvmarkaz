-- Qalqon — 0004_org_slug.sql
-- TZ §7.4's PIN login request body carries `org_slug`, but §6.2's
-- `organizations` table never defines that column. Adding it here: a
-- public, non-secret identifier used only to route a shared classroom
-- tablet's PIN screen to the right org before any session exists (the
-- same job a `?org=` URL param would do, just stable and shareable).

alter table organizations add column slug text;
alter table organizations add constraint uq_organizations_slug unique (slug);
create index idx_organizations_slug on organizations(slug) where slug is not null;
