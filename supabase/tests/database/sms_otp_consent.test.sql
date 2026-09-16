begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(25);

select has_table(
  'public',
  'sms_otp_consent_events',
  'SMS OTP consent evidence table exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.sms_otp_consent_events'::regclass),
  'SMS OTP consent evidence has RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'public.sms_otp_consent_events', 'select,insert,update,delete'),
  'anonymous clients have no direct consent-table privileges'
);

select ok(
  not has_table_privilege(
    'authenticated',
    'public.sms_otp_consent_events',
    'select,insert,update,delete'
  ),
  'authenticated clients have no direct consent-table privileges'
);

select ok(
  to_regprocedure('public.record_sms_otp_consent(text,text)') is not null,
  'consent-recording RPC exists'
);

select ok(
  (
    select
      functions.prosecdef
      and pg_get_userbyid(functions.proowner) not in ('anon', 'authenticated')
      and functions.proconfig @> array['search_path=""']::text[]
    from pg_proc as functions
    where functions.oid = 'public.record_sms_otp_consent(text,text)'::regprocedure
  ),
  'consent RPC has a trusted owner, SECURITY DEFINER, and an empty search path'
);

select ok(
  has_function_privilege(
    'anon',
    'public.record_sms_otp_consent(text,text)',
    'execute'
  ),
  'anonymous clients may execute the narrow consent RPC'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.record_sms_otp_consent(text,text)',
    'execute'
  ),
  'authenticated clients cannot execute the pre-auth consent RPC'
);

select ok(
  not has_table_privilege(
    'service_role',
    'public.sms_otp_consent_events',
    'select,insert,update,delete'
  )
  and not has_function_privilege(
    'service_role',
    'public.record_sms_otp_consent(text,text)',
    'execute'
  ),
  'service role receives no unnecessary consent table or RPC privileges'
);

select ok(
  not exists (
    select 1
    from pg_proc as functions
    cross join lateral aclexplode(
      coalesce(functions.proacl, acldefault('f', functions.proowner))
    ) as privileges
    where functions.oid = 'public.record_sms_otp_consent(text,text)'::regprocedure
      and privileges.grantee = 0
      and privileges.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no execute privilege on the consent RPC'
);

select ok(
  (
    select functions.prorettype = 'void'::regtype
    from pg_proc as functions
    where functions.oid = 'public.record_sms_otp_consent(text,text)'::regprocedure
  ),
  'consent RPC returns no stored consent data'
);

select ok(
  not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sms_otp_consent_events'
  ),
  'consent evidence is not published to Realtime'
);

select ok(
  exists (
    select 1
    from pg_constraint as constraints
    where constraints.conrelid = 'public.sms_otp_consent_events'::regclass
      and constraints.contype = 'u'
      and pg_get_constraintdef(constraints.oid) = 'UNIQUE (request_key)'
  ),
  'request keys have a database uniqueness backstop'
);

set local role anon;

select throws_ok(
  $$select * from public.sms_otp_consent_events$$,
  '42501',
  'permission denied for table sms_otp_consent_events',
  'anonymous clients cannot read consent records'
);

select throws_ok(
  $$
    insert into public.sms_otp_consent_events (
      phone_e164,
      disclosure_version,
      source,
      request_key
    ) values (
      '+17025550134',
      'sms_otp_v1',
      'courtcheck_mobile_phone_auth',
      'directinsertattempt00'
    )
  $$,
  '42501',
  'permission denied for table sms_otp_consent_events',
  'anonymous clients cannot insert consent records directly'
);

select throws_ok(
  $$select public.record_sms_otp_consent('7025550134', 'abcdefghijklmnopqrst')$$,
  '22023',
  'Invalid phone number',
  'RPC rejects a non-E.164 phone number'
);

select throws_ok(
  $$select public.record_sms_otp_consent('+17025550134', 'short')$$,
  '22023',
  'Invalid consent request',
  'RPC rejects an invalid idempotency key'
);

select lives_ok(
  $$select public.record_sms_otp_consent('+17025550134', 'abcdefghijklmnopqrst')$$,
  'anonymous RPC records valid pre-auth consent evidence'
);

select lives_ok(
  $$select public.record_sms_otp_consent('+17025550134', 'abcdefghijklmnopqrst')$$,
  'repeating the same attempt is idempotent'
);

select throws_ok(
  $$select public.record_sms_otp_consent('+923001234567', 'abcdefghijklmnopqrst')$$,
  '22023',
  'Invalid consent request',
  'a request key cannot be replayed for another phone'
);

reset role;

select ok(
  exists (
    select 1
    from public.sms_otp_consent_events
    where phone_e164 = '+17025550134'
      and consented_at <= statement_timestamp()
      and disclosure_version = 'sms_otp_v1'
      and source = 'courtcheck_mobile_phone_auth'
  ),
  'database assigns the expected timestamp, disclosure, and source'
);

select is(
  (
    select count(*)
    from public.sms_otp_consent_events
    where request_key = 'abcdefghijklmnopqrst'
  ),
  1::bigint,
  'idempotent retry creates only one evidence row'
);

select is(
  (
    select count(*)
    from public.sms_otp_consent_events
    where phone_e164 = '+923001234567'
  ),
  0::bigint,
  'cross-phone request-key replay creates no record'
);

set local role authenticated;

select throws_ok(
  $$select * from public.sms_otp_consent_events$$,
  '42501',
  'permission denied for table sms_otp_consent_events',
  'authenticated clients cannot read consent records'
);

select throws_ok(
  $$select public.record_sms_otp_consent('+17025550134', 'zyxwvutsrqponmlkjihg')$$,
  '42501',
  'permission denied for function record_sms_otp_consent',
  'authenticated clients cannot execute the pre-auth consent RPC'
);

reset role;

select * from finish();
rollback;
