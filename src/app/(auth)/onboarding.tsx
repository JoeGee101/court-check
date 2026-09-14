import { PlaceholderScreen } from '@/components/placeholder-screen';
import { SignOutButton } from '@/features/auth/sign-out-button';

export default function OnboardingScreen() {
  return (
    <PlaceholderScreen
      description="Your session is valid. Account setup will be implemented in the onboarding task."
      title="Complete account setup">
      <SignOutButton />
    </PlaceholderScreen>
  );
}
