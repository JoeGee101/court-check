import { Link } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function AuthenticationScreen() {
  return (
    <PlaceholderScreen
      description="Phone OTP authentication will be implemented in a later task."
      title="Authentication">
      <Link href="/(user)/boards">Preview user area</Link>
      <Link href="/(admin)/admin">Preview admin area</Link>
    </PlaceholderScreen>
  );
}
