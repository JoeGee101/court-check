# CourtCheck Privacy Policy

> **DRAFT — NOT YET PUBLISHED**
>
> **Internal publication warning:** The user-facing policy is followed by a separate Developer and Legal Review section. That internal section must be resolved and removed before publication.
>
> **PRIVACY POLICY MUST BE REVIEWED/UPDATED BEFORE BACKGROUND LOCATION AUTO-CHECKOUT IS RELEASED.**

**Effective Date:** [PUBLICATION DATE]

**Operator:** Yin Hospitality International (YHI)

**Privacy contact:** george@yinhospitality.com

**Mailing address:** 9451 Lunar Phase Street, Las Vegas, NV 89143, United States

**Public HTTPS policy URL:** Pending — not yet established

## 1. About this Privacy Policy

Yin Hospitality International ("YHI," "CourtCheck," "we," "us," or "our") operates CourtCheck, a mobile application for recreational pickleball players and authorized CourtCheck administrators.

This Privacy Policy explains the information CourtCheck collects, how we use and disclose it, and the choices available to you when you use the CourtCheck mobile application and related services (the "Service").

## 2. Information we collect

### Account, authentication, and profile information

We collect or generate information needed to create, authenticate, and maintain your account, including:

- Your mobile phone number and phone-verification status.
- Authentication and session information associated with your CourtCheck account.
- An optional contact email address, if you choose to provide one. This email address is profile and contact information; it is not an authentication method in the current Service.
- A system-generated anonymous username.
- Your selected pickleball experience level.
- Your confirmation that you are at least 18 years old and the time of that confirmation.
- Your account role, such as player or administrator.

CourtCheck uses one-time verification codes sent by SMS instead of passwords. We do not ask you to provide your verification code anywhere other than the CourtCheck verification screen.

### SMS verification consent information

Before CourtCheck requests an authentication message, you must affirmatively select the checkbox stating: "I agree to receive a verification code by SMS at this number." The screen also states that standard message and data rates may apply.

CourtCheck retains evidence of that request, including the normalized destination phone number, a server-generated consent timestamp, the version of the disclosure shown, the CourtCheck phone-authentication source, and an opaque request identifier used to prevent duplicate consent records from a retry. CourtCheck does not store the verification code in this consent record.

### Check-ins and facility activity

When you use check-in or facility features, we collect or generate information such as:

- The facility associated with your check-in.
- Check-in, expiration, and checkout timestamps.
- The reason a check-in ended, such as manual checkout, expiration, or facility deactivation.
- Preset facility-status reports you submit, including the facility, report type, and server-generated creation and expiration information.
- Administrative changes to facility information made by authorized administrators.

CourtCheck uses check-in records to operate facility activity features and preserve legitimate operational history. Player-facing views use anonymous usernames, experience levels, and aggregate activity or reporter counts rather than exposing internal account identifiers or status-reporter identities.

### Location information

CourtCheck does not require location access merely to create an account or browse facilities.

When you explicitly tap **Check In**, CourtCheck requests foreground location permission if needed and obtains a current device location. The app sends the facility identifier and current latitude and longitude to CourtCheck's server-side database logic, which determines whether the device is inside the facility's private check-in area. The mobile app does not make the authoritative geofence decision. The submitted check-in coordinates are used for that validation and are not stored in the check-in history record in the current Service.

The current Service does not continuously track player location, use a location watcher, or collect player location in the background. Manual checkout and a server-controlled 90-minute check-in expiration remain available without background location.

If an authorized administrator explicitly chooses **Use My Location** while editing a facility, CourtCheck requests foreground location and uses the resulting point as the public facility location selected by that administrator. CourtCheck does not continuously track the administrator's location.

When you choose Directions, CourtCheck sends only the facility's public destination coordinates or address to the external maps application. CourtCheck does not retrieve or provide your origin for that action. The external maps provider may use location according to your device settings and its own privacy policy.

### Technical and service information

CourtCheck and service providers acting on our behalf may process technical information reasonably necessary to deliver and secure the Service. Depending on the provider and event, this may include IP address, device or app information, authentication events, session information, request timestamps, SMS delivery information, diagnostic information, and security or abuse-prevention signals.

