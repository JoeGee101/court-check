import { Link } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function AdminScreen() {
  return (
    <PlaceholderScreen
      description="Administrative tools will be implemented later."
      title="Admin">
      <Link href="/(admin)/admin/facilities">Preview facility management</Link>
      <Link href="/(user)/boards">Open player preview</Link>
    </PlaceholderScreen>
  );
}
