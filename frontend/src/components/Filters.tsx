interface FilterState {
  onlyAvailable: boolean;
  minSpots: number;
  nearbyMode: boolean;
  userLat: number | null;
  userLng: number | null;
  radius: number;
}

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

export default function Filters({ filters, onChange }: Props) {
  return (
    <div className="filters">
      <label className="filter-toggle">
        <input
          type="checkbox"
          checked={filters.onlyAvailable}
          onChange={(e) =>
            onChange({ ...filters, onlyAvailable: e.target.checked })
          }
        />
        <span>Solo disponibili</span>
      </label>

      <label className="filter-range">
        <span>Posti liberi min: {filters.minSpots}</span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={filters.minSpots}
          onChange={(e) =>
            onChange({ ...filters, minSpots: Number(e.target.value) })
          }
        />
      </label>

      {filters.nearbyMode && (
        <label className="filter-range">
          <span>Raggio: {filters.radius}m</span>
          <input
            type="range"
            min={200}
            max={5000}
            step={100}
            value={filters.radius}
            onChange={(e) =>
              onChange({ ...filters, radius: Number(e.target.value) })
            }
          />
        </label>
      )}
    </div>
  );
}
