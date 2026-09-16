import { getSupabaseClient } from "@/lib/supabase/client";

const E164_PATTERN = /^\+[1-9]\d{7,14}$/;
const CONSENT_REQUEST_KEY_PATTERN = /^[a-z0-9]{20,64}$/;

export type PhoneCountry = {
  code: string;
  name: string;
  dialCode: `+${number}`;
  example: string;
  nationalPattern: RegExp;
  removeTrunkPrefix?: boolean;
};

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  {
    code: "US",
    name: "United States",
    dialCode: "+1",
    example: "7025550134",
    nationalPattern: /^[2-9]\d{2}[2-9]\d{6}$/,
  },
  {
    code: "PK",
    name: "Pakistan",
    dialCode: "+92",
    example: "03001234567",
    nationalPattern: /^3\d{9}$/,
    removeTrunkPrefix: true,
  },
  {
    code: "CA",
    name: "Canada",
    dialCode: "+1",
    example: "4165550123",
    nationalPattern: /^[2-9]\d{2}[2-9]\d{6}$/,
  },
  {
    code: "AU",
    name: "Australia",
    dialCode: "+61",
    example: "0412345678",
    nationalPattern: /^4\d{8}$/,
    removeTrunkPrefix: true,
  },
  {
    code: "BR",
    name: "Brazil",
    dialCode: "+55",
    example: "11987654321",
    nationalPattern: /^\d{10,11}$/,
  },
  {
    code: "FR",
    name: "France",
    dialCode: "+33",
    example: "0612345678",
    nationalPattern: /^[1-9]\d{8}$/,
    removeTrunkPrefix: true,
  },
  {
    code: "DE",
    name: "Germany",
    dialCode: "+49",
    example: "015123456789",
    nationalPattern: /^\d{5,11}$/,
    removeTrunkPrefix: true,
  },
  {
    code: "IN",
    name: "India",
    dialCode: "+91",
    example: "9876543210",
    nationalPattern: /^[6-9]\d{9}$/,
  },
  {
    code: "IT",
    name: "Italy",
    dialCode: "+39",
    example: "3123456789",
    nationalPattern: /^\d{6,11}$/,
  },
  {
    code: "JP",
    name: "Japan",
    dialCode: "+81",
    example: "09012345678",
    nationalPattern: /^\d{9,10}$/,
    removeTrunkPrefix: true,
  },
  {
    code: "MX",
    name: "Mexico",
    dialCode: "+52",
    example: "5512345678",
    nationalPattern: /^\d{10}$/,
  },
  {
    code: "NL",
    name: "Netherlands",
    dialCode: "+31",
    example: "0612345678",
    nationalPattern: /^\d{9}$/,
    removeTrunkPrefix: true,
  },
  {
    code: "NZ",
    name: "New Zealand",
    dialCode: "+64",
    example: "0212345678",
    nationalPattern: /^\d{8,10}$/,
    removeTrunkPrefix: true,
  },
  {
    code: "NG",
    name: "Nigeria",
    dialCode: "+234",
    example: "08021234567",
    nationalPattern: /^\d{10}$/,
    removeTrunkPrefix: true,
  },
  {
    code: "SA",
    name: "Saudi Arabia",
    dialCode: "+966",
    example: "0512345678",
    nationalPattern: /^5\d{8}$/,
    removeTrunkPrefix: true,
  },
  {
    code: "SG",
    name: "Singapore",
    dialCode: "+65",
    example: "81234567",
    nationalPattern: /^[689]\d{7}$/,
  },
  {
    code: "ZA",
    name: "South Africa",
    dialCode: "+27",
    example: "0821234567",
    nationalPattern: /^\d{9}$/,
    removeTrunkPrefix: true,
  },
  {
    code: "ES",
    name: "Spain",
    dialCode: "+34",
    example: "612345678",
    nationalPattern: /^[6789]\d{8}$/,
  },
  {
    code: "AE",
    name: "United Arab Emirates",
    dialCode: "+971",
    example: "0501234567",
    nationalPattern: /^5\d{8}$/,
    removeTrunkPrefix: true,
  },
  {
    code: "GB",
    name: "United Kingdom",
    dialCode: "+44",
    example: "07123456789",
    nationalPattern: /^\d{9,10}$/,
    removeTrunkPrefix: true,
  },
];

