import { useRouter } from 'expo-router';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii, shadows, spacing, typeScale } from '@/constants/theme';
import type { ActiveCheckIn } from '@/features/check-ins/active-check-in-api';
import {
  type CheckOutFeedback,
  useActiveCheckIn,
} from '@/features/check-ins/use-active-check-in';
import {
  type CheckInFeedback,
  type CheckInPhase,
  useCheckIn,
} from '@/features/check-ins/use-check-in';
import {
  type FacilityDetail,
  type FacilityDetailPlayer,
  type FacilityDetailStatus,
  type FacilityStatusType,
} from '@/features/facilities/facilities-api';
import { useFacilityDetail } from '@/features/facilities/use-facility-detail';
import {
  type FacilityStatusFeedback,
  usePostFacilityStatus,
} from '@/features/statuses/use-post-facility-status';
import {
  type FacilityDirectionsProvider,
  openFacilityDirections,
} from '@/lib/maps';
import type { ExperienceLevel } from '@/types/user';

const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  newbie: 'Newbie',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  pro: 'Pro',
};

type StatusReportPreset = {
  confirmationTitle: string;
  durationLabel: string;
  icon: SymbolName;
  label: string;
  type: FacilityStatusType;
};

type SymbolName = {
  android: AndroidSymbol;
  ios: SFSymbol;
};

type StatusVisual = {
  backgroundColor: string;
  borderColor: string;
  iconColor: string;
};

const STATUS_REPORT_PRESETS: readonly StatusReportPreset[] = [
  {
    confirmationTitle: 'Report courts closed?',
    durationLabel: '4 hours',
    icon: { android: 'report', ios: 'exclamationmark.octagon' },
    label: 'Courts closed',
    type: 'courts_closed',
  },
  {
    confirmationTitle: 'Report maintenance?',
    durationLabel: '8 hours',
    icon: { android: 'construction', ios: 'wrench.and.screwdriver' },
    label: 'Maintenance',
    type: 'maintenance',
  },
  {
    confirmationTitle: 'Report wet or unsafe courts?',
    durationLabel: '2 hours',
    icon: { android: 'water_drop', ios: 'drop' },
    label: 'Courts wet / unsafe',
    type: 'courts_wet_unsafe',
  },
  {
    confirmationTitle: 'Report a tournament or event?',
    durationLabel: '8 hours',
    icon: { android: 'event', ios: 'calendar' },
    label: 'Tournament / Event',
    type: 'tournament_at_courts',
  },
  {
    confirmationTitle: 'Report courts full?',
    durationLabel: '1 hour',
    icon: { android: 'groups', ios: 'person.3' },
    label: 'Courts full',
    type: 'courts_full',
  },
];

const STATUS_PRESETS_BY_TYPE = Object.fromEntries(
  STATUS_REPORT_PRESETS.map((preset) => [preset.type, preset]),
) as Record<FacilityStatusType, StatusReportPreset>;

const STATUS_VISUALS: Record<FacilityStatusType, StatusVisual> = {
  courts_closed: {
    backgroundColor: '#FFF0EB',
    borderColor: '#F1C4B3',
    iconColor: colors.orange,
  },
  maintenance: {
    backgroundColor: '#F5F1E8',
    borderColor: '#DDD0B2',
    iconColor: '#80632D',
  },
  courts_wet_unsafe: {
    backgroundColor: '#EAF3F7',
    borderColor: '#BDD7E2',
    iconColor: '#34738E',
  },
  tournament_at_courts: {
    backgroundColor: '#F1EFF8',
    borderColor: '#D6CFEB',
    iconColor: '#66539A',
  },
  courts_full: {
    backgroundColor: colors.tealTint,
    borderColor: '#B7D8D5',
    iconColor: colors.tealDark,
  },
};

