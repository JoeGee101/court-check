import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typeScale } from '@/constants/theme';
import type { LegalContentBlock, LegalDocument } from '@/features/legal/legal-content';

export function LegalDocumentScreen({ document }: { document: LegalDocument }) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{document.status}</Text>
        </View>

        {document.sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {section.title}
            </Text>
            {section.blocks.map((block, blockIndex) => (
              <LegalBlock block={block} key={`${section.title}-${blockIndex}`} />
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function LegalBlock({ block }: { block: LegalContentBlock }) {
  if (block.type === 'subheading') {
    return (
      <Text accessibilityRole="header" style={styles.subheading}>
        {block.text}
      </Text>
    );
  }

  if (block.type === 'bullets') {
    return (
      <View style={styles.bulletList}>
        {block.items.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Text accessible={false} style={styles.bulletMark}>
              •
            </Text>
            <Text style={styles.bodyText}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.paragraphGroup}>
      {block.paragraphs.map((paragraph) => (
        <Text key={paragraph} style={styles.bodyText}>
          {paragraph}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cloud,
  },
  content: {
    gap: spacing.xxl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: 48,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
  },
  statusText: {
    color: colors.inkMuted,
    fontSize: typeScale.caption,
    fontWeight: '700',
  },
  section: {
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
  },
  subheading: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  paragraphGroup: {
    gap: spacing.md,
  },
  bodyText: {
    minWidth: 0,
    flex: 1,
    color: colors.inkMuted,
    fontSize: typeScale.body,
    lineHeight: 24,
  },
  bulletList: {
    gap: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bulletMark: {
    color: colors.teal,
    fontSize: 18,
    lineHeight: 24,
  },
});
