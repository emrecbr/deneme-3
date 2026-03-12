import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import api from './api/axios';
import { useAuth } from './context/AuthContext';

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
const OnboardingModal = lazy(() => import('./components/OnboardingModal'));

function App() {
  const { user, loading, checkAuth } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const body = document.body;
    if (theme === 'dark') {
      body.classList.add('dark-mode');
    } else {
      body.classList.remove('dark-mode');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

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

  if (loading) {
    return <div className="card">Yukleniyor...</div>;
  }

  return (
    <>
    <Suspense fallback={<div className="card">Yukleniyor...</div>}>
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <Layout showBottomNav={true} theme={theme} onToggleTheme={toggleTheme}>
              <Login />
            </Layout>
          )
        }
      />

      <Route
        path="/forgot-password"
        element={
          <Layout showBottomNav={false} theme={theme} onToggleTheme={toggleTheme}>
            <ForgotPassword />
          </Layout>
        }
      />

      <Route
        path="/reset-password"
        element={
          <Layout showBottomNav={false} theme={theme} onToggleTheme={toggleTheme}>
            <ResetPassword />
          </Layout>
        }
      />

      <Route
        path="/auth/callback"
        element={
          <Layout showBottomNav={false} theme={theme} onToggleTheme={toggleTheme}>
            <AuthCallback />
          </Layout>
        }
      />

      <Route
        path="/register"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <Layout showBottomNav={true} theme={theme} onToggleTheme={toggleTheme}>
              <RegisterOtp />
            </Layout>
          )
        }
      />

      <Route
        path="/sms-verify"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <Layout showBottomNav={true} theme={theme} onToggleTheme={toggleTheme}>
              <SmsVerify />
            </Layout>
          )
        }
      />

      <Route
        path="/email-verify"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <Layout showBottomNav={true} theme={theme} onToggleTheme={toggleTheme}>
              <EmailVerify />
            </Layout>
          )
        }
      />

      <Route
        path="/login-otp"
        element={
          user ? (
            <Navigate to="/" replace />
          ) : (
            <Layout showBottomNav={true} theme={theme} onToggleTheme={toggleTheme}>
              <LoginOtp />
            </Layout>
          )
        }
      />

      <Route
        path="/verify-otp"
        element={
          <Layout showBottomNav={true} theme={theme} onToggleTheme={toggleTheme}>
            <OtpVerify />
          </Layout>
        }
      />

      <Route
        path="/"
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
      <Route path="/rfq" element={<Navigate to="/" replace />} />

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