export function FacilityDetailScreen({ facilityId }: { facilityId: string | undefined }) {
  const router = useRouter();
  const isOpeningDirectionsRef = useRef(false);
  const statusToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOpeningDirections, setIsOpeningDirections] = useState(false);
  const { detail, error, isInitialLoading, isNotFound, isRefreshing, refresh } =
    useFacilityDetail(facilityId);
  const activeState = useActiveCheckIn(refresh);
  const checkIn = useCheckIn({
    facilityId: detail?.id,
    onActiveCheckInConflict: activeState.refresh,
    onFacilityUnavailable: refresh,
    onOutsideGeofence: () => {
      Alert.alert(
        'You’re too far away',
        'You need to be at this facility to check in.',
        [{ text: 'OK' }],
      );
    },
    onSuccess: () => {
      activeState.refresh();
      refresh();
    },
  });
  const statusPosting = usePostFacilityStatus({
    facilityId: detail?.id,
    onAuthorizationFailure: () => {
      void activeState.refresh();
      refresh();
    },
    onFacilityUnavailable: refresh,
    onSuccess: refresh,
  });
  const clearStatusFeedback = statusPosting.clearFeedback;
  const statusFeedback = statusPosting.feedback;

  useEffect(() => {
    if (statusToastTimer.current) {
      clearTimeout(statusToastTimer.current);
      statusToastTimer.current = null;
    }

    if (statusFeedback?.tone !== 'success') {
      return;
    }

    statusToastTimer.current = setTimeout(() => {
      statusToastTimer.current = null;
      clearStatusFeedback();
    }, 2800);

    return () => {
      if (statusToastTimer.current) {
        clearTimeout(statusToastTimer.current);
        statusToastTimer.current = null;
      }
    };
  }, [clearStatusFeedback, statusFeedback]);

  const refreshAll = () => {
    void activeState.refresh();
    refresh();
  };

  const handleCheckOut = async () => {
    const serverConfirmedNoActiveCheckIn = await activeState.checkout();

    if (serverConfirmedNoActiveCheckIn) {
      checkIn.resetAfterConfirmedCheckout();
    }
  };

  const confirmStatus = (statusType: FacilityStatusType) => {
    const preset = STATUS_PRESETS_BY_TYPE[statusType];

    Alert.alert(
      preset.confirmationTitle,
      `This notice will remain active for ${preset.durationLabel}.`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          onPress: () => void statusPosting.postStatus(statusType),
          style: statusType === 'courts_closed' ? 'destructive' : 'default',
          text: 'Post status',
        },
      ],
    );
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(user)/boards');
    }
  };

  const goToBoards = () => {
    router.replace('/(user)/boards');
  };

  const viewActiveFacility = () => {
    if (!activeState.activeCheckIn) {
      return;
    }

    router.push({
      pathname: '/(user)/facilities/[facilityId]',
      params: { facilityId: activeState.activeCheckIn.facilityId },
    });
  };

  const openDirections = async (provider: FacilityDirectionsProvider) => {
    if (!detail || isOpeningDirectionsRef.current) {
      return;
    }

    isOpeningDirectionsRef.current = true;
    setIsOpeningDirections(true);

    try {
      await openFacilityDirections(
        {
          address: detail.address,
          latitude: detail.latitude,
          longitude: detail.longitude,
          name: detail.name,
        },
        provider,
      );
    } catch {
      Alert.alert(
        'Directions unavailable',
        "Couldn't open Maps. Try again or use the facility address shown above.",
      );
    } finally {
      isOpeningDirectionsRef.current = false;
      setIsOpeningDirections(false);
    }
  };

  const handleDirections = () => {
    if (!detail || isOpeningDirectionsRef.current) {
      return;
    }

    if (Platform.OS !== 'ios') {
      void openDirections('google');
      return;
    }

    isOpeningDirectionsRef.current = true;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        cancelButtonIndex: 2,
        options: ['Apple Maps', 'Google Maps', 'Cancel'],
        title: `Directions to ${detail.name}`,
      },
      (selectedIndex) => {
        if (selectedIndex === 2) {
          isOpeningDirectionsRef.current = false;
          return;
        }

        isOpeningDirectionsRef.current = false;
        void openDirections(selectedIndex === 0 ? 'apple' : 'google');
      },
    );
  };

  if (isInitialLoading) {
    return (
      <DetailStateShell onBack={goBack}>
        <View style={styles.stateIconTile}>
          <ActivityIndicator color={colors.teal} size="large" />
        </View>
        <Text style={styles.stateTitle}>Loading facility</Text>
        <Text style={styles.stateBody}>Getting the latest court activity…</Text>
      </DetailStateShell>
    );
  }

  if (isNotFound) {
    return (
      <DetailStateShell onBack={goBack}>
        <View style={styles.stateIconTile}>
          <CourtCheckSymbol android="location_off" color={colors.teal} ios="mappin.slash" size={28} />
        </View>
        <Text style={styles.stateTitle}>Facility unavailable</Text>
        <Text style={styles.stateBody}>
          This facility could not be found or is no longer available.
        </Text>
        <ActionButton label="Back to Boards" onPress={goToBoards} />
      </DetailStateShell>
    );
  }

  if (!detail) {
    return (
      <DetailStateShell onBack={goBack}>
        <View style={styles.stateIconTile}>
          <CourtCheckSymbol android="warning" color={colors.orange} ios="exclamationmark.triangle" size={28} />
        </View>
        <Text style={styles.stateTitle}>Unable to load facility</Text>
        <Text style={styles.stateBody}>Check your connection and try again.</Text>
        <ActionButton label="Try again" onPress={refresh} />
      </DetailStateShell>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            colors={['#0E7C7C']}
            onRefresh={refreshAll}
            refreshing={isRefreshing || activeState.isRefreshing}
            tintColor="#FFFFFF"
          />
        }
        showsVerticalScrollIndicator={false}>
        <FacilityHero detail={detail} onBack={goBack} />
        <View style={styles.body}>
          <View style={styles.countCard}>
            <Text style={styles.count}>{detail.activeCheckInCount}</Text>
            <Text style={styles.countLabel}>players checked in right now</Text>
            <PlayerPreview players={detail.players} />
            <FacilityContextMap detail={detail} />
            <CheckInControl
              activeCheckIn={activeState.activeCheckIn}
              activeRemainingMs={activeState.remainingMs}
              activeError={activeState.error}
              checkInFeedback={checkIn.feedback}
              checkInPhase={checkIn.phase}
              checkOutFeedback={activeState.feedback}
              currentFacilityId={detail.id}
              isActiveLoading={activeState.isInitialLoading || activeState.isRefreshing}
              isCheckingIn={checkIn.isBusy}
              isCheckingOut={activeState.isCheckingOut}
              onCheckIn={() => {
                activeState.clearFeedback();
                void checkIn.checkIn();
              }}
              onCheckOut={() => void handleCheckOut()}
              onRetryActive={activeState.refresh}
              onViewActiveFacility={viewActiveFacility}
            />
            <Pressable
              accessibilityLabel={`Get directions to ${detail.name}`}
              accessibilityRole="button"
              accessibilityState={{ busy: isOpeningDirections, disabled: isOpeningDirections }}
              disabled={isOpeningDirections}
              onPress={handleDirections}
              style={({ pressed }) => [
                styles.directionsButton,
                isOpeningDirections && styles.directionsButtonDisabled,
                pressed && !isOpeningDirections && styles.pressed,
              ]}>
              {isOpeningDirections ? (
                <ActivityIndicator color={colors.teal} size="small" />
              ) : (
                <CourtCheckSymbol android="navigation" color={colors.tealDark} ios="location.north.fill" size={18} />
              )}
              <Text style={styles.directionsButtonText}>
                {isOpeningDirections ? 'Opening Maps…' : 'Directions to park'}
              </Text>
            </Pressable>
          </View>

          {error ? <InlineError onRetry={refresh} /> : null}

          <Section title="Current notices">
            {detail.statuses.length > 0 ? (
              <View style={styles.statusList}>
                {detail.statuses.map((status, index) => (
                  <StatusNotice
                    key={`${status.type}-${status.latestReportedAt}-${index}`}
                    status={status}
                  />
                ))}
              </View>
            ) : (
              <EmptySection text="No active facility notices." />
            )}
          </Section>

          <Section title="Report court status">
            <StatusReportingControl
              activeCheckIn={activeState.activeCheckIn}
              activeError={activeState.error}
              currentFacilityId={detail.id}
              feedback={
                statusPosting.feedback?.tone === 'error' ? statusPosting.feedback : null
              }
              isActiveLoading={activeState.isInitialLoading || activeState.isRefreshing}
              onPost={confirmStatus}
              postingType={statusPosting.postingType}
            />
          </Section>

          <Section title="Players here now">
            {detail.players.length > 0 ? (
              <View style={styles.playerList}>
                {detail.players.map((player) => (
                  <PlayerRow key={player.anonymousUsername} player={player} />
                ))}
              </View>
            ) : (
              <EmptySection text="No one is checked in right now." />
            )}
          </Section>

          <Section title="Facility information">
            <View style={styles.infoCard}>
              <InfoRow
                icon={{ android: 'schedule', ios: 'clock' }}
                label="Hours"
                value={detail.hoursText}
              />
              <InfoRow
                icon={{ android: 'grid_view', ios: 'square.grid.2x2' }}
                label="Courts"
                value={`${detail.courtCount} ${detail.courtCount === 1 ? 'court' : 'courts'}`}
              />
              <InfoRow
                icon={{ android: 'lightbulb', ios: 'lightbulb' }}
                label="Lights"
                value={detail.hasLights ? 'Courts are lit' : 'Not available'}
              />
              <InfoRow
                icon={{ android: 'wc', ios: 'toilet' }}
                label="Restrooms"
                value={detail.hasRestrooms ? 'On site' : 'Not available'}
              />
              <InfoRow
                icon={{ android: 'water_drop', ios: 'drop' }}
                label="Water"
                value={detail.hasWater ? 'On site' : 'Not available'}
                isLast={!detail.verifiedBy}
              />
              {detail.verifiedBy ? (
                <InfoRow
                  icon={{ android: 'verified', ios: 'checkmark.seal' }}
                  isLast
                  label="Verified by"
                  value={detail.verifiedBy}
                />
              ) : null}
            </View>
          </Section>
        </View>
      </ScrollView>
      {statusPosting.feedback?.tone === 'success' ? (
        <View
          accessibilityLiveRegion="polite"
          pointerEvents="none"
          style={styles.statusToast}>
          <CourtCheckSymbol
            android="check_circle"
            color={colors.white}
            ios="checkmark.circle.fill"
            size={19}
          />
          <Text style={styles.statusToastText}>Status report confirmed</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function FacilityContextMap({ detail }: { detail: FacilityDetail }) {
  return (
    <View style={styles.contextMapSection}>
      <View style={styles.contextMapHeading}>
        <CourtCheckSymbol android="location_on" color={colors.teal} ios="mappin.and.ellipse" size={17} />
        <Text style={styles.contextMapTitle}>Court location</Text>
      </View>
      <View
        accessibilityLabel={`${detail.name} location map`}
        accessibilityRole="image"
        style={styles.contextMapFrame}>
        <MapView
          initialRegion={{
            latitude: detail.latitude,
            longitude: detail.longitude,
            latitudeDelta: 0.014,
            longitudeDelta: 0.014,
          }}
          pitchEnabled={false}
          pointerEvents="none"
          rotateEnabled={false}
          scrollEnabled={false}
          showsCompass={false}
          showsMyLocationButton={false}
          showsUserLocation={false}
          style={StyleSheet.absoluteFill}
          toolbarEnabled={false}
          zoomEnabled={false}>
          <Marker
            accessibilityLabel={`${detail.name} court location`}
            anchor={{ x: 0.5, y: 0.5 }}
            coordinate={{ latitude: detail.latitude, longitude: detail.longitude }}
            tappable={false}>
            <View style={styles.courtMapMarker}>
              <CourtCheckSymbol
                android="sports_tennis"
                color={colors.white}
                ios="figure.pickleball"
                size={19}
              />
            </View>
          </Marker>
        </MapView>
      </View>
    </View>
  );
}

function CheckInControl({
  activeCheckIn,
  activeRemainingMs,
  activeError,
  checkInFeedback,
  checkInPhase,
  checkOutFeedback,
  currentFacilityId,
  isActiveLoading,
  isCheckingIn,
  isCheckingOut,
  onCheckIn,
  onCheckOut,
  onRetryActive,
  onViewActiveFacility,
}: {
  activeCheckIn: ActiveCheckIn | null;
  activeRemainingMs: number | null;
  activeError: string | null;
  checkInFeedback: CheckInFeedback | null;
  checkInPhase: CheckInPhase;
  checkOutFeedback: CheckOutFeedback | null;
  currentFacilityId: string;
  isActiveLoading: boolean;
  isCheckingIn: boolean;
  isCheckingOut: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onRetryActive: () => void;
  onViewActiveFacility: () => void;
}) {
  if (isActiveLoading) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.checkInLoadingState}>
        <ActivityIndicator color={colors.teal} size="small" />
        <Text style={styles.checkInLoadingText}>Checking your current visit…</Text>
      </View>
    );
  }

  if (activeError) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.activeStateError}>
        <Text style={styles.checkInFeedbackText}>{activeError}</Text>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onRetryActive}>
          <Text style={styles.settingsLink}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (activeCheckIn?.facilityId === currentFacilityId) {
    return (
      <View style={styles.checkedInState}>
        <View style={styles.checkedInHeading}>
          <CourtCheckSymbol android="check_circle" color={colors.tealDark} ios="checkmark.circle.fill" size={20} />
          <Text style={styles.checkedInTitle}>Checked in</Text>
        </View>
        <Text style={styles.checkedInBody}>Your visit is included in the live board.</Text>
        {activeRemainingMs !== null ? (
          <View style={styles.countdownRow}>
            <CourtCheckSymbol android="schedule" color={colors.tealDark} ios="clock.fill" size={15} />
            <Text style={styles.countdownText}>
              Auto-checkout in {formatRemainingTime(activeRemainingMs)}
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: isCheckingOut, disabled: isCheckingOut }}
          disabled={isCheckingOut}
          onPress={onCheckOut}
          style={({ pressed }) => [
            styles.checkOutButton,
            isCheckingOut && styles.disabledCheckInButton,
            pressed && !isCheckingOut && styles.pressed,
          ]}>
          {isCheckingOut ? (
            <ActivityIndicator color={colors.tealDark} size="small" />
          ) : (
            <CourtCheckSymbol android="logout" color={colors.tealDark} ios="rectangle.portrait.and.arrow.right" size={17} />
          )}
          <Text style={styles.checkOutButtonText}>
            {isCheckingOut ? 'Checking out…' : 'Check out'}
          </Text>
        </Pressable>
        {checkOutFeedback ? <ActionFeedbackMessage feedback={checkOutFeedback} /> : null}
      </View>
    );
  }

  if (activeCheckIn) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.checkedInElsewhereState}>
        <View style={styles.elsewhereIcon}>
          <CourtCheckSymbol android="location_on" color={colors.teal} ios="mappin.and.ellipse" size={20} />
        </View>
        <Text style={styles.checkedInElsewhereTitle}>You’re already checked in</Text>
        <Text style={styles.checkedInElsewhereBody}>{activeCheckIn.facilityName}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onViewActiveFacility}
          style={({ pressed }) => [
            styles.viewActiveFacilityButton,
            pressed && styles.pressed,
          ]}>
          <Text style={styles.viewActiveFacilityText}>View active facility</Text>
        </Pressable>
      </View>
    );
  }

  if (checkInPhase === 'success') {
    return (
      <View accessibilityLiveRegion="polite" style={styles.checkedInState}>
        <View style={styles.checkedInHeading}>
          <CourtCheckSymbol android="check_circle" color={colors.tealDark} ios="checkmark.circle.fill" size={20} />
          <Text style={styles.checkedInTitle}>Check-in accepted</Text>
        </View>
        <Text style={styles.checkedInBody}>Updating the live board…</Text>
      </View>
    );
  }

  return (
    <View style={styles.checkInArea}>
      <Pressable
        accessibilityLabel="Check in at this facility"
        accessibilityRole="button"
        accessibilityState={{ busy: isCheckingIn, disabled: isCheckingIn }}
        disabled={isCheckingIn}
        onPress={onCheckIn}
        style={({ pressed }) => [
          styles.checkInButton,
          isCheckingIn && styles.disabledCheckInButton,
          pressed && !isCheckingIn && styles.pressed,
        ]}>
        {isCheckingIn ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <CourtCheckSymbol android="sports_tennis" color={colors.white} ios="tennis.racket" size={20} />
        )}
        <Text style={styles.checkInButtonText}>
          {checkInPhase === 'locating'
            ? 'Checking location…'
            : checkInPhase === 'submitting'
              ? 'Checking in…'
              : 'Check in here'}
        </Text>
      </Pressable>
      {checkInFeedback ? <ActionFeedbackMessage feedback={checkInFeedback} /> : null}
      {!checkInFeedback && checkOutFeedback ? (
        <ActionFeedbackMessage feedback={checkOutFeedback} />
      ) : null}
    </View>
  );
}

