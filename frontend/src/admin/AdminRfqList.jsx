import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { formatAdminCityName, formatAdminDistrictName, formatAdminLocationLabel } from './adminLocationUtils';

const statusLabels = {
  open: 'Yayinda',
  closed: 'Pasif',
  awarded: 'Odullendi',
  expired: 'Suresi doldu',
  pending: 'Moderasyon',
  waiting: 'Moderasyon',
  draft: 'Taslak',
  rejected: 'Reddedildi'
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

export default function AdminRfqList({ defaultStatus = '' }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(() => ({
    q: '',
    status: defaultStatus === 'flagged' ? '' : defaultStatus,
    category: '',
    city: '',
    district: '',
    userId: '',
    moderationStatus: defaultStatus === 'pending' ? 'pending' : '',
    flagged: defaultStatus === 'flagged' ? 'true' : '',
    followUp: ''
  }));
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', page);
    params.set('limit', 20);
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters, page]);

  useEffect(() => {
    let active = true;
    const loadFilters = async () => {
      try {
        const [citiesResponse, districtsResponse] = await Promise.all([
          api.get('/admin/location/cities?includeInactive=true&limit=500'),
          api.get('/admin/location/districts?includeInactive=true&limit=500')
        ]);
        if (!active) return;
        setCities(citiesResponse.data?.items || []);
        setDistricts(districtsResponse.data?.items || []);
      } catch (_error) {
        if (!active) return;
        setCities([]);
        setDistricts([]);
      }
    };
    loadFilters();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/admin/rfqs?${queryParams}`);
        if (!active) return;
        const nextItems = response.data?.items || [];
        setItems(nextItems);
        setHasMore(Boolean(response.data?.pagination?.hasMore));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'RFQ listesi alinamadi.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [queryParams]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const applyBulkStatus = async () => {
    if (!bulkStatus || selectedIds.length === 0) return;
    setActionMessage('');
    try {
      await api.post('/admin/rfqs/status', {
        ids: selectedIds,
        status: bulkStatus
      });
      setActionMessage('Secili RFQ kayitlari guncellendi.');
      setSelectedIds([]);
      setPage(1);
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Toplu guncelleme basarisiz.');
    }
  };

  const onFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const filteredDistrictOptions = useMemo(() => {
    if (!filters.city) {
      return districts;
    }
    return districts.filter((district) => String(district.city?._id || district.city) === String(filters.city));
  }, [districts, filters.city]);

  const isRefreshing = loading && items.length > 0;

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">RFQ Yonetimi</div>
      <div className="admin-panel-body">
        <div className="admin-filter-grid">
          <input
            className="admin-input"
            placeholder="RFQ ara (baslik/aciklama)"
            value={filters.q}
            onChange={(event) => onFilterChange('q', event.target.value)}
          />
          <input
            className="admin-input"
            placeholder="Durum"
            value={filters.status}
            onChange={(event) => onFilterChange('status', event.target.value)}
          />
          <input
            className="admin-input"
            placeholder="Kategori id/slug"
            value={filters.category}
            onChange={(event) => onFilterChange('category', event.target.value)}
          />
          <select
            className="admin-input"
            value={filters.city}
            onChange={(event) => onFilterChange('city', event.target.value)}
          >
            <option value="">Sehir filtresi</option>
            {cities.map((city) => (
              <option key={city._id} value={city._id}>
                {city.name}
              </option>
            ))}
          </select>
          <select
            className="admin-input"
            value={filters.district}
            onChange={(event) => onFilterChange('district', event.target.value)}
          >
            <option value="">{filters.city ? 'Ilce sec' : 'Ilce filtresi'}</option>
            {filteredDistrictOptions.map((district) => (
              <option key={district._id} value={district._id}>
                {district.name}
              </option>
            ))}
          </select>
          <input
            className="admin-input"
            placeholder="Kullanici id"
            value={filters.userId}
            onChange={(event) => onFilterChange('userId', event.target.value)}
          />
          <input
            className="admin-input"
            placeholder="Moderasyon (pending/approved)"
            value={filters.moderationStatus}
            onChange={(event) => onFilterChange('moderationStatus', event.target.value)}
          />
          <select className="admin-input" value={filters.flagged} onChange={(event) => onFilterChange('flagged', event.target.value)}>
            <option value="">Flag durumu</option>
            <option value="true">Flagged</option>
            <option value="false">Flag yok</option>
          </select>
          <select className="admin-input" value={filters.followUp} onChange={(event) => onFilterChange('followUp', event.target.value)}>
            <option value="">Takip</option>
            <option value="true">Takibe alindi</option>
            <option value="false">Takip yok</option>
          </select>
        </div>

        <div className="admin-bulk-row">
          <select className="admin-input" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)}>
            <option value="">Toplu durum sec</option>
            <option value="open">open</option>
            <option value="closed">closed</option>
            <option value="awarded">awarded</option>
          </select>
          <button type="button" className="admin-btn" onClick={applyBulkStatus} disabled={!bulkStatus || selectedIds.length === 0}>
            Toplu Guncelle
          </button>
          {actionMessage ? <span className="admin-muted">{actionMessage}</span> : null}
        </div>

        {error ? <div className="admin-error">{error}</div> : null}
        {loading && items.length === 0 ? (
          <div className="admin-empty">Yukleniyor…</div>
        ) : items.length === 0 ? (
          <div className="admin-empty">RFQ bulunamadi.</div>
        ) : (
          <div className="admin-table-wrap">
            {isRefreshing ? (
              <div className="admin-table-overlay">
                <span>Filtreler guncelleniyor…</span>
              </div>
            ) : null}
            <div className="admin-table">
              <div className="admin-table-row admin-table-head rfq-row">
                <div></div>
                <div>Baslik</div>
                <div>Durum</div>
                <div>Moderasyon</div>
                <div>Kullanici</div>
                <div>Konum</div>
                <div>Olusturma</div>
                <div></div>
              </div>
              {items.map((rfq) => (
                <div key={rfq._id} className="admin-table-row rfq-row">
                  <div>
                    <input type="checkbox" checked={selectedIds.includes(rfq._id)} onChange={() => toggleSelect(rfq._id)} />
                  </div>
                  <div>
                    <strong>{rfq.title}</strong>
                    <div className="admin-muted">{formatAdminLocationLabel(rfq)}</div>
                  </div>
                  <div>
                    {filters.status === 'pending'
                      ? 'Moderasyon'
                      : statusLabels[rfq.status] || rfq.status}
                  </div>
                  <div>{rfq.moderationStatus || 'pending'}</div>
                  <div>{rfq.buyer?.email || '—'}</div>
                  <div>
                    <div>{formatAdminCityName(rfq)}</div>
                    <div className="admin-muted">{formatAdminDistrictName(rfq)}</div>
                  </div>
                  <div>{formatDate(rfq.createdAt)}</div>
                  <div>
                    <Link to={`/admin/rfq/${rfq._id}`} className="admin-link">
                      Detay
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="admin-pagination">
          <button type="button" className="admin-btn" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
            Onceki
          </button>
          <span className="admin-muted">Sayfa {page}</span>
          <button type="button" className="admin-btn" disabled={!hasMore} onClick={() => setPage((prev) => prev + 1)}>
            Sonraki
          </button>
        </div>
      </div>
    </div>
  );
}
