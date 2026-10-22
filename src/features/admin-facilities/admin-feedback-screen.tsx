import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii, shadows, spacing, typeScale } from '@/constants/theme';
import {
  type AdminFacilityFeedback,
  listAdminFacilityFeedback,
  setAdminFacilityFeedbackStatus,
} from '@/features/admin-facilities/admin-feedback-api';

export function AdminFeedbackScreen() {
  const router = useRouter();
  const [items, setItems] = useState<AdminFacilityFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const isMounted = useRef(true);
  const requestId = useRef(0);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      requestId.current += 1;
    };
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    const currentRequestId = ++requestId.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const nextItems = await listAdminFacilityFeedback();
      if (!isMounted.current || currentRequestId !== requestId.current) return;
      setItems(nextItems);
      setError(null);
    } catch {
      if (!isMounted.current || currentRequestId !== requestId.current) return;
      setError('Player feedback could not be loaded. Please try again.');
    } finally {
      if (isMounted.current && currentRequestId === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const updateStatus = async (item: AdminFacilityFeedback, status: AdminFacilityFeedback['status']) => {
    if (busyId) return;
    setBusyId(item.id);
    try {
      await setAdminFacilityFeedbackStatus(item.id, status);
      if (!isMounted.current) return;
      await load(true);
    } catch {
      if (isMounted.current) setError('Feedback could not be updated. Please try again.');
    } finally {
      if (isMounted.current) setBusyId(null);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back to Admin Home" accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
          <CourtCheckSymbol android="arrow_back" color={colors.tealDark} ios="chevron.left" size={21} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>ADMIN</Text>
          <Text accessibilityRole="header" style={styles.title}>Facility feedback</Text>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={() => void load(true)} refreshing={refreshing} tintColor={colors.teal} />}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Player notes about facility information and new park suggestions.</Text>
        {error ? (
          <Pressable accessibilityRole="button" onPress={() => void load()} style={styles.errorCard}>
            <Text style={styles.errorText}>{error} Tap to retry.</Text>
          </Pressable>
        ) : null}
        {loading ? <ActivityIndicator color={colors.teal} size="large" style={styles.loader} /> : null}
        {!loading && !error && items.length === 0 ? (
          <View style={styles.emptyCard}><Text style={styles.emptyText}>No player feedback yet.</Text></View>
        ) : null}
        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category === 'suggest_facility' ? 'New park suggestion' : 'Facility information'}</Text>
              </View>
              <Text style={[styles.status, item.status === 'resolved' && styles.resolved]}>{item.status}</Text>
            </View>
            {item.facilityName ? <Text style={styles.facilityName}>{item.facilityName}</Text> : null}
            <Text style={styles.message}>{item.message}</Text>
            <Text style={styles.meta}>
              {item.reporterUsername ? `${item.reporterUsername} · ` : ''}{formatDate(item.createdAt)}
            </Text>
            {item.status !== 'resolved' ? (
              <View style={styles.actions}>
                {item.status === 'new' ? (
                  <FeedbackAction busy={busyId === item.id} label="Mark reviewed" onPress={() => void updateStatus(item, 'reviewed')} />
                ) : null}
                <FeedbackAction busy={busyId === item.id} label="Resolve" onPress={() => void updateStatus(item, 'resolved')} primary />
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function FeedbackAction({ busy, label, onPress, primary = false }: { busy: boolean; label: string; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ busy, disabled: busy }} disabled={busy} onPress={onPress} style={[styles.action, primary && styles.primaryAction]}>
      {busy ? <ActivityIndicator color={primary ? colors.white : colors.teal} size="small" /> : <Text style={[styles.actionText, primary && styles.primaryActionText]}>{label}</Text>}
    </Pressable>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cloud },
  header: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.card },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.tealTint },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.teal, fontSize: typeScale.eyebrow, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 2, color: colors.ink, fontSize: 22, fontWeight: '900' },
  content: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xxxl },
  intro: { marginBottom: spacing.xs, color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
  loader: { marginTop: spacing.xl },
  card: { gap: spacing.sm, padding: spacing.lg, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, backgroundColor: colors.card, ...shadows.card },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  categoryBadge: { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radii.md, backgroundColor: colors.tealTint },
  categoryText: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
  status: { color: colors.orange, fontSize: 12, fontWeight: '900', textTransform: 'capitalize' },
  resolved: { color: colors.teal },
  facilityName: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  message: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  meta: { color: colors.inkMuted, fontSize: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.xs },
  action: { minHeight: controlHeights.compact, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.teal, borderRadius: radii.md },
  actionText: { color: colors.tealDark, fontSize: 13, fontWeight: '800' },
  primaryAction: { backgroundColor: colors.teal },
  primaryActionText: { color: colors.white },
  errorCard: { padding: spacing.md, borderRadius: radii.md, backgroundColor: '#FFF0EB' },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  emptyCard: { alignItems: 'center', padding: spacing.xl, borderWidth: 1, borderColor: colors.line, borderRadius: radii.lg, backgroundColor: colors.card },
  emptyText: { color: colors.inkMuted, fontSize: 14 },
});
