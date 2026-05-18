const normalizeValue = (value) => String(value || '').trim().toLowerCase();

export const resolveRfqCategoryIconKey = (categoryLabel = '') => {
  const value = normalizeValue(categoryLabel);

  if (
    value.includes('nakliye') ||
    value.includes('tasima') ||
    value.includes('lojistik') ||
    value.includes('kargo')
  ) {
    return 'transport';
  }
  if (
    value.includes('temizlik') ||
    value.includes('hijyen') ||
    value.includes('bakim')
  ) {
    return 'sparkles';
  }
  if (
    value.includes('yazilim') ||
    value.includes('web') ||
    value.includes('uygulama') ||
    value.includes('kod') ||
    value.includes('tasarim')
  ) {
    return 'code';
  }
  if (
    value.includes('tadilat') ||
    value.includes('tamir') ||
    value.includes('usta') ||
    value.includes('onarim')
  ) {
    return 'hammer';
  }
  if (
    value.includes('otomobil') ||
    value.includes('arac') ||
    value.includes('oto')
  ) {
    return 'car';
  }
  if (
    value.includes('ev') ||
    value.includes('mobilya') ||
    value.includes('emlak')
  ) {
    return 'home';
  }
  if (
    value.includes('is') ||
    value.includes('kariyer') ||
    value.includes('personel') ||
    value.includes('eleman')
  ) {
    return 'briefcase';
  }
  return 'package';
};

const iconPaths = {
  transport: (
    <>
      <path d="M3.5 15.5V9.5a1 1 0 0 1 1-1h9v7" />
      <path d="M13.5 11.5h3.7l2.3 2.5v1.5h-6" />
      <circle cx="7.5" cy="16.5" r="1.5" />
      <circle cx="17.5" cy="16.5" r="1.5" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 4.5l1.1 2.9L16 8.5l-2.9 1.1L12 12.5l-1.1-2.9L8 8.5l2.9-1.1L12 4.5Z" />
      <path d="M18 13.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z" />
      <path d="M6 12.5l.5 1.4 1.5.5-1.5.5-.5 1.4-.5-1.4-1.5-.5 1.5-.5.5-1.4Z" />
    </>
  ),
  code: (
    <>
      <path d="M9 8 5.5 12 9 16" />
      <path d="m15 8 3.5 4-3.5 4" />
      <path d="m13 6-2 12" />
    </>
  ),
  hammer: (
    <>
      <path d="m14.5 6.5 3 3" />
      <path d="M12.5 8.5 7 14l3 3 5.5-5.5" />
      <path d="M6.5 17.5 4 20" />
      <path d="m10.5 4.5 3 3" />
    </>
  ),
  car: (
    <>
      <path d="M5.5 14.5 7 10h10l1.5 4.5" />
      <path d="M4.5 14.5h15v2a1 1 0 0 1-1 1h-1" />
      <path d="M5.5 17.5h-1a1 1 0 0 1-1-1v-2" />
      <circle cx="8" cy="17.5" r="1.5" />
      <circle cx="16" cy="17.5" r="1.5" />
    </>
  ),
  home: (
    <>
      <path d="m4.5 10.5 7.5-6 7.5 6" />
      <path d="M6.5 9.5v9h11v-9" />
      <path d="M10 18.5v-5h4v5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="4.5" y="7.5" width="15" height="10" rx="2" />
      <path d="M9 7.5v-1a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6.5v1" />
      <path d="M4.5 11.5h15" />
    </>
  ),
  package: (
    <>
      <path d="m12 4.5 7 3.5-7 3.5-7-3.5 7-3.5Z" />
      <path d="M5 8v8l7 3.5 7-3.5V8" />
      <path d="M12 11.5v8" />
    </>
  )
};

export function RfqCategoryIcon({ categoryLabel, size = 20, className = '' }) {
  const iconKey = resolveRfqCategoryIconKey(categoryLabel);

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {iconPaths[iconKey]}
    </svg>
  );
}

export const buildRfqMarkerIconSvg = (categoryLabel = '') => {
  const iconKey = resolveRfqCategoryIconKey(categoryLabel);
  const pathMarkupByKey = {
    transport:
      '<path d="M3.5 15.5V9.5a1 1 0 0 1 1-1h9v7"/><path d="M13.5 11.5h3.7l2.3 2.5v1.5h-6"/><circle cx="7.5" cy="16.5" r="1.5"/><circle cx="17.5" cy="16.5" r="1.5"/>',
    sparkles:
      '<path d="M12 4.5l1.1 2.9L16 8.5l-2.9 1.1L12 12.5l-1.1-2.9L8 8.5l2.9-1.1L12 4.5Z"/><path d="M18 13.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6.6-1.6Z"/><path d="M6 12.5l.5 1.4 1.5.5-1.5.5-.5 1.4-.5-1.4-1.5-.5 1.5-.5.5-1.4Z"/>',
    code:
      '<path d="M9 8 5.5 12 9 16"/><path d="m15 8 3.5 4-3.5 4"/><path d="m13 6-2 12"/>',
    hammer:
      '<path d="m14.5 6.5 3 3"/><path d="M12.5 8.5 7 14l3 3 5.5-5.5"/><path d="M6.5 17.5 4 20"/><path d="m10.5 4.5 3 3"/>',
    car:
      '<path d="M5.5 14.5 7 10h10l1.5 4.5"/><path d="M4.5 14.5h15v2a1 1 0 0 1-1 1h-1"/><path d="M5.5 17.5h-1a1 1 0 0 1-1-1v-2"/><circle cx="8" cy="17.5" r="1.5"/><circle cx="16" cy="17.5" r="1.5"/>',
    home:
      '<path d="m4.5 10.5 7.5-6 7.5 6"/><path d="M6.5 9.5v9h11v-9"/><path d="M10 18.5v-5h4v5"/>',
    briefcase:
      '<rect x="4.5" y="7.5" width="15" height="10" rx="2"/><path d="M9 7.5v-1a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6.5v1"/><path d="M4.5 11.5h15"/>',
    package:
      '<path d="m12 4.5 7 3.5-7 3.5-7-3.5 7-3.5Z"/><path d="M5 8v8l7 3.5 7-3.5V8"/><path d="M12 11.5v8"/>'
  };

  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${pathMarkupByKey[iconKey]}</svg>`;
};
