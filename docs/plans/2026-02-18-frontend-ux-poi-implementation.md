# Frontend UX + POI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 3-snap mobile bottom sheet, collapsible desktop sidebar, marker color differentiation, mobile optimizations, and POI layer with hospital/university routing.

**Architecture:** Incremental refactor of existing components. No new dependencies, no structural changes. Each task is independent and deployable. Touch handling via native events + CSS transforms.

**Tech Stack:** React 19, TypeScript, Leaflet/react-leaflet, CSS custom properties, Service Worker API, Page Visibility API.

---

## Task 1: Marker Color Differentiation

Smallest, self-contained change. No UI restructuring needed.

**Files:**
- Modify: `frontend/src/utils/parking.ts:3-9` (getStatusColor)
- Modify: `frontend/src/components/ParkingMap.tsx:11` (createIcon call)

**Step 1: Update `getStatusColor` in `utils/parking.ts`**

Replace the current function (lines 3-9) with:

```typescript
export function getStatusColor(parking: Parking): string {
  if (!parking.is_available) {
    if (parking.status_label === "fuori servizio") return "#dc2626";
    if (parking.status_label === "nessun dato") return "#9ca3af";
    return "#6b7280"; // chiuso (fuori orario)
  }
  if (parking.occupancy_percentage === null) return "#6b7280";
  if (parking.occupancy_percentage >= 90) return "#ef4444";
  if (parking.occupancy_percentage >= 70) return "#f59e0b";
  return "#22c55e";
}
```

**Step 2: Verify the build compiles**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors. `getStatusColor` signature is unchanged (takes `Parking`), so all call sites remain valid.

**Step 3: Commit**

```bash
git add frontend/src/utils/parking.ts
git commit -m "feat: differentiate marker colors for closed vs out-of-service"
```

---

## Task 2: Bottom Sheet Hook (`useBottomSheet`)

Core gesture logic, isolated in a hook with no UI changes yet.

**Files:**
- Create: `frontend/src/hooks/useBottomSheet.ts`

**Step 1: Create the hook**

```typescript
import { useCallback, useRef, useState } from "react";

export type SheetState = "closed" | "half" | "full";

interface UseBottomSheetOptions {
  closedHeight?: number;
  halfRatio?: number;
  fullRatio?: number;
  onStateChange?: (state: SheetState) => void;
}

interface UseBottomSheetReturn {
  sheetState: SheetState;
  setSheetState: (state: SheetState) => void;
  translateY: number;
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
  isAnimating: boolean;
}

export function useBottomSheet(options: UseBottomSheetOptions = {}): UseBottomSheetReturn {
  const {
    closedHeight = 80,
    halfRatio = 0.5,
    fullRatio = 0.1,
    onStateChange,
  } = options;

  const [sheetState, setSheetStateInternal] = useState<SheetState>("half");
  const [translateY, setTranslateY] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const startYRef = useRef(0);
  const startTranslateRef = useRef(0);
  const isDragging = useRef(false);

  function getSnapY(state: SheetState): number {
    const vh = window.innerHeight;
    switch (state) {
      case "closed": return vh - closedHeight;
      case "half": return vh * halfRatio;
      case "full": return vh * fullRatio;
    }
  }

  const setSheetState = useCallback((state: SheetState) => {
    setIsAnimating(true);
    setTranslateY(getSnapY(state));
    setSheetStateInternal(state);
    onStateChange?.(state);
    setTimeout(() => setIsAnimating(false), 300);
  }, [closedHeight, halfRatio, fullRatio, onStateChange]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't capture touches on scrollable content
    const target = e.target as HTMLElement;
    const scrollable = target.closest(".parking-list, .detail-panel");
    if (scrollable && scrollable.scrollTop > 0) return;

    isDragging.current = true;
    startYRef.current = e.touches[0].clientY;
    startTranslateRef.current = translateY || getSnapY(sheetState);
    setIsAnimating(false);
  }, [translateY, sheetState]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const deltaY = e.touches[0].clientY - startYRef.current;
    const newY = startTranslateRef.current + deltaY;

    const minY = getSnapY("full");
    const maxY = getSnapY("closed");
    const clamped = Math.max(minY, Math.min(maxY, newY));

    setTranslateY(clamped);
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const currentY = translateY;
    const snaps: { state: SheetState; y: number }[] = [
      { state: "full", y: getSnapY("full") },
      { state: "half", y: getSnapY("half") },
      { state: "closed", y: getSnapY("closed") },
    ];

    let closest = snaps[0];
    for (const snap of snaps) {
      if (Math.abs(currentY - snap.y) < Math.abs(currentY - closest.y)) {
        closest = snap;
      }
    }

    setSheetState(closest.state);
  }, [translateY, setSheetState]);

  return {
    sheetState,
    setSheetState,
    translateY: translateY || getSnapY(sheetState),
    handlers: { onTouchStart, onTouchMove, onTouchEnd },
    isAnimating,
  };
}
```

