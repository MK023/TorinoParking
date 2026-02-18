# Design: Frontend UX + POI

Data: 2026-02-18
Stato: Approvato
Approccio: Refactor incrementale (nessuna dipendenza aggiunta, nessun refactor strutturale)

---

## 1. Bottom Sheet Mobile (3 snap)

### Hook `useBottomSheet.ts`

State:
- `sheetState`: `'closed' | 'half' | 'full'`
- `translateY`: number (pixel offset)

Snap points:
- closed = `window.innerHeight - 80px` (handle + stats)
- half = `window.innerHeight * 0.5` (lista parcheggi)
- full = `window.innerHeight * 0.1` (dettaglio, 90vh)

Touch handling:
- `onTouchStart` -> salva startY e currentTranslateY
- `onTouchMove` -> calcola deltaY, applica transform con clamp
- `onTouchEnd` -> trova snap piu' vicino, anima con CSS transition

Transizioni automatiche:
- `selectedParking !== null` -> snap a `full`
- `selectedParking` diventa null -> snap a `half`
- Tap su mappa (fuori marker) -> snap a `closed`

### Modifiche a Sidebar.tsx

- Su mobile usa `useBottomSheet` per posizionamento
- Drag handle diventa un vero touch target (non pseudo-element CSS)
- Stato `closed` mostra riga stats: "12 aperti - 847 posti liberi"
- `safe-area-inset-bottom` per iPhone home indicator

Implementazione: touch events nativi + CSS `transform: translateY()` + `transition`. Zero librerie.

---

## 2. Sidebar Desktop Collassabile

### Stato

- `sidebarCollapsed: boolean` in `App.tsx` (default false)
- Persistenza: `localStorage` key `sidebar-collapsed`
- Inizializzazione: lazy init da localStorage

### Comportamento

- Bottone freccia sul bordo destro della sidebar
- Aperta (380px): sidebar attuale, invariata
- Chiusa (48px): strip verticale con icone (logo, contatore, bottone riapertura)
- Animazione: `transition: width 300ms ease`, mappa si espande (flex: 1)
- `overflow: hidden` sulla sidebar durante transizione

### CSS

```css
.sidebar.collapsed { width: 48px; }
.sidebar-collapse-btn { position: absolute; right: -12px; top: 50%; }
.sidebar.collapsed .sidebar-content { opacity: 0; pointer-events: none; }
```

Nascosto sotto 768px (il bottom sheet gestisce tutto su mobile).

---

## 3. Differenziazione Colori Marker

### Logica

Modifica a `getStatusColor()` in `utils/parking.ts`:

- `status_label = "chiuso"` -> grigio `#6b7280` (fuori orario, normale)
- `status_label = "fuori servizio"` -> rosso scuro `#dc2626` (anomalia)
- `status_label = "nessun dato"` -> grigio chiaro `#9ca3af`

Il campo `status_label` e' gia' nel payload API, nessun cambiamento backend.

### Impatto

- `getStatusColor()`: parametro aggiuntivo `status_label`
- Marker popup: mostra label testuale
- Legenda colori opzionale nel mini-badge stats

---

## 4. Ottimizzazioni Mobile

### 4.1 Page Visibility API

Modifica in `useParkings.ts`:
- Tab nascosta -> clearInterval refresh
- Tab torna visibile -> fetch immediato + riavvia interval

### 4.2 GPS solo su richiesta

Verifica che non ci siano `watchPosition` in background. Il bottone "Vicino a me" chiama `getCurrentPosition` una tantum.

### 4.3 Refresh adattivo

- Consultazione normale: refresh ogni 2 min (invariato)
- Dopo "Vicino a me": refresh ogni 30s per 5 minuti, poi torna a 2 min
- `refreshInterval` dinamico in `useParkings.ts`

### 4.4 Service Worker per tile cache

File `public/sw.js` registrato da `main.tsx`:
- Intercetta solo richieste tile CartoDB (`basemaps.cartocdn.com`)
- Strategy: cache-first con fallback network
- Non tocca dati API, solo immagini mappa

### 4.5 Payload API light (predisposizione)

Backend: query param `?fields=light` che ritorna solo `id, free_spots, status, status_label, tendence`.
Frontend continua a usare il full payload. Predisposizione per app nativa futura.

---

## 5. POI - Ospedali e Universita'

### Dati: `src/data/poi.json`

File statico JSON con ~14 POI:
- ~8 ospedali/PS: Molinette, CTO, Mauriziano, Maria Vittoria, Giovanni Bosco, Sant'Anna, Regina Margherita, Martini
- ~6 sedi universitarie: PoliTo Duca Abruzzi, PoliTo Lingotto, UniTo Palazzo Nuovo, UniTo Campus Einaudi, UniTo Valentino, SAA

Struttura: `{ id, name, category, lat, lng, address }`

### Componente `POILayer.tsx`

- Riceve `activeLayers: Set<'hospital' | 'university'>` e `onSelectPOI`
- Marker con icona distinta (croce rossa, cappello laurea) - `divIcon` custom
- Marker 28px (piu' piccoli dei parcheggi 36px) per gerarchia visiva

### Interazione "parcheggi vicino a X"

- Tap su POI -> `selectedPOI` in `App.tsx`
- Calcolo client-side con `haversine()` (gia' in `utils/parking.ts`)
- 3 parcheggi piu' vicini con posti liberi
- `Polyline` tratteggiata dal POI ai 3 parcheggi (react-leaflet, zero dipendenze)
- Bottom sheet/sidebar mostra: "Parcheggi vicino a [nome]" + lista per distanza
- Tap "X" chiude modalita' POI

### Toggle filtri

Due pill-toggle nella barra filtri: Ospedali / Universita'
Stessa meccanica filtri avanzati esistenti. Off di default.

### Stato in App.tsx

```
poiLayers: Set<'hospital' | 'university'>
selectedPOI: POI | null
```

---

## File impattati

| Area | File nuovi | File modificati |
|---|---|---|
| Bottom sheet | `hooks/useBottomSheet.ts` | `Sidebar.tsx`, `App.tsx`, `app.css` |
| Sidebar desktop | - | `Sidebar.tsx`, `App.tsx`, `app.css` |
| Marker colori | - | `utils/parking.ts`, `ParkingMap.tsx` |
| Ottimizzazioni | `public/sw.js` | `useParkings.ts`, `main.tsx` |
| POI | `data/poi.json`, `components/POILayer.tsx` | `ParkingMap.tsx`, `Filters.tsx`, `App.tsx`, `app.css` |

Zero dipendenze aggiunte. Ogni blocco e' indipendente e deployabile separatamente.
