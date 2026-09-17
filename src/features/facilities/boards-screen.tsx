import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii, spacing, typeScale } from '@/constants/theme';
import { useAuth } from '@/features/auth/session-provider';
import {
  type FacilityActivityState,
  type FacilitySummary,
} from '@/features/facilities/facilities-api';
import { useFacilities } from '@/features/facilities/use-facilities';

type ActivityPresentation = {
  backgroundColor: string;
  dotColor: string;
  label: string;
  textColor: string;
  tone: 'reported' | 'standard';
};

const ACTIVITY_PRESENTATION: Record<FacilityActivityState, ActivityPresentation> = {
  courts_closed: {
    backgroundColor: '#FFF0F0',
    dotColor: colors.danger,
    label: 'Courts closed',
    textColor: colors.danger,
    tone: 'reported',
  },
  maintenance: {
    backgroundColor: '#F3F0F8',
    dotColor: '#6B5A8E',
    label: 'Maintenance',
    textColor: '#604F82',
    tone: 'reported',
  },
  courts_wet_unsafe: {
    backgroundColor: '#FFF0F0',
    dotColor: colors.danger,
    label: 'Courts wet / unsafe',
    textColor: colors.danger,
    tone: 'reported',
  },
  tournament_at_courts: {
    backgroundColor: colors.orangeTint,
    dotColor: colors.orange,
    label: 'Tournament / Event',
    textColor: '#A34B27',
    tone: 'reported',
  },
  courts_full: {
    backgroundColor: '#FBF3E5',
    dotColor: '#B77A27',
    label: 'Courts full',
    textColor: '#91601E',
    tone: 'reported',
  },
  active: {
    backgroundColor: 'transparent',
    dotColor: colors.orange,
    label: 'Active now',
    textColor: colors.inkMuted,
    tone: 'standard',
  },
  quiet: {
    backgroundColor: 'transparent',
    dotColor: '#A8B3B2',
    label: 'Quiet',
    textColor: colors.inkMuted,
    tone: 'standard',
  },
};

