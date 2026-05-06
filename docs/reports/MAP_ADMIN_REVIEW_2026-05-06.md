# Review: Halaman Admin Map

**Tanggal Review:** 2026-05-06  
**URL:** http://localhost:3000/admin/map  
**Reviewer:** Claude (AI Code Review)

---

## Executive Summary

Halaman admin map adalah **MONSTER COMPONENT** dengan kompleksitas sangat tinggi. Ditemukan banyak code smell serius yang perlu refactoring mendesak.

**Status Arsitektur:** ⚠️ **PERLU REFACTORING BESAR**  
**Kualitas Kode:** 🔴 **CRITICAL** (Multiple God Components, Massive State Management)

---

## Struktur Arsitektur

### Layer Separation ✅

```
app/admin/map/page.tsx (UI Layer)
    ↓
components/map/MapWrapper.tsx (Dynamic Import)
    ↓
components/map/NetworkMapInteractive.tsx (MONSTER - 625 lines)
    ↓
components/map/useMapData.ts (336 lines)
components/map/useMapEditorState.ts (508 lines)
    ↓
app/api/map/nodes/route.ts (Controller)
    ↓
modules/map/services (Service Layer)
```

**Penilaian:** Arsitektur sudah benar, tapi implementasi component terlalu besar.

---

## Code Smell & Critical Issues

### 1. 🔴 **MONSTER COMPONENT** - `NetworkMapInteractive.tsx`

**Lokasi:** `components/map/NetworkMapInteractive.tsx`

**Masalah:**
- **625 LINES** - Jauh melebihi batas wajar (max 300 lines)
- Melakukan terlalu banyak tanggung jawab:
  1. Map rendering (Leaflet)
  2. Node icon creation
  3. Event handling (click, drag)
  4. Modal management (3 modals)
  5. State orchestration
  6. Search functionality
  7. Tab management
  8. Map style toggle

**Pelanggaran:** Single Responsibility Principle (SEVERE)

**Metrics:**
- Lines: 625
- Responsibilities: 8+
- State hooks: 4 direct + 2 custom hooks
- Event handlers: 10+

**Rekomendasi:**
```typescript
// Pecah menjadi:
// 1. NetworkMapContainer.tsx - orchestration only (~100 lines)
// 2. MapCanvas.tsx - Leaflet map rendering
// 3. MapNodeLayer.tsx - Node markers rendering
// 4. MapIconFactory.ts - Icon creation logic
// 5. MapModals.tsx - Modal management
// 6. MapSearch.tsx - Search functionality
```

---

### 2. 🔴 **GOD HOOK** - `useMapEditorState.ts`

**Lokasi:** `components/map/useMapEditorState.ts`

**Masalah:**
- **508 LINES** - Hook terlalu besar
- **24 state variables** - Terlalu banyak state
- **48 hooks total** (useState + useCallback)
- Mengelola 6 node types dengan state terpisah

**State Variables:**
```typescript
// ❌ BAD: 24 state variables
const [serverActionMode, setServerActionMode] = useState(...)
const [odcActionMode, setOdcActionMode] = useState(...)
const [odpActionMode, setOdpActionMode] = useState(...)
const [ontActionMode, setOntActionMode] = useState(...)
const [poleActionMode, setPoleActionMode] = useState(...)
const [joinboxActionMode, setJoinboxActionMode] = useState(...)

const [serverTempPosition, setServerTempPosition] = useState(...)
const [odcTempPosition, setOdcTempPosition] = useState(...)
const [odpTempPosition, setOdpTempPosition] = useState(...)
// ... 15 more states
```

**Solusi:**
```typescript
// ✅ GOOD: Unified state dengan Map/Record
type NodeTool = 'server' | 'odc' | 'odp' | 'ont' | 'pole' | 'joinbox'

const [nodeToolStates, setNodeToolStates] = useState<Record<NodeTool, {
  actionMode: NodeActionMode
  tempPosition: Position | null
  selectedNode: MappingNode | null
}>>({
  server: { actionMode: 'idle', tempPosition: null, selectedNode: null },
  odc: { actionMode: 'idle', tempPosition: null, selectedNode: null },
  // ...
})

// Reduce 24 states → 1 state
```

**Impact:** 24 state variables → 3-4 state variables

---

### 3. 🔴 **MASSIVE HOOK** - `useMapData.ts`

**Lokasi:** `components/map/useMapData.ts`

**Masalah:**
- **336 lines** - Hook terlalu besar
- **10 direct fetch calls** - Tidak ada API abstraction
- Mengelola CRUD operations untuk nodes, edges, settings
- Export/import logic di hook

**Direct API Calls:**
```typescript
// ❌ BAD: 10 direct fetch calls
await fetch("/api/map/nodes")
await fetch("/api/map/edges")
await fetch("/api/map/settings")
await fetch("/api/map/statistics")
await fetch(`/api/map/nodes/${nodeId}`, { method: "PUT" })
await fetch("/api/map/nodes", { method: "POST" })
await fetch("/api/map/edges", { method: "POST" })
await fetch(endpoint, { method: "DELETE" })
await fetch("/api/map/settings", { method: "PUT" })
await fetch("/api/map/reset", { method: "DELETE" })
```

