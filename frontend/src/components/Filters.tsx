import { useState } from "react";
import type { Filters as FilterState, StatusFilter } from "../hooks/useParkings";
import type { POICategory } from "../types/poi";
import { Accessibility, CreditCard, Roof, Train, Hospital, GraduationCap, ChevronDown } from "./Icons";

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
  { key: "disabledSpots", label: "Disabili", icon: <Accessibility size={14} /> },
  { key: "electronicPayment", label: "POS / Carte", icon: <CreditCard size={14} /> },
  { key: "covered", label: "Coperto", icon: <Roof size={14} /> },
  { key: "metroAccess", label: "Metro", icon: <Train size={14} /> },
];

interface StatusPillDef {
  key: StatusFilter;
  label: string;
  color: string;
}

const statusPills: StatusPillDef[] = [
  { key: "free", label: "Liberi", color: "#22c55e" },
  { key: "full", label: "Pieni", color: "#ec4899" },
  { key: "fillingUp", label: "Si riempie", color: "#f59e0b" },
  { key: "outOfService", label: "Fuori servizio", color: "#dc2626" },
  { key: "closed", label: "Chiusi", color: "#6b7280" },
];

export default function Filters({ filters, onChange, poiLayers, onTogglePOILayer }: Props) {
  const [expanded, setExpanded] = useState(false);

  const activeCount = pills.filter((p) => filters[p.key]).length
    + filters.statusFilters.length
    + (poiLayers?.size ?? 0);

  const toggleStatus = (key: StatusFilter) => {
    const current = filters.statusFilters;
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    onChange({ ...filters, statusFilters: next });
  };

  return (
    <div className="filters">
      <button
        className="filters-toggle"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>Filtri{activeCount > 0 ? ` (${activeCount})` : ""}</span>
        <ChevronDown size={14} className={`filters-toggle-icon${expanded ? " expanded" : ""}`} />
      </button>

      {expanded && (
        <>
          <div className="filter-pills filter-pills-status">
            <span className="filter-group-label">Stato</span>
            {statusPills.map((sp) => (
              <button
                key={sp.key}
                className={`filter-pill filter-pill-status${filters.statusFilters.includes(sp.key) ? " active" : ""}`}
                style={filters.statusFilters.includes(sp.key) ? { background: sp.color, borderColor: sp.color } : undefined}
                onClick={() => toggleStatus(sp.key)}
              >
                <span className="filter-status-dot" style={{ background: sp.color }} />
                {sp.label}
              </button>
            ))}
          </div>

          <div className="filter-pills">
            <span className="filter-group-label">Servizi</span>
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
          </div>

          {onTogglePOILayer && (
            <div className="filter-pills filter-pills-poi">
              <span className="filter-group-label">Punti di interesse</span>
              <button
                className={`filter-pill filter-pill-hospital${poiLayers?.has("hospital") ? " active" : ""}`}
                onClick={() => onTogglePOILayer("hospital")}
              >
                <Hospital size={14} />
                Ospedali
              </button>
              <button
                className={`filter-pill filter-pill-university${poiLayers?.has("university") ? " active" : ""}`}
                onClick={() => onTogglePOILayer("university")}
              >
                <GraduationCap size={14} />
                Università
              </button>
            </div>
          )}
        </>
      )}

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
