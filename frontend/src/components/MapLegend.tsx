import { useState } from "react";

export default function MapLegend() {
  const [open, setOpen] = useState(false);

  return (
    <div className="map-legend">
      <button
        className="map-legend-toggle"
        onClick={() => setOpen((v) => !v)}
        title="Legenda"
      >
        ?
      </button>

      {open && (
        <div className="map-legend-panel">
          <div className="map-legend-title">Legenda</div>

          <div className="map-legend-section">Parcheggi</div>
          <div className="map-legend-item">
            <span className="legend-circle" style={{ background: "#22c55e" }} />
            <span>Disponibile</span>
          </div>
          <div className="map-legend-item">
            <span className="legend-circle" style={{ background: "#f59e0b" }} />
            <span>Si riempie (70-90%)</span>
          </div>
          <div className="map-legend-item">
            <span className="legend-triangle" style={{ borderTopColor: "#ec4899" }} />
            <span>Quasi esaurito (&ge;90%)</span>
          </div>
          <div className="map-legend-item">
            <span className="legend-circle" style={{ background: "#dc2626" }} />
            <span>Fuori servizio</span>
          </div>
          <div className="map-legend-item">
            <span className="legend-circle" style={{ background: "#6b7280" }} />
            <span>Chiuso / Nessun dato</span>
          </div>

          <div className="map-legend-section">Punti di interesse</div>
          <div className="map-legend-item">
            <span className="legend-square" style={{ background: "#0891b2" }}>H</span>
            <span>Ospedale</span>
          </div>
          <div className="map-legend-item">
            <span className="legend-diamond" style={{ background: "#8b5cf6" }}>U</span>
            <span>Università</span>
          </div>

          <div className="map-legend-section">Altro</div>
          <div className="map-legend-item">
            <span className="legend-circle legend-user" />
            <span>La tua posizione</span>
          </div>
        </div>
      )}
    </div>
  );
}