**Step 2: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds. Hook is created but not imported anywhere yet.

**Step 3: Commit**

```bash
git add frontend/src/hooks/useBottomSheet.ts
git commit -m "feat: add useBottomSheet hook with 3-snap touch gesture"
```

---

## Task 3: Integrate Bottom Sheet into Sidebar

Wire the hook into Sidebar and update CSS for mobile.

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/styles/app.css:867-959` (mobile section)

**Step 1: Add bottom sheet state to App.tsx**

Add a `useMediaQuery`-like check and pass sheet controls to Sidebar. In `App.tsx`:

- Import `useBottomSheet` and its type
- Create the hook instance
- Add effect: when `selectedParking` changes, snap to `full` or `half`
- Pass `bottomSheet` props to `Sidebar`
- Add `onMapClick` handler to snap to `closed`
- Pass `onMapClick` to `ParkingMap`

Updated `App.tsx`:

```typescript
import { useCallback, useEffect, useState } from "react";
import type { Parking } from "./types/parking";
import { useParkings } from "./hooks/useParkings";
import { useBottomSheet } from "./hooks/useBottomSheet";
import ParkingMap from "./components/ParkingMap";
import Sidebar from "./components/Sidebar";
import "./styles/app.css";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return isMobile;
}

export default function App() {
  const { parkings, allParkings, lastUpdate, loading, error, filters, setFilters, refresh } =
    useParkings();
  const [selectedParking, setSelectedParking] = useState<Parking | null>(null);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);

  const isMobile = useIsMobile();
  const bottomSheet = useBottomSheet();

  // Sync bottom sheet with selected parking
  useEffect(() => {
    if (!isMobile) return;
    if (selectedParking) {
      bottomSheet.setSheetState("full");
    } else {
      bottomSheet.setSheetState("half");
    }
  }, [selectedParking, isMobile]);

  const handleLocateMe = useCallback(() => {
    if (!navigator.geolocation) {
      alert("Geolocalizzazione non supportata dal browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setUserPosition([lat, lng]);
        setFilters((prev) => ({
          ...prev,
          nearbyMode: true,
          userLat: lat,
          userLng: lng,
        }));
      },
      () => {
        alert("Impossibile ottenere la posizione. Controlla i permessi.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [setFilters]);

  const handleSelect = useCallback((parking: Parking | null) => {
    setSelectedParking(parking);
  }, []);

  const handleMapClick = useCallback(() => {
    if (isMobile) {
      bottomSheet.setSheetState("closed");
    }
  }, [isMobile, bottomSheet]);

  return (
    <div className="app-layout">
      <Sidebar
        parkings={parkings}
        allParkings={allParkings}
        loading={loading}
        error={error}
        lastUpdate={lastUpdate}
        selectedParking={selectedParking}
        filters={filters}
        onFilterChange={setFilters}
        onSelect={handleSelect}
        onLocateMe={handleLocateMe}
        onRefresh={refresh}
        isMobile={isMobile}
        bottomSheet={isMobile ? bottomSheet : undefined}
      />
      <ParkingMap
        parkings={parkings}
        selectedId={selectedParking?.id ?? null}
        onSelect={(p) => handleSelect(p)}
        userPosition={userPosition}
        onMapClick={handleMapClick}
      />
    </div>
  );
}
```

**Step 2: Update Sidebar.tsx to use bottom sheet**

Add bottom sheet props and apply transform style on mobile:

```typescript
import { useState } from "react";
import type { Parking } from "../types/parking";
import type { Filters as FilterState } from "../hooks/useParkings";
import type { UseBottomSheetReturn } from "../hooks/useBottomSheet";
import ParkingCard from "./ParkingCard";
import ParkingDetail from "./ParkingDetail";
import Filters from "./Filters";
import NearestParkingBanner from "./NearestParkingBanner";
import { Search, Crosshair, Refresh } from "./Icons";

interface Props {
  parkings: Parking[];
  allParkings: Parking[];
  loading: boolean;
  error: string | null;
  lastUpdate: string | null;
  selectedParking: Parking | null;
  filters: FilterState;
  onFilterChange: (f: FilterState) => void;
  onSelect: (parking: Parking | null) => void;
  onLocateMe: () => void;
  onRefresh: () => void;
  isMobile: boolean;
  bottomSheet?: UseBottomSheetReturn;
}

export default function Sidebar({
  parkings,
  allParkings,
  loading,
  error,
  lastUpdate,
  selectedParking,
  filters,
  onFilterChange,
  onSelect,
  onLocateMe,
  onRefresh,
  isMobile,
  bottomSheet,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = parkings.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableCount = allParkings.filter((p) => p.is_available).length;
  const totalSpots = allParkings.reduce((sum, p) => sum + (p.free_spots || 0), 0);

  const mobileStyle = isMobile && bottomSheet
    ? {
        transform: `translateY(${bottomSheet.translateY}px)`,
        transition: bottomSheet.isAnimating ? "transform 300ms ease-out" : "none",
        height: "100vh",
        top: 0,
      }
    : undefined;

  return (
    <aside
      className={`sidebar${isMobile ? " sidebar-mobile" : ""}`}
      style={mobileStyle}
      {...(isMobile && bottomSheet ? bottomSheet.handlers : {})}
    >
      {isMobile && <div className="drag-handle" />}

      {/* Collapsed stats for closed state */}
      {isMobile && bottomSheet?.sheetState === "closed" && (
        <div className="sheet-collapsed-stats">
          <span>{availableCount} aperti</span>
          <span className="sheet-collapsed-dot">·</span>
          <span>{totalSpots.toLocaleString()} posti liberi</span>
        </div>
      )}

      {(!isMobile || bottomSheet?.sheetState !== "closed") && (
        <>
          <header className="sidebar-header">
            <div className="logo">
              <span className="logo-icon">P</span>
              <div>
                <h1>Torino Parking</h1>
                <p className="subtitle">Disponibilita in tempo reale</p>
              </div>
            </div>
            <div className="stats-row">
              <div className="stat">
                <span className="stat-value">{allParkings.length}</span>
                <span className="stat-label">parcheggi</span>
              </div>
              <div className="stat">
                <span className="stat-value">{availableCount}</span>
                <span className="stat-label">aperti</span>
              </div>
              <div className="stat">
                <span className="stat-value">{totalSpots.toLocaleString()}</span>
                <span className="stat-label">posti liberi</span>
              </div>
            </div>
          </header>

          {selectedParking ? (
            <ParkingDetail parking={selectedParking} onBack={() => onSelect(null)} />
          ) : (
            <>
              <div className="sidebar-controls">
                <div className="search-box">
                  <Search />
                  <input
                    type="text"
                    placeholder="Cerca parcheggio..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="action-buttons">
                  <button className="btn btn-locate" onClick={onLocateMe} title="Trova vicino a me">
                    <Crosshair />
                    Vicino a me
                  </button>
                  <button className="btn btn-refresh" onClick={onRefresh} title="Aggiorna dati">
                    <Refresh />
                  </button>
                </div>

                <Filters filters={filters} onChange={onFilterChange} />
              </div>

              {filters.nearbyMode && filters.userLat !== null && filters.userLng !== null && (
                <NearestParkingBanner
                  parkings={parkings}
                  userLat={filters.userLat}
                  userLng={filters.userLng}
                  onSelect={onSelect}
                />
              )}

              <div className="parking-list">
                {loading && <div className="loading-spinner">Caricamento...</div>}
                {error && <div className="error-message">{error}</div>}
                {!loading && !error && filtered.length === 0 && (
                  <div className="empty-state">Nessun parcheggio trovato</div>
                )}
                {filtered.map((p) => (
                  <ParkingCard key={p.id} parking={p} onClick={() => onSelect(p)} />
                ))}
              </div>
            </>
          )}

          <footer className="sidebar-footer">
            {lastUpdate && (
              <span>
                Aggiornato: {new Date(lastUpdate).toLocaleTimeString("it-IT")}
              </span>
            )}
            <span>Dati: 5T Torino Open Data</span>
          </footer>
        </>
      )}
    </aside>
  );
}
```

**Step 3: Add `onMapClick` to ParkingMap.tsx**

Add a `MapClickHandler` component inside `ParkingMap` and accept the `onMapClick` prop:

In `ParkingMap.tsx`, add to Props interface:
```typescript
onMapClick?: () => void;
```

Add component inside the file:
```typescript
function MapClickHandler({ onClick }: { onClick?: () => void }) {
  const map = useMap();
  useEffect(() => {
    if (!onClick) return;
    const handler = () => onClick();
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map, onClick]);
  return null;
}
```

Import `useEffect` from react at the top. Add inside `<MapContainer>`:
```tsx
<MapClickHandler onClick={onMapClick} />
```

**Step 4: Update CSS for mobile bottom sheet**

Replace the `@media (max-width: 768px)` block in `app.css` (lines 868-959). Key changes:
- Remove `height: 50vh` (now controlled by JS transform)
- Remove `::before` pseudo-element (replaced by `.drag-handle` div)
- Add `.sidebar-mobile` base styles
- Add `.drag-handle` styles
- Add `.sheet-collapsed-stats` styles
- Add `safe-area-inset-bottom` padding

New mobile CSS:

```css
/* === Mobile Responsive - Bottom Sheet === */
@media (max-width: 768px) {
  .app-layout {
    flex-direction: column;
    position: relative;
  }

  .parking-map {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    z-index: 1;
  }

  .sidebar-mobile {
    position: fixed;
    left: 0;
    right: 0;
    width: 100%;
    height: 100vh;
    border-right: none;
    border-top: none;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.5);
    z-index: 20;
    will-change: transform;
    padding-bottom: env(safe-area-inset-bottom, 0px);
    touch-action: none;
  }

  .drag-handle {
    width: 36px;
    height: 4px;
    background: var(--text-muted);
    border-radius: 2px;
    margin: 10px auto 6px;
    flex-shrink: 0;
    cursor: grab;
  }

  .drag-handle:active {
    cursor: grabbing;
    background: var(--text-secondary);
  }

  .sheet-collapsed-stats {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .sheet-collapsed-dot {
    color: var(--text-muted);
  }

  .sidebar-header {
    padding: 12px 16px;
  }

  .logo {
    margin-bottom: 10px;
  }

  .logo h1 {
    font-size: 16px;
  }

  .sidebar-controls {
    padding: 10px 16px;
    gap: 8px;
  }

  .parking-list {
    padding: 4px 8px;
  }

  /* Touch targets */
  .btn,
  .filter-pill,
  .navigate-btn,
  .nearest-banner-nav,
  .detail-back {
    min-height: 44px;
  }

  .filter-pill {
    padding: 8px 14px;
  }

  /* Prevent iOS zoom on input focus */
  .search-box input,
  input[type="range"] {
    font-size: 16px;
  }

  .big-number {
    font-size: 44px;
  }

  .detail-spots-big {
    padding: 12px 0;
  }

  :root {
    --sidebar-width: 100%;
  }
}
```

**Step 5: Export the hook type for Sidebar**

In `useBottomSheet.ts`, ensure `UseBottomSheetReturn` is exported (already done in the type definition above, just verify the export keyword is present).

**Step 6: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds with no errors.

**Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Sidebar.tsx frontend/src/components/ParkingMap.tsx frontend/src/styles/app.css
git commit -m "feat: integrate 3-snap bottom sheet on mobile with touch gestures"
```

---

## Task 4: Collapsible Desktop Sidebar

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/styles/app.css`
- Modify: `frontend/src/components/Icons.tsx`

**Step 1: Add ChevronRight icon**

In `Icons.tsx`, add after `ChevronLeft`:

```typescript
export function ChevronRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}
```

**Step 2: Add collapsed state to App.tsx**

Add to `App.tsx`:

```typescript
const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
  return localStorage.getItem("sidebar-collapsed") === "true";
});

const toggleSidebar = useCallback(() => {
  setSidebarCollapsed((prev) => {
    const next = !prev;
    localStorage.setItem("sidebar-collapsed", String(next));
    return next;
  });
}, []);
```

Pass to Sidebar:
```tsx
<Sidebar
  // ...existing props
  collapsed={!isMobile && sidebarCollapsed}
  onToggleCollapse={toggleSidebar}
/>
```

**Step 3: Update Sidebar.tsx for collapsed state**

Add to Props:
```typescript
collapsed?: boolean;
onToggleCollapse?: () => void;
```

In the return, wrap with collapsed logic:

```tsx
<aside className={`sidebar${collapsed ? " collapsed" : ""}${isMobile ? " sidebar-mobile" : ""}`}
  style={mobileStyle}
  {...(isMobile && bottomSheet ? bottomSheet.handlers : {})}
>
  {!isMobile && (
    <button className="sidebar-collapse-btn" onClick={onToggleCollapse}>
      {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
    </button>
  )}

  {collapsed ? (
    <div className="sidebar-collapsed-icons">
      <span className="logo-icon">P</span>
      <span className="collapsed-stat">{availableCount}</span>
      <span className="collapsed-stat-label">aperti</span>
    </div>
  ) : (
    // ...existing full sidebar content
  )}
</aside>
```

Import `ChevronRight` from `./Icons`.

**Step 4: Add CSS for collapsed sidebar**

Add before the `@media (max-width: 768px)` block:

```css
/* === Collapsible Sidebar (Desktop) === */
.sidebar {
  position: relative;
  transition: width 300ms ease;
}

.sidebar.collapsed {
  width: 48px;
}

.sidebar-collapse-btn {
  position: absolute;
  right: -14px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 15;
  transition: all 0.15s;
}

.sidebar-collapse-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--accent);
}

.sidebar-collapsed-icons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-top: 20px;
}

