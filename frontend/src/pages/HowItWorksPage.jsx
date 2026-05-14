import { useEffect, useState } from 'react';
import api, { buildPublicRequestConfig } from '../api/axios';
import PublicPageTemplate from '../components/PublicPageTemplate';
import { PUBLIC_PAGE_CONTENT } from '../content/publicPages';

function HowItWorksPage() {
  const [content, setContent] = useState(PUBLIC_PAGE_CONTENT.howItWorks);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const response = await api.get('/public/how-it-works', buildPublicRequestConfig());
        const payload = response.data?.data;
        if (!active || !payload) {
          return;
        }

        setContent({
          title: payload.title || PUBLIC_PAGE_CONTENT.howItWorks.title,
          description: payload.summary || PUBLIC_PAGE_CONTENT.howItWorks.description,
          lead: payload.summary || PUBLIC_PAGE_CONTENT.howItWorks.lead,
          sections:
            Array.isArray(payload.steps) && payload.steps.length
              ? [
                  {
                    heading: 'Talep ve teklif akisi',
                    paragraphs: payload.steps.map((item) => `${item.step} - ${item.title}: ${item.body}`)
                  },
                  {
                    heading: 'Kritik notlar',
                    paragraphs: payload.keyNotices || []
                  }
                ]
              : PUBLIC_PAGE_CONTENT.howItWorks.sections
        });
      } catch (_error) {
        // Fallback content already loaded.
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  return <PublicPageTemplate {...content} />;
}

export default HowItWorksPage;
