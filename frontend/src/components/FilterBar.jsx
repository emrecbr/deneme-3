import CitySearch from './CitySearch';
import DistrictSelect from './DistrictSelect';

function FilterBar({ filters, onChange, compact = false, radiusDisabled = false }) {
  return (
    <section className={`filter-bar premium-filter-bar ${compact ? 'compact' : ''}`}>
      <div className="filter-grid">
        <div className="filter-item filter-span-2">
          <label htmlFor="radiusRange">Yaricap: {filters.radius} km</label>
          <input
            id="radiusRange"
            type="range"
            min="5"
            max="50"
            step="1"
            value={filters.radius}
            disabled={radiusDisabled}
            onChange={(event) => onChange('radius', Number(event.target.value))}
          />
        </div>

        <div className="filter-item filter-span-2">
          <CitySearch />
        </div>

        <div className="filter-item filter-span-2">
          <DistrictSelect />
        </div>

      </div>
    </section>
  );
}

export default FilterBar;
