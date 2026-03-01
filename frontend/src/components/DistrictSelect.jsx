import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

function DistrictSelect() {
  const { selectedCity, selectedDistrict, setSelectedDistrict } = useAuth();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState([]);

  useEffect(() => {
    if (!selectedCity?._id) {
      setOptions([]);
      setSelectedDistrict(null);
      return;
    }

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const response = await api.get('/location/districts', {
          params: {
            cityId: selectedCity._id,
            page: 1,
            limit: 200
          }
        });

        if (cancelled) {
          return;
        }

        const nextOptions = (response.data?.data || []).map((item) => ({
          _id: item._id || item.id,
          name: item.name,
          cityId: item.cityId
        }));
        setOptions(nextOptions.filter((item) => item?._id && item?.name));
      } catch (_error) {
        if (!cancelled) {
          setOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [selectedCity?._id, setSelectedDistrict]);

  const canClear = useMemo(() => Boolean(selectedDistrict?._id), [selectedDistrict?._id]);

  return (
    <div className="district-select-wrap">
      <label htmlFor="districtSelect">Ilce Sec</label>
      <select
        id="districtSelect"
        value={selectedDistrict?._id || ''}
        onChange={(event) => {
          const value = event.target.value;
          const selected = options.find((item) => String(item._id) === String(value));
          setSelectedDistrict(selected || null);
        }}
        disabled={!selectedCity?._id || loading}
      >
        <option value="">{selectedCity?._id ? (loading ? 'Yukleniyor...' : 'Tum ilceler') : 'Once sehir secin'}</option>
        {options.map((district) => (
          <option key={district._id} value={district._id}>
            {district.name}
          </option>
        ))}
      </select>

      {selectedDistrict ? (
        <div className="district-chip-row">
          <span className="district-chip">{selectedDistrict.name}</span>
          {canClear ? (
            <button type="button" className="secondary-btn" onClick={() => setSelectedDistrict(null)}>
              Temizle
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default DistrictSelect;