.collapsed-stat {
  font-size: 16px;
  font-weight: 700;
  color: var(--green);
}

.collapsed-stat-label {
  font-size: 8px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

Hide the collapse button on mobile (inside the `@media` block):
```css
.sidebar-collapse-btn {
  display: none;
}
```

**Step 5: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Sidebar.tsx frontend/src/components/Icons.tsx frontend/src/styles/app.css
git commit -m "feat: add collapsible desktop sidebar with localStorage persistence"
```

---

## Task 5: Page Visibility + Adaptive Refresh

**Files:**
- Modify: `frontend/src/hooks/useParkings.ts`

**Step 1: Update useParkings.ts**

Replace the interval logic (lines 67-100) with visibility-aware + adaptive refresh:

```typescript
const REFRESH_NORMAL = 120_000;     // 2 minutes
const REFRESH_NEARBY = 30_000;      // 30 seconds
const NEARBY_BOOST_DURATION = 300_000; // 5 minutes

// Inside useParkings():
const intervalRef = useRef<ReturnType<typeof setInterval>>();
const nearbyBoostUntil = useRef(0);

const getRefreshInterval = useCallback(() => {
  if (Date.now() < nearbyBoostUntil.current) return REFRESH_NEARBY;
  return REFRESH_NORMAL;
}, []);

// Expose a boostRefresh function for when "Vicino a me" is tapped
const boostRefresh = useCallback(() => {
  nearbyBoostUntil.current = Date.now() + NEARBY_BOOST_DURATION;
  // Restart interval with new rate
  clearInterval(intervalRef.current);
  intervalRef.current = setInterval(fetchData, REFRESH_NEARBY);
  // Schedule return to normal rate
  setTimeout(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchData, REFRESH_NORMAL);
  }, NEARBY_BOOST_DURATION);
}, [fetchData]);

