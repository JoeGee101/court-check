import { LegalDocumentScreen } from '@/features/legal/legal-document-screen';
import { termsOfService } from '@/features/legal/legal-content';

export default function TermsOfServiceScreen() {
  return <LegalDocumentScreen document={termsOfService} />;
}
