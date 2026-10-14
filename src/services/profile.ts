import { supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
}

/**
 * Read the signed-in member's own profile row.
 * Row Level Security (see supabase/migrations) enforces the hbplus.fit rule on the server,
 * so this returns nothing for any session that is not an authorized company account.
 */
export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error('profile_unavailable');
  if (!data) return null;

  return {
    id: String(data.id),
    email: String(data.email),
    fullName: typeof data.full_name === 'string' ? data.full_name : null,
    createdAt: String(data.created_at),
  };
}
