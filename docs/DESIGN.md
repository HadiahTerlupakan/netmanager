# NetManager Design System

## 1. Atmosphere & Identity

NetManager is an operations command center for ISP teams: dense enough for network, billing, and customer workflows, but still calm for daily admin use. The signature is practical clarity — white/light surfaces, neutral borders, blue primary actions, and compact data tables that keep operational decisions close to the data.

## 2. Color

### Palette

| Role | Token | Light | Dark | Usage |
|------|-------|-------|------|-------|
| Surface/primary | `--color-bg` | `#f6f7f8` | `#101922` | App background |
| Surface/card | `--color-bg-surface` | CSS variable | CSS variable | Cards, panels, table wrappers |
| Surface/variant | `--color-bg-surface-variant` | CSS variable | CSS variable | Muted panels and secondary states |
| Text/primary | `--color-text-primary` | CSS variable | CSS variable | Headings and body |
| Text/secondary | `--color-text-secondary` | CSS variable | CSS variable | Helper text, metadata |
| Text/tertiary | `--color-text-tertiary` | CSS variable | CSS variable | Disabled/muted labels |
| Border/default | `--color-border` | CSS variable | CSS variable | Cards, dividers, inputs |
| Accent/primary | `--color-primary` | CSS variable | CSS variable | Primary buttons, links, focus |
| Accent/hover | `--color-primary-hover` | CSS variable | CSS variable | Primary hover state |
| Status/success | `--color-success` | CSS variable | CSS variable | Success badges/actions |
| Status/warning | `--color-warning` | CSS variable | CSS variable | Warnings |
| Status/error | `--color-error` | CSS variable | CSS variable | Destructive actions/errors |
| Status/info | `--color-info` | CSS variable | CSS variable | Informational states |

### Rules
- Prefer existing Tailwind semantic tokens: `bg-surface`, `bg-muted`, `text-gray-*`, `border-border`, `text-primary`, `bg-primary`.
- Raw colors are allowed only when matching existing legacy admin patterns; new reusable UI should use semantic tokens first.
- Accent color is for actions and focus, not decoration.

## 3. Typography

### Scale

| Level | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| H1 | `text-2xl` / 24px | 700 | tight | Admin page titles |
| H2 | `text-xl` / 20px | 600 | snug | Panel titles |
| H3 | `text-lg` / 18px | 600 | snug | Card titles |
| Body | `text-sm` / 14px | 400 | normal | Admin forms and tables |
| Caption | `text-xs` / 12px | 500 | normal | Badges, metadata, helper text |

### Font Stack
- Primary: `var(--font-inter)`, system sans-serif.
- Mono: system monospace only for codes/IDs.

### Rules
- Admin table/body text defaults to `text-sm`.
- Page titles use `text-2xl font-bold` matching existing admin pages.
- Body text should not go below `text-xs`, except compact badges.

## 4. Spacing & Layout

### Base Unit
All spacing follows Tailwind's 4px scale.

| Token | Value | Usage |
|-------|-------|-------|
| `space-2` | 8px | Inline icon/label gaps |
| `space-3` | 12px | Compact form groups |
| `space-4` | 16px | Default input/card internal spacing |
| `space-6` | 24px | Page section rhythm |
| `space-8` | 32px | Major admin panel separation |

### Grid
- Max content width follows existing admin shell; individual pages use `space-y-6` and full-width data panels.
- Responsive forms use `grid grid-cols-1 md:grid-cols-2`.
- Data surfaces use `ResponsiveTable` when available.

### Rules
- Prefer `space-y-6` for admin pages.
- Prefer grid over flex percentage math.
- Keep form actions right-aligned in modal footers.

## 5. Components

### Admin Data Page
- **Structure**: page header with title/actions, optional stat cards, bordered table panel.
- **Spacing**: `space-y-6`; header uses `flex items-center justify-between`.
- **States**: loading via `PageLoader`, empty via table empty message, errors via toast.
- **Accessibility**: action buttons are real buttons/links with visible text or `aria-label`.

### Modal Form
- **Structure**: `Modal` + form fields + `ModalFooter`.
- **Spacing**: fields use `space-y-4` or 2-column grid with `gap-4`.
- **States**: saving disables submit button; validation errors shown via toast or inline helper.
- **Accessibility**: labels use `htmlFor`; inputs have stable IDs.

### Status Badge
- **Structure**: compact pill with status text.
- **Variants**: active/success, inactive/muted, danger/error.
- **Spacing**: `px-2 py-1 text-xs`.

## 6. Motion & Interaction

### Timing

| Type | Duration | Usage |
|------|----------|-------|
| Micro | 100-150ms | Button hover/press |
| Standard | 200ms | Modal/table state changes |

### Rules
- Animate only `transform`, `opacity`, or color transitions already handled by Tailwind/classes.
- Every button/input must preserve hover, focus, disabled states from shared components.
- Avoid custom animation in dense admin workflows unless it clarifies state.

## 7. Depth & Surface

### Strategy
Mixed, matching current admin UI: subtle borders plus small shadows on cards/panels.

| Level | Pattern | Usage |
|-------|---------|-------|
| Panel | `bg-white dark:bg-gray-800 rounded-xl shadow-sm border` | Table/form containers |
| Modal | Existing `Modal` component | Dialogs |
| Input | Existing border/focus ring classes | Form controls |

### Rules
- Use existing `rounded-xl shadow-sm border` admin panel pattern.
- Do not introduce heavy shadows or decorative gradients for operational pages.
- Dark mode must use paired `dark:` classes when using legacy gray classes.