**Solusi:**
```typescript
// ✅ GOOD: Extract ke API client
// lib/api/mapClient.ts
export const mapApi = {
  nodes: {
    list: () => fetch("/api/map/nodes").then(r => r.json()),
    create: (data) => fetch("/api/map/nodes", { method: "POST", body: JSON.stringify(data) }),
    update: (id, data) => fetch(`/api/map/nodes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id) => fetch(`/api/map/nodes/${id}`, { method: "DELETE" }),
  },
  edges: { /* ... */ },
  settings: { /* ... */ },
}

// hooks/useMapData.ts
const nodes = await mapApi.nodes.list()
```

---

### 4. ⚠️ **HARDCODED ICONS** - `NetworkMapInteractive.tsx`

**Lokasi:** `NetworkMapInteractive.tsx:70-99`

**Masalah:**
```typescript
// ❌ BAD: Hardcoded SVG strings di component
const nodeIcons = {
  server: {
    color: "#9333ea",
    svg: '<path d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'
  },
  // ... 6 more icons
}
```

**Solusi:**
```typescript
// ✅ GOOD: Extract ke constants file
// constants/mapIcons.ts
export const MAP_NODE_ICONS = { /* ... */ }

// utils/mapIconFactory.ts
export function createNodeIcon(type: string, isSelected: boolean) { /* ... */ }
```

---

### 5. ⚠️ **MAGIC NUMBERS**

**Lokasi:** Multiple files

**Masalah:**
```typescript
// ❌ BAD: Magic numbers
const size = isSelected ? 36 : 30
const border = isSelected ? "3px solid #facc15" : "2px solid white"
const zoomLevel = settings?.defaultZoom ? parseInt(settings.defaultZoom) : 13
const maxZoomIn = settings?.maxZoomIn ? parseInt(settings.maxZoomIn) : 22
const minZoomOut = settings?.maxZoomOut ? parseInt(settings.maxZoomOut) : 5
```

**Solusi:**
```typescript
// ✅ GOOD: Named constants
export const MAP_CONSTANTS = {
  ICON_SIZE: {
    DEFAULT: 30,
    SELECTED: 36,
  },
  ZOOM: {
    DEFAULT: 13,
    MAX: 22,
    MIN: 5,
  },
  BORDER: {
    DEFAULT: "2px solid white",
    SELECTED: "3px solid #facc15",
  },
} as const
```

---

### 6. ⚠️ **REPETITIVE CODE** - Node Tool Handling

**Lokasi:** `useMapEditorState.ts:73-106`

**Masalah:**
```typescript
// ❌ BAD: Repetitive switch cases
const cancelNodeTool = useCallback((tool: NodeTool) => {
  switch (tool) {
    case 'server':
      setServerActionMode('idle')
      setServerTempPosition(null)
      setSelectedServerNode(null)
      return
    case 'odc':
      setOdcActionMode('idle')
      setOdcTempPosition(null)
      setSelectedOdcNode(null)
      return
    // ... 4 more identical cases
  }
}, [])
```

**Solusi:**
```typescript
// ✅ GOOD: Generic handler dengan unified state
const cancelNodeTool = useCallback((tool: NodeTool) => {
  setNodeToolStates(prev => ({
    ...prev,
    [tool]: { actionMode: 'idle', tempPosition: null, selectedNode: null }
  }))
}, [])
```

---

### 7. ⚠️ **COMPLEX CONDITIONAL** - Active Mode Message

**Lokasi:** `useMapEditorState.ts:409-427`

**Masalah:**
```typescript
// ❌ BAD: 19 lines of if-else
const activeModeMessage = useMemo(() => {
  if (serverActionMode === 'adding') return 'Click on map to place Server/OLT, then click Save'
  if (serverActionMode === 'editing') return 'Drag marker to new position, then click Save'
  if (odcActionMode === 'adding') return 'Click on map to place ODC, then click Save'
  if (odcActionMode === 'editing') return 'Drag marker to new position, then click Save'
  // ... 15 more conditions
  return ''
}, [/* 7 dependencies */])
```

**Solusi:**
```typescript
// ✅ GOOD: Lookup table
const MODE_MESSAGES: Record<string, string> = {
  'server:adding': 'Click on map to place Server/OLT, then click Save',
  'server:editing': 'Drag marker to new position, then click Save',
  // ...
}

