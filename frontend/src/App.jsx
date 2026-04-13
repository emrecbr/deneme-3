import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import WebsiteAuthShell from './components/WebsiteAuthShell';
import AdminLayout from './admin/AdminLayout';
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'));
const AdminPlaceholder = lazy(() => import('./admin/AdminPlaceholder'));
const AdminRfqList = lazy(() => import('./admin/AdminRfqList'));
const AdminRfqDetail = lazy(() => import('./admin/AdminRfqDetail'));
const AdminRfqExpired = lazy(() => import('./admin/AdminRfqExpired'));
const AdminUserList = lazy(() => import('./admin/AdminUserList'));
const AdminUserDetail = lazy(() => import('./admin/AdminUserDetail'));
const AdminAuditLog = lazy(() => import('./admin/AdminAuditLog'));
const AdminCategories = lazy(() => import('./admin/AdminCategories'));
const AdminSubcategories = lazy(() => import('./admin/AdminSubcategories'));
const AdminCategoryIssues = lazy(() => import('./admin/AdminCategoryIssues'));
const AdminSearchSuggestions = lazy(() => import('./admin/AdminSearchSuggestions'));
const AdminCities = lazy(() => import('./admin/AdminCities'));
const AdminDistricts = lazy(() => import('./admin/AdminDistricts'));
const AdminLocationIssues = lazy(() => import('./admin/AdminLocationIssues'));
const AdminRadiusSettings = lazy(() => import('./admin/AdminRadiusSettings'));
const AdminOtpLogs = lazy(() => import('./admin/AdminOtpLogs'));
const AdminSmsLogs = lazy(() => import('./admin/AdminSmsLogs'));
const AdminPushTest = lazy(() => import('./admin/AdminPushTest'));
const AdminPushLogs = lazy(() => import('./admin/AdminPushLogs'));
const AdminPushPreferences = lazy(() => import('./admin/AdminPushPreferences'));
const AdminAlerts = lazy(() => import('./admin/AdminAlerts'));
const AdminSystemHealth = lazy(() => import('./admin/AdminSystemHealth'));
const AdminFeatureFlags = lazy(() => import('./admin/AdminFeatureFlags'));
const AdminMaintenance = lazy(() => import('./admin/AdminMaintenance'));
const AdminListingExpiry = lazy(() => import('./admin/AdminListingExpiry'));
const AdminListingQuota = lazy(() => import('./admin/AdminListingQuota'));
const AdminMonetizationPlans = lazy(() => import('./admin/AdminMonetizationPlans'));
const AdminMapSettings = lazy(() => import('./admin/AdminMapSettings'));
const AdminMapTest = lazy(() => import('./admin/AdminMapTest'));
const AdminSearchAnalytics = lazy(() => import('./admin/AdminSearchAnalytics'));
const AdminContentHome = lazy(() => import('./admin/AdminContentHome'));
const AdminContentOnboarding = lazy(() => import('./admin/AdminContentOnboarding'));
const AdminUiTexts = lazy(() => import('./admin/AdminUiTexts'));
const AdminRfqFlowSteps = lazy(() => import('./admin/AdminRfqFlowSteps'));
const AdminRfqValidationAnalytics = lazy(() => import('./admin/AdminRfqValidationAnalytics'));
const AdminModerationQueueAdvanced = lazy(() => import('./admin/AdminModerationQueueAdvanced'));
const AdminRiskSignals = lazy(() => import('./admin/AdminRiskSignals'));
const AdminModerationRules = lazy(() => import('./admin/AdminModerationRules'));
const AdminModerationAttempts = lazy(() => import('./admin/AdminModerationAttempts'));
const AdminModerationAttemptDetail = lazy(() => import('./admin/AdminModerationAttemptDetail'));
const AdminModerationSettings = lazy(() => import('./admin/AdminModerationSettings'));
const AdminModerationRiskUsers = lazy(() => import('./admin/AdminModerationRiskUsers'));
const AdminReportsOverview = lazy(() => import('./admin/AdminReportsOverview'));
const AdminReportsExports = lazy(() => import('./admin/AdminReportsExports'));
const AdminIssueReports = lazy(() => import('./admin/AdminIssueReports'));
const AdminIssueReportDetail = lazy(() => import('./admin/AdminIssueReportDetail'));
const AdminPermissions = lazy(() => import('./admin/AdminPermissions'));
const AdminAdmins = lazy(() => import('./admin/AdminAdmins'));
const AdminChangePassword = lazy(() => import('./admin/AdminChangePassword'));
import AdminProtectedRoute from './admin/AdminProtectedRoute';
import PrivateRoute from './components/PrivateRoute';
import api from './api/axios';
import {
  ADMIN_HOME_PATH,
  APP_HOME_PATH,
  SURFACE_LABELS,
  isWebsiteAuthPath,
  isWebSurfaceHost,
  resolveSurfaceLabel,
  resolveSurfaceLabelFromHostname,
  WEB_HOME_PATH
} from './config/surfaces';
import { useAuth } from './context/AuthContext';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const OtpVerify = lazy(() => import('./pages/OtpVerify'));
const RegisterOtp = lazy(() => import('./pages/RegisterOtp'));
const SmsVerify = lazy(() => import('./pages/SmsVerify'));
const EmailVerify = lazy(() => import('./pages/EmailVerify'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const LoginOtp = lazy(() => import('./pages/LoginOtp'));
const RFQCreate = lazy(() => import('./pages/RFQCreate'));
const RFQList = lazy(() => import('./pages/RFQList'));
const RFQDetail = lazy(() => import('./pages/RFQDetail'));
const Chat = lazy(() => import('./pages/Chat'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Profile = lazy(() => import('./pages/Profile'));
const ProfileRequests = lazy(() => import('./pages/ProfileRequests'));
const ProfileOffers = lazy(() => import('./pages/ProfileOffers'));
const ProfileAccount = lazy(() => import('./pages/ProfileAccount'));
const ProfileAddresses = lazy(() => import('./pages/ProfileAddresses'));
const Messages = lazy(() => import('./pages/Messages'));
const FavoritesPage = lazy(() => import('./pages/FavoritesPage'));
const Premium = lazy(() => import('./pages/Premium'));
const PremiumReturn = lazy(() => import('./pages/PremiumReturn'));
const Categories = lazy(() => import('./pages/Categories'));
const AdminCarImport = lazy(() => import('./pages/AdminCarImport'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const DistanceSalesPage = lazy(() => import('./pages/DistanceSalesPage'));
const DeliveryReturnsPage = lazy(() => import('./pages/DeliveryReturnsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));

function RootSurfaceRoute({ user, authenticatedPath }) {
  const hostSurface = resolveSurfaceLabelFromHostname();

  if (hostSurface === SURFACE_LABELS.admin) {
    return <Navigate to={ADMIN_HOME_PATH} replace />;
  }

  if (hostSurface === SURFACE_LABELS.app) {
    return (
      <Layout>
        <RFQList />
      </Layout>
    );
  }

  if (hostSurface === SURFACE_LABELS.web) {
    return <LandingPage />;
  }

  if (user) {
    return <Navigate to={authenticatedPath} replace />;
  }

  return <LandingPage />;
}

function App() {
  const { user, loading, checkAuth } = useAuth();
  const location = useLocation();
  const websiteHost = isWebSurfaceHost();
  const websiteAuthRoute = websiteHost && isWebsiteAuthPath(location.pathname);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [maintenance, setMaintenance] = useState({ loading: true, enabled: false, message: '' });

  useEffect(() => {
    const body = document.body;
    if (theme === 'dark') {
      body.classList.add('dark-mode');
    } else {
      body.classList.remove('dark-mode');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.surface = resolveSurfaceLabel(location.pathname);
  }, [location.pathname]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const renderAuthShell = useCallback(
    (content, options = {}) => {
      if (!websiteHost) {
        return (
          <Layout showBottomNav={options.showBottomNav ?? true} theme={theme} onToggleTheme={toggleTheme}>
            {content}
          </Layout>
        );
      }

      return (
        <WebsiteAuthShell
          eyebrow={options.eyebrow}
          title={options.title}
          description={options.description}
        >
          {content}
        </WebsiteAuthShell>
      );
    },
    [theme, toggleTheme, websiteHost]
  );

  useEffect(() => {
    if (!user) {
      setShowOnboarding(false);
      return;
    }
    setShowOnboarding(user.isOnboardingCompleted === false);
  }, [user]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const openOnboarding = () => {
      if (user) {
        setShowOnboarding(true);
      }
    };

    window.addEventListener('open-onboarding', openOnboarding);
    return () => {
      window.removeEventListener('open-onboarding', openOnboarding);
    };
  }, [user]);

  useEffect(() => {
    if (showOnboarding) {
      window.dispatchEvent(new CustomEvent('bottomnav:hide'));
    } else {
      window.dispatchEvent(new CustomEvent('bottomnav:show'));
    }
  }, [showOnboarding]);

  useEffect(() => {
    if (import.meta.env.DEV) {
    }
  }, []);

  useEffect(() => {
    let active = true;
    const loadMaintenance = async () => {
      try {
        const response = await api.get('/system/maintenance');
        if (!active) return;
        const data = response.data?.data || {};
        setMaintenance({
          loading: false,
          enabled: Boolean(data.enabled),
          message: data.message || 'Sistem bakımda.'
        });
      } catch (_error) {
        if (!active) return;
        setMaintenance((prev) => ({ ...prev, loading: false }));
      }
    };
    loadMaintenance();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="card">Yükleniyor...</div>;
  }

  const isAdminRole = user?.role === 'admin' || user?.role === 'moderator';
  const defaultAuthenticatedPath = isAdminRole ? ADMIN_HOME_PATH : APP_HOME_PATH;
  const maintenanceBlocking =
    !maintenance.loading &&
    maintenance.enabled &&
    !isAdminRole &&
    !location.pathname.startsWith('/admin') &&
    !websiteAuthRoute;

  if (maintenanceBlocking) {
    return (
      <div className="card maintenance-card">
        <h2>Bakım Modu</h2>
        <p>{maintenance.message || 'Sistem bakımda.'}</p>
      </div>
    );
  }

  return (
    <>
    <Suspense fallback={<div className="card">Yükleniyor...</div>}>
    <Routes>
      <Route
        path="/admin"
        element={
          <AdminProtectedRoute>
            <AdminLayout />
          </AdminProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="rfq/all" element={<AdminRfqList />} />
        <Route path="rfq/moderation" element={<AdminRfqList defaultStatus="pending" />} />
        <Route path="rfq/flagged" element={<AdminRfqList defaultStatus="flagged" />} />
        <Route path="rfq/expired" element={<AdminRfqExpired />} />
        <Route path="rfq/:id" element={<AdminRfqDetail />} />
        <Route path="moderation/queue-advanced" element={<AdminModerationQueueAdvanced />} />
        <Route path="moderation/risk-signals" element={<AdminRiskSignals />} />
        <Route path="moderation/rules" element={<AdminModerationRules />} />
        <Route path="moderation/attempts" element={<AdminModerationAttempts />} />
        <Route path="moderation/attempts/:id" element={<AdminModerationAttemptDetail />} />
        <Route path="moderation/settings" element={<AdminModerationSettings />} />
        <Route path="moderation/risk-users" element={<AdminModerationRiskUsers />} />
        <Route path="rfq-flow/steps" element={<AdminRfqFlowSteps />} />
        <Route path="rfq-flow/validation" element={<Navigate to="/admin/rfq-flow/validation-analytics" replace />} />
        <Route path="rfq-flow/validation-analytics" element={<AdminRfqValidationAnalytics />} />
        <Route path="rfq-flow/errors" element={<AdminPlaceholder title="Form Hata İzleme" />} />
        <Route path="users/all" element={<AdminUserList />} />
        <Route path="users/flagged" element={<AdminUserList defaultStatus="blocked" />} />
        <Route path="users/:id" element={<AdminUserDetail />} />
        <Route path="categories/main" element={<AdminCategories />} />
        <Route path="categories/sub" element={<AdminSubcategories />} />
        <Route path="categories/mapping" element={<AdminCategoryIssues />} />
        <Route path="categories/suggestions" element={<AdminSearchSuggestions />} />
        <Route path="locations/cities" element={<AdminCities />} />
        <Route path="locations/districts" element={<AdminDistricts />} />
        <Route path="locations/issues" element={<AdminLocationIssues />} />
        <Route path="locations/live" element={<AdminRadiusSettings />} />
        <Route path="location/cities" element={<AdminCities />} />
        <Route path="location/districts" element={<AdminDistricts />} />
        <Route path="location/issues" element={<AdminLocationIssues />} />
        <Route path="location/radius-settings" element={<AdminRadiusSettings />} />
        <Route path="map/settings" element={<AdminMapSettings />} />
        <Route path="map/missing" element={<AdminPlaceholder title="Haritada Görünmeyen İlanlar" />} />
        <Route path="map/test" element={<AdminMapTest />} />
        <Route path="search/analytics" element={<AdminSearchAnalytics />} />
        <Route path="search/suggestions" element={<AdminSearchSuggestions />} />
        <Route path="search/filters" element={<AdminPlaceholder title="Filtre Ayarları" />} />
        <Route path="notifications/sms" element={<Navigate to="/admin/notifications/sms-logs" replace />} />
        <Route path="notifications/otp" element={<Navigate to="/admin/notifications/otp-logs" replace />} />
        <Route path="notifications/sms-logs" element={<AdminSmsLogs />} />
        <Route path="notifications/otp-logs" element={<AdminOtpLogs />} />
        <Route path="notifications/push-test" element={<AdminPushTest />} />
        <Route path="notifications/push-logs" element={<AdminPushLogs />} />
        <Route path="notifications/push-preferences" element={<AdminPushPreferences />} />
        <Route path="notifications/templates" element={<AdminPlaceholder title="Bildirim Şablonları" />} />
        <Route path="alerts" element={<AdminAlerts />} />
        <Route path="content/home" element={<AdminContentHome />} />
        <Route path="content/onboarding" element={<AdminContentOnboarding />} />
        <Route path="content/ui" element={<Navigate to="/admin/content/ui-texts" replace />} />
        <Route path="content/ui-texts" element={<AdminUiTexts />} />
        <Route path="system/health" element={<AdminSystemHealth />} />
        <Route path="system/errors" element={<AdminPlaceholder title="Hata Kayıtları" />} />
        <Route path="system/flags" element={<Navigate to="/admin/system/feature-flags" replace />} />
        <Route path="system/feature-flags" element={<AdminFeatureFlags />} />
        <Route path="system/maintenance" element={<AdminMaintenance />} />
        <Route path="system/listing-expiry" element={<AdminListingExpiry />} />
        <Route path="system/listing-quota" element={<AdminListingQuota />} />
        <Route path="system/monetization-plans" element={<AdminMonetizationPlans />} />
        <Route path="admins" element={<AdminAdmins />} />
        <Route path="roles" element={<AdminPermissions />} />
        <Route path="account/password" element={<AdminChangePassword />} />
        <Route path="reports/overview" element={<AdminReportsOverview />} />
        <Route path="reports/exports" element={<AdminReportsExports />} />
        <Route path="reports/issues" element={<AdminIssueReports />} />
        <Route path="reports/issues/:id" element={<AdminIssueReportDetail />} />
        <Route path="audit" element={<AdminAuditLog />} />
      </Route>
      <Route
        path="/login"
        element={
          user && !websiteAuthRoute ? (
            <Navigate to={defaultAuthenticatedPath} replace />
          ) : (
            renderAuthShell(<Login />, {
              eyebrow: 'Website girisi',
              title: 'Talepet hesabina website uzerinden giris yap.',
              description:
                'Talepet website deneyimini terk etmeden hesabina giris yapabilir, kayit olabilir ve hazir oldugunda uygulamaya kontrollu sekilde gecebilirsin.'
            })
          )
        }
      />

      <Route
        path="/forgot-password"
        element={
          renderAuthShell(<ForgotPassword />, {
            showBottomNav: false,
            eyebrow: 'Sifre yenileme',
            title: 'Sifreni website uzerinden yenile.',
            description: 'Sifre sifirlama adimlari website baglaminda ilerler ve mevcut auth altyapisini reuse eder.'
          })
        }
      />

      <Route
        path="/reset-password"
        element={
          renderAuthShell(<ResetPassword />, {
            showBottomNav: false,
            eyebrow: 'Sifre sifirlama',
            title: 'Yeni sifreni belirle.',
            description: 'Sifre yenileme akisini website yuzeyi icinde tamamlayip daha sonra kontrollu sekilde devam edebilirsin.'
          })
        }
      />

      <Route
        path="/auth/callback"
        element={
          renderAuthShell(<AuthCallback />, {
            showBottomNav: false,
            eyebrow: 'Auth callback',
            title: 'Giris bilgilerin dogrulaniyor.',
            description: 'Social auth callback tamamlanirken website baglami korunur.'
          })
        }
      />

      <Route
        path="/register"
        element={
          user && !websiteAuthRoute ? (
            <Navigate to={defaultAuthenticatedPath} replace />
          ) : (
            renderAuthShell(<RegisterOtp />, {
              eyebrow: 'Website kaydi',
              title: 'Talepet hesabini website uzerinden olustur.',
              description:
                'Kayit deneyimi website icinde baslar. OTP, e-posta ve telefon adimlari ayni backend auth altyapisini kullanir.'
            })
          )
        }
      />

      <Route
        path="/sms-verify"
        element={
          user && !websiteAuthRoute ? (
            <Navigate to={defaultAuthenticatedPath} replace />
          ) : (
            renderAuthShell(<SmsVerify />, {
              eyebrow: 'SMS dogrulama',
              title: 'Telefon dogrulamani website uzerinden tamamla.',
              description: 'SMS tabanli giris ve kayit adimlari website auth deneyiminin parcasi olarak kalir.'
            })
          )
        }
      />

      <Route
        path="/email-verify"
        element={
          user && !websiteAuthRoute ? (
            <Navigate to={defaultAuthenticatedPath} replace />
          ) : (
            renderAuthShell(<EmailVerify />, {
              eyebrow: 'E-posta dogrulama',
              title: 'E-posta ile hesabini dogrula.',
              description: 'E-posta kod dogrulama adimlari website yuzeyi icinde ilerler ve ayni auth servisini reuse eder.'
            })
          )
        }
      />

      <Route
        path="/login-otp"
        element={
          user && !websiteAuthRoute ? (
            <Navigate to={defaultAuthenticatedPath} replace />
          ) : (
            renderAuthShell(<LoginOtp />, {
              eyebrow: 'OTP ile giris',
              title: 'OTP ile website uzerinden devam et.',
              description: 'Telefon ve e-posta OTP giris akislari website auth katmaninda calisir.'
            })
          )
        }
      />

      <Route
        path="/verify-otp"
        element={
          renderAuthShell(<OtpVerify />, {
            eyebrow: 'Kod dogrulama',
            title: 'Dogrulama kodunu gir.',
            description: 'Kod dogrulama adimini website auth deneyimi icinde tamamlayabilirsin.'
          })
        }
      />

      <Route
        path={WEB_HOME_PATH}
        element={
          <RootSurfaceRoute user={user} authenticatedPath={defaultAuthenticatedPath} />
        }
      />

      <Route
        path={APP_HOME_PATH}
        element={
          <Layout theme={theme} onToggleTheme={toggleTheme}>
            <RFQList />
          </Layout>
        }
      />

      <Route
        path="/create"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <RFQCreate />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route path="/rfq/create" element={<Navigate to="/create" replace />} />
      <Route path="/rfq" element={<Navigate to={APP_HOME_PATH} replace />} />

      <Route
        path="/rfq/:id"
        element={
          <Layout theme={theme} onToggleTheme={toggleTheme}>
            <RFQDetail />
          </Layout>
        }
      />

      <Route
        path="/messages"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <Messages />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/messages/:chatId"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <Chat />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <Notifications />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <Profile />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/profile/requests"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <ProfileRequests />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/profile/account"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <ProfileAccount />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/profile/addresses"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <ProfileAddresses />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/profile/offers"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <ProfileOffers />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/favorites"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <FavoritesPage />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/premium"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <Premium />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/premium/return"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <PremiumReturn />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/categories"
        element={
          <Layout theme={theme} onToggleTheme={toggleTheme}>
            <Categories />
          </Layout>
        }
      />

      <Route
        path="/hakkimizda"
        element={
          <Layout showBottomNav={false} theme={theme} onToggleTheme={toggleTheme}>
            <AboutPage />
          </Layout>
        }
      />

      <Route
        path="/gizlilik-sozlesmesi"
        element={
          <Layout showBottomNav={false} theme={theme} onToggleTheme={toggleTheme}>
            <PrivacyPolicyPage />
          </Layout>
        }
      />

      <Route
        path="/mesafeli-satis-sozlesmesi"
        element={
          <Layout showBottomNav={false} theme={theme} onToggleTheme={toggleTheme}>
            <DistanceSalesPage />
          </Layout>
        }
      />

      <Route
        path="/teslimat-ve-iade"
        element={
          <Layout showBottomNav={false} theme={theme} onToggleTheme={toggleTheme}>
            <DeliveryReturnsPage />
          </Layout>
        }
      />

      <Route
        path="/iletisim"
        element={
          <Layout showBottomNav={false} theme={theme} onToggleTheme={toggleTheme}>
            <ContactPage />
          </Layout>
        }
      />

      <Route
        path="/admin/tsb-import"
        element={
          <PrivateRoute>
            <Layout theme={theme} onToggleTheme={toggleTheme}>
              <AdminCarImport />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
    {showOnboarding ? (
      <Suspense fallback={null}>
        <OnboardingModal
          open={showOnboarding}
          onComplete={async (locationSelection) => {
            try {
              if (locationSelection?.city) {
                await api.patch('/users/location-selection', locationSelection);
              }
              await api.patch('/users/onboarding-complete');
              await checkAuth();
            } finally {
              setShowOnboarding(false);
            }
          }}
        />
      </Suspense>
    ) : null}
    </>
  );
}

export default App;
