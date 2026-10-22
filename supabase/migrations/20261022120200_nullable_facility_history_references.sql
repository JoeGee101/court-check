begin;

-- Facility deletion preserves historical activity and detaches it from the
-- deleted facility via ON DELETE SET NULL. These references must be nullable
-- for that FK action; context checks still require a facility-name snapshot.
alter table public.check_ins
  alter column facility_id drop not null;

alter table public.facility_statuses
  alter column facility_id drop not null;

commit;