const activeModeMessage = useMemo(() => {
  const activeMode = Object.entries(nodeToolStates).find(([_, state]) => state.actionMode !== 'idle')
  if (!activeMode) return ''
  return MODE_MESSAGES[`${activeMode[0]}:${activeMode[1].actionMode}`] || ''
}, [nodeToolStates])
```

---

### 8. ✅ **GOOD: Service Layer Separation**

**Lokasi:** `app/api/map/nodes/route.ts`

**Penilaian:** API routes sudah proper:
- Thin controller
- Delegation ke service layer
- Permission check
- Activity logging

```typescript
export const POST = createHandler(
  {
    auth: true,
    permissions: ["map:create"],
    schema: createNodeSchema,
  },
  async (req, ctx) => {
    const body = ctx.validated;
    const newNode = await adminService.createNode({
      nodeId: crypto.randomUUID(),
      ...body,
    });

    await logger.logActivity({
      action: "CREATE",
      subject: "Node",
      details: { id: newNode.nodeId, name: newNode.name, type: newNode.type },
      userId: ctx.session?.user.id,
    });

    return apiSuccess(newNode, { status: 201 });
  },
);
```

---

### 9. ✅ **GOOD: Dynamic Import**

**Lokasi:** `MapWrapper.tsx`

**Penilaian:** Sudah menggunakan dynamic import untuk Leaflet (SSR issue):
```typescript
const NetworkMapInteractive = dynamic(() => import("./NetworkMapInteractive"), {
  ssr: false,
  loading: () => <LoadingSpinner />,
});
```

---

## Performance Analysis

### ⚠️ **Potential Issues:**

1. **Re-render Hell** - 24 state variables bisa trigger banyak re-render
2. **Large Component** - 625 lines component slow to parse
3. **No Memoization** - Node icons created on every render
4. **10 API Calls** - Initial load fetch 4 endpoints parallel (good), tapi bisa di-cache

### ✅ **Optimizations Detected:**

1. **Dynamic Import** - Leaflet loaded client-side only
2. **Parallel Fetching** - `Promise.all` untuk initial data
3. **useCallback** - Event handlers di-memoize

---

## Security Analysis

### ✅ **Security Measures:**

1. **Permission Check** - `ensurePermission("map:read")` di page level
2. **RBAC** - API routes check permissions
3. **Activity Logging** - CRUD operations logged
4. **Input Validation** - Zod schema validation

### ⚠️ **Security Concerns:**

1. **Password in Reset** - `resetMap(password)` - password dikirim plain text?
2. **No Rate Limiting** - Banyak API calls tanpa rate limit visible

---

## Testing Coverage

### ❌ **Missing Tests:**

Tidak ditemukan test files untuk:
- `NetworkMapInteractive.tsx`
- `useMapData.ts`
- `useMapEditorState.ts`
- Map services

**Rekomendasi:** Minimum 70% coverage untuk hooks, 90% untuk critical path.

---

## Complexity Metrics

| File | Lines | Responsibilities | State Variables | Complexity |
|------|-------|-----------------|----------------|------------|
| NetworkMapInteractive.tsx | 625 | 8+ | 4 direct + 2 hooks | 🔴 CRITICAL |
| useMapEditorState.ts | 508 | 6 | 24 | 🔴 CRITICAL |
| useMapData.ts | 336 | 5 | 5 | 🟡 HIGH |
| **Total** | **3,623** | - | - | - |

---

## Recommendations

### 🔴 **CRITICAL PRIORITY:**

1. **Refactor useMapEditorState**
   - Unify 24 state variables → 3-4 unified states
   - Extract node tool logic ke separate hook
   - Reduce complexity dari 508 lines → ~200 lines

2. **Split NetworkMapInteractive**
   - Extract icon factory → `utils/mapIconFactory.ts`
   - Extract node layer → `MapNodeLayer.tsx`
   - Extract modals → `MapModals.tsx`
   - Main component → ~150 lines

3. **Extract API Calls**
   - Create `lib/api/mapClient.ts`
   - Remove 10 direct fetch calls dari hook
   - Centralize error handling

### 🟡 **HIGH PRIORITY:**

4. **Extract Magic Numbers**
   - Create `constants/mapConstants.ts`
   - Define icon sizes, zoom levels, colors

5. **Simplify Conditional Logic**
   - Replace 19-line if-else dengan lookup table
   - Use unified state untuk reduce complexity

6. **Add Memoization**
   - Memoize icon creation
   - Memoize node filtering
   - Memoize connected devices calculation

### 🟢 **MEDIUM PRIORITY:**

7. **Add Unit Tests**
   - Test hooks dengan React Testing Library
   - Test icon factory
   - Test API client

8. **Add Caching**
   - Cache nodes/edges untuk 30 detik
   - Invalidate on mutations

9. **Improve Type Safety**
   - Replace `any` types
   - Add branded types untuk IDs

---

## Conclusion

**Overall Score:** 4/10

**Strengths:**
- ✅ Service layer separation proper
- ✅ Permission & authorization correct
- ✅ Dynamic import untuk SSR issue
- ✅ Activity logging implemented

**Critical Weaknesses:**
- 🔴 Monster component (625 lines)
- 🔴 God hook (508 lines, 24 states)
- 🔴 No API abstraction (10 direct fetches)
- 🔴 Massive complexity
- 🔴 No tests

**Next Steps:**
1. **URGENT:** Refactor `useMapEditorState` - unify states
2. **URGENT:** Split `NetworkMapInteractive` - extract components
3. **HIGH:** Create API client - remove direct fetches
4. **HIGH:** Extract constants - remove magic numbers
5. **MEDIUM:** Add tests - minimum 70% coverage

**Estimated Refactoring Time:** 2-3 days (full refactor)

---

**Generated by:** Claude AI Code Review  
**Date:** 2026-05-06
