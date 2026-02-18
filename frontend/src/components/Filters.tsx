import type { Filters as FilterState } from "../hooks/useParkings";
import type { POICategory } from "../types/poi";
import { Accessibility, CreditCard, Roof, Train, Hospital, GraduationCap } from "./Icons";

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  poiLayers?: Set<POICategory>;
  onTogglePOILayer?: (category: POICategory) => void;
}

interface PillDef {
  key: keyof Pick<FilterState, "onlyAvailable" | "disabledSpots" | "electronicPayment" | "covered" | "metroAccess">;
  label: string;
  icon?: React.ReactNode;
}

const pills: PillDef[] = [
  { key: "onlyAvailable", label: "Disponibili" },
  { key: "disabledSpots", label: "Disabili", icon: <Accessibility size={14} /> },
  { key: "electronicPayment", label: "POS / Carte", icon: <CreditCard size={14} /> },
  { key: "covered", label: "Coperto", icon: <Roof size={14} /> },
  { key: "metroAccess", label: "Metro", icon: <Train size={14} /> },
];

export default function Filters({ filters, onChange, poiLayers, onTogglePOILayer }: Props) {
  return (
    <div className="filters">
      <div className="filter-pills">
        {pills.map((pill) => (
          <button
            key={pill.key}
            className={`filter-pill${filters[pill.key] ? " active" : ""}`}
            onClick={() =>
              onChange({ ...filters, [pill.key]: !filters[pill.key] })
            }
          >
            {pill.icon}
            {pill.label}
          </button>
        ))}
        {onTogglePOILayer && (
          <>
            <span className="filter-pill-divider" />
            <button
              className={`filter-pill filter-pill-poi${poiLayers?.has("hospital") ? " active" : ""}`}
              onClick={() => onTogglePOILayer("hospital")}
            >
              <Hospital size={14} />
              Ospedali
            </button>
            <button
              className={`filter-pill filter-pill-poi${poiLayers?.has("university") ? " active" : ""}`}
              onClick={() => onTogglePOILayer("university")}
            >
              <GraduationCap size={14} />
              Universita
            </button>
          </>
        )}
      </div>

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
