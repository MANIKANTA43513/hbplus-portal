import { useEffect, useState } from 'react';

import { fetchOwnProfile, type Profile } from '@/services/profile';

export type ProfileState =
  | { status: 'loading'; profile: null }
  | { status: 'ready'; profile: Profile | null }
  | { status: 'unavailable'; profile: null };

/** Loads the member's profile row; access is enforced by Row Level Security on the server. */
export function useProfile(userId: string): ProfileState {
  const [state, setState] = useState<ProfileState>({ status: 'loading', profile: null });

  useEffect(() => {
    let active = true;
    fetchOwnProfile(userId)
      .then((profile) => active && setState({ status: 'ready', profile }))
      .catch(() => active && setState({ status: 'unavailable', profile: null }));
    return () => {
      active = false;
    };
  }, [userId]);

  return state;
}
