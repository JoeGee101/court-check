begin;

create table public.sms_otp_consent_events (
  id uuid primary key default gen_random_uuid(),
  phone_e164 text not null,
  consented_at timestamptz not null default statement_timestamp(),
  disclosure_version text not null default 'sms_otp_v1',
  source text not null default 'courtcheck_mobile_phone_auth',
  request_key text not null,
  constraint sms_otp_consent_phone_e164_valid
    check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  constraint sms_otp_consent_disclosure_version_valid
    check (disclosure_version = 'sms_otp_v1'),
  constraint sms_otp_consent_source_valid
    check (source = 'courtcheck_mobile_phone_auth'),
  constraint sms_otp_consent_request_key_valid
    check (request_key ~ '^[a-z0-9]{20,64}$'),
  constraint sms_otp_consent_request_key_unique
    unique (request_key)
);

comment on table public.sms_otp_consent_events is
  'Append-only evidence that a user requested a CourtCheck SMS authentication code.';
comment on column public.sms_otp_consent_events.phone_e164 is
  'Private normalized destination needed to produce consent evidence for a specific recipient.';
comment on column public.sms_otp_consent_events.disclosure_version is
  'sms_otp_v1: I agree to receive a verification code by SMS at this number. Standard message and data rates may apply.';
comment on column public.sms_otp_consent_events.request_key is
  'Opaque client attempt identifier used only to make consent recording idempotent.';

create index sms_otp_consent_events_phone_time_idx
  on public.sms_otp_consent_events (phone_e164, consented_at desc);

alter table public.sms_otp_consent_events enable row level security;

revoke all on table public.sms_otp_consent_events
  from public, anon, authenticated, service_role;

create or replace function public.record_sms_otp_consent(
  p_phone_e164 text,
  p_request_key text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone_e164 text := btrim(p_phone_e164);
  v_request_key text := lower(btrim(p_request_key));
  v_existing_phone text;
begin
  if p_phone_e164 is null
    or p_phone_e164 is distinct from v_phone_e164
    or v_phone_e164 !~ '^\+[1-9][0-9]{7,14}$'
  then
    raise exception 'Invalid phone number' using errcode = '22023';
  end if;

  if p_request_key is null
    or p_request_key is distinct from v_request_key
    or v_request_key !~ '^[a-z0-9]{20,64}$'
  then
    raise exception 'Invalid consent request' using errcode = '22023';
  end if;

  -- Serialize only identical retries. Never let anonymous calls consume a
  -- phone-number quota that could block the legitimate owner of that number.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_request_key, 0)
  );

  select events.phone_e164
  into v_existing_phone
  from public.sms_otp_consent_events as events
  where events.request_key = v_request_key;

  if found then
    if v_existing_phone is distinct from v_phone_e164 then
      raise exception 'Invalid consent request' using errcode = '22023';
    end if;

    return;
  end if;

  insert into public.sms_otp_consent_events (
    phone_e164,
    disclosure_version,
    source,
    request_key
  )
  values (
    v_phone_e164,
    'sms_otp_v1',
    'courtcheck_mobile_phone_auth',
    v_request_key
  );
end;
$$;

revoke all on function public.record_sms_otp_consent(text, text)
  from public, anon, authenticated, service_role;

grant usage on schema public to anon;
grant execute on function public.record_sms_otp_consent(text, text) to anon;

commit;
