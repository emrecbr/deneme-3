function RFQSkeletonGrid({ count = 6 }) {
  return (
    <div className="rfq-skeleton-grid">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card skeleton-card-wrap rfq-skeleton-card">
          <div className="skeleton skeleton-media" />
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton skeleton-line short" />
        </div>
      ))}
    </div>
  );
}

export default RFQSkeletonGrid;
