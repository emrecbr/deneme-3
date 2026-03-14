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

  const submit = async () => {
    setError('');
    setMessage('');
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Tüm alanlar zorunludur.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalıdır.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.patch('/admin/auth/change-password', {
        currentPassword,
        newPassword
      });
      if (response.data?.success) {
        setMessage('Şifre güncellendi. Lütfen tekrar giriş yapın.');
        setTimeout(() => {
          logout({ redirect: true });
        }, 1200);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Şifre güncellenemedi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Şifre Değiştir</div>
      <div className="admin-panel-body">
        <div className="admin-form-grid">
          <label>
            Mevcut Şifre
            <input
              className="admin-input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </label>
          <label>
            Yeni Şifre
            <input
              className="admin-input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </label>
          <label>
            Yeni Şifre Tekrar
            <input
              className="admin-input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
        </div>
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={submit} disabled={loading}>
            {loading ? 'Kaydediliyor…' : 'Şifreyi Güncelle'}
          </button>
          {message ? <span className="admin-muted">{message}</span> : null}
          {error ? <span className="admin-error">{error}</span> : null}
        </div>
      </div>
    </div>
  );
}
