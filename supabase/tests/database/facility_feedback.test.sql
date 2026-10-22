begin;

create extension if not exists pgtap with schema extensions;
set local search_path = extensions, public, pg_catalog;

select plan(14);

select ok(
  to_regclass('public.facility_feedback') is not null,
  'facility feedback storage exists'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.facility_feedback'::regclass),
  'facility feedback has RLS enabled'
);
select ok(
  not has_table_privilege('authenticated', 'public.facility_feedback', 'select,insert,update,delete'),
  'players cannot directly access facility feedback rows'
);
select ok(
  has_function_privilege('authenticated', 'public.submit_facility_feedback(text,uuid,text)', 'execute')
    and not has_function_privilege('anon', 'public.submit_facility_feedback(text,uuid,text)', 'execute'),
  'only authenticated clients can submit feedback'
);
select ok(
  has_function_privilege('authenticated', 'public.admin_list_facility_feedback(integer,integer)', 'execute')
    and has_function_privilege('authenticated', 'public.admin_set_facility_feedback_status(uuid,text)', 'execute'),
  'authenticated clients can call admin feedback RPCs which enforce admin authorization'
);
select ok(
  not has_function_privilege('anon', 'public.admin_list_facility_feedback(integer,integer)', 'execute')
    and not has_function_privilege('anon', 'public.admin_set_facility_feedback_status(uuid,text)', 'execute'),
  'anonymous clients cannot invoke admin feedback RPCs'
);
select ok(
  (
    select bool_and(functions.prosecdef and functions.proconfig @> array['search_path=""']::text[])
    from pg_proc as functions
    where functions.oid in (
      'public.submit_facility_feedback(text,uuid,text)'::regprocedure,
      'public.admin_list_facility_feedback(integer,integer)'::regprocedure,
      'public.admin_set_facility_feedback_status(uuid,text)'::regprocedure
    )
  ),
  'feedback RPCs are SECURITY DEFINER with an empty search path'
);

insert into auth.users (id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('33000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', '+15555550401', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('33000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', '+15555550402', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
update public.user_roles set role = 'admin' where user_id = '33000000-0000-4000-8000-000000000002';
update public.profiles
set adult_confirmed_at = now(), experience_level = 'beginner', onboarding_completed_at = now()
where id = '33000000-0000-4000-8000-000000000001';

set local role authenticated;
set local request.jwt.claim.role = 'authenticated';
set local request.jwt.claim.sub = '33000000-0000-4000-8000-000000000001';

select lives_ok(
  $$select public.submit_facility_feedback('suggest_facility', null, 'Please add Sunset Park courts.')$$,
  'a signed-in player can submit a new-facility suggestion'
);
reset role;
select is(
  (select count(*) from public.facility_feedback where reporter_user_id = '33000000-0000-4000-8000-000000000001' and category = 'suggest_facility'),
  1::bigint,
  'feedback reporter is derived from auth.uid()'
);
select set_config(
  'courtcheck.test_feedback_id',
  (select id::text from public.facility_feedback where category = 'suggest_facility' limit 1),
  true
);
set local role authenticated;
select throws_ok(
  $$select public.submit_facility_feedback('suggest_facility', '33000000-0000-4000-8000-000000000002', 'Spoofed facility.')$$,
  '22023',
  'New park suggestions cannot include a facility ID',
  'a suggestion cannot attach an arbitrary facility identifier'
);
select throws_ok(
  $$select public.admin_list_facility_feedback(50, 0)$$,
  '42501',
  'Administrator role required',
  'normal players cannot read submitted feedback'
);

set local request.jwt.claim.sub = '33000000-0000-4000-8000-000000000002';
select ok(
  (public.admin_list_facility_feedback(50, 0) -> 0) ?& array['id','category','message','status','createdAt','reporterUsername'],
  'admin feedback read returns review fields without account identifiers'
);
select lives_ok(
  $$select public.admin_set_facility_feedback_status(current_setting('courtcheck.test_feedback_id')::uuid, 'resolved')$$,
  'admin can resolve feedback'
);
reset role;
select is(
  (select status from public.facility_feedback where id = current_setting('courtcheck.test_feedback_id')::uuid),
  'resolved',
  'admin resolution is persisted'
);

reset role;
reset request.jwt.claim.role;
reset request.jwt.claim.sub;
select * from finish();
rollback;
