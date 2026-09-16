import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type PhoneAuthContextValue = {
  phoneE164: string | null;
  otpSentAt: number | null;
  beginVerification: (phone: string) => void;
  markOtpSent: () => void;
  clearVerification: () => void;
};

const PhoneAuthContext = createContext<PhoneAuthContextValue | undefined>(undefined);

export function PhoneAuthProvider({ children }: PropsWithChildren) {
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null);

  const beginVerification = useCallback((phone: string) => {
    setPhoneE164(phone);
    setOtpSentAt(Date.now());
  }, []);

  const markOtpSent = useCallback(() => {
    setOtpSentAt(Date.now());
  }, []);

  const clearVerification = useCallback(() => {
    setPhoneE164(null);
    setOtpSentAt(null);
  }, []);

  const value = useMemo(
    () => ({ phoneE164, otpSentAt, beginVerification, markOtpSent, clearVerification }),
    [beginVerification, clearVerification, markOtpSent, otpSentAt, phoneE164],
  );

  return <PhoneAuthContext.Provider value={value}>{children}</PhoneAuthContext.Provider>;
}

export function usePhoneAuth() {
  const context = useContext(PhoneAuthContext);

  if (!context) {
    throw new Error('usePhoneAuth must be used within PhoneAuthProvider.');
  }

  return context;
}
