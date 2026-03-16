import { useEffect, useMemo, useState } from 'react';
import ReusableBottomSheet from './ReusableBottomSheet';
import api from '../api/axios';

const CATEGORY_OPTIONS = [
  { value: '', label: 'Kategori (isteğe bağlı)' },
  { value: 'uygunsuz_icerik', label: 'Uygunsuz İçerik' },
  { value: 'dolandiricilik', label: 'Dolandırıcılık Şüphesi' },
  { value: 'iletisim', label: 'İletişim Sorunu' },
  { value: 'yanlis_bilgi', label: 'Yanlış Bilgi' },
  { value: 'diger', label: 'Diğer' }
];

const ROLE_OPTIONS = [
  { value: 'buyer', label: 'Alıcı' },
  { value: 'seller', label: 'Satıcı' },
  { value: 'owner', label: 'İlan Sahibi' },
  { value: 'other', label: 'Diğer' },
  { value: 'self', label: 'Kendi Profilim' }
];

export default function ReportIssueSheet({
  open,
  onClose,
  sourceType,
  sourceId,
  relatedRfqId,
  reportedUserId,
  relatedRfqTitle,
  reportedUserLabel,
  defaultRoleRelation = 'other'
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [roleRelation, setRoleRelation] = useState(defaultRoleRelation);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle('');
    setDescription('');
    setCategory('');
    setRoleRelation(defaultRoleRelation);
    setError('');
    setSuccess('');
    setSubmitting(false);
  }, [open, defaultRoleRelation]);

  const payload = useMemo(
    () => ({
      title,
      description,
      category,
      roleRelation,
      sourceType,
      sourceId,
      relatedRfqId,
      reportedUserId
    }),
    [category, description, relatedRfqId, reportedUserId, roleRelation, sourceId, sourceType, title]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError('Başlık ve açıklama zorunludur.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await api.post('/reports', payload);
      setSuccess('Bildiriminiz alındı. En kısa sürede incelenecek.');
      setTitle('');
      setDescription('');
      setCategory('');
    } catch (err) {
      setError(err?.response?.data?.message || 'Sorun bildirilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ReusableBottomSheet
      open={open}
      onClose={onClose}
      title="Sorun Bildir"
      contentClassName="report-sheet"
      headerRight={
        <button type="button" className="offer-sheet-close" onClick={onClose} aria-label="Kapat">
          ✕
        </button>
      }
      initialSnap="mid"
    >
      <form onSubmit={handleSubmit} className="report-form">
        {relatedRfqTitle ? (
          <div className="report-meta">
            <span className="report-label">İlgili İlan</span>
            <strong>{relatedRfqTitle}</strong>
          </div>
        ) : null}
        {reportedUserLabel ? (
          <div className="report-meta">
            <span className="report-label">Şikayet Edilen</span>
            <strong>{reportedUserLabel}</strong>
          </div>
        ) : null}

        <div className="report-field">
          <label htmlFor="report-title">Başlık</label>
          <input
            id="report-title"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Kısa bir başlık yazın"
            maxLength={120}
            required
          />
        </div>

        <div className="report-field">
          <label htmlFor="report-description">Açıklama</label>
          <textarea
            id="report-description"
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Sorunu detaylıca anlatın"
            maxLength={2000}
            required
          />
        </div>

        <div className="report-field">
          <label htmlFor="report-category">Sorun Tipi</label>
          <select
            id="report-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="report-field">
          <label htmlFor="report-relation">Sorun kimle ilgili?</label>
          <select
            id="report-relation"
            value={roleRelation}
            onChange={(event) => setRoleRelation(event.target.value)}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {error ? <div className="report-error">{error}</div> : null}
        {success ? <div className="report-success">{success}</div> : null}

        <div className="report-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            İptal
          </button>
          <button type="submit" className="primary-btn" disabled={submitting}>
            {submitting ? 'Gönderiliyor…' : 'Gönder'}
          </button>
        </div>
      </form>
    </ReusableBottomSheet>
  );
}
