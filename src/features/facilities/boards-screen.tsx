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

import {
  type FacilityActivityState,
  type FacilitySummary,
} from '@/features/facilities/facilities-api';
import { useFacilities } from '@/features/facilities/use-facilities';
import { useAuth } from '@/features/auth/session-provider';

const ACTIVITY_PRESENTATION: Record<
  FacilityActivityState,
  { label: string; tone: 'active' | 'quiet' | 'warning' | 'closed' }
> = {
  courts_closed: { label: 'Courts closed', tone: 'closed' },
  maintenance: { label: 'Maintenance', tone: 'warning' },
  courts_wet_unsafe: { label: 'Courts wet / unsafe', tone: 'closed' },
  tournament_at_courts: { label: 'Tournament / Event', tone: 'warning' },
  courts_full: { label: 'Courts full', tone: 'warning' },
  active: { label: 'Active now', tone: 'active' },
  quiet: { label: 'Quiet', tone: 'quiet' },
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
          <View>
            <Text style={styles.eyebrow}>Clark County</Text>
            <Text style={styles.title}>Nearby courts</Text>
          </View>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => router.push('/(user)/profile')}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}>
            <Text style={styles.avatarText}>
              {getUsernameInitials(profile?.anonymous_username)}
            </Text>
          </Pressable>
        </View>

        <View style={styles.searchField}>
          <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.searchIcon}>
            ⌕
          </Text>
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
          {isRefreshing ? <ActivityIndicator color="#0E7C7C" size="small" /> : null}
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
              colors={['#0E7C7C']}
              onRefresh={refresh}
              refreshing={isRefreshing}
              tintColor="#0E7C7C"
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

function FacilityCard({
  facility,
  onPress,
}: {
  facility: FacilitySummary;
  onPress: () => void;
}) {
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
        <MetadataTag text={courtLabel} />
        <MetadataTag text={facility.has_lights ? 'Lights' : 'No lights'} />
        <MetadataTag text={facility.hours_text} />
        <View style={styles.activityTag}>
          {activity.tone === 'active' ? <View style={styles.liveDot} /> : null}
          <Text
            style={[
              styles.metadataText,
              activity.tone === 'closed' && styles.closedText,
              activity.tone === 'warning' && styles.warningText,
            ]}>
            {activityLabel}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function isReportedStatus(activityState: FacilityActivityState) {
  return activityState !== 'active' && activityState !== 'quiet';
}

function formatReportCount(count: number) {
  return `${count} ${count === 1 ? 'report' : 'reports'}`;
}

function MetadataTag({ text }: { text: string }) {
  return (
    <View style={styles.metadataTag}>
      <View style={styles.metadataDot} />
      <Text style={styles.metadataText}>{text}</Text>
    </View>
  );
}

function LoadingState() {
  return (
    <View accessibilityLiveRegion="polite" style={styles.centeredState}>
      <ActivityIndicator color="#0E7C7C" size="large" />
      <Text style={styles.stateTitle}>Finding nearby courts</Text>
      <Text style={styles.stateBody}>Loading current facility activity…</Text>
    </View>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <View style={styles.centeredState}>
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
      <Text style={styles.stateTitle}>Unable to load facilities</Text>
      <Text style={styles.stateBody}>Check your connection and try again.</Text>
      <RetryButton onPress={onRetry} />
    </View>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.inlineError}>
      <Text style={styles.inlineErrorText}>Activity could not be refreshed.</Text>
      <RetryButton compact onPress={onRetry} />
    </View>
  );
}

function RetryButton({ compact = false, onPress }: { compact?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
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
    backgroundColor: '#F3F7F6',
  },
  header: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCE5E3',
    backgroundColor: '#FFFFFF',
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: '#D76735',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 3,
    color: '#16263D',
    fontSize: 22,
    fontWeight: '800',
  },
  avatar: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
    backgroundColor: '#0E7C7C',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  searchField: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#D6E1DF',
    borderRadius: 12,
    backgroundColor: '#F3F7F6',
  },
  searchIcon: {
    color: '#667684',
    fontSize: 22,
    lineHeight: 22,
    transform: [{ rotate: '-20deg' }],
  },
  searchInput: {
    minWidth: 0,
    flex: 1,
    paddingVertical: 10,
    color: '#16263D',
    fontSize: 15,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 28,
  },
  list: {
    flex: 1,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCE5E3',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#16263D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
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
    color: '#16263D',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
  },
  address: {
    marginTop: 4,
    color: '#667684',
    fontSize: 13,
    lineHeight: 18,
  },
  countBadge: {
    minWidth: 66,
    alignItems: 'center',
    marginLeft: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#DFF1EE',
  },
  count: {
    color: '#0A6666',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 21,
  },
  countLabel: {
    marginTop: 2,
    color: '#0A6666',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  metadata: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 9,
    marginTop: 14,
  },
  metadataTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metadataDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A5B4B8',
  },
  metadataText: {
    color: '#5B6B7C',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  activityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#D76735',
  },
  closedText: {
    color: '#A63232',
  },
  warningText: {
    color: '#A9572F',
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 56,
  },
  stateTitle: {
    marginTop: 14,
    color: '#16263D',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateBody: {
    maxWidth: 300,
    marginTop: 7,
    color: '#667684',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#0E7C7C',
  },
  compactRetryButton: {
    minHeight: 36,
    marginTop: 0,
    paddingHorizontal: 14,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
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
  cardSeparator: {
    height: 12,
  },
  pressed: {
    opacity: 0.76,
  },
});
