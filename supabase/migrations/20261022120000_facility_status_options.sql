begin;

alter type public.facility_status_type add value if not exists 'league_in_progress';
alter type public.facility_status_type add value if not exists 'need_players';
alter type public.facility_status_type add value if not exists 'open_courts';
alter type public.facility_status_type add value if not exists 'short_wait';
alter type public.facility_status_type add value if not exists 'long_wait';
alter type public.facility_status_type add value if not exists 'lights_out_of_order';

commit;
