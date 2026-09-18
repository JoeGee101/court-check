-- PostgreSQL requires enum values added in a transaction to be committed
-- before later statements may reference them. Keep this migration separate
-- from the account-deletion lifecycle migration.
begin;

alter type public.checkout_reason
  add value if not exists 'account_deleted';

alter type public.facility_status_end_reason
  add value if not exists 'account_deleted';

commit;
