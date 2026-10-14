import { Redirect } from 'expo-router';

import { useAuth } from '@/hooks/use-auth';

export default function Index() {
  const { status } = useAuth();
  return <Redirect href={status === 'authenticated' ? '/dashboard' : '/login'} />;
}