useEffect(() => {
  setLoading(true);
  fetchData();
  intervalRef.current = setInterval(fetchData, getRefreshInterval());

  // Page Visibility: pause refresh when tab is hidden
  const onVisibility = () => {
    if (document.hidden) {
      clearInterval(intervalRef.current);
    } else {
      fetchData(); // Immediate refresh on return
      intervalRef.current = setInterval(fetchData, getRefreshInterval());
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    clearInterval(intervalRef.current);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}, [fetchData, getRefreshInterval]);
```

Return `boostRefresh` from the hook alongside existing returns.

**Step 2: Wire boostRefresh to locate-me in App.tsx**

In `App.tsx`, destructure `boostRefresh` from `useParkings()` and call it inside `handleLocateMe` after the geolocation success callback.

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add frontend/src/hooks/useParkings.ts frontend/src/App.tsx
git commit -m "feat: add page visibility pause and adaptive refresh rate"
```

---

## Task 6: Service Worker for Tile Cache

**Files:**
- Create: `frontend/public/sw.js`
- Modify: `frontend/src/main.tsx`

**Step 1: Create service worker**

```javascript
// Service Worker for caching map tiles
const TILE_CACHE = "map-tiles-v1";
const TILE_PATTERN = /basemaps\.cartocdn\.com/;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("map-tiles-") && key !== TILE_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (!TILE_PATTERN.test(event.request.url)) return;

  event.respondWith(
    caches.open(TILE_CACHE).then((cache) =>
      cache.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    )
  );
});
```

**Step 2: Register service worker in main.tsx**

Add after `createRoot`:

```typescript
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {
    // Silent fail - tile caching is a nice-to-have
  });
}
```

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds, `sw.js` is copied to `dist/`.

**Step 4: Commit**

```bash
git add frontend/public/sw.js frontend/src/main.tsx
git commit -m "feat: add service worker for map tile caching"
```

---

## Task 7: POI Data File

**Files:**
- Create: `frontend/src/data/poi.ts`
- Create: `frontend/src/types/poi.ts`

**Step 1: Create POI type**

```typescript
// frontend/src/types/poi.ts
export type POICategory = "hospital" | "university";

export interface POI {
  id: string;
  name: string;
  category: POICategory;
  lat: number;
  lng: number;
  address: string;
}
```

**Step 2: Create POI data file**

Research accurate coordinates for Torino hospitals and universities. Create `frontend/src/data/poi.ts`:

```typescript
import type { POI } from "../types/poi";

export const poiData: POI[] = [
  // Ospedali
  {
    id: "hosp-molinette",
    name: "Molinette",
    category: "hospital",
    lat: 45.0422,
    lng: 7.6722,
    address: "Corso Bramante 88",
  },
  {
    id: "hosp-cto",
    name: "CTO",
    category: "hospital",
    lat: 45.0382,
    lng: 7.6621,
    address: "Via Zuretti 29",
  },
  {
    id: "hosp-mauriziano",
    name: "Mauriziano",
    category: "hospital",
    lat: 45.0523,
    lng: 7.6656,
    address: "Largo Turati 62",
  },
  {
    id: "hosp-maria-vittoria",
    name: "Maria Vittoria",
    category: "hospital",
    lat: 45.0903,
    lng: 7.6698,
    address: "Via Cibrario 72",
  },
  {
    id: "hosp-giovanni-bosco",
    name: "Giovanni Bosco",
    category: "hospital",
    lat: 45.1004,
    lng: 7.6876,
    address: "Piazza del Donatore di Sangue 3",
  },
  {
    id: "hosp-sant-anna",
    name: "Sant'Anna",
    category: "hospital",
    lat: 45.0403,
    lng: 7.6752,
    address: "Corso Spezia 60",
  },
  {
    id: "hosp-regina-margherita",
    name: "Regina Margherita",
    category: "hospital",
    lat: 45.0417,
    lng: 7.6728,
    address: "Piazza Polonia 94",
  },
  {
    id: "hosp-martini",
    name: "Martini",
    category: "hospital",
    lat: 45.0979,
    lng: 7.6395,
    address: "Via Tofane 71",
  },
  // Universita
  {
    id: "uni-polito-duca",
    name: "Politecnico - Corso Duca",
    category: "university",
    lat: 45.0628,
    lng: 7.6621,
    address: "Corso Duca degli Abruzzi 24",
  },
  {
    id: "uni-polito-lingotto",
    name: "Politecnico - Lingotto",
    category: "university",
    lat: 45.0264,
    lng: 7.6656,
    address: "Via Nizza 230",
  },
  {
    id: "uni-palazzo-nuovo",
    name: "UniTo - Palazzo Nuovo",
    category: "university",
    lat: 45.0681,
    lng: 7.6944,
    address: "Via Sant'Ottavio 20",
  },
  {
    id: "uni-campus-einaudi",
    name: "UniTo - Campus Einaudi",
    category: "university",
    lat: 45.0893,
    lng: 7.6720,
    address: "Lungo Dora Siena 100",
  },
  {
    id: "uni-valentino",
    name: "UniTo - Valentino",
    category: "university",
    lat: 45.0543,
    lng: 7.6856,
    address: "Viale Mattioli 25",
  },
  {
    id: "uni-saa",
    name: "SAA School of Management",
    category: "university",
    lat: 45.0553,
    lng: 7.6612,
    address: "Via Ventimiglia 115",
  },
];
```

Note: Coordinates should be verified against real positions during implementation. The implementer should check each coordinate on Google Maps and adjust if needed.

**Step 3: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add frontend/src/types/poi.ts frontend/src/data/poi.ts
git commit -m "feat: add POI data for Torino hospitals and universities"
```

---

## Task 8: POI Layer Component + Map Integration

**Files:**
- Create: `frontend/src/components/POILayer.tsx`
- Modify: `frontend/src/components/ParkingMap.tsx`
- Modify: `frontend/src/components/Icons.tsx`

**Step 1: Add Hospital and GraduationCap icons**

In `Icons.tsx`:

```typescript
export function Hospital(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 3h18v18H3zM12 7v10M7 12h10" />
    </Svg>
  );
}

export function GraduationCap(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M22 10 12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 1.5 3 3 6 3s6-1.5 6-3v-5" />
      <path d="M22 10v6" />
    </Svg>
  );
}
```

**Step 2: Create POILayer component**

```typescript
// frontend/src/components/POILayer.tsx
import { Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import type { POI, POICategory } from "../types/poi";
import type { Parking } from "../types/parking";
import { haversineMeters, formatDistance } from "../utils/parking";

interface Props {
  pois: POI[];
  activeLayers: Set<POICategory>;
  parkings: Parking[];
  selectedPOI: POI | null;
  onSelectPOI: (poi: POI | null) => void;
  onSelectParking: (parking: Parking) => void;
}

function createPOIIcon(category: POICategory): L.DivIcon {
  const isHospital = category === "hospital";
  const bg = isHospital ? "#dc2626" : "#8b5cf6";
  const symbol = isHospital ? "+" : "U";

  return L.divIcon({
    className: "poi-marker",
    html: `
      <div style="
        background: ${bg};
        color: white;
        border-radius: 50%;
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 800;
        border: 2px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      ">${symbol}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function getNearestParkings(poi: POI, parkings: Parking[], count: number = 3): (Parking & { distance: number })[] {
  return parkings
    .filter((p) => p.is_available && p.free_spots !== null && p.free_spots > 0)
    .map((p) => ({
      ...p,
      distance: haversineMeters(poi.lat, poi.lng, p.lat, p.lng),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, count);
}

export default function POILayer({
  pois,
  activeLayers,
  parkings,
  selectedPOI,
  onSelectPOI,
  onSelectParking,
}: Props) {
  const visiblePOIs = pois.filter((p) => activeLayers.has(p.category));
  const nearestParkings = selectedPOI ? getNearestParkings(selectedPOI, parkings) : [];

  return (
    <>
      {visiblePOIs.map((poi) => (
        <Marker
          key={poi.id}
          position={[poi.lat, poi.lng]}
          icon={createPOIIcon(poi.category)}
          eventHandlers={{ click: () => onSelectPOI(poi) }}
        >
          <Popup>
            <div style={{ minWidth: 160 }}>
              <strong>{poi.name}</strong>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.7 }}>
                {poi.address}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {selectedPOI && nearestParkings.map((p) => (
        <Polyline
          key={`line-${selectedPOI.id}-${p.id}`}
          positions={[
            [selectedPOI.lat, selectedPOI.lng],
            [p.lat, p.lng],
          ]}
          pathOptions={{
            color: "#3b82f6",
            weight: 2,
            dashArray: "6 4",
            opacity: 0.7,
          }}
        />
      ))}
    </>
  );
}

export { getNearestParkings };
```

**Step 3: Integrate POILayer into ParkingMap.tsx**

Add imports and props to `ParkingMap`:

```typescript
import type { POI, POICategory } from "../types/poi";
import POILayer from "./POILayer";
```

Add to Props interface:
```typescript
pois?: POI[];
activePOILayers?: Set<POICategory>;
selectedPOI?: POI | null;
onSelectPOI?: (poi: POI | null) => void;
```

Add inside `<MapContainer>`, after the parking markers:
```tsx
{pois && activePOILayers && onSelectPOI && (
  <POILayer
    pois={pois}
    activeLayers={activePOILayers}
    parkings={parkings}
    selectedPOI={selectedPOI ?? null}
    onSelectPOI={onSelectPOI}
    onSelectParking={onSelect}
  />
)}
```

**Step 4: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add frontend/src/components/POILayer.tsx frontend/src/components/ParkingMap.tsx frontend/src/components/Icons.tsx
git commit -m "feat: add POI layer with hospital/university markers and routing lines"
```

---

## Task 9: POI State + Filters + Sidebar Integration

Wire everything together in App.tsx, add POI toggle pills to Filters, and show nearby parkings list in Sidebar when a POI is selected.

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Filters.tsx`
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/styles/app.css`

**Step 1: Add POI state to App.tsx**

```typescript
import type { POI, POICategory } from "./types/poi";
import { poiData } from "./data/poi";

// Inside App():
const [poiLayers, setPoiLayers] = useState<Set<POICategory>>(new Set());
const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

const togglePOILayer = useCallback((category: POICategory) => {
  setPoiLayers((prev) => {
    const next = new Set(prev);
    if (next.has(category)) {
      next.delete(category);
      // If we deactivate the layer of the selected POI, deselect it
      if (selectedPOI?.category === category) setSelectedPOI(null);
    } else {
      next.add(category);
    }
    return next;
  });
}, [selectedPOI]);

const handleSelectPOI = useCallback((poi: POI | null) => {
  setSelectedPOI(poi);
  // Clear parking selection when selecting a POI
  if (poi) setSelectedParking(null);
}, []);
```

Pass to components:
```tsx
<Sidebar
  // ...existing
  poiLayers={poiLayers}
  onTogglePOILayer={togglePOILayer}
  selectedPOI={selectedPOI}
  onSelectPOI={handleSelectPOI}
/>
<ParkingMap
  // ...existing
  pois={poiData}
  activePOILayers={poiLayers}
  selectedPOI={selectedPOI}
  onSelectPOI={handleSelectPOI}
/>
```

**Step 2: Add POI toggle pills to Filters.tsx**

Add props:
```typescript
import type { POICategory } from "../types/poi";
import { Hospital, GraduationCap } from "./Icons";

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  poiLayers?: Set<POICategory>;
  onTogglePOILayer?: (category: POICategory) => void;
}
```

Add after the existing filter pills, inside the `filter-pills` div:

```tsx
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
```

**Step 3: Add POI nearby list to Sidebar.tsx**

When `selectedPOI` is set, show a section above the parking list with the 3 nearest parkings:

Import:
```typescript
import type { POI, POICategory } from "../types/poi";
import { getNearestParkings } from "./POILayer";
import { formatDistance } from "../utils/parking";
```

Add props:
```typescript
poiLayers?: Set<POICategory>;
onTogglePOILayer?: (category: POICategory) => void;
selectedPOI?: POI | null;
onSelectPOI?: (poi: POI | null) => void;
```

Add in the body, just before the parking-list div (when selectedPOI is set and no selectedParking):

```tsx
{selectedPOI && !selectedParking && (
  <div className="poi-nearby-section">
    <div className="poi-nearby-header">
      <span>Parcheggi vicino a <strong>{selectedPOI.name}</strong></span>
      <button className="poi-nearby-close" onClick={() => onSelectPOI?.(null)}>✕</button>
    </div>
    {getNearestParkings(selectedPOI, parkings).map((p) => (
      <div
        key={p.id}
        className="poi-nearby-item"
        onClick={() => onSelect(p)}
      >
        <span className="poi-nearby-name">{p.name}</span>
        <span className="poi-nearby-meta">
          {p.free_spots} posti · {formatDistance(p.distance)}
        </span>
      </div>
    ))}
  </div>
)}
```

Pass `poiLayers` and `onTogglePOILayer` to `Filters`.

**Step 4: Add POI CSS**

```css
/* === POI === */
.poi-marker {
  background: none !important;
  border: none !important;
}

.filter-pill-divider {
  width: 1px;
  height: 20px;
  background: var(--border);
  align-self: center;
  margin: 0 2px;
}

.filter-pill-poi.active {
  background: #8b5cf6;
  border-color: #8b5cf6;
}

.poi-nearby-section {
  margin: 0 12px;
  padding: 12px;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(139, 92, 246, 0.04));
  border: 1px solid #8b5cf6;
  border-radius: 10px;
}

.poi-nearby-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.poi-nearby-close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 16px;
  padding: 4px;
}

.poi-nearby-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.poi-nearby-item:hover {
  background: rgba(139, 92, 246, 0.1);
}

.poi-nearby-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.poi-nearby-meta {
  font-size: 11px;
  color: var(--text-secondary);
}
```

**Step 5: Verify build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

**Step 6: Manual test**

Run: `cd frontend && npm run dev`
- Toggle hospital/university pills
- Tap a POI marker on the map
- Verify dotted lines and "Parcheggi vicino a X" section appear
- Tap a parking in the list to open detail

**Step 7: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Filters.tsx frontend/src/components/Sidebar.tsx frontend/src/styles/app.css
git commit -m "feat: integrate POI layers with toggle filters and nearby parking routing"
```

---

## Task 10: Final Visual QA + Polish

Manually test every feature, fix any CSS glitches, verify mobile and desktop.

**Files:**
- Potentially touch any CSS or component

**Step 1: Desktop QA checklist**

Run: `cd frontend && npm run dev`

- [ ] Sidebar opens/collapses with smooth animation
- [ ] Collapse button positioned correctly on sidebar edge
- [ ] Collapsed sidebar shows P icon and count
- [ ] Map expands to fill space when sidebar collapses
- [ ] Reload page - sidebar state persists from localStorage
- [ ] POI pills appear after divider in filter row
- [ ] Hospital markers are red, university markers are purple
- [ ] Tap POI shows dotted lines to 3 nearest parkings
- [ ] Close POI selection with X button
- [ ] Closed/out-of-service markers have correct colors

**Step 2: Mobile QA checklist**

Open browser DevTools mobile view (iPhone SE, iPhone 14 Pro, Pixel 5):

- [ ] Bottom sheet starts at half (50vh)
- [ ] Drag handle is visible and touchable
- [ ] Drag up snaps to full (90vh)
- [ ] Drag down from half snaps to closed (80px)
- [ ] Closed state shows "X aperti · Y posti liberi"
- [ ] Tap parking marker snaps to full with detail
- [ ] Tap map snaps to closed
- [ ] Scroll content inside sheet works without triggering drag
- [ ] iPhone safe area padding at bottom
- [ ] All buttons have 44px min touch targets

**Step 3: Fix any issues found**

Apply CSS and logic fixes as needed.

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: visual QA polish for bottom sheet, sidebar, and POI layers"
```

---

## Task 11: Update ROADMAP.md

Mark completed items in the roadmap.

**Files:**
- Modify: `ROADMAP.md`

**Step 1: Mark items as done**

Update the following lines from `[ ]` to `[x]`:

Under "Sidebar collassabile e mappa interattiva":
- `[x]` Sidebar chiudibile con toggle
- `[x]` Animazione fluida apertura/chiusura sidebar
- `[x]` Stato sidebar persistente (localStorage)
- `[x]` Su mobile: bottom-sheet con 3 stati via touch drag
- `[x]` Floating action button (drag handle on closed state)
- `[x]` Mini-badge flottante con stats visibile a sidebar chiusa

Under "Ottimizzazione mappa":
- `[x]` Tile map in cache locale (Service Worker)
- `[x]` GPS solo su richiesta esplicita
- `[x]` Aggiornamento dati smart: refresh solo se app in foreground (Page Visibility API)
- `[x]` Intervallo refresh adattivo
- `[x]` Differenziare colore marker per stato

Under "Punti di Interesse":
- `[x]` Layer dedicato sulla mappa con icona ospedale/universita
- `[x]` Suggerimento parcheggio piu vicino
- `[x]` Sedi UniTo / PoliTo
- `[x]` Sistema layer sulla mappa con toggle per categoria

**Step 2: Commit**

```bash
git add ROADMAP.md
git commit -m "docs: update roadmap with completed frontend UX and POI features"
```
