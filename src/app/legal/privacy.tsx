import { LegalDocumentScreen } from '@/features/legal/legal-document-screen';
import { privacyPolicy } from '@/features/legal/legal-content';

export default function PrivacyPolicyScreen() {
  return <LegalDocumentScreen document={privacyPolicy} />;
}
