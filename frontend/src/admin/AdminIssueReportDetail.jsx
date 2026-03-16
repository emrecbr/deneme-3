import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

const statusLabel = (status) => {
  switch (status) {
    case 'new':
      return 'Yeni';
    case 'under_review':
      return 'İncelemede';
    case 'resolved':
      return 'Çözüldü';
    case 'rejected':
      return 'Geçersiz';
    case 'closed':
      return 'Kapalı';
    default:
      return status || '—';
  }
};

export default function AdminIssueReportDetail() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [source, setSource] = useState(null);
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/admin/reports/issues/${id}`);
      const data = response.data?.data || null;
      setReport(data);
      setSource(response.data?.source || null);
      setStatus(data?.status || 'new');
    } catch (err) {
      setError(err?.response?.data?.message || 'Bildirim detayı alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const updateStatus = async () => {
    setActionMessage('');
    try {
      await api.patch(`/admin/reports/issues/${id}/status`, { status });
      setActionMessage('Durum güncellendi.');
      load();
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Durum güncellenemedi.');
    }
  };

  const addNote = async () => {
    if (!note.trim()) return;
    setActionMessage('');
    try {
      await api.post(`/admin/reports/issues/${id}/notes`, { note });
      setNote('');
      setActionMessage('Not eklendi.');
      load();
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Not eklenemedi.');
    }
  };

  if (loading) {
    return <div className="admin-empty">Yükleniyor…</div>;
  }

  if (error) {
    return <div className="admin-error">{error}</div>;
  }

  if (!report) {
    return <div className="admin-empty">Bildirim bulunamadı.</div>;
  }

  const reporterLabel = report.reporterUserId?.name || report.reporterUserId?.email || '—';
  const reportedLabel = report.reportedUserId?.name || report.reportedUserId?.email || '—';

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Sorun Bildirimi Detay</div>
      <div className="admin-panel-body">
        <div className="admin-detail-grid">
          <div>
            <div className="admin-muted">Başlık</div>
            <div>{report.title}</div>
          </div>
          <div>
            <div className="admin-muted">Durum</div>
            <div>{statusLabel(report.status)}</div>
          </div>
          <div>
            <div className="admin-muted">Kaynak</div>
            <div>{report.sourceType === 'rfq' ? 'RFQ' : 'Profil'}</div>
          </div>
          <div>
            <div className="admin-muted">Kategori</div>
            <div>{report.category || '—'}</div>
          </div>
          <div>
            <div className="admin-muted">İlişki</div>
            <div>{report.roleRelation || '—'}</div>
          </div>
          <div>
            <div className="admin-muted">Reporter</div>
            <div>{reporterLabel}</div>
          </div>
          <div>
            <div className="admin-muted">Reported</div>
            <div>{reportedLabel}</div>
          </div>
          <div>
            <div className="admin-muted">Oluşturma</div>
            <div>{formatDate(report.createdAt)}</div>
          </div>
        </div>

        <div className="admin-divider"></div>

        <div className="admin-panel-subtitle">Açıklama</div>
        <div className="admin-empty" style={{ textAlign: 'left' }}>{report.description}</div>

        {source ? (
          <>
            <div className="admin-divider"></div>
            <div className="admin-panel-subtitle">İlgili Kayıt</div>
            {report.sourceType === 'rfq' ? (
              <div className="admin-muted">
                RFQ: {source?.title || '—'} ({source?.status || '-'})
              </div>
            ) : (
              <div className="admin-muted">
                Profil: {source?.name || source?.email || '—'}
              </div>
            )}
          </>
        ) : null}

        <div className="admin-divider"></div>

        <div className="admin-form-grid">
          <label>
            Durum
            <select className="admin-input" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="new">Yeni</option>
              <option value="under_review">İncelemede</option>
              <option value="resolved">Çözüldü</option>
              <option value="rejected">Geçersiz</option>
              <option value="closed">Kapalı</option>
            </select>
          </label>
        </div>
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={updateStatus}>
            Durumu Güncelle
          </button>
          {actionMessage ? <span className="admin-muted">{actionMessage}</span> : null}
        </div>

        <div className="admin-divider"></div>

        <div className="admin-panel-subtitle">Admin Notu</div>
        <div className="admin-note-row">
          <input
            className="admin-input"
            placeholder="Not ekle"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <button type="button" className="admin-btn" onClick={addNote}>
            Not Kaydet
          </button>
        </div>

        {report.adminNotes?.length ? (
          <ul className="admin-list">
            {report.adminNotes.map((item) => (
              <li key={item._id || item.createdAt}>
                <div>{item.note}</div>
                <span className="admin-muted">{formatDate(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="admin-empty">Not bulunamadı.</div>
        )}

        {report.statusHistory?.length ? (
          <>
            <div className="admin-divider"></div>
            <div className="admin-panel-subtitle">Durum Geçmişi</div>
            <ul className="admin-list">
              {report.statusHistory.map((item) => (
                <li key={item._id || item.createdAt}>
                  <div>{statusLabel(item.status)}</div>
                  <span className="admin-muted">{formatDate(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
