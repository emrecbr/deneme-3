import { useEffect, useState } from 'react';
import api from '../api/adminApi';

export default function AdminCategoryIssues() {
  const [issues, setIssues] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setError('');
      try {
        const response = await api.get('/admin/categories/issues');
        setIssues(response.data?.issues || null);
      } catch (err) {
        setError(err?.response?.data?.message || 'Kategori sorunları alınamadı.');
      }
    };
    load();
  }, []);

  return (
    <div className="admin-panel">
      <div className="admin-panel-title">Kategori Eşleme Sorunları</div>
      <div className="admin-panel-body">
        {error ? <div className="admin-error">{error}</div> : null}
        {!issues ? (
          <div className="admin-empty">Yükleniyor…</div>
        ) : (
          <>
            <div className="admin-panel-subtitle">Parent Kaybı</div>
            {issues.parentIssues?.length ? (
              <ul className="admin-list">
                {issues.parentIssues.map((item) => (
                  <li key={item.categoryId}>
                    <div>
                      <strong>{item.name}</strong>
                      <span className="admin-muted">Parent: {item.parentId}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">Parent sorunu yok.</div>
            )}

            <div className="admin-divider"></div>
            <div className="admin-panel-subtitle">RFQ Kategori ID Sorunları</div>
            {issues.rfqCategoryIssues?.length ? (
              <ul className="admin-list">
                {issues.rfqCategoryIssues.map((item) => (
                  <li key={item._id}>
                    <div>
                      <strong>{item.title}</strong>
                      <span className="admin-muted">Kategori: {item.category}</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty">RFQ kategori sorunu yok.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
