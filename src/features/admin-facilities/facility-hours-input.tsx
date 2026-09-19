import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii, spacing } from '@/constants/theme';

type TimeField = 'closes' | 'opens';

export type FacilityHoursValue = {
  closesAtMinutes: number | null;
  isOpen24Hours: boolean;
  mode: 'legacy' | 'structured';
  opensAtMinutes: number | null;
  legacyText: string;
};

const DEFAULT_OPENING_MINUTES = 8 * 60;
const DEFAULT_CLOSING_MINUTES = 22 * 60;
const TIME_RANGE_PATTERN =
  /^\s*(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)\s*(?:–|—|-)\s*(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)\s*$/i;

export function createEmptyFacilityHours(): FacilityHoursValue {
  return {
    closesAtMinutes: null,
    isOpen24Hours: false,
    legacyText: '',
    mode: 'structured',
    opensAtMinutes: null,
  };
}

export function parseFacilityHours(hoursText: string): FacilityHoursValue {
  const normalized = hoursText.trim();
  if (/^open 24 hours$/i.test(normalized)) {
    return {
      ...createEmptyFacilityHours(),
      isOpen24Hours: true,
    };
  }

  const match = TIME_RANGE_PATTERN.exec(normalized);
  if (match) {
    return {
      closesAtMinutes: parseTimeParts(match[4], match[5], match[6]),
      isOpen24Hours: false,
      legacyText: '',
      mode: 'structured',
      opensAtMinutes: parseTimeParts(match[1], match[2], match[3]),
    };
  }

  if (normalized) {
    return {
      ...createEmptyFacilityHours(),
      legacyText: normalized,
      mode: 'legacy',
    };
  }

  return createEmptyFacilityHours();
}

export function serializeFacilityHours(value: FacilityHoursValue): string {
  if (value.mode === 'legacy') {
    return value.legacyText.trim();
  }

  if (value.isOpen24Hours) {
    return 'Open 24 hours';
  }

  if (value.opensAtMinutes === null || value.closesAtMinutes === null) {
    return '';
  }

  return `${formatTime(value.opensAtMinutes)} – ${formatTime(value.closesAtMinutes)}`;
}

