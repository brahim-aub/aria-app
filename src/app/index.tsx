import { Redirect } from 'expo-router';

import { useAppStore } from '@/store/app-store';

export default function Index() {
  const profile = useAppStore((state) => state.profile);
  return <Redirect href={profile ? '/(tabs)' : '/onboarding'} />;
}
