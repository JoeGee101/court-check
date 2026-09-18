export type LegalContentBlock =
  | { paragraphs: readonly string[]; type: 'paragraphs' }
  | { items: readonly string[]; type: 'bullets' }
  | { text: string; type: 'subheading' };

export type LegalSection = {
  blocks: readonly LegalContentBlock[];
  title: string;
};

export type LegalDocument = {
  sections: readonly LegalSection[];
  status: string;
  title: string;
};

const DRAFT_STATUS = 'Draft — not yet published';

export const privacyPolicy: LegalDocument = {
  title: 'Privacy Policy',
  status: DRAFT_STATUS,
  sections: [
    {
      title: '1. About this Privacy Policy',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'Yin Hospitality International ("YHI," "CourtCheck," "we," "us," or "our") operates CourtCheck, a mobile application for recreational pickleball players and authorized CourtCheck administrators.',
            'This Privacy Policy explains the information CourtCheck collects, how we use and disclose it, and the choices available to you when you use the CourtCheck mobile application and related services (the "Service").',
          ],
        },
      ],
    },
    {
      title: '2. Information we collect',
      blocks: [
        { type: 'subheading', text: 'Account, authentication, and profile information' },
        {
          type: 'paragraphs',
          paragraphs: [
            'We collect or generate information needed to create, authenticate, and maintain your account, including:',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Your mobile phone number and phone-verification status.',
            'Authentication and session information associated with your CourtCheck account.',
            'An optional contact email address, if you choose to provide one. This email address is profile and contact information; it is not an authentication method in the current Service.',
            'A system-generated anonymous username.',
            'Your selected pickleball experience level.',
            'Your confirmation that you are at least 18 years old and the time of that confirmation.',
            'Your account role, such as player or administrator.',
          ],
        },
        {
          type: 'paragraphs',
          paragraphs: [
            'CourtCheck uses one-time verification codes sent by SMS instead of passwords. We do not ask you to provide your verification code anywhere other than the CourtCheck verification screen.',
          ],
        },
        { type: 'subheading', text: 'SMS verification consent information' },
        {
          type: 'paragraphs',
          paragraphs: [
            'Before CourtCheck requests an authentication message, you must affirmatively select the checkbox stating: "I agree to receive a verification code by SMS at this number." The screen also states that standard message and data rates may apply.',
            'CourtCheck retains evidence of that request, including the normalized destination phone number, a server-generated consent timestamp, the version of the disclosure shown, the CourtCheck phone-authentication source, and an opaque request identifier used to prevent duplicate consent records from a retry. CourtCheck does not store the verification code in this consent record.',
          ],
        },
        { type: 'subheading', text: 'Check-ins and facility activity' },
        {
          type: 'paragraphs',
          paragraphs: [
            'When you use check-in or facility features, we collect or generate information such as:',
          ],
        },
        {
          type: 'bullets',
          items: [
            'The facility associated with your check-in.',
            'Check-in, expiration, and checkout timestamps.',
            'The reason a check-in ended, such as manual checkout, expiration, or facility deactivation.',
            'Preset facility-status reports you submit, including the facility, report type, and server-generated creation and expiration information.',
            'Administrative changes to facility information made by authorized administrators.',
          ],
        },
        {
          type: 'paragraphs',
          paragraphs: [
            'CourtCheck uses check-in records to operate facility activity features and preserve legitimate operational history. Player-facing views use anonymous usernames, experience levels, and aggregate activity or reporter counts rather than exposing internal account identifiers or status-reporter identities.',
          ],
        },
        { type: 'subheading', text: 'Location information' },
        {
          type: 'paragraphs',
          paragraphs: [
            'CourtCheck does not require location access merely to create an account or browse facilities.',
            'When you explicitly tap Check In, CourtCheck requests foreground location permission if needed and obtains a current device location. The app sends the facility identifier and current latitude and longitude to CourtCheck\'s server-side database logic, which determines whether the device is inside the facility\'s private check-in area. The mobile app does not make the authoritative geofence decision. The submitted check-in coordinates are used for that validation and are not stored in the check-in history record in the current Service.',
            'The current Service does not continuously track player location, use a location watcher, or collect player location in the background. Manual checkout and a server-controlled 90-minute check-in expiration remain available without background location.',
            'If an authorized administrator explicitly chooses Use My Location while editing a facility, CourtCheck requests foreground location and uses the resulting point as the public facility location selected by that administrator. CourtCheck does not continuously track the administrator\'s location.',
            'When you choose Directions, CourtCheck sends only the facility\'s public destination coordinates or address to the external maps application. CourtCheck does not retrieve or provide your origin for that action. The external maps provider may use location according to your device settings and its own privacy policy.',
          ],
        },
        { type: 'subheading', text: 'Technical and service information' },
        {
          type: 'paragraphs',
          paragraphs: [
            'CourtCheck and service providers acting on our behalf may process technical information reasonably necessary to deliver and secure the Service. Depending on the provider and event, this may include IP address, device or app information, authentication events, session information, request timestamps, SMS delivery information, diagnostic information, and security or abuse-prevention signals.',
            'CourtCheck does not currently use information for third-party advertising or behavioral advertising, and the current application architecture does not include an advertising or analytics SDK.',
          ],
        },
      ],
    },
    {
      title: '3. How we use information',
      blocks: [
        { type: 'paragraphs', paragraphs: ['We use information to:'] },
        {
          type: 'bullets',
          items: [
            'Create, authenticate, maintain, and secure CourtCheck accounts.',
            'Record a user\'s request for an authentication SMS and send user-requested verification codes.',
            'Complete onboarding and maintain account and profile information.',
            'Validate check-ins, enforce one active check-in per user, support manual checkout, and apply server-controlled expiration.',
            'Display facility activity, anonymous checked-in player summaries, and aggregate facility-status confidence.',
            'Operate maps, directions, facility administration, and other requested Service features.',
            'Maintain accurate operational records and reconcile activity across devices.',
            'Prevent, detect, and investigate abuse, fraud, unauthorized access, and violations of our Terms of Service.',
            'Diagnose errors, maintain and improve Service reliability, and respond to support or privacy requests.',
            'Comply with applicable law and protect or enforce legal rights.',
          ],
        },
      ],
    },
    {
      title: '4. Authentication SMS messages',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'CourtCheck sends authentication messages only after a user enters a phone number, checks the SMS consent box, and requests a verification code. These messages are transactional authentication messages, not promotional or marketing messages. Message frequency depends on the authentication requests you initiate. Standard message and data rates may apply.',
            'The current sign-in method requires a verified phone number. Carrier filtering, an unavailable phone number, or an inability to receive a requested verification message may prevent access to the account.',
            'CourtCheck does not sell, rent, share, or transfer text-messaging originator opt-in data or consent to third parties. This restriction does not prevent service providers acting solely on YHI\'s behalf from processing the minimum information needed to deliver, secure, and support the authentication-message program; those providers may not use that information for their own marketing or unrelated purposes.',
          ],
        },
      ],
    },
    {
      title: '5. How we disclose information',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: ['We may disclose information in the following limited circumstances:'],
        },
        {
          type: 'bullets',
          items: [
            'Service providers. Supabase provides authentication, database, session, and Realtime infrastructure. Twilio provides delivery of authentication SMS messages through Supabase Auth. Expo, operating-system providers, and app-distribution providers support delivery and operation of the mobile application. These providers process information under their own terms and privacy commitments and, where they act for YHI, only for authorized service purposes.',
            'External maps. When you request Directions, the public facility destination is opened in the applicable external maps service. That provider independently controls its handling of information within its application.',
            'Legal, safety, and security reasons. We may disclose information when reasonably necessary to comply with applicable law or legal process; investigate fraud, abuse, or security incidents; enforce our agreements; or protect users, YHI, or the public.',
            'Business transactions. Information may be transferred as part of a merger, acquisition, financing, reorganization, bankruptcy, or sale of all or part of a business, subject to applicable law and the commitments in this Privacy Policy.',
            'At your direction. We may disclose information when you direct us to do so or provide valid consent.',
          ],
        },
        {
          type: 'paragraphs',
          paragraphs: [
            'YHI does not sell or rent personal information. YHI does not share personal information for third-party behavioral advertising. As stated above, text-messaging originator opt-in data and consent are not sold, rented, shared, or transferred to third parties, except for limited processing by service providers acting solely on YHI\'s behalf to operate the authentication-message program.',
          ],
        },
      ],
    },
    {
      title: '6. Data retention',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'We retain information only for as long as reasonably necessary for the purposes described in this Privacy Policy, including operating and securing CourtCheck, preventing abuse, maintaining legitimate operational records, complying with legal obligations, resolving disputes, and enforcing agreements.',
            'Retention may differ by data category and context. For example, operational check-in and facility-status records may remain after a check-in or report is no longer active so that CourtCheck can preserve data integrity, investigate problems, and maintain legitimate records. Service providers may also retain limited information under their legal, security, and operational requirements.',
            'Account deletion does not necessarily require every record to be removed immediately when continued retention is reasonably necessary or legally permitted. Depending on the final account-deletion implementation, some records may be deleted, de-identified, or retained in a restricted form. We do not claim a fixed retention period or a particular deletion or anonymization method that has not been adopted and verified.',
          ],
        },
      ],
    },
    {
      title: '7. Your choices and privacy rights',
      blocks: [
        { type: 'paragraphs', paragraphs: ['You may:'] },
        {
          type: 'bullets',
          items: [
            'Choose whether to provide an optional contact email address and update or clear it in your profile.',
            'Update your experience level.',
            'Control foreground location permission through your device settings. If location permission is unavailable, you may continue browsing facilities, but you cannot complete a location-verified check-in.',
            'Manually check out of an active facility check-in.',
            'Stop using the Service at any time.',
            'Request assistance with access, correction, deletion, or another privacy question by contacting george@yinhospitality.com.',
          ],
        },
        {
          type: 'paragraphs',
          paragraphs: [
            'Depending on where you live, applicable law may provide additional rights concerning your personal information. We may need to verify your identity before completing a request, and lawful exceptions may apply.',
            'We will explain any information that must be retained or cannot be deleted when responding to a verified request.',
          ],
        },
      ],
    },
    {
      title: '8. Security',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'YHI uses administrative, technical, and organizational measures intended to protect information against unauthorized access, loss, misuse, or alteration. No storage or transmission method is completely secure, and we cannot guarantee absolute security.',
            'Keep your device, phone number, session, and verification codes secure. Contact george@yinhospitality.com if you believe your account or phone number has been misused.',
          ],
        },
      ],
    },
    {
      title: '9. Age eligibility',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'CourtCheck is intended only for people who are at least 18 years old. Users must confirm that they are 18 or older during onboarding. We do not knowingly permit anyone under 18 to complete onboarding. If you believe a person under 18 has provided information to CourtCheck, contact george@yinhospitality.com.',
          ],
        },
      ],
    },
    {
      title: '10. Third-party services',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'CourtCheck depends on third-party infrastructure, mobile platforms, carriers, app stores, facilities, and maps services. Their handling of information for their own purposes is governed by their respective privacy policies. YHI does not control independent third-party services or facilities.',
          ],
        },
      ],
    },
    {
      title: '11. Changes to this Privacy Policy',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'We may update this Privacy Policy as CourtCheck changes or as legal requirements evolve. We will update the Effective Date and provide any additional notice required by applicable law. Material feature changes that affect data collection or use will be reviewed before release.',
          ],
        },
      ],
    },
    {
      title: '12. Contact us',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: ['Questions, privacy requests, and account-deletion assistance may be sent to:'],
        },
        {
          type: 'bullets',
          items: [
            'Yin Hospitality International (YHI), Attn: CourtCheck Privacy',
            '9451 Lunar Phase Street, Las Vegas, NV 89143, United States',
            'Email: george@yinhospitality.com',
          ],
        },
      ],
    },
  ],
};

