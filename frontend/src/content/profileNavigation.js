import {
  WEBSITE_PROFILE_ACCOUNT_PATH,
  WEBSITE_PROFILE_ADDRESSES_PATH,
  WEBSITE_PROFILE_ALERTS_PATH,
  WEBSITE_PROFILE_FAVORITES_PATH,
  WEBSITE_PROFILE_HOME_PATH,
  WEBSITE_PROFILE_MESSAGES_PATH,
  WEBSITE_PROFILE_OFFERS_PATH,
  WEBSITE_PROFILE_PREMIUM_PATH,
  WEBSITE_PROFILE_REQUESTS_PATH
} from '../config/surfaces';

export const websiteProfileNavItems = [
  {
    label: 'Genel Bakış',
    to: WEBSITE_PROFILE_HOME_PATH,
    description: 'Hesap özeti, hızlı aksiyonlar ve temel görünüm.'
  },
  {
    label: 'Hesap',
    to: WEBSITE_PROFILE_ACCOUNT_PATH,
    description: 'Kullanıcı bilgileri, güvenlik ve hesap ayarları.'
  },
  {
    label: 'Taleplerim',
    to: WEBSITE_PROFILE_REQUESTS_PATH,
    description: 'Oluşturduğun talepler ve durumları.'
  },
  {
    label: 'Tekliflerim',
    to: WEBSITE_PROFILE_OFFERS_PATH,
    description: 'Verdiğin teklifler ve süreçleri.'
  },
  {
    label: 'Favoriler',
    to: WEBSITE_PROFILE_FAVORITES_PATH,
    description: 'Kaydettiğin RFQ ve ilanlar.'
  },
  {
    label: 'Mesajlar',
    to: WEBSITE_PROFILE_MESSAGES_PATH,
    description: 'Sohbet ve iletişim giriş noktaları.'
  },
  {
    label: 'Adresler',
    to: WEBSITE_PROFILE_ADDRESSES_PATH,
    description: 'Konum ve adres kayıtların.'
  },
  {
    label: 'Premium',
    to: WEBSITE_PROFILE_PREMIUM_PATH,
    description: 'Paket, kota ve premium görünürlük alanı.'
  },
  {
    label: 'Takiplerim',
    to: WEBSITE_PROFILE_ALERTS_PATH,
    description: 'Kategori, şehir ve anahtar kelime takiplerin.'
  }
];

