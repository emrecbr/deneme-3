import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('tr-TR');
};

export default function AdminUserDetail() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [rfqs, setRfqs] = useState([]);
  const [notes, setNotes] = useState([]);
  const [otpLogs, setOtpLogs] = useState([]);
  const [smsLogs, setSmsLogs] = useState([]);
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [noteText, setNoteText] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/admin/users/${id}`);
      const data = response.data?.data;
      setUser(data);
      setRfqs(response.data?.rfqs || []);
      setNotes(response.data?.notes || []);
      setStatus(data?.isDeleted ? 'blocked' : data?.isActive ? 'active' : 'passive');
      setRole(data?.role || 'buyer');
      if (data?.email) {
        const otpRes = await api.get('/admin/notifications/otp-logs', {
          params: { target: data.email, limit: 5 }
        });
        setOtpLogs(otpRes.data?.items || []);
      } else {
        setOtpLogs([]);
      }
      if (data?.phone) {
        const smsRes = await api.get('/admin/notifications/sms-logs', {
          params: { target: data.phone, limit: 5 }
        });
        setSmsLogs(smsRes.data?.items || []);
      } else {
        setSmsLogs([]);
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Kullanıcı detayı alınamadı.');
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
      await api.patch(`/admin/users/${id}/status`, { status });
      setActionMessage('Kullanıcı durumu güncellendi.');
      load();
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Durum güncellenemedi.');
    }
  };

  const updateRole = async () => {
    setActionMessage('');
    try {
      await api.patch(`/admin/users/${id}/role`, { role });
      setActionMessage('Kullanıcı rolü güncellendi.');
      load();
    } catch (err) {
      setActionMessage(err?.response?.data?.message || 'Rol güncellenemedi.');
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setActionMessage('');
    try {
      await api.post(`/admin/users/${id}/notes`, { note: noteText });
      setNoteText('');
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

  if (!user) {
    return <div className="admin-empty">Kullanıcı bulunamadı.</div>;
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Kullanıcı Detay</div>
      <div className="admin-panel-body">
        <div className="admin-detail-grid">
          <div>
            <div className="admin-muted">Email</div>
            <div>{user.email || '—'}</div>
          </div>
          <div>
            <div className="admin-muted">Telefon</div>
            <div>{user.phone || '—'}</div>
          </div>
          <div>
            <div className="admin-muted">Rol</div>
            <div>{user.role}</div>
          </div>
          <div>
            <div className="admin-muted">Son giriş</div>
            <div>{formatDate(user.lastLoginAt)}</div>
          </div>
        </div>

        <div className="admin-form-grid">
          <label>
            Kullanıcı Durumu
            <select className="admin-input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">active</option>
              <option value="passive">passive</option>
              <option value="blocked">blocked</option>
            </select>
          </label>
          <label>
            Rol
            <select className="admin-input" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="buyer">buyer</option>
              <option value="supplier">supplier</option>
              <option value="moderator">moderator</option>
              <option value="admin">admin</option>
            </select>
          </label>
        </div>

        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={updateStatus}>Durumu Güncelle</button>
          <button type="button" className="admin-btn" onClick={updateRole} disabled={currentUser?.role !== 'admin'}>
            Rolü Güncelle
          </button>
          {actionMessage ? <span className="admin-muted">{actionMessage}</span> : null}
        </div>

        <div className="admin-divider"></div>

        <div className="admin-panel-subtitle">Admin Notları</div>
        <div className="admin-note-row">
          <input
            className="admin-input"
            placeholder="Not ekle"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <button type="button" className="admin-btn" onClick={addNote}>
            Not Kaydet
          </button>
        </div>
        {notes.length === 0 ? (
          <div className="admin-empty">Not bulunamadı.</div>
        ) : (
          <ul className="admin-list">
            {notes.map((item) => (
              <li key={item._id}>
                <div>{item.note}</div>
                <span className="admin-muted">{formatDate(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="admin-divider"></div>

        <div className="admin-panel-subtitle">OTP / SMS Logları</div>
        <div className="admin-split-grid">
          <div>
            <div className="admin-muted">OTP</div>
            {otpLogs.length === 0 ? (
              <div className="admin-empty">Log yok.</div>
            ) : (
              <ul className="admin-list">
                {otpLogs.map((log) => (
                  <li key={log._id}>
                    <div>{log.event}</div>
                    <span className="admin-muted">{formatDate(log.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="admin-muted">SMS</div>
            {smsLogs.length === 0 ? (
              <div className="admin-empty">Log yok.</div>
            ) : (
              <ul className="admin-list">
                {smsLogs.map((log) => (
                  <li key={log._id}>
                    <div>{log.event}</div>
                    <span className="admin-muted">{formatDate(log.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="admin-divider"></div>

        <div className="admin-panel-subtitle">Kullanıcı RFQ’ları</div>
        {rfqs.length === 0 ? (
          <div className="admin-empty">RFQ bulunamadı.</div>
        ) : (
          <ul className="admin-list">
            {rfqs.map((item) => (
              <li key={item._id}>
                <div>
                  <strong>{item.title}</strong>
                  <span className="admin-muted">{item.status}</span>
                </div>
                <span className="admin-muted">{formatDate(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
