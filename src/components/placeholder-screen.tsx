import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type PlaceholderScreenProps = PropsWithChildren<{
  description: string;
  title: string;
}>;

export function PlaceholderScreen({ children, description, title }: PlaceholderScreenProps) {
  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>CourtCheck route skeleton</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {children ? <View style={styles.links}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#F3F7F6',
  },
  eyebrow: {
    color: '#0E7C7C',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#16263D',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    maxWidth: 360,
    color: '#5B6B7C',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  links: {
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
});
