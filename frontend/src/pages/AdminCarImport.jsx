import { useState } from 'react';
import api from '../api/axios';
import BackIconButton from '../components/BackIconButton';
import { useAuth } from '../context/AuthContext';

function AdminCarImport() {
  const { user } = useAuth();
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  if (user?.role !== 'admin') {
    return (
      <div className="card">
        <h2>Yetkisiz</h2>
        <p>Bu sayfa sadece admin kullanicilar icindir.</p>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file) {
      setError('Dosya sec');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/admin/import/tsb-cars', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(response.data?.stats || null);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Import basarisiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="account-page">
      <div className="account-header">
        <BackIconButton />
        <h1>Araç Veri İçe Aktar</h1>
      </div>
      <section className="card account-card">
        <h2>TSB Kasko Listesi</h2>
        <form onSubmit={handleSubmit} className="account-form">
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'İçe aktarılıyor...' : 'İçe Aktar'}
          </button>
        </form>
        {error ? <div className="error">{error}</div> : null}
        {result ? (
          <div className="card">
            <div className="rfq-sub">Rows: {result.rowsProcessed}</div>
            <div className="rfq-sub">Brands: {result.brandsUpserted}</div>
            <div className="rfq-sub">Models: {result.modelsUpserted}</div>
            <div className="rfq-sub">Variants: {result.variantsUpserted}</div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

export default AdminCarImport;
