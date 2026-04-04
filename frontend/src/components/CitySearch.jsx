import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function CitySearch() {
  const { selectedCity, setSelectedCity } = useAuth();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (selectedCity?.name) {
      setQuery(selectedCity.name);
    }
  }, [selectedCity?.name]);

  useEffect(() => {
    const value = query.trim();
    if (selectedCity?.name === value && value) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = value
          ? await api.get('/location/search', {
              params: { q: value }
            })
          : await api.get('/location/cities', {
              params: {
                page: 1,
                limit: 20
              }
            });

        if (cancelled) {
          return;
        }
        const nextOptions = value
          ? Array.isArray(response.data?.data)
            ? response.data.data
            : Array.isArray(response.data?.items)
              ? response.data.items
              : Array.isArray(response.data)
                ? response.data
                : []
          : (response.data?.data || response.data?.items || []).map((item) => ({
              _id: item._id || item.id,
              name: item.name
            }));

        setOptions(nextOptions.filter((item) => item?._id && item?.name));
        setOpen((prev) => prev || Boolean(value));
      } catch (_error) {
        if (!cancelled) {
          setOptions([]);
          setOpen(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [query, selectedCity?.name]);

  const canClear = useMemo(() => Boolean(selectedCity?._id), [selectedCity?._id]);

  return (
    <div className="city-search">
      <div className="city-search-input-wrap">
        <input
          className="city-search-input"
          type="text"
          placeholder="Şehir ara..."
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            if (selectedCity) {
              setSelectedCity(null);
            }
          }}
          onFocus={() => {
            setOpen(true);
          }}
        />

        {canClear ? (
          <button
            type="button"
            className="city-clear-btn"
            onClick={() => {
              setSelectedCity(null);
              setQuery('');
              setOptions([]);
              setOpen(false);
            }}
            aria-label="Şehir filtresini temizle"
          >
            ×
          </button>
        ) : null}
      </div>

      {selectedCity ? <span className="city-chip">{selectedCity.name}</span> : null}

      {open ? (
        <div className="city-dropdown">
          {loading ? <div className="city-dropdown-item muted">Yükleniyor...</div> : null}
          {!loading && options.length === 0 ? <div className="city-dropdown-item muted">Sonuc yok</div> : null}
          {!loading
            ? options.map((city) => (
                <button
                  key={city._id}
                  type="button"
                  className="city-dropdown-item"
                  onClick={() => {
                    setSelectedCity({ _id: city._id, name: city.name });
                    setQuery(city.name);
                    setOpen(false);
                  }}
                >
                  {city.name}
                </button>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}

export default CitySearch;
