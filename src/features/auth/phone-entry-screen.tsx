import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CourtCheckSymbol } from '@/components/ui/courtcheck-symbol';
import { colors, controlHeights, radii, spacing, typeScale } from '@/constants/theme';
import { AuthButton, AuthFeedback, AuthScreen, authStyles } from '@/features/auth/auth-ui';
import { usePhoneAuth } from '@/features/auth/phone-auth-context';
import {
  createSmsOtpConsentRequestKey,
  formatNationalPhoneInput,
  isValidNationalPhone,
  PHONE_COUNTRIES,
  recordSmsOtpConsent,
  requestPhoneOtp,
  toPhoneE164,
  type PhoneCountry,
} from '@/features/auth/phone-otp';
import { useAuth } from '@/features/auth/session-provider';

const SAFE_REQUEST_ERRORS = new Set([
  'We could not save your SMS consent. Please try again.',
  'Too many code requests. Wait a moment before trying again.',
  'We could not send a verification code. Check the number and try again.',
  'Enter a valid international phone number.',
]);

export function PhoneEntryScreen() {
  const router = useRouter();
  const { beginVerification } = usePhoneAuth();
  const { error: sessionError } = useAuth();
  const [country, setCountry] = useState(PHONE_COUNTRIES[0]);
  const [isCountrySelectorOpen, setIsCountrySelectorOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [hasConsented, setHasConsented] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPhoneFocused, setIsPhoneFocused] = useState(false);
  const submissionInFlight = useRef(false);
  const consentRequestKey = useRef<string | null>(null);
  const isPhoneValid = isValidNationalPhone(country, phone);
  const hasPhoneValidationError = feedback?.startsWith('Enter a valid phone number') ?? false;

  const handleSubmit = async () => {
    if (submissionInFlight.current) {
      return;
    }

    if (!isValidNationalPhone(country, phone)) {
      setFeedback(`Enter a valid phone number for ${country.name}.`);
      return;
    }

    if (!hasConsented) {
      setFeedback('Confirm SMS consent before requesting a verification code.');
      return;
    }

    submissionInFlight.current = true;
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const phoneE164 = toPhoneE164(country, phone);
      const requestKey = consentRequestKey.current ?? createSmsOtpConsentRequestKey();
      consentRequestKey.current = requestKey;

      await recordSmsOtpConsent(phoneE164, requestKey);
      await requestPhoneOtp(phoneE164);
      beginVerification(phoneE164);
      router.push('/(auth)/verify');
    } catch (requestError) {
      setFeedback(getSafeRequestError(requestError));
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen
      description="We'll text a 6-digit code to verify it's really you. Phone verification is required to check in on any court."
      eyebrow="Secure sign-in"
      onBack={() => router.replace('/(auth)')}
      progress={1 / 3}
      title="What's your number?">
      <View style={authStyles.section}>
        <Text style={authStyles.label}>Phone number</Text>
        <View
          style={[
            styles.phoneField,
            isPhoneFocused && styles.focusedPhoneField,
            hasPhoneValidationError && styles.invalidPhoneField,
          ]}>
          <Pressable
            accessibilityLabel={`Choose country or region. Current selection ${country.name}, ${country.dialCode}`}
            accessibilityRole="button"
            disabled={isSubmitting}
            hitSlop={4}
            onPress={() => {
              Keyboard.dismiss();
              setIsCountrySelectorOpen(true);
            }}
            style={({ pressed }) => [styles.callingCodeButton, pressed && styles.pressed]}>
            <Text style={styles.countryCode}>{country.dialCode}</Text>
            <CourtCheckSymbol android="expand_more" color={colors.inkMuted} ios="chevron.down" size={14} />
          </Pressable>
          <View style={styles.phoneDivider} />
          <TextInput
            accessibilityLabel={`Phone number for ${country.name}`}
            autoComplete="tel"
            editable={!isSubmitting}
            keyboardType="phone-pad"
            onBlur={() => setIsPhoneFocused(false)}
            onChangeText={(value) => {
              setPhone(formatNationalPhoneInput(country, value));
              setHasConsented(false);
              consentRequestKey.current = null;
              setFeedback(null);
            }}
            onFocus={() => setIsPhoneFocused(true)}
            onSubmitEditing={() => void handleSubmit()}
            placeholder={formatNationalPhoneInput(country, country.example)}
            placeholderTextColor="#93A1A8"
            returnKeyType="send"
            style={styles.phoneInput}
            textContentType="telephoneNumber"
            value={phone}
          />
        </View>
        <Text style={styles.countryHint}>{country.name}</Text>
      </View>

      <CountrySelector
        isOpen={isCountrySelectorOpen}
        onClose={() => setIsCountrySelectorOpen(false)}
        onSelect={(selectedCountry) => {
          setCountry(selectedCountry);
          setPhone('');
          setHasConsented(false);
          consentRequestKey.current = null;
          setFeedback(null);
          setIsCountrySelectorOpen(false);
        }}
        selectedCountry={country}
      />

      <View style={styles.consentArea}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: hasConsented }}
          disabled={isSubmitting}
          onPress={() => {
            setHasConsented((isConsented) => {
              if (isConsented) {
                consentRequestKey.current = null;
              }
              return !isConsented;
            });
            setFeedback(null);
          }}
          style={styles.consentRow}>
          <View style={[styles.checkbox, hasConsented && styles.checkedCheckbox]}>
            {hasConsented ? (
              <CourtCheckSymbol android="check" color={colors.white} ios="checkmark" size={13} />
            ) : null}
          </View>
          <View style={styles.consentCopy}>
            <Text style={styles.consentText}>
              I agree to receive a verification code by SMS at this number.
            </Text>
            <Text style={styles.ratesText}>Standard message and data rates may apply.</Text>
          </View>
        </Pressable>

        <View style={styles.legalArea}>
          <Text style={styles.legalText}>By continuing, you agree to the</Text>
          <View style={styles.legalLinks}>
            <Pressable
              accessibilityLabel="Open Terms of Service"
              accessibilityRole="link"
              hitSlop={4}
              onPress={() => router.push('/legal/terms')}
              style={({ pressed }) => [styles.legalLinkButton, pressed && styles.pressed]}>
              <Text style={styles.legalLinkText}>Terms of Service</Text>
            </Pressable>
            <Text style={styles.legalText}>and acknowledge the</Text>
            <Pressable
              accessibilityLabel="Open Privacy Policy"
              accessibilityRole="link"
              hitSlop={4}
              onPress={() => router.push('/legal/privacy')}
              style={({ pressed }) => [styles.legalLinkButton, pressed && styles.pressed]}>
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
            </Pressable>
            <Text style={styles.legalText}>.</Text>
          </View>
        </View>
      </View>

      {sessionError ? (
        <AuthFeedback>Sign-in is not configured for this build. Check the development setup.</AuthFeedback>
      ) : null}
      {feedback ? <AuthFeedback>{feedback}</AuthFeedback> : null}
      <AuthButton
        disabled={!isPhoneValid || !hasConsented}
        isLoading={isSubmitting}
        onPress={() => void handleSubmit()}
        title="Send verification code"
      />
    </AuthScreen>
  );
}

type CountrySelectorProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (country: PhoneCountry) => void;
  selectedCountry: PhoneCountry;
};

function CountrySelector({ isOpen, onClose, onSelect, selectedCountry }: CountrySelectorProps) {
  return (
    <Modal
      allowSwipeDismissal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={isOpen}>
      <SafeAreaView edges={['bottom']} style={styles.modalScreen}>
        <View style={styles.dragHandle} />
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Country or region</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.countryList} showsVerticalScrollIndicator={false}>
          <View style={styles.countryListCard}>
            {PHONE_COUNTRIES.map((option, index) => {
              const isSelected = option.code === selectedCountry.code;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  key={option.code}
                  onPress={() => onSelect(option)}
                  style={({ pressed }) => [
                    styles.countryOption,
                    index < PHONE_COUNTRIES.length - 1 && styles.countryOptionDivider,
                    isSelected && styles.selectedCountryOption,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.countryOptionName}>{option.name}</Text>
                  <View style={styles.countryOptionEnd}>
                    <Text style={styles.countryOptionCode}>{option.dialCode}</Text>
                    <View style={styles.selectedMarkSlot}>
                      {isSelected ? (
                        <CourtCheckSymbol android="check" color={colors.teal} ios="checkmark" size={17} />
                      ) : null}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function getSafeRequestError(error: unknown) {
  if (error instanceof Error && SAFE_REQUEST_ERRORS.has(error.message)) {
    return error.message;
  }
  return 'We could not send a verification code. Please try again.';
}

const styles = StyleSheet.create({
  phoneField: {
    minHeight: controlHeights.phone,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radii.md,
    backgroundColor: colors.card,
  },
  focusedPhoneField: {
    borderColor: colors.teal,
  },
  invalidPhoneField: {
    borderColor: colors.danger,
  },
  callingCodeButton: {
    minWidth: 78,
    minHeight: controlHeights.phone,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
  },
  countryCode: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: '800',
  },
  phoneDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.line,
  },
  phoneInput: {
    minWidth: 0,
    minHeight: controlHeights.phone,
    flex: 1,
    paddingHorizontal: 14,
    color: colors.ink,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  countryHint: {
    color: colors.inkMuted,
    fontSize: typeScale.caption,
  },
  consentArea: {
    gap: spacing.sm,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    borderWidth: 1.5,
    borderColor: colors.inkMuted,
    borderRadius: 5,
    backgroundColor: colors.card,
  },
  checkedCheckbox: {
    borderColor: colors.teal,
    backgroundColor: colors.teal,
  },
  consentCopy: {
    minWidth: 0,
    flex: 1,
    gap: 3,
  },
  consentText: {
    color: colors.ink,
    fontSize: 13.5,
    lineHeight: 20,
  },
  ratesText: {
    color: colors.inkMuted,
    fontSize: typeScale.caption,
    lineHeight: 18,
  },
  legalArea: {
    alignItems: 'flex-start',
    gap: 0,
    marginLeft: 34,
  },
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    columnGap: 4,
    rowGap: 0,
  },
  legalText: {
    color: colors.inkMuted,
    fontSize: typeScale.caption,
    lineHeight: 17,
  },
  legalLinkButton: {
    minHeight: controlHeights.compact,
    justifyContent: 'center',
  },
  legalLinkText: {
    color: colors.tealDark,
    fontSize: typeScale.caption,
    fontWeight: '700',
    lineHeight: 17,
    textDecorationLine: 'underline',
  },
  pressed: {
    opacity: 0.68,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: colors.cloud,
  },
  dragHandle: {
    width: 38,
    height: 5,
    alignSelf: 'center',
    marginTop: 10,
    borderRadius: radii.pill,
    backgroundColor: '#CAD4D2',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: colors.card,
  },
  modalTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '800',
  },
  closeButton: {
    minHeight: controlHeights.compact,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  closeButtonText: {
    color: colors.teal,
    fontSize: 16,
    fontWeight: '800',
  },
  countryList: {
    padding: 16,
    paddingBottom: 40,
  },
  countryListCard: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  countryOption: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
  },
  countryOptionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  selectedCountryOption: {
    backgroundColor: colors.tealTint,
  },
  countryOptionName: {
    color: colors.ink,
    fontSize: typeScale.body,
    fontWeight: '700',
  },
  countryOptionCode: {
    color: colors.inkMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  countryOptionEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedMarkSlot: {
    width: 18,
    height: 18,
  },
});
