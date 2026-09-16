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

export default function AuthenticationScreen() {
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
      setFeedback(getErrorMessage(requestError));
    } finally {
      submissionInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen
      compact
      description="Enter your phone number and we'll send you a 6-digit verification code."
      eyebrow="Secure sign-in">
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
            style={({ pressed }) => [
              styles.callingCodeButton,
              pressed && styles.pressedField,
            ]}>
            <Text style={styles.countryCode}>{country.dialCode}</Text>
            <Text style={styles.chevron}>⌄</Text>
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
          <Text style={styles.checkmark}>{hasConsented ? '✓' : ''}</Text>
        </View>
        <View style={styles.consentCopy}>
          <Text style={styles.consentText}>
            I agree to receive a verification code by SMS at this number.
          </Text>
          <Text style={styles.ratesText}>Standard message and data rates may apply.</Text>
        </View>
      </Pressable>

      <View style={styles.legalArea}>
        <View style={styles.legalLinks}>
          <Text style={styles.legalText}>Review our</Text>
          <Text accessibilityState={{ disabled: true }} style={styles.pendingLink}>
            Terms of Service
          </Text>
          <Text style={styles.legalText}>and</Text>
          <Text accessibilityState={{ disabled: true }} style={styles.pendingLink}>
            Privacy Policy
          </Text>
          <Text style={styles.legalText}>.</Text>
        </View>
        <Text style={styles.pendingNote}>Links will be enabled when published.</Text>
      </View>

      {sessionError ? <AuthFeedback>{sessionError}</AuthFeedback> : null}
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

function CountrySelector({
  isOpen,
  onClose,
  onSelect,
  selectedCountry,
}: CountrySelectorProps) {
  return (
    <Modal
      allowSwipeDismissal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="pageSheet"
      visible={isOpen}>
      <View style={styles.modalScreen}>
        <View style={styles.dragHandle} />
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Country or region</Text>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>Done</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.countryList}
          showsVerticalScrollIndicator={false}>
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
                    pressed && styles.pressedField,
                  ]}>
                  <Text style={styles.countryOptionName}>{option.name}</Text>
                  <View style={styles.countryOptionEnd}>
                    <Text style={styles.countryOptionCode}>{option.dialCode}</Text>
                    <Text style={styles.selectedCountryMark}>{isSelected ? '✓' : ''}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}

const styles = StyleSheet.create({
  pressedField: {
    opacity: 0.65,
  },
  chevron: {
    marginTop: -3,
    color: '#687A82',
    fontSize: 18,
  },
  phoneField: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8D5D3',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    shadowColor: '#16263D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  focusedPhoneField: {
    borderWidth: 1.5,
    borderColor: '#0E7C7C',
    shadowColor: '#0E7C7C',
    shadowOpacity: 0.1,
  },
  invalidPhoneField: {
    borderColor: '#B33A3A',
  },
  callingCodeButton: {
    minWidth: 76,
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
  },
  countryCode: {
    color: '#16263D',
    fontSize: 16,
    fontWeight: '800',
  },
  phoneDivider: {
    width: 1,
    height: 26,
    backgroundColor: '#D7E0DE',
  },
  phoneInput: {
    flex: 1,
    minHeight: 58,
    paddingLeft: 14,
    paddingRight: 16,
    color: '#16263D',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  countryHint: {
    marginTop: -3,
    color: '#71838A',
    fontSize: 12,
    lineHeight: 17,
  },
  modalScreen: {
    flex: 1,
    backgroundColor: '#F5FAF9',
  },
  dragHandle: {
    width: 38,
    height: 5,
    alignSelf: 'center',
    marginTop: 10,
    borderRadius: 999,
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
    borderBottomColor: '#C8D5D3',
    backgroundColor: '#FFFFFF',
  },
  modalTitle: {
    color: '#16263D',
    fontSize: 22,
    fontWeight: '800',
  },
  closeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  closeButtonText: {
    color: '#0E7C7C',
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
    borderColor: '#DCE5E3',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  countryOption: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  countryOptionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DCE5E3',
  },
  selectedCountryOption: {
    backgroundColor: '#EAF5F3',
  },
  countryOptionName: {
    color: '#16263D',
    fontSize: 15,
    fontWeight: '700',
  },
  countryOptionCode: {
    color: '#526670',
    fontSize: 16,
    fontWeight: '700',
  },
  countryOptionEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedCountryMark: {
    width: 18,
    color: '#0E7C7C',
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingVertical: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#71838A',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  checkedCheckbox: {
    borderColor: '#0E7C7C',
    backgroundColor: '#0E7C7C',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
  },
  consentCopy: {
    flex: 1,
    gap: 3,
  },
  consentText: {
    color: '#354A5F',
    fontSize: 14,
    lineHeight: 20,
  },
  ratesText: {
    color: '#71838A',
    fontSize: 12,
    lineHeight: 17,
  },
  legalArea: {
    alignItems: 'center',
    gap: 4,
  },
  legalLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 4,
  },
  legalText: {
    color: '#71838A',
    fontSize: 12,
    lineHeight: 17,
  },
  pendingLink: {
    color: '#5A7678',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    textDecorationLine: 'underline',
  },
  pendingNote: {
    color: '#8A969B',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },
});
