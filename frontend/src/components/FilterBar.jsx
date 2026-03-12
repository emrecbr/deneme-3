import CitySearch from './CitySearch';
import DistrictSelect from './DistrictSelect';

function FilterBar({ filters, onChange, compact = false, radiusDisabled = false }) {
  return (
    <section className={`filter-bar premium-filter-bar ${compact ? 'compact' : ''}`}>
      <div className="filter-grid">
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