CourtCheck does not currently use information for third-party advertising or behavioral advertising, and the current application architecture does not include an advertising or analytics SDK.

## 3. How we use information

We use information to:

- Create, authenticate, maintain, and secure CourtCheck accounts.
- Record a user's request for an authentication SMS and send user-requested verification codes.
- Complete onboarding and maintain account and profile information.
- Validate check-ins, enforce one active check-in per user, support manual checkout, and apply server-controlled expiration.
- Display facility activity, anonymous checked-in player summaries, and aggregate facility-status confidence.
- Operate maps, directions, facility administration, and other requested Service features.
- Maintain accurate operational records and reconcile activity across devices.
- Prevent, detect, and investigate abuse, fraud, unauthorized access, and violations of our Terms of Service.
- Diagnose errors, maintain and improve Service reliability, and respond to support or privacy requests.
- Comply with applicable law and protect or enforce legal rights.

## 4. Authentication SMS messages

CourtCheck sends authentication messages only after a user enters a phone number, checks the SMS consent box, and requests a verification code. These messages are transactional authentication messages, not promotional or marketing messages. Message frequency depends on the authentication requests you initiate. Standard message and data rates may apply.

The current sign-in method requires a verified phone number. Carrier filtering, an unavailable phone number, or an inability to receive a requested verification message may prevent access to the account.

CourtCheck does not sell, rent, share, or transfer text-messaging originator opt-in data or consent to third parties. This restriction does not prevent service providers acting solely on YHI's behalf from processing the minimum information needed to deliver, secure, and support the authentication-message program; those providers may not use that information for their own marketing or unrelated purposes.

## 5. How we disclose information

We may disclose information in the following limited circumstances:

- **Service providers.** Supabase provides authentication, database, session, and Realtime infrastructure. Twilio provides delivery of authentication SMS messages through Supabase Auth. Expo, operating-system providers, and app-distribution providers support delivery and operation of the mobile application. These providers process information under their own terms and privacy commitments and, where they act for YHI, only for authorized service purposes.
- **External maps.** When you request Directions, the public facility destination is opened in the applicable external maps service. That provider independently controls its handling of information within its application.
- **Legal, safety, and security reasons.** We may disclose information when reasonably necessary to comply with applicable law or legal process; investigate fraud, abuse, or security incidents; enforce our agreements; or protect users, YHI, or the public.
- **Business transactions.** Information may be transferred as part of a merger, acquisition, financing, reorganization, bankruptcy, or sale of all or part of a business, subject to applicable law and the commitments in this Privacy Policy.
- **At your direction.** We may disclose information when you direct us to do so or provide valid consent.

YHI does not sell or rent personal information. YHI does not share personal information for third-party behavioral advertising. As stated above, text-messaging originator opt-in data and consent are not sold, rented, shared, or transferred to third parties, except for limited processing by service providers acting solely on YHI's behalf to operate the authentication-message program.

## 6. Data retention

We retain information only for as long as reasonably necessary for the purposes described in this Privacy Policy, including operating and securing CourtCheck, preventing abuse, maintaining legitimate operational records, complying with legal obligations, resolving disputes, and enforcing agreements.

Retention may differ by data category and context. For example, operational check-in and facility-status records may remain after a check-in or report is no longer active so that CourtCheck can preserve data integrity, investigate problems, and maintain legitimate records. Service providers may also retain limited information under their legal, security, and operational requirements.

Account deletion does not necessarily require every record to be removed immediately when continued retention is reasonably necessary or legally permitted. Depending on the final account-deletion implementation, some records may be deleted, de-identified, or retained in a restricted form. We do not claim a fixed retention period or a particular deletion or anonymization method that has not been adopted and verified.

## 7. Your choices and privacy rights

You may:

- Choose whether to provide an optional contact email address and update or clear it in your profile.
- Update your experience level.
- Control foreground location permission through your device settings. If location permission is unavailable, you may continue browsing facilities, but you cannot complete a location-verified check-in.
- Manually check out of an active facility check-in.
- Stop using the Service at any time.
- Request assistance with access, correction, deletion, or another privacy question by contacting george@yinhospitality.com.

