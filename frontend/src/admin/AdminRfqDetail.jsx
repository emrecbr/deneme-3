import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';

const statusOptions = ['open', 'closed', 'awarded'];

export default function AdminRfqDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rfq, setRfq] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    categoryId: '',
    cityId: '',
    districtId: '',
    latitude: '',
    longitude: '',
    moderationNote: '',
    moderationReason: '',
    moderationStatus: '',
    isFlagged: false,
    followUp: false
  });
  const [status, setStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/admin/rfqs/${id}`);
        if (!active) return;
        const data = response.data?.data;
        setRfq(data);
        setForm({
          title: data?.title || '',
          description: data?.description || '',
          categoryId: data?.category?._id || data?.category || '',
          cityId: data?.city?._id || '',
          districtId: data?.district?._id || '',
          latitude: Array.isArray(data?.location?.coordinates) ? data.location.coordinates[1] : '',
          longitude: Array.isArray(data?.location?.coordinates) ? data.location.coordinates[0] : '',
          moderationNote: data?.moderationNote || '',
          moderationReason: data?.moderationReason || '',
          moderationStatus: data?.moderationStatus || 'pending',
          isFlagged: Boolean(data?.isFlagged),
          followUp: Boolean(data?.followUp)
        });
        setStatus(data?.status || '');
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'RFQ detayı alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [id]);

  const onFormChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveRfq = async () => {
    setActionMessage('');
    try {
      const payload = { ...form };
      await api.patch(`/admin/rfqs/${id}`, payload);
      setActionMessage('RFQ güncellendi.');
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'RFQ güncellenemedi.');
    }
  };

  const updateStatus = async () => {
    if (!status) return;
    setActionMessage('');
    try {
      await api.patch(`/admin/rfqs/${id}/status`, { status, note: statusNote });
      setActionMessage('RFQ durumu güncellendi.');
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'RFQ durumu güncellenemedi.');
    }
  };

  const updateModeration = async () => {
    setActionMessage('');
    try {
      await api.patch(`/admin/rfqs/${id}/moderation`, {
        moderationStatus: form.moderationStatus,
        moderationReason: form.moderationReason,
        moderationNote: form.moderationNote,
        isFlagged: Boolean(form.isFlagged),
        followUp: Boolean(form.followUp)
      });
      setActionMessage('Moderasyon güncellendi.');
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Moderasyon güncellenemedi.');
    }
  };

  const quickModeration = async (nextStatus, reason) => {
    setActionMessage('');
    try {
      await api.patch(`/admin/rfqs/${id}/moderation`, {
        moderationStatus: nextStatus,
        moderationReason: reason || '',
        moderationNote: form.moderationNote,
        isFlagged: nextStatus === 'flagged' ? true : form.isFlagged,
        followUp: form.followUp
      });
      setForm((prev) => ({
        ...prev,
        moderationStatus: nextStatus,
        moderationReason: reason || prev.moderationReason,
        isFlagged: nextStatus === 'flagged' ? true : prev.isFlagged
      }));
      setActionMessage('Moderasyon güncellendi.');
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Moderasyon güncellenemedi.');
    }
  };

  const meta = useMemo(() => {
    if (!rfq) return null;
    const category = rfq.category;
    let categoryLabel = 'Kategori bulunamadı';
    if (category && typeof category === 'object') {
      const name = category.name || '';
      if (category.parent?.name && name) {
        categoryLabel = `${category.parent.name} > ${name}`;
      } else if (name) {
        categoryLabel = name;
      }
    } else if (typeof category === 'string' && category.trim()) {
      categoryLabel = 'Kategori bulunamadı';
    }
    return {
      buyerEmail: rfq.buyer?.email || '—',
      city: rfq.city?.name || rfq.locationData?.city || '—',
      district: rfq.district?.name || rfq.locationData?.district || '—',
      category: categoryLabel
    };
  }, [rfq]);

  if (loading) {
    return <div className="admin-empty">Yükleniyor…</div>;
  }

  if (error) {
    return <div className="admin-error">{error}</div>;
  }

  if (!rfq) {
    return <div className="admin-empty">RFQ bulunamadı.</div>;
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">RFQ Detay</div>
      <div className="admin-panel-body">
        <div className="admin-detail-grid">
          <div>
            <div className="admin-muted">RFQ ID</div>
            <div>{rfq._id}</div>
          </div>
          <div>
            <div className="admin-muted">Kullanıcı</div>
            <div>{meta?.buyerEmail}</div>
          </div>
          <div>
            <div className="admin-muted">Şehir / İlçe</div>
            <div>{meta?.city} / {meta?.district}</div>
          </div>
          <div>
            <div className="admin-muted">Kategori</div>
            <div>{meta?.category}</div>
          </div>
        </div>

        <div className="admin-form-grid">
          <label>
            Başlık
            <input className="admin-input" value={form.title} onChange={(e) => onFormChange('title', e.target.value)} />
          </label>
          <label>
            Açıklama
            <textarea className="admin-textarea" rows="4" value={form.description} onChange={(e) => onFormChange('description', e.target.value)} />
          </label>
          <label>
            Kategori
            <input className="admin-input" value={meta?.category || 'Kategori bulunamadı'} readOnly />
          </label>
          <label>
            Şehir ID
            <input className="admin-input" value={form.cityId} onChange={(e) => onFormChange('cityId', e.target.value)} />
          </label>
          <label>
            İlçe ID
            <input className="admin-input" value={form.districtId} onChange={(e) => onFormChange('districtId', e.target.value)} />
          </label>
          <label>
            Latitude
            <input className="admin-input" value={form.latitude} onChange={(e) => onFormChange('latitude', e.target.value)} />
          </label>
          <label>
            Longitude
            <input className="admin-input" value={form.longitude} onChange={(e) => onFormChange('longitude', e.target.value)} />
          </label>
          <label>
            Moderasyon Notu
            <textarea className="admin-textarea" rows="3" value={form.moderationNote} onChange={(e) => onFormChange('moderationNote', e.target.value)} />
          </label>
          <label>
            Moderasyon Durumu
            <select className="admin-input" value={form.moderationStatus} onChange={(e) => onFormChange('moderationStatus', e.target.value)}>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="flagged">flagged</option>
            </select>
          </label>
          <label>
            Moderasyon Nedeni
            <input className="admin-input" value={form.moderationReason} onChange={(e) => onFormChange('moderationReason', e.target.value)} />
          </label>
          <label>
            Şüpheli (flag)
            <input type="checkbox" checked={form.isFlagged} onChange={(e) => onFormChange('isFlagged', e.target.checked)} />
          </label>
          <label>
            Takibe al
            <input type="checkbox" checked={form.followUp} onChange={(e) => onFormChange('followUp', e.target.checked)} />
          </label>
        </div>

        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={saveRfq}>Kaydet</button>
          <button type="button" className="admin-btn" onClick={updateModeration}>Moderasyonu Kaydet</button>
          <button type="button" className="admin-btn" onClick={() => quickModeration('approved', 'icerik uygun')}>
            Hızlı Onay
          </button>
          <button type="button" className="admin-btn" onClick={() => quickModeration('rejected', 'icerik uygun degil')}>
            Hızlı Red
          </button>
          <button type="button" className="admin-btn" onClick={() => quickModeration('flagged', 'supheli ilan')}>
            Şüpheli İşaretle
          </button>
          {actionMessage ? <span className="admin-muted">{actionMessage}</span> : null}
        </div>

        <div className="admin-divider"></div>

        <div className="admin-form-grid">
          <label>
            Durum
            <select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
          <label>
            Durum Notu
            <input className="admin-input" value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
          </label>
        </div>
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={updateStatus}>Durumu Güncelle</button>
        </div>
      </div>
    </div>
  );
}
