import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSystem } from '@/db/powersync/system';
import { View } from 'react-native';
import { userService } from '@/database_services/userService';
import { TermsModal } from '@/components/TermsModal';

export function TermsGuard({ children }: { children: React.ReactNode }) {
  const { currentUser, setCurrentUser, isLoading } = useAuth();
  const { powersync, supabaseConnector } = useSystem();
  const [termsModalVisible, setTermsModalVisible] = useState(false);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

  // Check if the user has accepted the terms and conditions
  useEffect(() => {
    if (!isLoading && currentUser) {
      // Set the initial state based on the user's terms acceptance
      const hasAccepted = !!currentUser.terms_accepted;
      setHasAcceptedTerms(hasAccepted);

      // Only show the modal if terms haven't been accepted
      if (!hasAccepted) {
        setTermsModalVisible(true);
      }
    }
  }, [currentUser, isLoading]);

  // Pause syncing if terms not accepted
  useEffect(() => {
    if (!isLoading && currentUser && !hasAcceptedTerms) {
      // Pause syncing
      powersync.disconnect();
    } else if (!isLoading && currentUser && hasAcceptedTerms) {
      // Resume syncing if not connected
      if (!powersync.connected) {
        powersync.connect(supabaseConnector);
      }
    }
  }, [currentUser, isLoading, powersync, hasAcceptedTerms, supabaseConnector]);

  const handleAcceptTerms = async () => {
    if (!currentUser) return;

    try {
      console.log('Accepting terms...');

      // Update the user's metadata in auth
      const updatedUser = await userService.updateUser({
        id: currentUser.id,
        terms_accepted: true,
        terms_version: '1.0'
      });


      // Update local state to reflect terms acceptance
      setHasAcceptedTerms(true);

      // Close the modal
      setTermsModalVisible(false);

      // Resume syncing
      if (!powersync.connected) {
        powersync.connect(supabaseConnector);
      }

      // Refresh the current user
      if (updatedUser) {
        setCurrentUser(updatedUser);
      }
    } catch (error) {
      console.error('Error accepting terms:', error);
    }
  };

  // If loading, show nothing
  if (isLoading) {
    return null;
  }

  // If user has accepted terms or is not authenticated, render children
  if (!currentUser || hasAcceptedTerms) {
    return <>{children}</>;
  }

  // Otherwise, show terms modal and block rendering of children
  return (
    <>
      <TermsModal
        visible={termsModalVisible}
        onClose={() => {
          // Only allow closing if terms have been accepted
          if (hasAcceptedTerms) {
            setTermsModalVisible(false);
          }
        }}
        onAccept={handleAcceptTerms}
        showAcceptButton={true}
        canDismiss={hasAcceptedTerms}
      />
    </>
  );
}