export function FacilityHoursInput({
  error,
  onChange,
  value,
}: {
  error?: string;
  onChange: (value: FacilityHoursValue) => void;
  value: FacilityHoursValue;
}) {
  const safeAreaInsets = useSafeAreaInsets();
  const [activeField, setActiveField] = useState<TimeField | null>(null);
  const [draftTime, setDraftTime] = useState<Date | null>(null);

  const openPicker = (field: TimeField) => {
    const minutes =
      field === 'opens'
        ? value.opensAtMinutes ?? DEFAULT_OPENING_MINUTES
        : value.closesAtMinutes ?? DEFAULT_CLOSING_MINUTES;
    Keyboard.dismiss();
    setDraftTime(dateFromMinutes(minutes));
    setActiveField(field);
  };

  const applyTime = (field: TimeField, date: Date) => {
    const minutes = date.getHours() * 60 + date.getMinutes();
    onChange({
      ...value,
      closesAtMinutes: field === 'closes' ? minutes : value.closesAtMinutes,
      isOpen24Hours: false,
      legacyText: '',
      mode: 'structured',
      opensAtMinutes: field === 'opens' ? minutes : value.opensAtMinutes,
    });
  };

  const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      const field = activeField;
      setActiveField(null);
      setDraftTime(null);
      if (event.type === 'set' && field && selectedDate) {
        applyTime(field, selectedDate);
      }
      return;
    }

    if (selectedDate) {
      setDraftTime(selectedDate);
    }
  };

  const finishIosPicker = () => {
    if (activeField && draftTime) {
      applyTime(activeField, draftTime);
    }
    setActiveField(null);
    setDraftTime(null);
  };

  const cancelPicker = () => {
    setActiveField(null);
    setDraftTime(null);
  };

  const toggleOpen24Hours = (isOpen24Hours: boolean) => {
    cancelPicker();
    onChange({
      ...value,
      isOpen24Hours,
      legacyText: '',
      mode: 'structured',
    });
  };

  return (
    <View style={styles.container}>
      {value.mode === 'legacy' ? (
        <View style={styles.legacyNotice}>
          <Text style={styles.legacyLabel}>Saved hours</Text>
          <Text style={styles.legacyValue}>{value.legacyText}</Text>
          <Text style={styles.legacyHelp}>
            Choose opening and closing times to replace this legacy value.
          </Text>
        </View>
      ) : null}

      <View style={styles.timeRow}>
        <TimeButton
          disabled={value.isOpen24Hours}
          label="Opens"
          onPress={() => openPicker('opens')}
          value={value.opensAtMinutes === null ? null : formatTime(value.opensAtMinutes)}
        />
        <TimeButton
          disabled={value.isOpen24Hours}
          label="Closes"
          onPress={() => openPicker('closes')}
          value={value.closesAtMinutes === null ? null : formatTime(value.closesAtMinutes)}
        />
      </View>

      <View style={styles.openAllDayRow}>
        <View style={styles.openAllDayCopy}>
          <Text style={styles.openAllDayTitle}>Open 24 hours</Text>
          <Text style={styles.openAllDayHelp}>No daily closing time</Text>
        </View>
        <Switch
          accessibilityLabel="Open 24 hours"
          ios_backgroundColor="#A9B8B5"
          onValueChange={toggleOpen24Hours}
          thumbColor={colors.white}
          trackColor={{ false: '#A9B8B5', true: colors.teal }}
          value={value.isOpen24Hours}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {Platform.OS === 'android' && activeField && draftTime ? (
        <DateTimePicker
          display="default"
          minuteInterval={5}
          mode="time"
          onChange={handlePickerChange}
          value={draftTime}
        />
      ) : null}

      {Platform.OS === 'ios' && activeField && draftTime ? (
        <Modal
          animationType="fade"
          onRequestClose={cancelPicker}
          presentationStyle="overFullScreen"
          transparent
          visible>
          <View accessibilityViewIsModal style={styles.pickerModal}>
            <Pressable
              accessibilityLabel="Cancel time selection"
              accessibilityRole="button"
              onPress={cancelPicker}
              style={StyleSheet.absoluteFill}
            />
            <View
              style={[
                styles.iosPickerPanel,
                { paddingBottom: Math.max(safeAreaInsets.bottom, spacing.md) },
              ]}>
              <View style={styles.iosPickerHeader}>
                <Pressable
                  accessibilityRole="button"
                  onPress={cancelPicker}
                  style={({ pressed }) => [styles.pickerHeaderAction, pressed && styles.pressed]}>
                  <Text style={styles.pickerCancelText}>Cancel</Text>
                </Pressable>
                <Text accessibilityRole="header" style={styles.pickerTitle}>
                  {activeField === 'opens' ? 'Opening time' : 'Closing time'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={finishIosPicker}
                  style={({ pressed }) => [styles.pickerHeaderAction, pressed && styles.pressed]}>
                  <Text style={styles.pickerDoneText}>Done</Text>
                </Pressable>
              </View>
              <DateTimePicker
                display="spinner"
                minuteInterval={5}
                mode="time"
                onChange={handlePickerChange}
                value={draftTime}
              />
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function TimeButton({
  disabled,
  label,
  onPress,
  value,
}: {
  disabled: boolean;
  label: string;
  onPress: () => void;
  value: string | null;
}) {
  return (
    <View style={styles.timeField}>
      <Text style={styles.timeLabel}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label} time, ${value ?? 'not set'}`}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => [
          styles.timeButton,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}>
        <CourtCheckSymbol android="schedule" color={colors.teal} ios="clock" size={18} />
        <Text style={[styles.timeValue, !value && styles.timePlaceholder]}>
          {value ?? 'Select time'}
        </Text>
        <CourtCheckSymbol android="expand_more" color={colors.inkMuted} ios="chevron.down" size={14} />
      </Pressable>
    </View>
  );
}

function parseTimeParts(hourText: string, minuteText: string, meridiemText: string) {
  const hour = Number(hourText) % 12;
  const minute = Number(minuteText);
  return hour * 60 + minute + (meridiemText.toUpperCase() === 'PM' ? 12 * 60 : 0);
}

function formatTime(minutesAfterMidnight: number) {
  const hours24 = Math.floor(minutesAfterMidnight / 60) % 24;
  const minutes = minutesAfterMidnight % 60;
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

function dateFromMinutes(minutesAfterMidnight: number) {
  const date = new Date(2000, 0, 1, 0, 0, 0, 0);
  date.setHours(
    Math.floor(minutesAfterMidnight / 60),
    minutesAfterMidnight % 60,
    0,
    0,
  );
  return date;
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeField: { minWidth: 0, flex: 1, gap: 6 },
  timeLabel: { color: colors.ink, fontSize: 12.5, fontWeight: '800' },
  timeButton: {
    minHeight: controlHeights.default,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: '#FAFCFB',
  },
  timeValue: { minWidth: 0, flex: 1, color: colors.ink, fontSize: 14, fontWeight: '800' },
  timePlaceholder: { color: colors.inkMuted, fontWeight: '600' },
  openAllDayRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  openAllDayCopy: { minWidth: 0, flex: 1 },
  openAllDayTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  openAllDayHelp: { marginTop: 2, color: colors.inkMuted, fontSize: 12 },
  legacyNotice: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E6D5AE',
    borderRadius: radii.md,
    backgroundColor: '#FCF8EC',
  },
  legacyLabel: { color: colors.inkMuted, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  legacyValue: { marginTop: 3, color: colors.ink, fontSize: 14, fontWeight: '800' },
  legacyHelp: { marginTop: 4, color: colors.inkMuted, fontSize: 12, lineHeight: 17 },
  errorText: { color: colors.danger, fontSize: 12, lineHeight: 17 },
  pickerModal: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10, 35, 39, 0.42)',
  },
  iosPickerPanel: {
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    backgroundColor: colors.card,
  },
  iosPickerHeader: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  pickerHeaderAction: {
    minWidth: 64,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  pickerTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  pickerCancelText: { color: colors.inkMuted, fontSize: 14, fontWeight: '800' },
  pickerDoneText: { color: colors.tealDark, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  pressed: { opacity: 0.76 },
  disabled: { opacity: 0.5 },
});