export function BoardsScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const {
    error,
    facilities,
    isInitialLoading,
    isRefreshing,
    refresh,
    search,
    setSearch,
  } = useFacilities();
  const hasSearch = search.trim().length > 0;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>Clark County</Text>
            <Text accessibilityRole="header" style={styles.title}>
              Court Boards
            </Text>
          </View>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            hitSlop={5}
            onPress={() => router.push('/(user)/profile')}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
            <Text style={styles.avatarText}>{getUsernameInitials(profile?.anonymous_username)}</Text>
          </Pressable>
        </View>

        <View style={styles.searchField}>
          <CourtCheckSymbol android="search" color={colors.inkMuted} ios="magnifyingglass" size={16} />
          <TextInput
            accessibilityLabel="Search parks and facilities"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setSearch}
            placeholder="Search parks & facilities"
            placeholderTextColor="#7B8B96"
            returnKeyType="search"
            style={styles.searchInput}
            value={search}
          />
          {isRefreshing ? <ActivityIndicator color={colors.teal} size="small" /> : null}
        </View>
      </View>

      {isInitialLoading ? (
        <LoadingState />
      ) : error && facilities.length === 0 ? (
        <ErrorState onRetry={refresh} />
      ) : (
        <FlatList
          contentContainerStyle={[
            styles.listContent,
            facilities.length === 0 && styles.emptyListContent,
          ]}
          data={facilities}
          ItemSeparatorComponent={CardSeparator}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          keyExtractor={(facility) => facility.id}
          ListEmptyComponent={<EmptyState hasSearch={hasSearch} />}
          ListHeaderComponent={error ? <InlineError onRetry={refresh} /> : null}
          refreshControl={
            <RefreshControl
              colors={[colors.teal]}
              onRefresh={refresh}
              refreshing={isRefreshing}
              tintColor={colors.teal}
            />
          }
          renderItem={({ item }) => (
            <FacilityCard
              facility={item}
              onPress={() =>
                router.push({
                  pathname: '/(user)/facilities/[facilityId]',
                  params: { facilityId: item.id },
                })
              }
            />
          )}
          showsVerticalScrollIndicator={false}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

function FacilityCard({ facility, onPress }: { facility: FacilitySummary; onPress: () => void }) {
  const activity = ACTIVITY_PRESENTATION[facility.activity_state];
  const courtLabel = `${facility.court_count} ${facility.court_count === 1 ? 'court' : 'courts'}`;
  const activityLabel = isReportedStatus(facility.activity_state)
    ? `${activity.label} · ${formatReportCount(facility.activity_reporter_count)}`
    : activity.label;

  return (
    <Pressable
      accessibilityHint="Opens facility details"
      accessibilityLabel={`${facility.name}, ${facility.active_check_in_count} checked in, ${activityLabel}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardIdentity}>
          <Text style={styles.facilityName}>{facility.name}</Text>
          <Text style={styles.address}>{facility.address}</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.count}>{facility.active_check_in_count}</Text>
          <Text style={styles.countLabel}>Checked in</Text>
        </View>
      </View>

      <View style={styles.metadata}>
        <MetadataTag icon="courts" text={courtLabel} />
        <MetadataTag icon="lights" text={facility.has_lights ? 'Lights' : 'No lights'} />
        <MetadataTag icon="hours" text={facility.hours_text} />
        <View
          style={[
            styles.activityTag,
            activity.tone === 'reported' && {
              backgroundColor: activity.backgroundColor,
            },
            activity.tone === 'reported' && styles.reportedActivityTag,
          ]}>
          <View style={[styles.activityDot, { backgroundColor: activity.dotColor }]} />
          <Text style={[styles.activityText, { color: activity.textColor }]}>{activityLabel}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function MetadataTag({ icon, text }: { icon: 'courts' | 'hours' | 'lights'; text: string }) {
  const iconProps =
    icon === 'courts'
      ? ({ android: 'grid_view', ios: 'square.grid.2x2' } as const)
      : icon === 'lights'
        ? ({ android: 'lightbulb', ios: 'lightbulb' } as const)
        : ({ android: 'schedule', ios: 'clock' } as const);

  return (
    <View style={styles.metadataTag}>
      <CourtCheckSymbol
        android={iconProps.android}
        color={colors.inkMuted}
        ios={iconProps.ios}
        size={13}
      />
      <Text style={styles.metadataText}>{text}</Text>
    </View>
  );
}

function LoadingState() {
  return (
    <View accessibilityLiveRegion="polite" style={styles.centeredState}>
      <View style={styles.stateIcon}>
        <ActivityIndicator color={colors.teal} size="large" />
      </View>
      <Text style={styles.stateTitle}>Finding nearby courts</Text>
      <Text style={styles.stateBody}>Loading current facility activity…</Text>
    </View>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <View style={styles.centeredState}>
      <View style={styles.stateIcon}>
        <CourtCheckSymbol
          android={hasSearch ? 'search' : 'grid_view'}
          color={colors.teal}
          ios={hasSearch ? 'magnifyingglass' : 'square.grid.2x2'}
          size={24}
        />
      </View>
      <Text style={styles.stateTitle}>
        {hasSearch ? 'No matching facilities' : 'No facilities available'}
      </Text>
      <Text style={styles.stateBody}>
        {hasSearch
          ? 'Try searching for another park or address.'
          : 'Active facilities will appear here when they are available.'}
      </Text>
    </View>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.centeredState}>
      <View style={styles.stateIcon}>
        <CourtCheckSymbol android="error" color={colors.teal} ios="exclamationmark.circle" size={25} />
      </View>
      <Text style={styles.stateTitle}>Unable to load facilities</Text>
      <Text style={styles.stateBody}>Check your connection and try again.</Text>
      <RetryButton onPress={onRetry} />
    </View>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.inlineError}>
      <View style={styles.inlineErrorCopy}>
        <CourtCheckSymbol android="error" color={colors.danger} ios="exclamationmark.circle" size={17} />
        <Text style={styles.inlineErrorText}>Activity could not be refreshed.</Text>
      </View>
      <RetryButton compact onPress={onRetry} />
    </View>
  );
}

function RetryButton({ compact = false, onPress }: { compact?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={compact ? 5 : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.retryButton,
        compact && styles.compactRetryButton,
        pressed && styles.pressed,
      ]}>
      <Text style={styles.retryButtonText}>Try again</Text>
    </Pressable>
  );
}

function CardSeparator() {
  return <View style={styles.cardSeparator} />;
}

function isReportedStatus(activityState: FacilityActivityState) {
  return activityState !== 'active' && activityState !== 'quiet';
}

function formatReportCount(count: number) {
  return `${count} ${count === 1 ? 'report' : 'reports'}`;
}

function getUsernameInitials(username: string | undefined) {
  if (!username) {
    return 'CC';
  }

  const uppercaseLetters = username.match(/[A-Z]/g)?.slice(0, 2).join('');
  return (uppercaseLetters || username.slice(0, 2)).toUpperCase();
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cloud,
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.card,
  },
  headingRow: {
    minHeight: controlHeights.compact,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headingCopy: {
    minWidth: 0,
    flex: 1,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: typeScale.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 2,
    color: colors.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.25,
  },
  avatar: {
    width: 34,
    height: 34,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md,
    borderRadius: 17,
    backgroundColor: colors.teal,
  },
  avatarText: {
    color: colors.white,
    fontSize: typeScale.caption,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  searchField: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.cloud,
  },
  searchInput: {
    minWidth: 0,
    flex: 1,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 13.5,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 24,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.card,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.025,
    shadowRadius: 8,
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.985 }],
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardIdentity: {
    minWidth: 0,
    flex: 1,
  },
  facilityName: {
    color: colors.ink,
    fontSize: 15.5,
    fontWeight: '800',
    lineHeight: 20,
  },
  address: {
    marginTop: 3,
    color: colors.inkMuted,
    fontSize: 12.5,
    lineHeight: 17,
  },
  countBadge: {
    minWidth: 64,
    flexShrink: 0,
    alignItems: 'center',
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    backgroundColor: colors.tealTint,
  },
  count: {
    color: colors.tealDark,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
  countLabel: {
    marginTop: 2,
    color: colors.tealDark,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 9,
    marginTop: 12,
  },
  metadataTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metadataText: {
    color: colors.inkMuted,
    fontSize: 11.5,
    fontWeight: '600',
    lineHeight: 16,
  },
  activityTag: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
  },
  reportedActivityTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  activityDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  activityText: {
    fontSize: 11.5,
    fontWeight: '700',
    lineHeight: 16,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 56,
  },
  stateIcon: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: colors.tealTint,
  },
  stateTitle: {
    marginTop: 14,
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateBody: {
    maxWidth: 300,
    marginTop: 7,
    color: colors.inkMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: controlHeights.compact,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 20,
    borderRadius: radii.md,
    backgroundColor: colors.teal,
  },
  compactRetryButton: {
    minHeight: 34,
    marginTop: 0,
    paddingHorizontal: 12,
  },
  retryButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '800',
  },
  inlineError: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#F1C7C2',
    borderRadius: radii.md,
    backgroundColor: '#FFF3F1',
  },
  inlineErrorCopy: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineErrorText: {
    flex: 1,
    color: colors.danger,
    fontSize: 12.5,
    fontWeight: '600',
  },
  cardSeparator: {
    height: 12,
  },
  pressed: {
    opacity: 0.72,
  },
});
