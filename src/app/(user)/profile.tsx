import { Link } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function ProfileScreen() {
  return (
    <PlaceholderScreen
      description="Account and profile management will be implemented later."
      title="Profile">
      <Link href="/(auth)">Return to authentication preview</Link>
    </PlaceholderScreen>
  );
}
