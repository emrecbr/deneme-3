import { useEffect, useState } from 'react';
import api from '../api/axios';

const emptyStep = { title: '', text: '' };

export default function AdminContentOnboarding() {
  const [steps, setSteps] = useState([emptyStep, emptyStep, emptyStep]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/admin/content/onboarding');
        if (!active) return;
        setSteps(response.data?.data?.steps || [emptyStep, emptyStep, emptyStep]);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Onboarding içerikleri alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const updateStep = (index, field, value) => {
    setSteps((prev) => prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  };

  const save = async () => {
    if (!window.confirm('Onboarding içerikleri güncellenecek. Devam edilsin mi?')) {
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await api.patch('/admin/content/onboarding', { steps });
      setSteps(response.data?.data?.steps || steps);
      setSuccess('Onboarding içerikleri güncellendi.');
    } catch (err) {
      setError(err?.response?.data?.message || 'Onboarding içerikleri güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Onboarding / Yardım Metinleri</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {success ? <div className="admin-success">{success}</div> : null}
        {loading ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : (
          <div className="admin-form-grid">
            {steps.map((step, index) => (
              <div key={`step-${index}`} className="admin-card">
                <div className="admin-card-label">Adım {index + 1}</div>
                <label>
                  <span>Başlık</span>
                  <input className="admin-input" value={step.title || ''} onChange={(e) => updateStep(index, 'title', e.target.value)} />
                </label>
                <label>
                  <span>Metin</span>
                  <textarea className="admin-textarea" rows={3} value={step.text || ''} onChange={(e) => updateStep(index, 'text', e.target.value)} />
                </label>
              </div>
            ))}
          </div>
        )}
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={save} disabled={loading || saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
