import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { formatAdminCityName, formatAdminDistrictName, formatAdminLocationLabel } from './adminLocationUtils';

const statusOptions = ['open', 'closed', 'awarded', 'expired'];

export default function AdminRfqDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rfq, setRfq] = useState(null);
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
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
        const [rfqResponse, citiesResponse, districtsResponse] = await Promise.all([
          api.get(`/admin/rfqs/${id}`),
          api.get('/admin/location/cities?includeInactive=true&limit=500'),
          api.get('/admin/location/districts?includeInactive=true&limit=500')
        ]);
        if (!active) return;
        const data = rfqResponse.data?.data;
        setCities(citiesResponse.data?.items || []);
        setDistricts(districtsResponse.data?.items || []);
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
        setError(err?.response?.data?.message || 'RFQ detayi alinamadi.');
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
      setActionMessage('RFQ guncellendi.');
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'RFQ guncellenemedi.');
    }
  };

  const updateStatus = async () => {
    if (!status) return;
    setActionMessage('');
    try {
      await api.patch(`/admin/rfqs/${id}/status`, { status, note: statusNote });
      setActionMessage('RFQ durumu guncellendi.');
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'RFQ durumu guncellenemedi.');
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
      setActionMessage('Moderasyon guncellendi.');
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Moderasyon guncellenemedi.');
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
      setActionMessage('Moderasyon guncellendi.');
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Moderasyon guncellenemedi.');
    }
  };

  const meta = useMemo(() => {
    if (!rfq) return null;
    const category = rfq.category;
    let categoryLabel = 'Kategori bulunamadi';
    if (category && typeof category === 'object') {
      const name = category.name || '';
      if (category.parent?.name && name) {
        categoryLabel = `${category.parent.name} > ${name}`;
      } else if (name) {
        categoryLabel = name;
      }
    }
    return {
      buyerEmail: rfq.buyer?.email || '—',
      city: formatAdminCityName(rfq),
      district: formatAdminDistrictName(rfq),
      locationLabel: formatAdminLocationLabel(rfq),
      category: categoryLabel
    };
  }, [rfq]);

  const filteredDistricts = useMemo(() => {
    if (!form.cityId) {
      return districts;
    }
    return districts.filter((district) => String(district.city?._id || district.city) === String(form.cityId));
  }, [districts, form.cityId]);

  if (loading) {
    return <div className="admin-empty">Yukleniyor…</div>;
  }

  if (error) {
    return <div className="admin-error">{error}</div>;
  }

  if (!rfq) {
    return <div className="admin-empty">RFQ bulunamadi.</div>;
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
            <div className="admin-muted">Kullanici</div>
            <div>{meta?.buyerEmail}</div>
          </div>
          <div>
            <div className="admin-muted">Sehir / Ilce</div>
            <div>{meta?.city} / {meta?.district}</div>
            <div className="admin-muted">{meta?.locationLabel}</div>
          </div>
          <div>
            <div className="admin-muted">Kategori</div>
            <div>{meta?.category}</div>
          </div>
        </div>

        <div className="admin-form-grid">
          <label>
            Baslik
            <input className="admin-input" value={form.title} onChange={(e) => onFormChange('title', e.target.value)} />
          </label>
          <label>
            Aciklama
            <textarea className="admin-textarea" rows="4" value={form.description} onChange={(e) => onFormChange('description', e.target.value)} />
          </label>
          <label>
            Kategori
            <input className="admin-input" value={meta?.category || 'Kategori bulunamadi'} readOnly />
          </label>
          <label>
            Sehir
            <select className="admin-input" value={form.cityId} onChange={(e) => onFormChange('cityId', e.target.value)}>
              <option value="">Sehir secin</option>
              {cities.map((city) => (
                <option key={city._id} value={city._id}>{city.name}</option>
              ))}
            </select>
          </label>
          <label>
            Ilce
            <select className="admin-input" value={form.districtId} onChange={(e) => onFormChange('districtId', e.target.value)}>
              <option value="">{form.cityId ? 'Ilce secin' : 'Once sehir secin'}</option>
              {filteredDistricts.map((district) => (
                <option key={district._id} value={district._id}>{district.name}</option>
              ))}
            </select>
          </label>
          <label>
            Enlem
            <input className="admin-input" value={form.latitude} onChange={(e) => onFormChange('latitude', e.target.value)} />
          </label>
          <label>
            Boylam
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
            Supheli (flag)
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
            Hizli Onay
          </button>
          <button type="button" className="admin-btn" onClick={() => quickModeration('rejected', 'icerik uygun degil')}>
            Hizli Red
          </button>
          <button type="button" className="admin-btn" onClick={() => quickModeration('flagged', 'supheli ilan')}>
            Supheli Isaretle
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
          <button type="button" className="admin-btn" onClick={updateStatus}>Durumu Guncelle</button>
        </div>
      </div>
    </div>
  );
}
