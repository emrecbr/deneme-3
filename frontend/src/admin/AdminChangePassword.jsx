import { useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function AdminChangePassword() {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event?.preventDefault();
    setError('');
    setMessage('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Tum alanlar zorunludur.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Yeni sifre en az 8 karakter olmalidir.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Yeni sifreler eslesmiyor.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.patch('/admin/auth/change-password', {
        currentPassword,
        newPassword
      });
      if (response.data?.success) {
        setMessage('Sifre guncellendi. Guvenlik geregi tekrar giris yapilacak.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          logout({ redirect: true });
        }, 1200);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Sifre guncellenemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Sifre Degistir</div>
      <div className="admin-panel-body">
        <div className="admin-info">
          Bu form admin paneli icinde mevcut sifreni degistirir. Islem basarili oldugunda mevcut oturum sonlandirilir
          ve yeni sifreyle tekrar giris yapman gerekir.
        </div>
        <form className="admin-form-grid" onSubmit={submit}>
          <label>
            Mevcut sifre
            <input
              className="admin-input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            Yeni sifre
            <input
              className="admin-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label>
            Yeni sifre tekrar
            <input
              className="admin-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
          <div className="admin-action-row">
            <button type="submit" className="admin-btn" disabled={loading}>
              {loading ? 'Kaydediliyor…' : 'Sifreyi Guncelle'}
            </button>
            {message ? <span className="admin-success-inline">{message}</span> : null}
            {error ? <span className="admin-error">{error}</span> : null}
          </div>
        </form>
      </div>
    </div>
  );
}
