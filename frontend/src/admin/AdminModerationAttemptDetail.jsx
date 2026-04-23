import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/adminApi';

export default function AdminModerationAttemptDetail() {
  const { id } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setError('');
      const response = await api.get(`/admin/moderation/attempts/${id}`);
      const data = response.data?.data || null;
      setAttempt(data);
      setUserStats(response.data?.userStats || null);
      setStatus(data?.status || '');
      setAdminNotes(data?.adminNotes || '');
    } catch (err) {
      setError(err?.response?.data?.message || 'Detay alınamadı.');
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.patch(`/admin/moderation/attempts/${id}`, { status, adminNotes });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Güncelleme başarısız.');
    } finally {
      setSaving(false);
    }
  };

  if (!attempt) {
    return (
      <div className="admin-panel">
        <div className="admin-panel-title">Moderasyon Detayı</div>
        <div className="admin-panel-body">{error ? <div className="admin-error">{error}</div> : 'Yükleniyor…'}</div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Moderasyon Detayı</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-panel-subtitle">İçerik</div>
        <div className="admin-card">
          <div>
            <strong>{attempt.attemptedTitle || 'Başlıksız içerik'}</strong>
          </div>
          <div className="admin-muted">{attempt.attemptedDescription || 'Açıklama yok.'}</div>
          <div className="admin-muted">
            Tür: {attempt.contentType} · Durum: {attempt.status} · Karar: {attempt.decision || '—'} · Risk: {attempt.riskScore || 0}
          </div>
          {attempt.normalizedText ? (
            <div className="admin-muted">Normalize: {attempt.normalizedText.slice(0, 120)}</div>
          ) : null}
          {attempt.matchedSignals?.length ? (
            <div className="admin-muted">
              Sinyaller: {attempt.matchedSignals.map((signal) => signal.type).join(', ')}
            </div>
          ) : null}
          {attempt.repeatedAttemptCount ? (
            <div className="admin-muted">Tekrar sayısı: {attempt.repeatedAttemptCount}</div>
          ) : null}
        </div>

        <div className="admin-panel-subtitle">Eşleşen Kurallar</div>
        {attempt.matchedRules?.length ? (
          <ul className="admin-list">
            {attempt.matchedRules.map((rule, idx) => (
              <li key={`${rule.id || 'rule'}-${idx}`}>
                <div>
                  <strong>{rule.term}</strong>
                  <span className="admin-muted">
                    {rule.category} · {rule.severity} · {rule.matchType}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="admin-empty">Eşleşme yok.</div>
        )}

        <div className="admin-panel-subtitle">Kullanıcı</div>
        <div className="admin-card">
          <div>
            <strong>{attempt.user?.name || 'İsim yok'}</strong>
          </div>
          <div className="admin-muted">{attempt.user?.email || 'E-posta yok'}</div>
          <div className="admin-muted">{attempt.user?.phone || ''}</div>
          {userStats ? (
            <div className="admin-muted">
              Toplam deneme: {userStats.total} · Engellenen: {userStats.blocked}
            </div>
          ) : null}
        </div>

        <div className="admin-panel-subtitle">İnceleme</div>
        <div className="admin-form-grid">
          <label>
            <span>Durum</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="blocked">Engellendi</option>
              <option value="under_review">İncelemede</option>
              <option value="approved_override">Onaylandı</option>
              <option value="rejected">Reddedildi</option>
            </select>
          </label>
          <label>
            <span>Admin Notu</span>
            <textarea value={adminNotes} onChange={(event) => setAdminNotes(event.target.value)} />
          </label>
        </div>
        <button type="button" className="primary-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