function ActionFeedbackMessage({
  feedback,
}: {
  feedback: CheckInFeedback | CheckOutFeedback | FacilityStatusFeedback;
}) {
  const openSettings = () => {
    void Linking.openSettings().catch(() => undefined);
  };

  return (
    <View accessibilityLiveRegion="polite" style={styles.checkInFeedback}>
      <Text
        style={[
          styles.checkInFeedbackText,
          feedback.tone === 'success' && styles.checkInSuccessText,
        ]}>
        {feedback.message}
      </Text>
      {'canOpenSettings' in feedback && feedback.canOpenSettings ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={openSettings}>
          <Text style={styles.settingsLink}>Open Settings</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function StatusReportingControl({
  activeCheckIn,
  activeError,
  currentFacilityId,
  feedback,
  isActiveLoading,
  onPost,
  postingType,
}: {
  activeCheckIn: ActiveCheckIn | null;
  activeError: string | null;
  currentFacilityId: string;
  feedback: FacilityStatusFeedback | null;
  isActiveLoading: boolean;
  onPost: (statusType: FacilityStatusType) => void;
  postingType: FacilityStatusType | null;
}) {
  let content: React.ReactNode;

  if (isActiveLoading) {
    content = (
      <StatusReportingUnavailable text="Confirming your current check-in before status reporting…" />
    );
  } else if (activeError) {
    content = (
      <StatusReportingUnavailable text="Status reporting is unavailable until your current check-in can be confirmed." />
    );
  } else if (!activeCheckIn) {
    content = (
      <StatusReportingUnavailable text="Check in at this facility to report a court status." />
    );
  } else if (activeCheckIn.facilityId !== currentFacilityId) {
    content = (
      <StatusReportingUnavailable text="You must be checked in at this facility to report its status." />
    );
  } else {
    content = (
      <View style={styles.statusActionRow}>
        {STATUS_REPORT_PRESETS.map((preset) => (
          <StatusAction
            duration={preset.durationLabel}
            icon={preset.icon}
            isPosting={postingType === preset.type}
            key={preset.type}
            label={preset.label}
            onPress={() => onPost(preset.type)}
            postingType={postingType}
          />
        ))}
      </View>
    );
  }

  return (
    <View>
      {content}
      {feedback ? <ActionFeedbackMessage feedback={feedback} /> : null}
    </View>
  );
}

function StatusReportingUnavailable({ text }: { text: string }) {
  return (
    <View style={styles.statusUnavailable}>
      <Text style={styles.statusUnavailableText}>{text}</Text>
    </View>
  );
}

function StatusAction({
  duration,
  icon,
  isPosting,
  label,
  onPress,
  postingType,
}: {
  duration: string;
  icon: SymbolName;
  isPosting: boolean;
  label: string;
  onPress: () => void;
  postingType: FacilityStatusType | null;
}) {
  const isDisabled = postingType !== null;

  return (
    <Pressable
      accessibilityHint={`Posts this notice for ${duration}`}
      accessibilityLabel={`${label}, ${duration}`}
      accessibilityRole="button"
      accessibilityState={{ busy: isPosting, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.statusAction,
        isDisabled && styles.statusActionDisabled,
        pressed && !isDisabled && styles.pressed,
      ]}>
      {isPosting ? (
        <ActivityIndicator color={colors.teal} size="small" />
      ) : (
        <View style={styles.statusActionIcon}>
          <CourtCheckSymbol {...icon} color={colors.tealDark} size={21} />
        </View>
      )}
      <Text style={styles.statusActionLabel}>{isPosting ? 'Posting…' : label}</Text>
      <Text style={styles.statusActionDuration}>{duration}</Text>
    </Pressable>
  );
}

function FacilityHero({ detail, onBack }: { detail: FacilityDetail; onBack: () => void }) {
  return (
    <View style={styles.hero}>
      <BackButton onPress={onBack} />
      <Text style={styles.facilityName}>{detail.name}</Text>
      <Text style={styles.address}>{detail.address}</Text>
      <View style={styles.amenities}>
        <AmenityChip
          icon={{ android: 'grid_view', ios: 'square.grid.2x2' }}
          label={`${detail.courtCount} ${detail.courtCount === 1 ? 'court' : 'courts'}`}
        />
        <AmenityChip
          icon={{ android: 'lightbulb', ios: 'lightbulb' }}
          label={detail.hasLights ? 'Lights' : 'No lights'}
        />
        {detail.hasWater ? (
          <AmenityChip icon={{ android: 'water_drop', ios: 'drop' }} label="Water" />
        ) : null}
        {detail.hasRestrooms ? (
          <AmenityChip icon={{ android: 'wc', ios: 'toilet' }} label="Restrooms" />
        ) : null}
      </View>
    </View>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Go back"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
      <CourtCheckSymbol android="chevron_left" color={colors.white} ios="chevron.left" size={23} />
    </Pressable>
  );
}

function AmenityChip({ icon, label }: { icon: SymbolName; label: string }) {
  return (
    <View style={styles.amenityChip}>
      <CourtCheckSymbol {...icon} color={colors.white} size={13} />
      <Text style={styles.amenityText}>{label}</Text>
    </View>
  );
}

function PlayerPreview({ players }: { players: FacilityDetailPlayer[] }) {
  if (players.length === 0) {
    return <Text style={styles.previewEmpty}>No one checked in yet — be the first</Text>;
  }

  const visiblePlayers = players.slice(0, 4);
  const remainingCount = Math.max(0, players.length - visiblePlayers.length);

  return (
    <View accessibilityLabel={`${players.length} player previews`} style={styles.playerPreview}>
      <View style={styles.previewAvatarStack}>
        {visiblePlayers.map((player, index) => (
          <View
            key={player.anonymousUsername}
            style={[styles.previewAvatar, index > 0 && styles.previewAvatarOverlap]}>
            <Text style={styles.previewInitials}>
              {getUsernameInitials(player.anonymousUsername)}
            </Text>
          </View>
        ))}
        {remainingCount > 0 ? (
          <View style={[styles.previewMore, styles.previewAvatarOverlap]}>
            <Text style={styles.previewMoreText}>+{remainingCount}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.previewLabel}>Anonymous players on court</Text>
    </View>
  );
}

function PlayerRow({ player }: { player: FacilityDetailPlayer }) {
  return (
    <View style={styles.playerRow}>
      <View style={styles.playerAvatar}>
        <Text style={styles.playerInitials}>{getUsernameInitials(player.anonymousUsername)}</Text>
      </View>
      <Text style={styles.playerName}>
        {player.anonymousUsername}
      </Text>
      <View style={styles.levelBadge}>
        <Text style={styles.levelText}>{EXPERIENCE_LABELS[player.experienceLevel]}</Text>
      </View>
    </View>
  );
}

function StatusNotice({ status }: { status: FacilityDetailStatus }) {
  const preset = STATUS_PRESETS_BY_TYPE[status.type];
  const visual = STATUS_VISUALS[status.type];
  const reporterLabel = `${status.reporterCount} ${
    status.reporterCount === 1 ? 'player reported' : 'players reported'
  } this`;

  return (
    <View
      style={[
        styles.statusNotice,
        { backgroundColor: visual.backgroundColor, borderColor: visual.borderColor },
      ]}>
      <View style={[styles.noticeIcon, { backgroundColor: visual.borderColor }]}>
        <CourtCheckSymbol {...preset.icon} color={visual.iconColor} size={20} />
      </View>
      <View style={styles.noticeContent}>
        <Text style={styles.statusTitle}>{preset.label}</Text>
        <Text style={styles.statusReporter}>{reporterLabel}</Text>
        <Text style={styles.statusMetadata}>
          Latest {formatTimestamp(status.latestReportedAt)} · active until{' '}
          {formatTimestamp(status.expiresAt)}
        </Text>
      </View>
    </View>
  );
}

function Section({ children, title }: React.PropsWithChildren<{ title: string }>) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({
  icon,
  isLast = false,
  label,
  value,
}: {
  icon: SymbolName;
  isLast?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.infoRow, isLast && styles.lastInfoRow]}>
      <View style={styles.infoIcon}>
        <CourtCheckSymbol {...icon} color={colors.teal} size={18} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <View style={styles.emptySection}>
      <CourtCheckSymbol android="info" color={colors.teal} ios="info.circle" size={20} />
      <Text style={styles.emptySectionText}>{text}</Text>
    </View>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.inlineError}>
      <CourtCheckSymbol android="warning" color={colors.danger} ios="exclamationmark.triangle" size={19} />
      <Text style={styles.inlineErrorText}>Facility activity could not be refreshed.</Text>
      <Pressable accessibilityRole="button" onPress={onRetry}>
        <Text style={styles.inlineRetry}>Try again</Text>
      </Pressable>
    </View>
  );
}

function DetailStateShell({
  children,
  onBack,
}: React.PropsWithChildren<{ onBack: () => void }>) {
  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.stateHeader}>
        <BackButton onPress={onBack} />
      </View>
      <View accessibilityLiveRegion="polite" style={styles.stateContent}>
        {children}
      </View>
    </SafeAreaView>
  );
}

function ActionButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
      <Text style={styles.actionButtonText}>{label}</Text>
    </Pressable>
  );
}

function getUsernameInitials(username: string) {
  const uppercaseLetters = username.match(/[A-Z]/g)?.slice(0, 2).join('');
  return (uppercaseLetters || username.slice(0, 2)).toUpperCase();
}

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'at an unavailable time';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRemainingTime(remainingMs: number) {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cloud,
  },
  scrollContent: {
    paddingBottom: 42,
  },
  hero: {
    paddingHorizontal: spacing.xl,
    paddingTop: 10,
    paddingBottom: 66,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    backgroundColor: colors.teal,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    borderRadius: radii.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  facilityName: {
    maxWidth: 330,
    marginTop: 18,
    color: colors.white,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.45,
    lineHeight: 31,
  },
  address: {
    maxWidth: 330,
    marginTop: 6,
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: typeScale.bodySmall,
    lineHeight: 20,
  },
  amenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  amenityChip: {
    minHeight: 29,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.26)',
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  amenityText: {
    color: colors.white,
    fontSize: 11.5,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: spacing.xl,
  },
  countCard: {
    alignItems: 'center',
    marginTop: -43,
    paddingHorizontal: spacing.lg,
    paddingTop: 20,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  count: {
    color: colors.tealDark,
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
    fontVariant: ['tabular-nums'],
  },
  countLabel: {
    marginTop: 2,
    color: colors.inkMuted,
    fontSize: typeScale.bodySmall,
    fontWeight: '700',
    textAlign: 'center',
  },
  playerPreview: {
    alignItems: 'center',
    marginTop: 14,
  },
  previewAvatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  previewAvatar: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
    borderRadius: 16,
    backgroundColor: colors.teal,
  },
  previewAvatarOverlap: {
    marginLeft: -8,
  },
  previewInitials: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
  },
  previewMore: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
    borderRadius: 16,
    backgroundColor: colors.orangeTint,
  },
  previewMoreText: {
    color: colors.orange,
    fontSize: 10,
    fontWeight: '900',
  },
  previewLabel: {
    marginTop: 5,
    color: colors.inkMuted,
    fontSize: 10.5,
    fontWeight: '600',
  },
  previewEmpty: {
    marginTop: 12,
    color: colors.inkMuted,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  contextMapSection: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  contextMapHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  contextMapTitle: {
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: '800',
  },
  contextMapFrame: {
    height: 166,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.cloud,
  },
  courtMapMarker: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 19,
    backgroundColor: colors.teal,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  checkInArea: {
    alignSelf: 'stretch',
    marginTop: 18,
  },
  checkInLoadingState: {
    minHeight: controlHeights.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 9,
    marginTop: 18,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: colors.tealTint,
  },
  checkInLoadingText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '700',
  },
  activeStateError: {
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#E2B5B5',
    borderRadius: radii.lg,
    backgroundColor: '#FFF4F4',
  },
  checkInButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.orange,
    shadowColor: colors.orange,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 2,
  },
  disabledCheckInButton: {
    opacity: 0.68,
  },
  checkInButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  directionsButton: {
    minHeight: controlHeights.default,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  directionsButtonDisabled: {
    opacity: 0.65,
  },
  directionsButtonText: {
    color: colors.tealDark,
    fontSize: typeScale.button,
    fontWeight: '800',
  },
  checkInFeedback: {
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  checkInFeedbackText: {
    color: colors.danger,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  checkInSuccessText: {
    color: colors.success,
  },
  settingsLink: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '800',
  },
  checkedInState: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#AED5D1',
    borderRadius: radii.lg,
    backgroundColor: colors.tealTint,
  },
  checkedInHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  checkedInTitle: {
    color: colors.tealDark,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  checkedInBody: {
    marginTop: 3,
    color: colors.inkMuted,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  countdownRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    alignSelf: 'stretch',
    marginTop: 10,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  countdownText: {
    color: colors.tealDark,
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  checkOutButton: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 8,
    marginTop: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  checkOutButtonText: {
    color: colors.tealDark,
    fontSize: 14,
    fontWeight: '800',
  },
  checkedInElsewhereState: {
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.cloud,
  },
  elsewhereIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    borderRadius: 19,
    backgroundColor: colors.tealTint,
  },
  checkedInElsewhereTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  checkedInElsewhereBody: {
    marginTop: 4,
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  viewActiveFacilityButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 13,
    paddingHorizontal: 16,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
  },
  viewActiveFacilityText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  section: {
    marginTop: spacing.xxl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
    color: colors.ink,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.15,
  },
  playerList: {
    gap: 9,
  },
  playerRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  playerAvatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: colors.teal,
  },
  playerInitials: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  playerName: {
    minWidth: 0,
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  levelBadge: {
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.tealTint,
  },
  levelText: {
    color: colors.tealDark,
    fontSize: 11,
    fontWeight: '800',
  },
  statusList: {
    gap: 9,
  },
  statusActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statusAction: {
    minHeight: 104,
    width: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  statusActionIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    borderRadius: 19,
    backgroundColor: colors.tealTint,
  },
  statusActionDisabled: {
    opacity: 0.6,
  },
  statusActionLabel: {
    marginTop: 5,
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  statusActionDuration: {
    marginTop: 4,
    color: colors.tealDark,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  statusToast: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    left: spacing.xl,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.ink,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  statusToastText: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: '800',
  },
  statusUnavailable: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  statusUnavailableText: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  statusNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  noticeIcon: {
    width: 38,
    height: 38,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  noticeContent: {
    minWidth: 0,
    flex: 1,
  },
  statusTitle: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '900',
  },
  statusReporter: {
    marginTop: 3,
    color: colors.ink,
    fontSize: 12.5,
    fontWeight: '700',
  },
  statusMetadata: {
    marginTop: 5,
    color: colors.inkMuted,
    fontSize: 11.5,
    lineHeight: 16,
  },
  infoCard: {
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  lastInfoRow: {
    borderBottomWidth: 0,
  },
  infoIcon: {
    width: 34,
    height: 34,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: colors.tealTint,
  },
  infoText: {
    minWidth: 0,
    flex: 1,
  },
  infoLabel: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.35,
    textTransform: 'uppercase',
  },
  infoValue: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 19,
  },
  emptySection: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.card,
  },
  emptySectionText: {
    color: colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: '#FCEBE8',
  },
  inlineErrorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  inlineRetry: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '800',
  },
  stateHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: 10,
    paddingBottom: 22,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    backgroundColor: colors.teal,
  },
  stateContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 80,
  },
  stateIconTile: {
    width: 62,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 31,
    backgroundColor: colors.tealTint,
  },
  stateTitle: {
    marginTop: 14,
    color: colors.ink,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateBody: {
    maxWidth: 310,
    marginTop: 7,
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  actionButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.76,
  },
});
