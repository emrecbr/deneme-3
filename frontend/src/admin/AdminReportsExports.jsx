import { useState } from 'react';
import api from '../api/axios';

const EXPORT_TYPES = [
  { key: 'rfqs', label: 'RFQ Listesi' },
  { key: 'users', label: 'Kullanıcı Listesi' },
  { key: 'audit', label: 'Audit Log' },
  { key: 'otp', label: 'OTP Logları' },
  { key: 'sms', label: 'SMS Logları' },
  { key: 'search', label: 'Arama Logları' }
];

export default function AdminReportsExports() {
  const [selected, setSelected] = useState('rfqs');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const download = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/reports/export', {
        params: { type: selected },
        responseType: 'blob'
      });
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${selected}-export.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.response?.data?.message || 'Export başarısız.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Export / Reporting</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        <div className="admin-form-grid">
          <label>
            <span>Export türü</span>
            <select className="admin-input" value={selected} onChange={(e) => setSelected(e.target.value)}>
              {EXPORT_TYPES.map((item) => (
                <option key={item.key} value={item.key}>{item.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="admin-action-row">
          <button type="button" className="admin-btn" onClick={download} disabled={loading}>
            {loading ? 'İndiriliyor…' : 'CSV İndir'}
          </button>
        </div>
      </div>
    </div>
  );
}
