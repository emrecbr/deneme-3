import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import OtpVerify from './pages/OtpVerify';
import RegisterOtp from './pages/RegisterOtp';
import SmsVerify from './pages/SmsVerify';
import EmailVerify from './pages/EmailVerify';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LoginOtp from './pages/LoginOtp';
import RFQCreate from './pages/RFQCreate';
import RFQList from './pages/RFQList';
import RFQDetail from './pages/RFQDetail';
import Chat from './pages/Chat';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import ProfileRequests from './pages/ProfileRequests';
import ProfileOffers from './pages/ProfileOffers';
import ProfileAccount from './pages/ProfileAccount';
import ProfileAddresses from './pages/ProfileAddresses';
import Messages from './pages/Messages';
import FavoritesPage from './pages/FavoritesPage';
import Premium from './pages/Premium';
import PremiumReturn from './pages/PremiumReturn';
import Categories from './pages/Categories';
import AdminCarImport from './pages/AdminCarImport';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import OnboardingModal from './components/OnboardingModal';
import api from './api/axios';
import { useAuth } from './context/AuthContext';

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
      console.log('VITE_API_URL', import.meta.env.VITE_API_URL);
    }
  }, []);

  if (loading) {
    return <div className="card">Yukleniyor...</div>;
  }

  return (
    <>
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
    </>
  );
}

export default App;
