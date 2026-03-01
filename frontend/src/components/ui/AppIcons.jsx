export function NotificationIcon({ size = 22, className = '', unreadCount = 0 }) {
  const dotSize = 8;
  return (
    <span className={`app-icon ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M6 9a6 6 0 0 1 12 0v4.2l1.7 2.2a1 1 0 0 1-.8 1.6H5.1a1 1 0 0 1-.8-1.6L6 13.2V9Z" />
        <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
      </svg>
      {unreadCount > 0 ? (
        <span
          className="app-icon-badge"
          style={{ width: dotSize, height: dotSize }}
        />
      ) : null}
    </span>
  );
}

export function FavoriteIcon({ size = 22, active = false, className = '' }) {
  return (
    <span className={`app-icon ${active ? 'app-icon-active' : 'app-icon-muted'} ${className}`} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
      </svg>
    </span>
  );
}
