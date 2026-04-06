import PublicPageTemplate from '../components/PublicPageTemplate';
import { PUBLIC_PAGE_CONTENT } from '../content/publicPages';

function PrivacyPolicyPage() {
  return <PublicPageTemplate {...PUBLIC_PAGE_CONTENT.privacy} />;
}

export default PrivacyPolicyPage;
