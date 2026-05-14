import {
  WEBSITE_PACKAGES_PATH,
  WEBSITE_PROFILE_ACCOUNT_PATH,
  WEBSITE_PROFILE_ADDRESSES_PATH,
  WEBSITE_PROFILE_ALERTS_PATH,
  WEBSITE_PROFILE_FAVORITES_PATH,
  WEBSITE_PROFILE_HOME_PATH,
  WEBSITE_PROFILE_MESSAGES_PATH,
  WEBSITE_PROFILE_OFFERS_PATH,
  WEBSITE_PROFILE_REQUESTS_PATH
} from '../config/surfaces';

export const websiteProfileNavItems = [
  {
    label: 'Genel Bakis',
    to: WEBSITE_PROFILE_HOME_PATH,
    description: 'Hesap ozeti, hizli aksiyonlar ve temel gorunum.'
  },
  {
    label: 'Hesap',
    to: WEBSITE_PROFILE_ACCOUNT_PATH,
    description: 'Kullanici bilgileri, guvenlik ve hesap ayarlari.'
  },
  {
    label: 'Taleplerim',
    to: WEBSITE_PROFILE_REQUESTS_PATH,
    description: 'Olusturdugun talepler ve durumlari.'
  },
  {
    label: 'Tekliflerim',
    to: WEBSITE_PROFILE_OFFERS_PATH,
    description: 'Verdigin teklifler ve surecleri.'
  },
  {
    label: 'Favoriler',
    to: WEBSITE_PROFILE_FAVORITES_PATH,
    description: 'Kaydettigin RFQ ve ilanlar.'
  },
  {
    label: 'Mesajlar',
    to: WEBSITE_PROFILE_MESSAGES_PATH,
    description: 'Sohbet ve iletisim giris noktalari.'
  },
  {
    label: 'Adresler',
    to: WEBSITE_PROFILE_ADDRESSES_PATH,
    description: 'Konum ve adres kayitlarin.'
  },
  {
    label: 'Paketler',
    to: WEBSITE_PACKAGES_PATH,
    description: 'Dijital hizmet paketleri, uyelik farklari ve compliance aciklamalari.'
  },
  {
    label: 'Takiplerim',
    to: WEBSITE_PROFILE_ALERTS_PATH,
    description: 'Kategori, sehir ve anahtar kelime takiplerin.'
  }
];
