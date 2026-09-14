import { Button } from 'react-native';

import { useAuth } from '@/features/auth/session-provider';

export function SignOutButton() {
  const { signOut } = useAuth();

  return <Button onPress={() => void signOut()} title="Sign out" />;
}
