import { useEffect } from 'react';
import PublicFooter from './PublicFooter';

const ensureMetaDescription = () => {
  let tag = document.querySelector('meta[name="description"]');
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', 'description');
    document.head.appendChild(tag);
  }
  return tag;
};

function PublicPageTemplate({ title, description, lead, sections }) {
  useEffect(() => {
    const previousTitle = document.title;
    const descriptionTag = ensureMetaDescription();
    const previousDescription = descriptionTag.getAttribute('content') || '';

    document.title = `${title} | Talepet`;
    descriptionTag.setAttribute('content', description);

    return () => {
      document.title = previousTitle;
      descriptionTag.setAttribute('content', previousDescription);
    };
  }, [description, title]);

  return (
    <div className="public-page-shell">
      <section className="public-hero">
        <p className="public-eyebrow">Kurumsal Bilgilendirme</p>
        <h1>{title}</h1>
        <p className="public-lead">{lead}</p>
      </section>

      <article className="public-page-card">
        {sections.map((section) => (
          <section key={section.heading} className="public-content-section">
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
      </article>

      <PublicFooter />
    </div>
  );
}

export default PublicPageTemplate;
