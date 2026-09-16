import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/session-provider';
import {
  type CheckInFeedback,
  type CheckInPhase,
  useCheckIn,
} from '@/features/check-ins/use-check-in';
import {
  type FacilityDetail,
  type FacilityDetailPlayer,
  type FacilityDetailStatus,
} from '@/features/facilities/facilities-api';
import { useFacilityDetail } from '@/features/facilities/use-facility-detail';
import type { ExperienceLevel } from '@/types/user';

const EXPERIENCE_LABELS: Record<ExperienceLevel, string> = {
  newbie: 'Newbie',
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  pro: 'Pro',
};

const STATUS_LABELS: Record<FacilityDetailStatus['type'], string> = {
  courts_closed: 'Courts closed',
  tournament_at_courts: 'Tournament at courts',
};

export function FacilityDetailScreen({ facilityId }: { facilityId: string | undefined }) {
  const router = useRouter();
  const { profile } = useAuth();
  const { detail, error, isInitialLoading, isNotFound, isRefreshing, refresh } =
    useFacilityDetail(facilityId);
  const checkIn = useCheckIn({
    facilityId: detail?.id,
    onFacilityUnavailable: refresh,
    onSuccess: refresh,
  });

  // TODO(check-out): use a canonical my-active-check-in API for checkout state.
  // This username match is presentation-only; the check_in RPC remains authoritative.
  const isCheckedInHere = Boolean(
    profile &&
      detail?.players.some(
        (player) => player.anonymousUsername === profile.anonymous_username,
      ),
  );

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

  if (isInitialLoading) {
    return (
      <DetailStateShell onBack={goBack}>
        <ActivityIndicator color="#0E7C7C" size="large" />
        <Text style={styles.stateTitle}>Loading facility</Text>
        <Text style={styles.stateBody}>Getting the latest court activity…</Text>
      </DetailStateShell>
    );
  }

  if (isNotFound) {
    return (
      <DetailStateShell onBack={goBack}>
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
            onRefresh={refresh}
            refreshing={isRefreshing}
            tintColor="#FFFFFF"
          />
        }
        showsVerticalScrollIndicator={false}>
        <FacilityHero detail={detail} onBack={goBack} />
        <View style={styles.body}>
          <View style={styles.countCard}>
            <Text style={styles.count}>{detail.activeCheckInCount}</Text>
            <Text style={styles.countLabel}>players checked in right now</Text>
            <CheckInAction
              feedback={checkIn.feedback}
              isBusy={checkIn.isBusy}
              isCheckedInHere={isCheckedInHere}
              onCheckIn={() => void checkIn.checkIn()}
              phase={checkIn.phase}
            />
          </View>

          {error ? <InlineError onRetry={refresh} /> : null}

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

          <Section title="Current notices">
            {detail.statuses.length > 0 ? (
              <View style={styles.statusList}>
                {detail.statuses.map((status, index) => (
                  <StatusNotice
                    key={`${status.type}-${status.createdAt}-${status.authorUsername}-${index}`}
                    status={status}
                  />
                ))}
              </View>
            ) : (
              <EmptySection text="No active facility notices." />
            )}
          </Section>

          <Section title="Facility information">
            <View style={styles.infoCard}>
              <InfoRow label="Hours" value={detail.hoursText} />
              <InfoRow label="Lights" value={detail.hasLights ? 'Courts are lit' : 'Not available'} />
              <InfoRow
                label="Restrooms"
                value={detail.hasRestrooms ? 'On site' : 'Not available'}
              />
              <InfoRow
                label="Water"
                value={detail.hasWater ? 'On site' : 'Not available'}
                isLast={!detail.verifiedBy}
              />
              {detail.verifiedBy ? (
                <InfoRow isLast label="Verified by" value={detail.verifiedBy} />
              ) : null}
            </View>
          </Section>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function CheckInAction({
  feedback,
  isBusy,
  isCheckedInHere,
  onCheckIn,
  phase,
}: {
  feedback: CheckInFeedback | null;
  isBusy: boolean;
  isCheckedInHere: boolean;
  onCheckIn: () => void;
  phase: CheckInPhase;
}) {
  if (isCheckedInHere) {
    return (
      <View accessibilityLiveRegion="polite" style={styles.checkedInState}>
        <Text style={styles.checkedInTitle}>You’re checked in here</Text>
        <Text style={styles.checkedInBody}>Your visit is included in the live board.</Text>
      </View>
    );
  }

  if (phase === 'success') {
    return (
      <View accessibilityLiveRegion="polite" style={styles.checkedInState}>
        <Text style={styles.checkedInTitle}>Check-in accepted</Text>
        <Text style={styles.checkedInBody}>Updating the live board…</Text>
      </View>
    );
  }

  return (
    <View style={styles.checkInArea}>
      <Pressable
        accessibilityLabel="Check in at this facility"
        accessibilityRole="button"
        accessibilityState={{ busy: isBusy, disabled: isBusy }}
        disabled={isBusy}
        onPress={onCheckIn}
        style={({ pressed }) => [
          styles.checkInButton,
          isBusy && styles.disabledCheckInButton,
          pressed && !isBusy && styles.pressed,
        ]}>
        {isBusy ? <ActivityIndicator color="#FFFFFF" size="small" /> : null}
        <Text style={styles.checkInButtonText}>
          {phase === 'locating'
            ? 'Checking location…'
            : phase === 'submitting'
              ? 'Checking in…'
              : 'Check in here'}
        </Text>
      </Pressable>
      {feedback ? <CheckInFeedbackMessage feedback={feedback} /> : null}
    </View>
  );
}

function CheckInFeedbackMessage({ feedback }: { feedback: CheckInFeedback }) {
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
      {feedback.canOpenSettings ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={openSettings}>
          <Text style={styles.settingsLink}>Open Settings</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FacilityHero({ detail, onBack }: { detail: FacilityDetail; onBack: () => void }) {
  return (
    <View style={styles.hero}>
      <BackButton onPress={onBack} />
      <Text style={styles.facilityName}>{detail.name}</Text>
      <Text style={styles.address}>{detail.address}</Text>
      <View style={styles.amenities}>
        <AmenityChip label={`${detail.courtCount} ${detail.courtCount === 1 ? 'court' : 'courts'}`} />
        <AmenityChip label={detail.hasLights ? 'Lights' : 'No lights'} />
        {detail.hasWater ? <AmenityChip label="Water" /> : null}
        {detail.hasRestrooms ? <AmenityChip label="Restrooms" /> : null}
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
      <Text allowFontScaling={false} style={styles.backIcon}>‹</Text>
    </Pressable>
  );
}

function AmenityChip({ label }: { label: string }) {
  return (
    <View style={styles.amenityChip}>
      <Text style={styles.amenityText}>{label}</Text>
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
  return (
    <View style={styles.statusNotice}>
      <Text style={styles.statusTitle}>{STATUS_LABELS[status.type]}</Text>
      <Text style={styles.statusMetadata}>Reported by {status.authorUsername}</Text>
      <Text style={styles.statusMetadata}>Expires {formatTimestamp(status.expiresAt)}</Text>
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
  isLast = false,
  label,
  value,
}: {
  isLast?: boolean;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.infoRow, isLast && styles.lastInfoRow]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function EmptySection({ text }: { text: string }) {
  return (
    <View style={styles.emptySection}>
      <Text style={styles.emptySectionText}>{text}</Text>
    </View>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.inlineError}>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F7F6',
  },
  scrollContent: {
    paddingBottom: 36,
  },
  hero: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 54,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: '#0E7C7C',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  backIcon: {
    marginTop: -3,
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '300',
    lineHeight: 38,
  },
  facilityName: {
    marginTop: 12,
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 31,
  },
  address: {
    marginTop: 5,
    color: 'rgba(255, 255, 255, 0.82)',
    fontSize: 14,
    lineHeight: 20,
  },
  amenities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 17,
  },
  amenityChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.26)',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  amenityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  body: {
    paddingHorizontal: 20,
  },
  countCard: {
    alignItems: 'center',
    marginTop: -30,
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: '#DCE5E3',
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#16263D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 3,
  },
  count: {
    color: '#16263D',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 46,
  },
  countLabel: {
    marginTop: 4,
    color: '#667684',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  checkInArea: {
    alignSelf: 'stretch',
    marginTop: 20,
  },
  checkInButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: '#D76735',
    shadowColor: '#D76735',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 2,
  },
  disabledCheckInButton: {
    opacity: 0.68,
  },
  checkInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  checkInFeedback: {
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  checkInFeedbackText: {
    color: '#8A3434',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  checkInSuccessText: {
    color: '#24704D',
  },
  settingsLink: {
    color: '#0E7C7C',
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
    borderColor: '#9ACDC4',
    borderRadius: 14,
    backgroundColor: '#DFF1EE',
  },
  checkedInTitle: {
    color: '#0A6666',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  checkedInBody: {
    marginTop: 3,
    color: '#42716C',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  section: {
    marginTop: 26,
  },
  sectionTitle: {
    marginBottom: 11,
    color: '#16263D',
    fontSize: 15,
    fontWeight: '800',
  },
  playerList: {
    gap: 9,
  },
  playerRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DCE5E3',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  playerAvatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#0E7C7C',
  },
  playerInitials: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  playerName: {
    minWidth: 0,
    flex: 1,
    color: '#16263D',
    fontSize: 14,
    fontWeight: '700',
  },
  levelBadge: {
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#DFF1EE',
  },
  levelText: {
    color: '#0A6666',
    fontSize: 11,
    fontWeight: '800',
  },
  statusList: {
    gap: 9,
  },
  statusNotice: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8B194',
    borderRadius: 14,
    backgroundColor: '#FFF0E8',
  },
  statusTitle: {
    color: '#8A4324',
    fontSize: 14,
    fontWeight: '800',
  },
  statusMetadata: {
    marginTop: 4,
    color: '#755648',
    fontSize: 12,
    lineHeight: 17,
  },
  infoCard: {
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#DCE5E3',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCE5E3',
  },
  lastInfoRow: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    color: '#667684',
    fontSize: 13,
    fontWeight: '700',
  },
  infoValue: {
    minWidth: 0,
    flex: 1,
    color: '#16263D',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'right',
  },
  emptySection: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCE5E3',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
  },
  emptySectionText: {
    color: '#667684',
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
    borderRadius: 12,
    backgroundColor: '#FCEBE8',
  },
  inlineErrorText: {
    flex: 1,
    color: '#8A3434',
    fontSize: 13,
    fontWeight: '600',
  },
  inlineRetry: {
    color: '#0E7C7C',
    fontSize: 13,
    fontWeight: '800',
  },
  stateHeader: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#0E7C7C',
  },
  stateContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingBottom: 80,
  },
  stateTitle: {
    marginTop: 14,
    color: '#16263D',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateBody: {
    maxWidth: 310,
    marginTop: 7,
    color: '#667684',
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
    borderRadius: 12,
    backgroundColor: '#0E7C7C',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.76,
  },
});
