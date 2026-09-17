import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii, shadows, spacing, typeScale } from '@/constants/theme';
import {
  AdminFacilityMissingGeofenceError,
  type AdminFacilitySummary,
  setAdminFacilityActive,
} from '@/features/admin-facilities/admin-facilities-api';
import { useAdminFacilities } from '@/features/admin-facilities/use-admin-facilities';

type FacilityFilter = 'all' | 'active' | 'inactive';
type Feedback = { message: string; tone: 'error' | 'success' };

export function AdminFacilityListScreen() {
  const router = useRouter();
  const safeAreaInsets = useSafeAreaInsets();
  const { error, facilities, isInitialLoading, isRefreshing, reconcile, refresh } =
    useAdminFacilities();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FacilityFilter>('all');
  const [busyFacilityIds, setBusyFacilityIds] = useState<ReadonlySet<string>>(new Set());
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const actionInFlight = useRef(new Set<string>());
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const counts = useMemo(
    () => ({
      all: facilities.length,
      active: facilities.filter((facility) => facility.is_active).length,
      inactive: facilities.filter((facility) => !facility.is_active).length,
    }),
    [facilities],
  );

  const visibleFacilities = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();

    return facilities.filter((facility) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && facility.is_active) ||
        (filter === 'inactive' && !facility.is_active);
      const matchesSearch =
        normalizedSearch.length === 0 ||
        facility.name.toLocaleLowerCase().includes(normalizedSearch) ||
        facility.address.toLocaleLowerCase().includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [facilities, filter, search]);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
      if (feedbackTimer.current) {
        clearTimeout(feedbackTimer.current);
      }
    };
  }, []);

  const showFeedback = (nextFeedback: Feedback, autoDismiss = false) => {
    if (!isMounted.current) {
      return;
    }

    if (feedbackTimer.current) {
      clearTimeout(feedbackTimer.current);
      feedbackTimer.current = null;
    }

    setFeedback(nextFeedback);

    if (autoDismiss) {
      feedbackTimer.current = setTimeout(() => {
        feedbackTimer.current = null;
        setFeedback(null);
      }, 2800);
    }
  };

  const changeFacilityState = async (facility: AdminFacilitySummary, isActive: boolean) => {
    if (actionInFlight.current.has(facility.id)) {
      return;
    }

    actionInFlight.current.add(facility.id);
    setBusyFacilityIds((current) => new Set(current).add(facility.id));
    setFeedback(null);

    try {
      await setAdminFacilityActive(facility.id, isActive);
      const didRefresh = await reconcile();

      if (!isMounted.current) {
        return;
      }

      if (!didRefresh) {
        showFeedback({
          message: 'Facility updated, but the list could not refresh. Pull down to try again.',
          tone: 'error',
        });
        return;
      }

      showFeedback(
        { message: isActive ? 'Facility activated' : 'Facility deactivated', tone: 'success' },
        true,
      );
    } catch (actionError) {
      if (!isMounted.current) {
        return;
      }

      showFeedback({
        message:
          actionError instanceof AdminFacilityMissingGeofenceError
            ? 'This facility needs a check-in geofence before it can be activated.'
            : `Couldn’t ${isActive ? 'activate' : 'deactivate'} this facility. Please try again.`,
        tone: 'error',
      });
    } finally {
      actionInFlight.current.delete(facility.id);
      if (isMounted.current) {
        setBusyFacilityIds((current) => {
          const next = new Set(current);
          next.delete(facility.id);
          return next;
        });
      }
    }
  };

  const requestStateChange = (facility: AdminFacilitySummary) => {
    if (facility.is_active) {
      Alert.alert(
        'Deactivate facility?',
        'This removes the facility from player discovery, closes current check-ins, and ends current facility status reports.',
        [
          { style: 'cancel', text: 'Cancel' },
          {
            onPress: () => void changeFacilityState(facility, false),
            style: 'destructive',
            text: 'Deactivate',
          },
        ],
      );
      return;
    }

    void changeFacilityState(facility, true);
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(admin)/admin');
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.topRow}>
          <Pressable
            accessibilityLabel="Back to admin home"
            accessibilityRole="button"
            hitSlop={6}
            onPress={goBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
            <CourtCheckSymbol android="arrow_back" color={colors.tealDark} ios="chevron.left" size={20} />
          </Pressable>
          <View style={styles.headingCopy}>
            <Text style={styles.eyebrow}>Admin</Text>
            <Text accessibilityRole="header" style={styles.title}>Facilities</Text>
          </View>
          <Pressable
            accessibilityLabel="Create facility"
            accessibilityRole="button"
            onPress={() => router.push('/(admin)/admin/facilities/new')}
            style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
            <CourtCheckSymbol android="add" color={colors.white} ios="plus" size={18} />
            <Text style={styles.createButtonText}>Create</Text>
          </Pressable>
        </View>
        <Text style={styles.headerDescription}>
          Manage the courts available throughout CourtCheck.
        </Text>

        <View style={styles.searchField}>
          <CourtCheckSymbol android="search" color={colors.inkMuted} ios="magnifyingglass" size={17} />
          <TextInput
            accessibilityLabel="Search managed facilities"
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={setSearch}
            placeholder="Search name or address"
            placeholderTextColor="#7B8B96"
            returnKeyType="search"
            style={styles.searchInput}
            value={search}
          />
          {isRefreshing ? <ActivityIndicator color={colors.teal} size="small" /> : null}
        </View>

        <View accessibilityRole="tablist" style={styles.filters}>
          {(['all', 'active', 'inactive'] as const).map((value) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === value }}
              key={value}
              onPress={() => setFilter(value)}
              style={({ pressed }) => [
                styles.filter,
                filter === value && styles.selectedFilter,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.filterText, filter === value && styles.selectedFilterText]}>
                {formatFilterLabel(value)} {counts[value]}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isInitialLoading ? (
        <LoadingState />
      ) : error && facilities.length === 0 ? (
        <ErrorState onRetry={() => void refresh()} />
      ) : (
        <FlatList
          contentContainerStyle={[
            styles.listContent,
            visibleFacilities.length === 0 && styles.emptyListContent,
          ]}
          data={visibleFacilities}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          keyExtractor={(facility) => facility.id}
          ListEmptyComponent={
            <EmptyState
              filter={filter}
              hasFacilities={facilities.length > 0}
              hasSearch={search.trim().length > 0}
            />
          }
          ListHeaderComponent={error ? <InlineError onRetry={() => void refresh()} /> : null}
          refreshControl={
            <RefreshControl
              colors={[colors.teal]}
              onRefresh={() => void refresh()}
              refreshing={isRefreshing}
              tintColor={colors.teal}
            />
          }
          renderItem={({ item }) => (
            <FacilityCard
              facility={item}
              isBusy={busyFacilityIds.has(item.id)}
              onChangeState={() => requestStateChange(item)}
              onEdit={() =>
                router.push({
                  pathname: '/(admin)/admin/facilities/[facilityId]',
                  params: { facilityId: item.id },
                })
              }
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      )}

      {feedback ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.feedback,
            { bottom: safeAreaInsets.bottom + spacing.lg },
            feedback.tone === 'success' ? styles.successFeedback : styles.errorFeedback,
          ]}>
          <CourtCheckSymbol
            android={feedback.tone === 'success' ? 'check_circle' : 'error'}
            color={colors.white}
            ios={feedback.tone === 'success' ? 'checkmark.circle.fill' : 'exclamationmark.circle.fill'}
            size={18}
          />
          <Text style={styles.feedbackText}>{feedback.message}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function FacilityCard({
  facility,
  isBusy,
  onChangeState,
  onEdit,
}: {
  facility: AdminFacilitySummary;
  isBusy: boolean;
  onChangeState: () => void;
  onEdit: () => void;
}) {
  const courtLabel = `${facility.court_count} ${facility.court_count === 1 ? 'court' : 'courts'}`;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeading}>
        <View style={styles.cardIdentity}>
          <Text style={styles.facilityName}>{facility.name}</Text>
          <Text style={styles.address}>{facility.address}</Text>
        </View>
        <View style={[styles.stateBadge, facility.is_active ? styles.activeBadge : styles.inactiveBadge]}>
          <View style={[styles.stateDot, facility.is_active ? styles.activeDot : styles.inactiveDot]} />
          <Text style={[styles.stateText, facility.is_active ? styles.activeText : styles.inactiveText]}>
            {facility.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      <View style={styles.metadata}>
        <View style={styles.metadataItem}>
          <CourtCheckSymbol android="grid_view" color={colors.inkMuted} ios="square.grid.2x2" size={14} />
          <Text style={styles.metadataText}>{courtLabel}</Text>
        </View>
        {facility.verified_by ? (
          <View style={styles.metadataItem}>
            <CourtCheckSymbol android="verified" color={colors.teal} ios="checkmark.seal" size={14} />
            <Text numberOfLines={1} style={styles.metadataText}>Verified by {facility.verified_by}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.cardActions}>
        <Pressable
          accessibilityLabel={`Edit ${facility.name}`}
          accessibilityRole="button"
          disabled={isBusy}
          onPress={onEdit}
          style={({ pressed }) => [styles.editButton, isBusy && styles.disabled, pressed && styles.pressed]}>
          <CourtCheckSymbol android="edit" color={colors.tealDark} ios="pencil" size={16} />
          <Text style={styles.editButtonText}>Edit</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={`${facility.is_active ? 'Deactivate' : 'Activate'} ${facility.name}`}
          accessibilityRole="button"
          accessibilityState={{ busy: isBusy, disabled: isBusy }}
          disabled={isBusy}
          onPress={onChangeState}
          style={({ pressed }) => [
            styles.stateAction,
            facility.is_active ? styles.deactivateButton : styles.activateButton,
            isBusy && styles.disabled,
            pressed && styles.pressed,
          ]}>
          {isBusy ? (
            <ActivityIndicator color={facility.is_active ? colors.orange : colors.white} size="small" />
          ) : (
            <CourtCheckSymbol
              android={facility.is_active ? 'visibility_off' : 'check_circle'}
              color={facility.is_active ? colors.orange : colors.white}
              ios={facility.is_active ? 'eye.slash' : 'checkmark.circle'}
              size={16}
            />
          )}
          <Text style={facility.is_active ? styles.deactivateText : styles.activateText}>
            {isBusy ? 'Updating…' : facility.is_active ? 'Deactivate' : 'Activate'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function LoadingState() {
  return (
    <View accessibilityLiveRegion="polite" style={styles.centeredState}>
      <View style={styles.stateIcon}><ActivityIndicator color={colors.teal} size="large" /></View>
      <Text style={styles.stateTitle}>Loading facilities</Text>
      <Text style={styles.stateBody}>Getting the latest management details…</Text>
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

function EmptyState({
  filter,
  hasFacilities,
  hasSearch,
}: {
  filter: FacilityFilter;
  hasFacilities: boolean;
  hasSearch: boolean;
}) {
  const isFiltered = filter !== 'all';
  const title = hasSearch
    ? 'No matching facilities'
    : isFiltered
      ? `No ${filter} facilities`
      : 'No facilities yet';
  const body = hasSearch
    ? 'Try another facility name or address.'
    : isFiltered && hasFacilities
      ? `No facilities currently match the ${filter} filter.`
      : 'Create the first facility when the editor is available.';

  return (
    <View style={styles.centeredState}>
      <View style={styles.stateIcon}>
        <CourtCheckSymbol android={hasSearch ? 'search' : 'location_city'} color={colors.teal} ios={hasSearch ? 'magnifyingglass' : 'building.2'} size={24} />
      </View>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateBody}>{body}</Text>
    </View>
  );
}

function InlineError({ onRetry }: { onRetry: () => void }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.inlineError}>
      <CourtCheckSymbol android="warning" color={colors.danger} ios="exclamationmark.triangle" size={17} />
      <Text style={styles.inlineErrorText}>Facility details could not be refreshed.</Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onRetry}>
        <Text style={styles.retryLink}>Retry</Text>
      </Pressable>
    </View>
  );
}

function RetryButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
      <Text style={styles.retryButtonText}>Try again</Text>
    </Pressable>
  );
}

