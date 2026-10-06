begin;

-- New anonymous usernames stay compact enough for mobile player rows while
-- retaining one million generated combinations before collision retries.
create or replace function public.generate_anonymous_username()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_adjectives constant text[] := array[
    'Ace', 'Bold', 'Cool', 'Fast', 'Keen',
    'Lucky', 'Swift', 'True', 'Zippy', 'Agile'
  ];
  v_nouns constant text[] := array[
    'Court', 'Dink', 'Hawk', 'Otter', 'Paddle',
    'Rally', 'Serve', 'Smash', 'Spin', 'Volley'
  ];
begin
  return
    v_adjectives[1 + floor(random() * array_length(v_adjectives, 1))::integer]
    || v_nouns[1 + floor(random() * array_length(v_nouns, 1))::integer]
    || lpad(floor(random() * 10000)::integer::text, 4, '0');
end;
$$;

revoke all on function public.generate_anonymous_username()
from public, anon, authenticated;

-- Existing usernames are also system-generated. This one-time migration is
-- deliberately the only exception to their normal immutable-profile rule.
-- The unique index remains active while each profile receives a new compact
-- name; a collision retries using the same bounded pattern as account setup.
alter table public.profiles disable trigger profiles_keep_anonymous_username;

do $$
declare
  v_profile record;
  v_attempt integer;
begin
  for v_profile in
    select profiles.id
    from public.profiles as profiles
    order by profiles.id
  loop
    v_attempt := 0;

    loop
      v_attempt := v_attempt + 1;

      begin
        update public.profiles as profiles
        set anonymous_username = public.generate_anonymous_username()
        where profiles.id = v_profile.id;
        exit;
      exception
        when unique_violation then
          if v_attempt >= 20 then
            raise exception 'Unable to generate a unique anonymous username';
          end if;
      end;
    end loop;
  end loop;
end;
$$;

alter table public.profiles enable trigger profiles_keep_anonymous_username;

alter table public.profiles
  add constraint profiles_anonymous_username_max_length
  check (char_length(anonymous_username) <= 15);

commit;
