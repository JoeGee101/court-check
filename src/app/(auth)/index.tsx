import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useAuth } from '@/features/auth/session-provider';

export default function AuthenticationScreen() {
  const { error } = useAuth();

  return (
    <PlaceholderScreen
      description={
        error ?? 'Phone OTP authentication will be implemented in a later task.'
      }
      title="Authentication"
    />
  );
}
