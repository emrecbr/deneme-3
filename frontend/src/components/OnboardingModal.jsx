import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../api/axios';

const STEPS = [
  {
    title: 'Yakindaki Talepleri Kesfet',
    text: 'Konumuna gore canli talepleri goruntule.'
  },
  {
    title: 'Teklif Ver veya Talep Olustur',
    text: 'Ihtiyacini paylas ya da teklif vererek kazan.'
  },
  {
    title: 'Guvenli Mesajlasma ve Puanlama',
    text: 'Islem sonrasi degerlendirme ile guven olustur.'
  }
];

function OnboardingModal({ open, onComplete }) {
  const [step, setStep] = useState(0);
  const [contentSteps, setContentSteps] = useState(STEPS);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [locationError, setLocationError] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const [districtQuery, setDistrictQuery] = useState('');
  const [neighborhoodQuery, setNeighborhoodQuery] = useState('');
  const [streetQuery, setStreetQuery] = useState('');
  const [cityOptions, setCityOptions] = useState([]);
  const [districtOptions, setDistrictOptions] = useState([]);
  const [neighborhoodOptions, setNeighborhoodOptions] = useState([]);
  const [streetOptions, setStreetOptions] = useState([]);
  const [selectionIds, setSelectionIds] = useState({
    cityId: '',
    districtId: '',
    neighborhoodId: ''
  });
  const [selection, setSelection] = useState({
    city: '',
    district: '',
    neighborhood: '',
    street: ''
  });
  const current = useMemo(() => contentSteps[step] || contentSteps[0], [contentSteps, step]);
  const normalizeOption = (item) => {
    if (typeof item === 'string') {
      return { id: item, name: item, type: undefined };
    }
    return {
      id: String(item?._id || item?.id || item?.name || ''),
      name: String(item?.name || item?.value || ''),
      type: item?.type
    };
  };
  const findOptionByName = (items, value) => {
    const normalizedValue = String(value || '').trim().toLocaleLowerCase('tr-TR');
    return items.find((item) => item.name.toLocaleLowerCase('tr-TR') === normalizedValue) || null;
  };

  useEffect(() => {
    if (open) {
      setStep(0);
      setLocationError('');
      setSelectionIds({ cityId: '', districtId: '', neighborhoodId: '' });
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    const loadContent = async () => {
      try {
        const response = await api.get('/content/onboarding');
        if (!active) return;
        const steps = response.data?.data?.steps;
        if (Array.isArray(steps) && steps.length) {
          setContentSteps(steps);
        } else {
          setContentSteps(STEPS);
        }
      } catch (_error) {
        if (active) setContentSteps(STEPS);
      }
    };
    loadContent();
    return () => {
      active = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const fetchCities = async () => {
      try {
        const response = await api.get('/location/cities', { params: { q: cityQuery, limit: 100, page: 1 } });
        setCityOptions((response.data?.data || response.data?.items || []).map(normalizeOption));
      } catch (_error) {
        setCityOptions([]);
      }
    };

    fetchCities();
  }, [cityQuery, open]);

  useEffect(() => {
    if (!open || !selection.city) {
      setDistrictOptions([]);
      return;
    }

    const fetchDistricts = async () => {
      try {
        const response = await api.get('/location/districts', {
          params: {
            ...(selectionIds.cityId ? { cityId: selectionIds.cityId } : { city: selection.city }),
            search: districtQuery,
            limit: 100,
            page: 1
          }
        });
        setDistrictOptions((response.data?.data || response.data?.items || []).map(normalizeOption));
      } catch (_error) {
        setDistrictOptions([]);
      }
    };

    fetchDistricts();
  }, [districtQuery, open, selection.city, selectionIds.cityId]);

  useEffect(() => {
    if (!open || !selection.city || !selection.district) {
      setNeighborhoodOptions([]);
      return;
    }

    const fetchNeighborhoods = async () => {
      try {
        const response = await api.get('/location/neighborhoods', {
          params: {
            ...(selectionIds.districtId
              ? { districtId: selectionIds.districtId }
              : { city: selection.city, district: selection.district }),
            search: neighborhoodQuery,
            limit: 100,
            page: 1
          }
        });
        setNeighborhoodOptions((response.data?.data || response.data?.items || []).map(normalizeOption));
      } catch (_error) {
        setNeighborhoodOptions([]);
      }
    };

    fetchNeighborhoods();
  }, [neighborhoodQuery, open, selection.city, selection.district, selectionIds.districtId]);

  useEffect(() => {
    if (!open || !selection.city || !selection.district || !selection.neighborhood) {
      setStreetOptions([]);
      return;
    }

    const fetchStreets = async () => {
      try {
        const response = await api.get('/location/streets', {
          params: {
            ...(selectionIds.neighborhoodId
              ? { neighborhoodId: selectionIds.neighborhoodId }
              : { city: selection.city, district: selection.district, neighborhood: selection.neighborhood }),
            search: streetQuery,
            limit: 100,
            page: 1
          }
        });
        setStreetOptions((response.data?.data || response.data?.items || []).map(normalizeOption));
      } catch (_error) {
        setStreetOptions([]);
      }
    };

    fetchStreets();
  }, [open, selection.city, selection.district, selection.neighborhood, selectionIds.neighborhoodId, streetQuery]);

  const isLastStep = step === contentSteps.length - 1;
  const isFirstStep = step === 0;

  const goNext = () => {
    if (isLastStep) {
      if (!selection.city.trim()) {
        setLocationError('Sehir secimi zorunludur.');
        return;
      }
      onComplete({
        city: selection.city.trim(),
        district: selection.district.trim(),
        neighborhood: selection.neighborhood.trim(),
        street: selection.street.trim()
      });
      return;
    }
    setLocationError('');
    setStep((prev) => Math.min(prev + 1, contentSteps.length - 1));
  };

  const goBack = () => {
    if (isFirstStep) {
      return;
    }
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleTouchStart = (event) => {
    const point = event.touches?.[0];
    if (!point) {
      return;
    }
    setTouchStartX(point.clientX);
    setTouchDeltaX(0);
  };

  const handleTouchMove = (event) => {
    if (touchStartX === null) {
      return;
    }
    const point = event.touches?.[0];
    if (!point) {
      return;
    }
    setTouchDeltaX(point.clientX - touchStartX);
  };

  const handleTouchEnd = () => {
    if (touchStartX === null) {
      return;
    }

    if (touchDeltaX <= -60) {
      goNext();
    } else if (touchDeltaX >= 60) {
      goBack();
    }

    setTouchStartX(null);
    setTouchDeltaX(0);
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="onboarding-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          <div className="onboarding-overlay-gradient" />
          <motion.div
            className="onboarding-modal"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="onboarding-progress">
              {step + 1}/{STEPS.length}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                className="onboarding-content"
                initial={{ x: 40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -40, opacity: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                <h2>{current.title}</h2>
                <p>{current.text}</p>
                {isLastStep ? (
                  <div className="onboarding-location-grid">
                    <input
                      value={selection.city}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCityQuery(value);
                        setSelection({
                          city: value,
                          district: '',
                          neighborhood: '',
                          street: ''
                        });
                        const selectedCity = findOptionByName(cityOptions, value);
                        setSelectionIds({
                          cityId: selectedCity?.id || '',
                          districtId: '',
                          neighborhoodId: ''
                        });
                        setDistrictQuery('');
                        setNeighborhoodQuery('');
                        setStreetQuery('');
                        setLocationError('');
                      }}
                      list="onboarding-cities"
                      placeholder="Il seciniz"
                    />
                    <datalist id="onboarding-cities">
                      {cityOptions.map((item) => (
                        <option key={item.id || item.name} value={item.name} />
                      ))}
                    </datalist>
                    <input
                      value={selection.district}
                      onChange={(event) => {
                        const value = event.target.value;
                        setDistrictQuery(value);
                        setSelection((prev) => ({
                          ...prev,
                          district: value,
                          neighborhood: '',
                          street: ''
                        }));
                        const selectedDistrict = findOptionByName(districtOptions, value);
                        setSelectionIds((prev) => ({
                          ...prev,
                          districtId: selectedDistrict?.id || '',
                          neighborhoodId: ''
                        }));
                        setNeighborhoodQuery('');
                        setStreetQuery('');
                      }}
                      list="onboarding-districts"
                      placeholder="Ilce (opsiyonel)"
                      disabled={!selection.city}
                    />
                    <datalist id="onboarding-districts">
                      {districtOptions.map((item) => (
                        <option key={item.id || item.name} value={item.name} />
                      ))}
                    </datalist>
                    <input
                      value={selection.neighborhood}
                      onChange={(event) => {
                        const value = event.target.value;
                        setNeighborhoodQuery(value);
                        setSelection((prev) => ({
                          ...prev,
                          neighborhood: value,
                          street: ''
                        }));
                        const selectedNeighborhood = findOptionByName(neighborhoodOptions, value);
                        setSelectionIds((prev) => ({
                          ...prev,
                          neighborhoodId: selectedNeighborhood?.id || ''
                        }));
                        setStreetQuery('');
                      }}
                      list="onboarding-neighborhoods"
                      placeholder="Mahalle (opsiyonel)"
                      disabled={!selection.district}
                    />
                    <datalist id="onboarding-neighborhoods">
                      {neighborhoodOptions.map((item) => (
                        <option key={item.id || item.name} value={item.name} />
                      ))}
                    </datalist>
                    <input
                      value={selection.street}
                      onChange={(event) => {
                        const value = event.target.value;
                        setStreetQuery(value);
                        setSelection((prev) => ({
                          ...prev,
                          street: value
                        }));
                      }}
                      list="onboarding-streets"
                      placeholder="Cadde/Sokak (opsiyonel)"
                      disabled={!selection.neighborhood}
                    />
                    <datalist id="onboarding-streets">
                      {streetOptions.map((item) => (
                        <option key={`${item.id || item.name}-${item.type || ''}`} value={item.name} />
                      ))}
                    </datalist>
                    {locationError ? <div className="error">{locationError}</div> : null}
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
            <div className="onboarding-dots">
              {STEPS.map((_, index) => (
                <span key={index} className={index === step ? 'onboarding-dot active' : 'onboarding-dot'} />
              ))}
            </div>
            <div className="onboarding-actions">
              {!isLastStep ? (
                <>
                  <button type="button" className="secondary-btn" onClick={onComplete}>
                    Atla
                  </button>
                  <button type="button" className="primary-btn" onClick={goNext}>
                    Devam
                  </button>
                </>
              ) : (
                <button type="button" className="primary-btn" onClick={goNext}>
                  Basla
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default OnboardingModal;
