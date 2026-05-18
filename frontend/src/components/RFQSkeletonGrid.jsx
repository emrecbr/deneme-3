function RFQSkeletonGrid({ count = 6 }) {
  return (
    <div className="rfq-skeleton-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card skeleton-card-wrap rfq-skeleton-card">
          <div className="rfq-skeleton-card__hero">
            <div className="skeleton rfq-skeleton-card__icon" />
            <div className="rfq-skeleton-card__copy">
              <div className="skeleton skeleton-title" />
              <div className="skeleton skeleton-line short" />
            </div>
          </div>
          <div className="rfq-skeleton-card__meta">
            <div className="skeleton skeleton-pill" />
            <div className="skeleton skeleton-pill" />
          </div>
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line" />
          <div className="rfq-skeleton-card__footer">
            <div className="skeleton rfq-skeleton-card__avatar" />
            <div className="rfq-skeleton-card__footer-copy">
              <div className="skeleton skeleton-line short" />
              <div className="skeleton skeleton-line short" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default RFQSkeletonGrid;
