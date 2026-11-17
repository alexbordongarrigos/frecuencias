import { supabase } from './starseedAuth';
import { OmniProfile } from '../types';

export const fetchCommunityProfiles = async (_currentUserId?: string): Promise<OmniProfile[]> => {
  const { data: profiles, error } = await supabase
    .from('os_profiles')
    .select('user_id, display_name, avatar_url, cover_url');

  if (error || !profiles) {
    console.error("Error fetching profiles:", error);
    return [];
  }

  const [{ data: particles }, { data: resonances }] = await Promise.all([
    supabase
      .from('omni_presets')
      .select('author_id')
      .eq('is_public', true),
    supabase
      .from('omni_resonances')
      .select('to_user_id')
  ]);

  return profiles.map(p => {
    const particlesCount = particles?.filter(pt => pt.author_id === p.user_id).length || 0;
    const resonancesCount = resonances?.filter((r: any) => r.to_user_id === p.user_id).length || 0;

    return {
      id: p.user_id,
      displayName: p.display_name || 'Explorador Cuántico',
      avatar_url: p.avatar_url,
      cover_url: p.cover_url,
      status: 'offline',
      lastActive: Date.now(),
      particlesCount,
      resonancesCount,
    };
  });
};

export const resonateWithUser = async (followerId: string, followingId: string) => {
  const { error } = await supabase
    .from('omni_resonances')
    .insert({ from_user_id: followerId, to_user_id: followingId });

  if (error) throw error;
};

export const unresonateWithUser = async (followerId: string, followingId: string) => {
  const { error } = await supabase
    .from('omni_resonances')
    .delete()
    .eq('from_user_id', followerId)
    .eq('to_user_id', followingId);

  if (error) throw error;
};

export const checkResonance = async (followerId: string, followingId: string) => {
  const { data, error } = await supabase
    .from('omni_resonances')
    .select('id')
    .eq('from_user_id', followerId)
    .eq('to_user_id', followingId)
    .maybeSingle();

  if (error) return false;
  return !!data;
};
