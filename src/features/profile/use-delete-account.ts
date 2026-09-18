import { useRef, useState } from 'react';
import { Alert } from 'react-native';

import { useAuth } from '@/features/auth/session-provider';
import { deleteMyAccount } from '@/features/profile/profile-api';

const DELETE_ERROR = 'Couldn’t delete your account. Please try again.';

export function useDeleteAccount({ blocked = false }: { blocked?: boolean } = {}) {
  const { completeAccountDeletion } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const confirmationOpen = useRef(false);
  const requestInFlight = useRef(false);

  const deleteAccount = async () => {
    if (requestInFlight.current || blocked) {
      return;
    }

    requestInFlight.current = true;
    setIsDeleting(true);
    setError(null);

    try {
      await deleteMyAccount();
      await completeAccountDeletion();
    } catch {
      requestInFlight.current = false;
      setIsDeleting(false);
      setError(DELETE_ERROR);
    }
  };

  const requestDeleteAccount = () => {
    if (confirmationOpen.current || requestInFlight.current || blocked) {
      return;
    }

    confirmationOpen.current = true;
    Alert.alert(
      'Delete account?',
      'This permanently deletes your CourtCheck account. This action cannot be undone.',
      [
        {
          style: 'cancel',
          text: 'Cancel',
          onPress: () => {
            confirmationOpen.current = false;
          },
        },
        {
          style: 'destructive',
          text: 'Delete Account',
          onPress: () => {
            confirmationOpen.current = false;
            void deleteAccount();
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          confirmationOpen.current = false;
        },
      },
    );
  };

  return {
    deleteAccountError: error,
    isDeletingAccount: isDeleting,
    requestDeleteAccount,
  };
}
