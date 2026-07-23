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

---

## 8. Marketing Landing (SaaS — RADPRO.ID)

> Applies only to `components/landing/SaasLandingPage.tsx` and related marketing surfaces.
> Admin/ops UI still follows sections 1–7.

### Direction
Soft Structuralism + Linear precision. Light zinc canvas, single indigo-violet accent, engineered type, floating island nav, asymmetric bento features, dimensional product mock as hero focal. No multi-hue gradients, no rocket icons, no 3 equal feature cards.

### Research Log
- Layer A: `soft-skill.md` (premium soft structural) + redesign discipline
- Layer B: `linear.app.md` (indigo accent, tight display tracking, hairline borders, 510-weight emphasis)
- Shortlist rejected: dark OLED glass (too heavy for ISP SMB audience), Stripe mesh (too chromatic)

### Atmosphere
- Soft structural dual-theme: light zinc canvas / dark zinc-950. Same structure both modes.
- Surfaces: white / zinc-900 cards with hairline borders (`zinc-200` light, `white/10` dark)
- Accent: indigo-600 light / indigo-400–500 dark — CTAs and focus only
- Signature: floating glass nav + product mock + theme toggle
- **Rule**: every color class MUST have a paired `dark:` variant. No orphan hex (`#fafafa`, `#0c0c0e`) that breaks under `ThemeProvider`.

### Marketing Color Tokens (Tailwind pairs)

| Role | Light | Dark |
|------|-------|------|
| Canvas | `bg-zinc-50` | `dark:bg-zinc-950` |
| Surface | `bg-white` | `dark:bg-zinc-900` |
| Ink | `text-zinc-900` | `dark:text-zinc-50` |
| Muted | `text-zinc-500` | `dark:text-zinc-400` |
| Faint | `text-zinc-400` | `dark:text-zinc-500` |
| Line / ring | `border/ring-zinc-200` | `dark:border/ring-white/10` |
| Accent text | `text-[#0a46aa]` | `dark:text-[#5b8def]` |
| Accent CTA | `bg-[#0a46aa] hover:bg-[#083a8f]` | `dark:bg-[#1a5bc4] dark:hover:bg-[#2a6bd4]` |
| Brand mark | `/brand/radpro-icon.png` (from mobile `assets/images/icon.png`) | same |
| Deep band | `bg-zinc-950` | `dark:bg-zinc-900` + ring |

### Marketing Typography
- Display: `text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-[-0.04em] leading-[1.05]`
- Section H2: `text-3xl sm:text-4xl font-semibold tracking-[-0.03em]`
- Body: `text-base sm:text-lg text-zinc-500 leading-relaxed`
- Eyebrow: `text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500`
- Font: existing Inter via `--font-inter` (no new font dep)

### Marketing Spacing
- Section: `py-24 sm:py-32`
- Content max: `max-w-6xl` (features/footer), `max-w-3xl` (hero copy), `max-w-5xl` (pricing)
- Card radius: outer `rounded-[1.75rem]`, inner `rounded-[1.35rem]` (double-bezel)
- CTA: `rounded-full` pills

### Primitives
1. **Island Nav** — floating centered glass pill, `sticky top-4`, `backdrop-blur-xl bg-white/70 ring-1 ring-zinc-200/80`
2. **Primary CTA** — filled accent pill + nested circular arrow chip
3. **Secondary CTA** — white surface, hairline ring, no fill gradient
4. **Bento Feature** — asymmetric grid (2×2 + wide), icon in soft accent well, no rainbow icon colors
5. **Pricing Card** — equal start baselines; popular uses deep surface not rainbow
6. **FAQ Row** — border-bottom list, no card-per-item accordion chrome
7. **Product Mock** — CSS dashboard frame as hero focal (window chrome + metric tiles)

### Motion
- Easing: `cubic-bezier(0.32,0.72,0,1)`
- Duration: 200–400ms interactive; GPU only (`transform`/`opacity`)
- Hover: CTA `active:scale-[0.98]`; nested arrow `translate-x-0.5`
- No decorative infinite animations

### Anti-patterns (banned on marketing)
- Multi-stop indigo→blue button gradients
- Rocket / generic Material filled icons for brand mark
- Three equal feature columns with rainbow pastel icon wells
- Uppercase bold tracking-widest section labels in brand color
- Pure black footer with indigo gradient CTA band above
