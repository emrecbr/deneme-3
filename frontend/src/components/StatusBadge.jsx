const TONE_CLASS_MAP = {
  neutral: 'badge-secondary',
  info: 'badge-info',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger'
};

export default function StatusBadge({ children, tone = 'neutral', className = '' }) {
  const toneClass = TONE_CLASS_MAP[tone] || TONE_CLASS_MAP.neutral;
  const classes = ['badge', toneClass, className].filter(Boolean).join(' ');

  return <span className={classes}>{children}</span>;
}