Depending on where you live, applicable law may provide additional rights concerning your personal information. We may need to verify your identity before completing a request, and lawful exceptions may apply.

CourtCheck intends to allow users to initiate account deletion directly inside the application. Until that feature has been implemented and verified, contact george@yinhospitality.com for account-deletion assistance. We will explain any information that must be retained or cannot be deleted when responding to a verified request.

## 8. Security

YHI uses administrative, technical, and organizational measures intended to protect information against unauthorized access, loss, misuse, or alteration. No storage or transmission method is completely secure, and we cannot guarantee absolute security.

Keep your device, phone number, session, and verification codes secure. Contact george@yinhospitality.com if you believe your account or phone number has been misused.

## 9. Age eligibility

CourtCheck is intended only for people who are at least 18 years old. Users must confirm that they are 18 or older during onboarding. We do not knowingly permit anyone under 18 to complete onboarding. If you believe a person under 18 has provided information to CourtCheck, contact george@yinhospitality.com.

## 10. Third-party services

CourtCheck depends on third-party infrastructure, mobile platforms, carriers, app stores, facilities, and maps services. Their handling of information for their own purposes is governed by their respective privacy policies. YHI does not control independent third-party services or facilities.

## 11. Changes to this Privacy Policy

We may update this Privacy Policy as CourtCheck changes or as legal requirements evolve. We will update the Effective Date and provide any additional notice required by applicable law. Material feature changes that affect data collection or use will be reviewed before release.

## 12. Contact us

Questions, privacy requests, and account-deletion assistance may be sent to:

- Yin Hospitality International (YHI), Attn: CourtCheck Privacy
- 9451 Lunar Phase Street, Las Vegas, NV 89143, United States
- Email: george@yinhospitality.com

---

## Developer and Legal Review Notes — Remove Before Publication

This section is not part of the user-facing Privacy Policy and must not be included in the published policy or in-app legal content.

### Current implementation conclusions

- The published policy should remain current-only for location. CourtCheck currently uses fresh foreground location only after an explicit player Check In action, plus an explicit administrator Use My Location action. It does not currently implement continuous or background player location.
- The planned automatic-checkout design is optional background location while a player has an active check-in, with server-authoritative checkout after approximately 15 continuous minutes outside the facility check-in area. Monitoring should stop when no active check-in exists; manual checkout and the 90-minute server expiry remain available. **The Privacy Policy must be reviewed and updated before that feature is released.**
- The current SMS consent record stores the normalized phone number, server-generated timestamp, fixed disclosure version and source, and an idempotency request key. It does not store the OTP.
- The current application records the user's 18+ confirmation but does not record a Terms acceptance timestamp, Terms version, or Privacy Policy acknowledgment.
- The current schema preserves operational check-in and facility-status rows. Final account-deletion behavior for those historical records has not been decided or implemented.

### Pre-publication checklist

- [ ] Replace **[PUBLICATION DATE]** with the approved effective/publication date.
- [ ] Obtain YHI approval and qualified legal review of the complete policy.
- [ ] Implement and verify in-app **Delete Account** before publishing any statement that presents it as available.
- [ ] Verify Auth-user deletion and account/profile personal-data handling.
- [ ] Decide and verify appropriate deletion, de-identification, or retention behavior for historical check-ins and facility-status reports, then align the policy wording.
- [ ] Establish and review retention criteria without inventing unsupported fixed periods.
- [ ] Review and update the policy before releasing background-location automatic checkout, including permissions, collection frequency, retention, and platform disclosures.
- [ ] Verify final Twilio/Supabase SMS program wording, including whether any carrier-specific STOP/HELP disclosure is accurate for the configured Twilio Verify flow.
- [ ] Publish an authoritative HTTPS Privacy Policy URL and configure all app-store and service-provider references to it.
- [ ] Publish an authoritative HTTPS Terms of Service URL.
- [ ] Confirm that the planned in-app route `/legal/privacy` renders only the approved user-facing policy and not this internal section.
- [ ] Align Apple App Store and Google Play privacy disclosures with the production implementation and service-provider practices.
- [ ] Recheck the production application and infrastructure for any new analytics, advertising, logging, location, or data-sharing behavior before publication.