export function formatNationalPhoneInput(country: PhoneCountry, value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 15);

  if (country.code === "US" || country.code === "CA") {
    return joinPhoneGroups(digits.slice(0, 10), [3, 3, 4]);
  }

  if (country.code === "PK") {
    return digits.startsWith("0")
      ? joinPhoneGroups(digits.slice(0, 11), [4, 7])
      : joinPhoneGroups(digits.slice(0, 10), [3, 7]);
  }

  return digits;
}

export function isValidNationalPhone(country: PhoneCountry, value: string) {
  const nationalDigits = getNationalDigits(country, value);
  return (
    country.nationalPattern.test(nationalDigits) &&
    E164_PATTERN.test(`${country.dialCode}${nationalDigits}`)
  );
}

export function toPhoneE164(country: PhoneCountry, value: string) {
  const nationalDigits = getNationalDigits(country, value);
  const phoneE164 = `${country.dialCode}${nationalDigits}`;

  if (
    !country.nationalPattern.test(nationalDigits) ||
    !E164_PATTERN.test(phoneE164)
  ) {
    throw new Error(`Enter a valid phone number for ${country.name}.`);
  }

  return phoneE164;
}

export function maskPhone(phoneE164: string) {
  if (!E164_PATTERN.test(phoneE164)) {
    return "your phone number";
  }

  const country = [...PHONE_COUNTRIES]
    .sort((first, second) => second.dialCode.length - first.dialCode.length)
    .find(({ dialCode }) => phoneE164.startsWith(dialCode));

  if (!country) {
    return `${phoneE164.slice(0, -4)} •••• ${phoneE164.slice(-4)}`;
  }

  return `${country.dialCode} •••• ${phoneE164.slice(-4)}`;
}

export function createSmsOtpConsentRequestKey() {
  // This is an idempotency key, not an authentication secret.
  const firstPart = Math.random().toString(36).slice(2).padEnd(10, "0");
  const secondPart = Math.random().toString(36).slice(2).padEnd(10, "0");
  const thirdPart = Math.random().toString(36).slice(2).padEnd(10, "0");

  return `${firstPart}${secondPart}${thirdPart}`.slice(0, 30);
}

export async function recordSmsOtpConsent(
  phoneE164: string,
  requestKey: string,
) {
  if (
    !E164_PATTERN.test(phoneE164) ||
    !CONSENT_REQUEST_KEY_PATTERN.test(requestKey)
  ) {
    throw new Error("We could not save your SMS consent. Please try again.");
  }

  const { error } = await getSupabaseClient().rpc("record_sms_otp_consent", {
    p_phone_e164: phoneE164,
    p_request_key: requestKey,
  });

  if (error) {
    throw new Error("We could not save your SMS consent. Please try again.");
  }
}

export async function requestPhoneOtp(phoneE164: string) {
  if (!E164_PATTERN.test(phoneE164)) {
    throw new Error("Enter a valid international phone number.");
  }

  const { error } = await getSupabaseClient().auth.signInWithOtp({
    phone: phoneE164,
  });

  if (error) {
    throw new Error(getOtpRequestMessage(error.status));
  }

  return phoneE164;
}

export async function verifyPhoneOtp(phone: string, token: string) {
  if (!E164_PATTERN.test(phone) || !/^\d{6}$/.test(token)) {
    throw new Error("Enter the complete 6-digit code.");
  }

  const { data, error } = await getSupabaseClient().auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });

  if (error || !data.session) {
    throw new Error(getOtpVerificationMessage(error?.status));
  }
}

function getNationalDigits(country: PhoneCountry, value: string) {
  const rawValue = value.trim();
  let digits = rawValue.replace(/\D/g, "");
  const dialDigits = country.dialCode.slice(1);

  if (rawValue.startsWith("+") && digits.startsWith(dialDigits)) {
    digits = digits.slice(dialDigits.length);
  }

  if (country.removeTrunkPrefix) {
    digits = digits.replace(/^0+/, "");
  }

  return digits;
}

function joinPhoneGroups(value: string, groupSizes: readonly number[]) {
  const groups: string[] = [];
  let start = 0;

  for (const size of groupSizes) {
    const group = value.slice(start, start + size);

    if (!group) {
      break;
    }

    groups.push(group);
    start += size;
  }

  return groups.join(" ");
}

function getOtpRequestMessage(status?: number) {
  if (status === 429) {
    return "Too many code requests. Wait a moment before trying again.";
  }

  return "We could not send a verification code. Check the number and try again.";
}

function getOtpVerificationMessage(status?: number) {
  if (status === 429) {
    return "Too many verification attempts. Wait a moment before trying again.";
  }

  return "That code is invalid or expired. Request a new code and try again.";
}
