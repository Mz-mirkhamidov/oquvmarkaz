-- Qalqon — 0009_dispute_items_hardening.sql
-- dispute_items_write (0002_rls.sql) only checked that dispute_id belonged
-- to the caller's org — check_id was never verified, so a manager who
-- somehow learned another org's state_checks id could attach it to their
-- own dispute. The application layer (lib/disputes/create.ts) already
-- filters check_id candidates by org before inserting, but TZ §11.3 wants
-- RLS itself to hold the line, not just the code calling it — closing that
-- gap here the same way 0007 hardened the SQL functions.

drop policy dispute_items_write on dispute_items;
create policy dispute_items_write on dispute_items for all
  using (
    is_manager()
    and dispute_id in (select id from disputes where org_id = auth_org_id())
    and check_id in (select id from state_checks where org_id = auth_org_id())
  )
  with check (
    dispute_id in (select id from disputes where org_id = auth_org_id())
    and check_id in (select id from state_checks where org_id = auth_org_id())
  );