export const termsOfService: LegalDocument = {
  title: 'Terms of Service',
  status: DRAFT_STATUS,
  sections: [
    {
      title: '1. Agreement to these Terms',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'These Terms of Service ("Terms") are an agreement between you and Yin Hospitality International ("YHI," "CourtCheck," "we," "us," or "our"). They govern your access to and use of the CourtCheck mobile application and related services (the "Service").',
            'By creating an account or using CourtCheck, you agree to these Terms and acknowledge the CourtCheck Privacy Policy. If you do not agree, do not create an account or use the Service.',
          ],
        },
      ],
    },
    {
      title: '2. Eligibility',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'You must be at least 18 years old and legally able to enter into these Terms. You must truthfully confirm that you are 18 or older during onboarding.',
            'CourtCheck is initially designed for recreational pickleball players and participating facilities in the Las Vegas and Clark County launch market. Service availability may expand or change.',
          ],
        },
      ],
    },
    {
      title: '3. What CourtCheck provides',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'CourtCheck allows eligible users to browse participating pickleball facilities, view aggregate facility activity, view anonymous checked-in player summaries, check in while physically present, check out manually, submit approved preset facility-status reports, open directions in an external maps application, and manage limited profile information. Authorized administrators may manage facility information, public map locations, check-in areas, and facility availability.',
            'CourtCheck does not provide reservations, guaranteed court access, turn-by-turn navigation, emergency services, or professional safety advice.',
          ],
        },
      ],
    },
    {
      title: '4. Accounts and authentication',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'A verified mobile phone number is required to use CourtCheck. When you request a sign-in code, CourtCheck sends a one-time verification code by SMS. CourtCheck does not use passwords or optional contact email as authentication methods in the current Service.',
            'You are responsible for maintaining control of your phone number, device, CourtCheck session, and verification codes. Do not share a verification code or permit another person to use your account. You must provide accurate information, keep permitted profile information reasonably current, and promptly notify george@yinhospitality.com if you suspect unauthorized account use.',
            'CourtCheck assigns a system-generated anonymous username. The username is not editable in the current Service. It helps limit the personal information displayed to other players, but it does not make your account activity anonymous to YHI or service providers that process information to operate the Service.',
          ],
        },
      ],
    },
    {
      title: '5. Authentication SMS terms',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'When you enter your mobile number, affirmatively select "I agree to receive a verification code by SMS at this number," and tap Send verification code, you request a transactional authentication message from CourtCheck at that number.',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Authentication messages are not promotional or marketing messages.',
            'Message frequency depends on the verification requests you initiate.',
            'Standard message and data rates may apply.',
            'Message delivery may be delayed or unavailable because of carrier, network, device, filtering, or provider conditions outside YHI\'s control.',
            'Because a verified phone number is the current authentication method, an inability to receive a requested code may prevent account access.',
          ],
        },
        {
          type: 'paragraphs',
          paragraphs: [
            'YHI does not request consent to receive marketing messages through this authentication flow. For information about how CourtCheck handles phone numbers and SMS consent evidence, review the CourtCheck Privacy Policy.',
          ],
        },
      ],
    },
    {
      title: '6. Check-ins, location, and checkout',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'To initiate a check-in, you must explicitly tap Check In, permit foreground location access, and be within the participating facility\'s server-defined check-in area. The server, not the mobile app, makes the authoritative location decision. A user may have only one active check-in at a time.',
            'You may check out manually. Every check-in also has a server-controlled expiration, currently 90 minutes, so current activity does not depend on the app remaining open. CourtCheck does not currently use continuous or background player location for checkout.',
            'You may not falsify or manipulate location, interfere with geofence validation, create a check-in for another person, or otherwise misrepresent your presence. CourtCheck check-ins and activity counts are informational. They must not be used as an emergency, safety, legal-capacity, occupancy-control, or facility-access system.',
          ],
        },
      ],
    },
    {
      title: '7. Facility-status reports and other submissions',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'CourtCheck permits checked-in users to submit approved preset facility-status reports, such as Courts closed, Maintenance, Courts wet / unsafe, Tournament / Event, or Courts full. You may report a status only while you have an active check-in at that facility. Statuses expire under server-controlled rules.',
            'You are responsible for reports and other information you submit. Reports must be honest, based on conditions you reasonably observe, and not misleading, abusive, unlawful, or intended to disrupt a facility or other users.',
            'You grant YHI a nonexclusive, worldwide, royalty-free license to host, process, display, aggregate, and otherwise use your submissions only as reasonably necessary to operate, secure, maintain, and improve the Service and enforce these Terms. CourtCheck may remove, end, limit, or correct content when reasonably necessary to address inaccuracy, abuse, safety, legal obligations, or Service integrity.',
          ],
        },
      ],
    },
    {
      title: '8. Facility information and accuracy',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'Facility names, addresses, map locations, hours, amenities, player counts, status reports, and other facility information may be incomplete, delayed, unavailable, or inaccurate. Player activity and status reports can change quickly, and Realtime delivery is not guaranteed.',
            'CourtCheck does not guarantee that a court is open, playable, safe, accessible, available, or operated as displayed. Unless YHI separately states otherwise, YHI does not operate the listed facilities. You are responsible for evaluating actual conditions, following posted facility rules, respecting closures and reservations, and using appropriate care.',
          ],
        },
      ],
    },
    {
      title: '9. Acceptable use',
      blocks: [
        { type: 'paragraphs', paragraphs: ['You may not:'] },
        {
          type: 'bullets',
          items: [
            'Use the Service if you are under 18 or otherwise ineligible.',
            'Violate applicable law or another person\'s rights.',
            'Harass, threaten, deceive, impersonate, or harm another person.',
            'Submit false or misleading check-ins, facility statuses, facility information, or support requests.',
            'Attempt to access another account or unauthorized administrator functionality.',
            'Bypass or interfere with authentication, rate limits, location checks, database authorization, or other security controls.',
            'Introduce malicious code, disrupt the Service, scrape it abusively, probe for vulnerabilities without authorization, or use it to facilitate fraud.',
            'Copy, modify, distribute, sell, lease, or reverse engineer the Service except where applicable law expressly permits it.',
          ],
        },
      ],
    },
    {
      title: '10. Directions and third-party services',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'The Directions action opens an external maps service using a facility\'s public destination information. CourtCheck does not calculate or provide turn-by-turn routes. The external provider determines origin, permissions, routing, and data handling under its own terms and privacy policy.',
            'CourtCheck also relies on third-party authentication, messaging, database, hosting, mobile-platform, app-distribution, and network services. Third-party services may be unavailable, delayed, or governed by separate terms. YHI is not responsible for independent facilities, carriers, app stores, maps providers, or other third parties beyond what applicable law requires.',
          ],
        },
      ],
    },
    {
      title: '11. Privacy',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'The CourtCheck Privacy Policy explains how YHI collects, uses, discloses, retains, and protects information. By creating an account or using CourtCheck, you acknowledge that policy.',
          ],
        },
      ],
    },
    {
      title: '12. Ownership and permitted use',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'The Service, including CourtCheck software, branding, design, and content supplied by YHI, is owned by YHI or its licensors and is protected by applicable intellectual-property laws.',
            'Subject to these Terms, YHI gives you a limited, personal, nonexclusive, nontransferable, revocable right to use the Service for its intended purpose. These Terms do not transfer ownership of CourtCheck or third-party content to you.',
          ],
        },
      ],
    },
    {
      title: '13. Suspension, termination, and account deletion',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'You may stop using CourtCheck at any time. You may request account-deletion assistance by contacting george@yinhospitality.com.',
            'YHI may suspend or terminate access when reasonably necessary to protect the Service or others, investigate suspected misuse, comply with law, respond to security concerns, or address a material violation of these Terms. Where required by applicable law, YHI will provide appropriate notice.',
            'Account closure or deletion does not automatically require immediate deletion of every record when retention is reasonably necessary or legally permitted. The Privacy Policy describes the applicable retention principles.',
          ],
        },
      ],
    },
    {
      title: '14. Service changes and availability',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'YHI may modify, suspend, or discontinue features or the Service. We aim to operate CourtCheck reliably, but do not promise uninterrupted, timely, secure, or error-free operation. Availability may be affected by maintenance, device settings, mobile carriers, internet providers, third-party platforms, facilities, or circumstances outside YHI\'s reasonable control.',
          ],
        },
      ],
    },
    {
      title: '15. Disclaimers',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, COURTCHECK IS PROVIDED "AS IS" AND "AS AVAILABLE." YHI DISCLAIMS IMPLIED WARRANTIES, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.',
            'YHI DOES NOT GUARANTEE THE ACCURACY OR TIMELINESS OF FACILITY DATA, PLAYER COUNTS, CHECK-INS, OR USER-REPORTED CONDITIONS, OR THE SAFETY, CONDITION, ACCESSIBILITY, OPERATION, OR AVAILABILITY OF ANY FACILITY. YOU ARE RESPONSIBLE FOR ASSESSING CONDITIONS, FOLLOWING FACILITY RULES, AND USING APPROPRIATE CARE.',
            'Some jurisdictions do not allow certain warranty exclusions, so some exclusions may not apply to you. Nothing in these Terms excludes a warranty or right that cannot lawfully be excluded.',
          ],
        },
      ],
    },
    {
      title: '16. Limitation of liability',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, YHI WILL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR RELATING TO COURTCHECK.',
            'Nothing in these Terms limits liability that cannot lawfully be limited or excluded. Some jurisdictions do not allow certain limitations of liability, so some limitations may not apply to you.',
          ],
        },
      ],
    },
    {
      title: '17. Governing law',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'These Terms are governed by the laws of the State of Nevada, United States, without regard to its conflict-of-laws principles, except to the extent another jurisdiction\'s law must apply and cannot lawfully be waived.',
            'These Terms do not impose arbitration, a class-action waiver, or a contractual venue provision.',
          ],
        },
      ],
    },
    {
      title: '18. Changes to these Terms',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'YHI may update these Terms as CourtCheck or legal requirements change. We will update the Effective Date and provide any additional notice required by applicable law. Your continued use after revised Terms take effect constitutes agreement to the revised Terms to the extent permitted by applicable law. If you do not agree to revised Terms, stop using CourtCheck.',
          ],
        },
      ],
    },
    {
      title: '19. Contact',
      blocks: [
        {
          type: 'paragraphs',
          paragraphs: [
            'Questions about these Terms or the authentication-message program may be sent to:',
          ],
        },
        {
          type: 'bullets',
          items: [
            'Yin Hospitality International (YHI), Attn: CourtCheck Support',
            '9451 Lunar Phase Street, Las Vegas, NV 89143, United States',
            'Email: george@yinhospitality.com',
          ],
        },
      ],
    },
  ],
};
