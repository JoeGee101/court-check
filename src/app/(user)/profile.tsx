import { Link } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { SignOutButton } from '@/features/auth/sign-out-button';
import { useAuth } from '@/features/auth/session-provider';

export default function ProfileScreen() {
  const { profile, role } = useAuth();

  return (
    <PlaceholderScreen
      description={`Signed in as ${profile?.anonymous_username ?? 'CourtCheck user'}. Profile management will be implemented later.`}
      title="Profile">
      {role === 'admin' ? <Link href="/(admin)/admin">Return to admin</Link> : null}
      <SignOutButton />
    </PlaceholderScreen>
  );
}