function formatFilterLabel(filter: FacilityFilter) {
  return filter.charAt(0).toUpperCase() + filter.slice(1);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cloud },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.card,
  },
  topRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  headingCopy: { minWidth: 0, flex: 1 },
  eyebrow: {
    color: colors.teal,
    fontSize: typeScale.eyebrow,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: { marginTop: 2, color: colors.ink, fontSize: 25, fontWeight: '900' },
  createButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 13,
    borderRadius: radii.md,
    backgroundColor: colors.orange,
  },
  createButtonText: { color: colors.white, fontSize: 13.5, fontWeight: '900' },
  headerDescription: { marginTop: 7, color: colors.inkMuted, fontSize: 13, lineHeight: 18 },
  searchField: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: spacing.lg,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.lg,
    backgroundColor: colors.cloud,
  },
  searchInput: { minWidth: 0, flex: 1, paddingVertical: 0, color: colors.ink, fontSize: 14.5 },
  filters: { flexDirection: 'row', gap: 8, marginTop: 12 },
  filter: {
    minHeight: 38,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
  },
  selectedFilter: { borderColor: colors.teal, backgroundColor: colors.tealTint },
  filterText: { color: colors.inkMuted, fontSize: 12.5, fontWeight: '800' },
  selectedFilterText: { color: colors.tealDark },
  listContent: { padding: spacing.xl, paddingBottom: 110 },
  emptyListContent: { flexGrow: 1 },
  separator: { height: 12 },
  card: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.xl,
    backgroundColor: colors.card,
    ...shadows.card,
  },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardIdentity: { minWidth: 0, flex: 1 },
  facilityName: { color: colors.ink, fontSize: 16.5, fontWeight: '900', lineHeight: 21 },
  address: { marginTop: 4, color: colors.inkMuted, fontSize: 12.5, lineHeight: 18 },
  stateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  activeBadge: { backgroundColor: colors.tealTint },
  inactiveBadge: { backgroundColor: '#EEF1F1' },
  stateDot: { width: 7, height: 7, borderRadius: 4 },
  activeDot: { backgroundColor: colors.teal },
  inactiveDot: { backgroundColor: '#829099' },
  stateText: { fontSize: 11.5, fontWeight: '900' },
  activeText: { color: colors.tealDark },
  inactiveText: { color: colors.inkMuted },
  metadata: { gap: 7, marginTop: 14 },
  metadataItem: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  metadataText: { minWidth: 0, flexShrink: 1, color: colors.inkMuted, fontSize: 12.5, lineHeight: 17 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: spacing.lg },
  editButton: {
    minHeight: controlHeights.compact,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.teal,
    borderRadius: radii.md,
  },
  editButtonText: { color: colors.tealDark, fontSize: 13, fontWeight: '900' },
  stateAction: {
    minHeight: controlHeights.compact,
    flex: 1.35,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radii.md,
  },
  activateButton: { backgroundColor: colors.teal },
  deactivateButton: { borderWidth: 1, borderColor: '#EDC9BA', backgroundColor: colors.orangeTint },
  activateText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  deactivateText: { color: colors.orange, fontSize: 13, fontWeight: '900' },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: 48,
  },
  stateIcon: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: colors.tealTint,
  },
  stateTitle: { marginTop: 15, color: colors.ink, fontSize: 19, fontWeight: '900', textAlign: 'center' },
  stateBody: { maxWidth: 300, marginTop: 6, color: colors.inkMuted, fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
  retryButton: { minHeight: 44, justifyContent: 'center', marginTop: 16, paddingHorizontal: 20, borderRadius: radii.md, backgroundColor: colors.teal },
  retryButtonText: { color: colors.white, fontSize: 13.5, fontWeight: '900' },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F0D1D1',
    borderRadius: radii.md,
    backgroundColor: '#FFF4F4',
  },
  inlineErrorText: { minWidth: 0, flex: 1, color: colors.danger, fontSize: 12.5, lineHeight: 17 },
  retryLink: { color: colors.danger, fontSize: 12.5, fontWeight: '900' },
  feedback: {
    position: 'absolute',
    right: spacing.xl,
    left: spacing.xl,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    ...shadows.button,
  },
  successFeedback: { backgroundColor: colors.tealDark },
  errorFeedback: { backgroundColor: colors.danger },
  feedbackText: { minWidth: 0, flexShrink: 1, color: colors.white, fontSize: 13, fontWeight: '800', lineHeight: 18 },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
});
