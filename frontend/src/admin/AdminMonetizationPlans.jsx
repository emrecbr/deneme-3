import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

const initialQuota = {
  periodDays: 30,
  maxFree: 5,
  extraEnabled: true
};

const formatPrice = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const normalizeModes = (modes) =>
  Array.isArray(modes) && modes.length ? modes : ['monthly', 'yearly'];

const planHelpTexts = {
  premium_listing:
    'Premium ilan, normal ilana göre daha görünür olacak ücretli ilan tipidir. Buradan aylık ve yıllık fiyatını belirleyebilirsiniz.',
  featured_listing:
    'Öne çıkarılan ilan, listelerde daha üstte veya daha dikkat çekici görünmesi için kullanılan ücretli ilan seçeneğidir.'
};

export default function AdminMonetizationPlans() {
  const [plans, setPlans] = useState([]);
  const [initialPlans, setInitialPlans] = useState([]);
  const [quota, setQuota] = useState(initialQuota);
  const [initialQuotaSnapshot, setInitialQuotaSnapshot] = useState(initialQuota);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const sanitizePlan = (plan) => ({
    _id: plan._id,
    key: plan.key,
    title: plan.title,
    shortDescription: plan.shortDescription,
    longDescription: plan.longDescription || '',
    badgeLabel: plan.badgeLabel || '',
    isActive: Boolean(plan.isActive),
    showInApp: Boolean(plan.showInApp),
    billingModes: normalizeModes(plan.billingModes),
    monthlyPrice: formatPrice(plan.monthlyPrice),
    yearlyPrice: formatPrice(plan.yearlyPrice),
    currency: plan.currency || 'TRY',
    sortOrder: Number(plan.sortOrder || 0)
  });

  const load = async () => {
    try {
      setError('');
      const [plansRes, quotaRes] = await Promise.all([
        api.get('/admin/monetization/plans'),
        api.get('/admin/system/listing-quota')
      ]);
      const incomingPlans = (plansRes.data?.items || []).map((item) => ({
        ...item,
        billingModes: normalizeModes(item.billingModes)
      }));
      setPlans(incomingPlans);
      setInitialPlans(incomingPlans.map(sanitizePlan));
      const incomingQuota = quotaRes.data?.data || initialQuota;
      setQuota(incomingQuota);
      setInitialQuotaSnapshot(incomingQuota);
    } catch (err) {
      setError(err?.response?.data?.message || 'Veriler alınamadı.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updatePlanField = (id, field, value) => {
    setPlans((prev) =>
      prev.map((item) => (item._id === id ? { ...item, [field]: value } : item))
    );
  };

  const updateBillingMode = (id, mode, enabled) => {
    setPlans((prev) =>
      prev.map((item) => {
        if (item._id !== id) return item;
        const current = new Set(normalizeModes(item.billingModes));
        if (enabled) {
          current.add(mode);
        } else {
          current.delete(mode);
        }
        return { ...item, billingModes: Array.from(current) };
      })
    );
  };

  const validatePlan = (plan) => {
    if (!plan.isActive || !plan.showInApp) return '';
    const modes = normalizeModes(plan.billingModes);
    if (!modes.length) return 'En az bir fatura modu seçilmelidir.';
    if (modes.includes('monthly') && Number(plan.monthlyPrice) <= 0) {
      return 'Aylık fiyat 0 olamaz.';
    }
    if (modes.includes('yearly') && Number(plan.yearlyPrice) <= 0) {
      return 'Yıllık fiyat 0 olamaz.';
    }
    return '';
  };

  const hasValidationError = useMemo(
    () => plans.some((plan) => Boolean(validatePlan(plan))),
    [plans]
  );

  const isDirty = useMemo(() => {
    const currentPlans = plans.map(sanitizePlan);
    const currentQuota = quota || initialQuota;
    return (
      JSON.stringify(currentPlans) !== JSON.stringify(initialPlans) ||
      JSON.stringify(currentQuota) !== JSON.stringify(initialQuotaSnapshot)
    );
  }, [plans, quota, initialPlans, initialQuotaSnapshot]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const handler = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await Promise.all(
        plans.map((plan) =>
          api.patch(`/admin/monetization/plans/${plan._id}`, {
            title: plan.title,
            shortDescription: plan.shortDescription,
            longDescription: plan.longDescription || '',
            badgeLabel: plan.badgeLabel,
            isActive: plan.isActive,
            showInApp: plan.showInApp,
            billingModes: normalizeModes(plan.billingModes),
            monthlyPrice: formatPrice(plan.monthlyPrice),
            yearlyPrice: formatPrice(plan.yearlyPrice),
            currency: plan.currency,
            sortOrder: plan.sortOrder
          })
        )
      );
      await api.patch('/admin/system/listing-quota', {
        periodDays: quota.periodDays,
        maxFree: quota.maxFree,
        extraEnabled: quota.extraEnabled
      });
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'Kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">İlan Paketleri & Ücretlendirme</div>
      <div className="admin-panel-body">
        <div className="admin-info">
          Bu ekrandaki ayarlar uygulamadaki ilan paketleri ve fiyatlarını doğrudan etkiler.
          Değişiklikten sonra uygulama yeni fiyatları API üzerinden alır.
        </div>
        {isDirty ? <div className="admin-warning">Kaydedilmemiş değişiklikleriniz var.</div> : null}
        {error ? <div className="admin-error">{error}</div> : null}

        <div className="admin-card admin-plan-card">
          <div className="admin-card-title">Ücretsiz İlan Hakkı</div>
          <div className="admin-muted">
            Bir kullanıcının belirli süre içinde ücretsiz oluşturabileceği ilan sayısını belirler.
          </div>
          <div className="admin-form-grid">
            <label>
              <span>Hak Periyodu (gün)</span>
              <input
                type="number"
                value={quota.periodDays || 0}
                onChange={(event) => setQuota((prev) => ({ ...prev, periodDays: Number(event.target.value) }))}
              />
            </label>
            <label>
              <span>Ücretsiz Hak</span>
              <input
                type="number"
                value={quota.maxFree || 0}
                onChange={(event) => setQuota((prev) => ({ ...prev, maxFree: Number(event.target.value) }))}
              />
            </label>
            <label>
              <span>Ücretli İlan Aktif</span>
              <select
                value={quota.extraEnabled ? 'true' : 'false'}
                onChange={(event) =>
                  setQuota((prev) => ({ ...prev, extraEnabled: event.target.value === 'true' }))
                }
              >
                <option value="true">Açık</option>
                <option value="false">Kapalı</option>
              </select>
            </label>
          </div>
        </div>

        {plans.map((plan) => (
          <div key={plan._id} className="admin-card admin-plan-card">
            <div className="admin-card-title">{plan.title}</div>
            <div className="admin-muted">{planHelpTexts[plan.key] || plan.shortDescription}</div>
            <div className="admin-form-grid">
              <label>
                <span>Aktif</span>
                <select
                  value={plan.isActive ? 'true' : 'false'}
                  onChange={(event) => updatePlanField(plan._id, 'isActive', event.target.value === 'true')}
                >
                  <option value="true">Açık</option>
                  <option value="false">Kapalı</option>
                </select>
              </label>
              <label>
                <span>Uygulamada Göster</span>
                <select
                  value={plan.showInApp ? 'true' : 'false'}
                  onChange={(event) => updatePlanField(plan._id, 'showInApp', event.target.value === 'true')}
                >
                  <option value="true">Evet</option>
                  <option value="false">Hayır</option>
                </select>
              </label>
              <label>
                <span>Fatura Modları</span>
                <div className="admin-inline-actions">
                  <label className="admin-inline-option">
                    <input
                      type="checkbox"
                      checked={normalizeModes(plan.billingModes).includes('monthly')}
                      onChange={(event) => updateBillingMode(plan._id, 'monthly', event.target.checked)}
                    />
                    <span>Aylık</span>
                  </label>
                  <label className="admin-inline-option">
                    <input
                      type="checkbox"
                      checked={normalizeModes(plan.billingModes).includes('yearly')}
                      onChange={(event) => updateBillingMode(plan._id, 'yearly', event.target.checked)}
                    />
                    <span>Yıllık</span>
                  </label>
                </div>
              </label>
              <label>
                <span>Aylık Ücret (TRY)</span>
                <input
                  type="number"
                  value={formatPrice(plan.monthlyPrice)}
                  onChange={(event) => updatePlanField(plan._id, 'monthlyPrice', Number(event.target.value))}
                />
              </label>
              <label>
                <span>Yıllık Ücret (TRY)</span>
                <input
                  type="number"
                  value={formatPrice(plan.yearlyPrice)}
                  onChange={(event) => updatePlanField(plan._id, 'yearlyPrice', Number(event.target.value))}
                />
              </label>
              <label>
                <span>Kısa Açıklama</span>
                <input
                  value={plan.shortDescription || ''}
                  onChange={(event) => updatePlanField(plan._id, 'shortDescription', event.target.value)}
                />
              </label>
              <label>
                <span>Uzun Açıklama</span>
                <textarea
                  rows={3}
                  value={plan.longDescription || ''}
                  onChange={(event) => updatePlanField(plan._id, 'longDescription', event.target.value)}
                />
              </label>
              <label>
                <span>Rozet</span>
                <input
                  value={plan.badgeLabel || ''}
                  onChange={(event) => updatePlanField(plan._id, 'badgeLabel', event.target.value)}
                />
              </label>
              <label>
                <span>Sıralama</span>
                <input
                  type="number"
                  value={plan.sortOrder || 0}
                  onChange={(event) => updatePlanField(plan._id, 'sortOrder', Number(event.target.value))}
                />
              </label>
            </div>
            {validatePlan(plan) ? <div className="admin-error">{validatePlan(plan)}</div> : null}
          </div>
        ))}

        <div className="admin-form-actions">
          <button type="button" className="primary-btn" onClick={handleSave} disabled={saving || hasValidationError}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}
