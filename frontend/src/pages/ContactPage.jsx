import PublicPageTemplate from '../components/PublicPageTemplate';
import { PUBLIC_PAGE_CONTENT } from '../content/publicPages';

function ContactPage() {
  return <PublicPageTemplate {...PUBLIC_PAGE_CONTENT.contact} />;
}

export default ContactPage;
