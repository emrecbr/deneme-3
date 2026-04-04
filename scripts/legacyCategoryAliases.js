export const LEGACY_CATEGORY_ALIASES = {
  'beyaz esya': ['goods:beyaz esya'],
  beyazesya: ['goods:beyaz esya'],
  bilgisayar: ['goods:elektronik>bilgisayar'],
  tv: ['goods:elektronik>tv'],
  telefon: ['goods:elektronik>telefon tablet'],
  tablet: ['goods:elektronik>telefon tablet'],
  'telefon tablet': ['goods:elektronik>telefon tablet'],
  'ses sistemi': ['goods:elektronik>ses sistemi'],
  elektrikci: ['service:tadilat ve onarim>elektrikci'],
  tesisat: ['service:tadilat ve onarim>tesisatci'],
  tesisatci: ['service:tadilat ve onarim>tesisatci'],
  boyaci: ['service:tadilat ve onarim>boyaci badana'],
  nakliye: ['service:nakliye ve tasima'],
  'oto bakim': ['auto:bakim ve servis>periyodik bakim'],
  bakim: ['auto:bakim ve servis>periyodik bakim'],
  'yag filtre': ['auto:bakim ve servis>yag filtre'],
  aku: ['auto:bakim ve servis>aku'],
  lastik: [
    'auto:lastik ve jant>yaz lastigi',
    'auto:lastik ve jant>kis lastigi',
    'auto:lastik ve jant>4 mevsim'
  ],
  jant: ['auto:lastik ve jant>jant'],
  temizlik: ['service:temizlik', 'jobseeker:is alanlari>temizlik']
};

export const LEGACY_SEGMENT_HINTS = {
  auto: ['brand:', 'araba', 'oto', 'yakit', 'yag', 'filtre', 'fren', 'jant', 'lastik', 'kaporta', 'motor', 'aku'],
  service: ['usta', 'servis', 'elektrik', 'tesisat', 'boya', 'badana', 'nakliye', 'montaj', 'temizlik', 'kurulum', 'tamir'],
  goods: ['beyaz esya', 'beyazesya', 'elektronik', 'telefon', 'tablet', 'bilgisayar', 'mobilya', 'mutfak', 'banyo'],
  jobseeker: ['garson', 'kurye', 'ofis', 'magaza', 'guvenlik', 'cagri', 'is arayan']
};

export const BRAND_VALUE_PATTERNS = [/^brand:/i, /^marka:/i];

export const JUNK_VALUE_PATTERNS = [
  /^[a-z0-9]{3,}$/i,
  /^[a-z0-9]+$/i
];

export const SEGMENT_INTENT_PATTERNS = {
  auto: ['brand:', 'araba', 'oto', 'bmw', 'fiat', 'peugeot', 'volkswagen', 'passat', 'uno', 'yag pompasi', 'paspas', 'motor', 'fren', 'filtre', 'jant', 'lastik'],
  service: ['usta', 'servis', 'montaj', 'tamir', 'kurulum', 'nakliye', 'temizlik', 'tesisat', 'elektrik', 'boyaci'],
  goods: ['beyaz esya', 'telefon', 'tablet', 'bilgisayar', 'mobilya', 'mutfak', 'banyo', 'elektronik'],
  jobseeker: ['garson', 'kurye', 'ofis', 'magaza', 'is arayan', 'cagri merkezi']
};
