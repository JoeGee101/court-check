import { getSupabaseClient } from '@/lib/supabase/client';

export type FacilityActivityState =
  | 'courts_closed'
  | 'tournament_at_courts'
  | 'active'
  | 'quiet';

export type FacilitySummary = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  hours_text: string;
  court_count: number;
  has_lights: boolean;
  has_restrooms: boolean;
  has_water: boolean;
  verified_by: string | null;
  active_check_in_count: number;
  activity_state: FacilityActivityState;
};

export async function listFacilities(search: string): Promise<FacilitySummary[]> {
  const client = getSupabaseClient();
  const normalizedSearch = search.trim();
  const { data, error } = await client.rpc('list_facilities', {
    p_search: normalizedSearch || null,
    p_min_latitude: null,
    p_min_longitude: null,
    p_max_latitude: null,
    p_max_longitude: null,
  });

  if (error || !Array.isArray(data)) {
    throw new Error('Facility list request failed.');
  }

  return data as FacilitySummary[];
}
