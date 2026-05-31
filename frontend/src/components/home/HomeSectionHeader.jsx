export default function HomeSectionHeader({ title, subtitle }) {
  if (!title && !subtitle) {
    return null;
  }

  return (
    <div className="home-section-header">
      {title ? <h2>{title}</h2> : null}
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}
