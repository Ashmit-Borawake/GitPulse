# 02 — UI Design System

> **Document Status:** Complete and final. Written once in Step 1; not updated in subsequent steps.
> This document describes the **desired final visual system** — the Antigravity-inspired design that will be applied to the completed application in Step 4. It is not a description of the temporary tutorial UI.

---

**Structural patterns** are inspired by the reference screenshots (sidebar layout, card placement, modal structure, list hierarchy) — meeting-specific content from those screenshots is void.
**Visual skin** comes directly from [antigravity.google](https://antigravity.google) — clean, Google-style, light-first design language.

---

## 1. Design Philosophy

GitPulse's UI is **clean, precise, and Google-native**. The aesthetic is drawn directly from antigravity.google: an airy, near-white background, generous whitespace, dark near-black text, soft rounded shapes, and a product-card-led content hierarchy. The feel is calm and professional — not dramatic or futuristic.

**Key characteristics of the antigravity.google design:**
- Light background (subtle periwinkle/lavender tint, not pure white)
- Flat white or near-white cards with soft drop shadows and large border-radii
- Dark pill-shaped buttons (near-black fill, white text) — the signature CTA shape
- Google's geometric rounded sans-serif for all text — clean, open, humanist
- Product showcase blocks use pure-black dark surfaces as deliberate contrast pockets
- Accent is the Google multicolor spectrum (blue, red, yellow, green) — used sparingly in logos and typographic highlights
- No gradients flooding surfaces; no glassmorphism; no neon glow — restraint is the design principle
- Floating tool-chip icons in the hero use gentle opacity, never garish

---

## 2. Theme Base — Light Mode Default

> Light is the default. Dark mode is a secondary palette, offered via toggle. The authenticated app inherits the same light-first aesthetic unless the user switches.

| Token Name | Value | Usage |
|---|---|---|
| `--bg-base` | `hsl(230, 35%, 96%)` | Root background — very pale periwinkle/lavender |
| `--bg-surface` | `hsl(0, 0%, 100%)` | Cards, modals, sidebar body (pure white) |
| `--bg-elevated` | `hsl(230, 20%, 98%)` | Hover surfaces, nested areas, input backgrounds |
| `--bg-inset` | `hsl(230, 25%, 93%)` | Subtle inset sections, divider areas |
| `--border-default` | `hsl(230, 20%, 88%)` | Card borders, input borders |
| `--border-subtle` | `hsl(230, 15%, 92%)` | Dividers, row separators |
| `--text-primary` | `hsl(0, 0%, 10%)` | Main body text (near-black) |
| `--text-secondary` | `hsl(230, 10%, 42%)` | Labels, timestamps, secondary info |
| `--text-tertiary` | `hsl(230, 8%, 62%)` | Placeholder text, disabled state |
| `--shadow-card` | `0 1px 3px hsl(230 30% 70% / 0.15), 0 4px 16px hsl(230 30% 70% / 0.1)` | Default card shadow |
| `--shadow-card-hover` | `0 4px 12px hsl(230 30% 60% / 0.18), 0 8px 32px hsl(230 30% 60% / 0.12)` | Card hover shadow |

---

## 3. Dark Mode Palette

Offered via toggle; dark is **not** the default. When active, it uses deep-but-not-pure-black surfaces matching the product showcase blocks seen on antigravity.google — dark navy/charcoal, not true `#000000`.

| Token Name | Value | Usage |
|---|---|---|
| `--bg-base` | `hsl(225, 20%, 9%)` | Root background |
| `--bg-surface` | `hsl(225, 18%, 13%)` | Cards, sidebar |
| `--bg-elevated` | `hsl(225, 15%, 17%)` | Hover states, inputs |
| `--bg-inset` | `hsl(225, 12%, 21%)` | Nested inset areas |
| `--border-default` | `hsl(225, 15%, 24%)` | Card/panel borders |
| `--border-subtle` | `hsl(225, 12%, 19%)` | Dividers |
| `--text-primary` | `hsl(210, 25%, 92%)` | Main text |
| `--text-secondary` | `hsl(210, 12%, 62%)` | Labels, timestamps |
| `--text-tertiary` | `hsl(210, 8%, 44%)` | Placeholders |
| `--shadow-card` | `0 1px 3px hsl(0 0% 0% / 0.3), 0 4px 16px hsl(0 0% 0% / 0.2)` | Card shadow |

Persist preference via `next-themes` + `localStorage`. Default: `light`.

---

## 4. Accent System — Google Spectrum

The accent on antigravity.google is the **Google multicolor spectrum** (blue, red, yellow, green) used only for the logo mark, typographic cursor highlights, and small decorative touches. It is never used as a gradient fill on buttons or backgrounds.

```css
/* Google spectrum — for logo, cursor blink, and rare decorative use */
--accent-blue:   hsl(217, 91%, 60%);   /* Google Blue */
--accent-red:    hsl(4,   90%, 58%);   /* Google Red */
--accent-yellow: hsl(45,  97%, 54%);   /* Google Yellow */
--accent-green:  hsl(142, 71%, 45%);   /* Google Green */

/* The typographic cursor (seen in the hero typewriter animation) */
--accent-cursor: linear-gradient(
  to bottom,
  var(--accent-blue) 0%,
  var(--accent-red) 33%,
  var(--accent-yellow) 66%,
  var(--accent-green) 100%
);

/* Primary CTA button — near-black fill, not gradient */
--btn-primary-bg:   hsl(0, 0%, 10%);   /* Near-black pill */
--btn-primary-text: hsl(0, 0%, 100%);  /* White text */
```

**Accent usage rules:**
- ✅ Logo mark / wordmark color spectrum
- ✅ Animated typewriter cursor in the hero section
- ✅ Small decorative typographic highlights (single characters)
- ✅ Semantic colors for status badges (success = green, warning = yellow, danger = red, info = blue)
- ❌ Do not use as large gradient fills on buttons or cards
- ❌ Do not mix all four Google colors on UI elements — use individually per semantic role

---

## 5. Semantic Colors

| Purpose | Token | Value | Usage |
|---|---|---|---|
| Success / Credits added / Open | `--color-success` | `hsl(142, 71%, 45%)` | Green "Open" PR badge, credit top-up toast |
| Warning / Medium priority | `--color-warning` | `hsl(45, 97%, 50%)` | "Medium" issue priority badge |
| Destructive / High priority / Closed | `--color-danger` | `hsl(4, 90%, 58%)` | "Closed" badge, delete actions, "High" priority |
| Info / Low priority / Neutral | `--color-info` | `hsl(217, 91%, 60%)` | "Low" priority badge, informational states |
| Merged state | `--color-merged` | `hsl(270, 65%, 58%)` | Violet "Merged" PR badge (only case where violet appears) |

---

## 6. Surface Treatment — Clean Cards, No Glass

Cards on antigravity.google are **flat white surfaces** with a soft box-shadow — no backdrop blur, no glassmorphism. Hover adds a slightly deeper shadow and a very faint upward lift.

```css
/* Base card */
.card {
  background: var(--bg-surface);          /* white */
  border: 1px solid var(--border-default);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
  transition: box-shadow 200ms ease, transform 200ms ease;
}

/* Card hover */
.card:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-2px);
}

/* Dark product showcase block (used sparingly for feature demos) */
.card--dark {
  background: hsl(0, 0%, 0%);            /* Pure black — deliberate contrast */
  border: none;
  border-radius: 16px;
  color: hsl(0, 0%, 100%);
}

/* Modal surface */
.modal {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: 20px;
  box-shadow: 0 8px 40px hsl(230 30% 60% / 0.2);
}
```

---

## 7. Typography

### Font Families

The antigravity.google site uses **Google Sans** — a rounded, humanist geometric sans-serif. Since Google Sans is not publicly available via Google Fonts for third-party use, we use **DM Sans** as the nearest open-source equivalent (same rounded, open letterforms and proportions).

```css
/* Primary UI font — rounded humanist sans-serif */
--font-sans: 'DM Sans', sans-serif;

/* Code / commit hashes / diffs / terminal */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* No separate display font — DM Sans at large weight serves all heading roles */
```

Import: `DM Sans` (weights 400, 500, 600, 700) + `JetBrains Mono` (400, 500) from Google Fonts.

### Type Scale

| Role | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| Hero display | `3.5rem` / `56px` | 500 | `1.1` | Landing page hero headline (normal weight, not heavy) |
| Section heading | `2rem` / `32px` | 500 | `1.2` | Section titles ("Antigravity 2.0", "Antigravity CLI") |
| Page title | `1.5rem` / `24px` | 500 | `1.3` | Dashboard, Q&A, Billing H1 |
| Card heading | `1rem` / `16px` | 500 | `1.4` | Card titles |
| Body | `0.9375rem` / `15px` | 400 | `1.6` | Descriptions, paragraph text |
| Small / label | `0.8125rem` / `13px` | 400 | `1.4` | Badges, timestamps, metadata |
| Code / hash | `0.8125rem` / `13px` | 400 | `1.5` | Commit hashes, file paths, code snippets |

**Key observation from the site:** Headings are **medium weight (500), not heavy (700–800)**. Text feels open and comfortable — not tight or compressed. The hero text reads as a friendly, approachable weight, never aggressive.

### Letter Spacing

```css
--tracking-tight:  -0.01em;  /* Large headings only */
--tracking-normal:  0em;     /* Body text */
--tracking-wide:    0.04em;  /* Small labels, uppercase badges */
```

---

## 8. Motion & Atmosphere Language

### Transition Conventions

```css
/* Standard transitions */
--duration-fast:   150ms;
--duration-base:   200ms;
--duration-slow:   300ms;
--ease-standard:   cubic-bezier(0.4, 0, 0.2, 1);
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);   /* Enter */
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);   /* Exit */
--ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1); /* Modal bounce-in */
```

### Hover & Press States

- **Buttons:** `opacity: 0.88` on hover (antigravity.google uses opacity reduction, not lift, on dark pill buttons). `100ms ease`.
- **Cards:** shadow deepens + `translateY(-2px)`. `200ms ease`.
- **Nav links:** `color → --text-primary`. `150ms ease`.
- **Pill buttons (ghost/secondary):** background fills to `--bg-inset`. `150ms ease`.

### Entrance / Exit Patterns

| Pattern | Enter | Exit |
|---|---|---|
| Page transition | `opacity 0→1` + `translateY(6px→0)`, `250ms decelerate` | — |
| Modal open | `scale(0.97→1)` + `opacity(0→1)`, `250ms spring` | `scale(1→0.97)` + `opacity(1→0)`, `150ms accelerate` |
| Toast | Slides from bottom-right, `300ms spring` | Fades + slides out, `200ms accelerate` |
| List items (first mount) | Staggered `translateY(8px→0)` + `opacity(0→1)`, `15ms` per item stagger | — |
| Dropdown | `scaleY(0.95→1)` + `opacity(0→1)`, `150ms decelerate` | `150ms accelerate` |

### Landing Page — Atmosphere Effects

These effects are **Landing Page only** — not in the authenticated dashboard.

- **Floating tool/icon chips:** From the antigravity.google hero — small circular `~56px` pill/circle chips containing developer icons (code bracket `</>`, search+sparkle, git commit dot, enter arrow, terminal square) rendered in `--bg-inset` / light gray circles. They drift very slowly at low opacity (`0.6–0.8`, not 0.2 — they're quite visible on the actual site). Arranged in a loose arc around the hero text.
- **Periwinkle edge glow:** The page background has a very subtle blue-lavender radial vignette at the top edges — not dramatic, just a soft color wash at `opacity ~0.4`.
- **No dot-grid texture** — the actual site does not use a grid pattern. Clean empty space.
- **Animated typewriter cursor:** A multicolor `|` cursor (Google spectrum gradient, see Section 4) that blinks at the end of the hero headline typewriter animation. This is a key brand element.
- **No parallax** — the actual site does not use scroll-driven parallax on the hero.

---

## 9. Component Inventory (shadcn/ui Mappings)

### Button — Primary (Dark Pill)

The signature button from antigravity.google: dark near-black pill, white text. No gradient.

```css
.btn-primary {
  background: var(--btn-primary-bg);    /* hsl(0, 0%, 10%) */
  color: var(--btn-primary-text);       /* white */
  border-radius: 999px;                 /* full pill */
  padding: 10px 20px;
  font-size: 15px;
  font-weight: 500;
  border: none;
  transition: opacity 100ms ease;
}
.btn-primary:hover { opacity: 0.85; }
```

In dark mode, this inverts: near-white background, dark text.

### Button — Secondary / Ghost

```css
.btn-secondary {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: 999px;                 /* pill — consistent with primary */
  padding: 10px 20px;
  font-size: 15px;
  font-weight: 500;
  transition: background 150ms ease, border-color 150ms ease;
}
.btn-secondary:hover {
  background: var(--bg-inset);
  border-color: var(--border-default);
}
```

### Button — Destructive

Same pill shape, `background: var(--color-danger)`, white text. Used for Archive/Delete confirmations only.

### Sidebar Nav Item

- Structure: icon (20px) + text label
- Default: `text-secondary`, `bg-transparent`, `border-radius: 8px`
- Hover: `bg-inset`, `text-primary`, `150ms ease`
- Active: `bg-surface` (white card feel), `text-primary`, `font-weight: 500`, subtle left border `3px solid var(--color-info)` (Google Blue)
- Icon: `text-secondary` by default; `color-info` (blue) on active

### Top Bar

- Height: `56px`
- Background: `var(--bg-surface)` (white) + `border-bottom: 1px solid var(--border-subtle)`
- Contents: GitPulse logo left, page breadcrumb, theme toggle + user avatar right

### Avatar

- Circular, `32px` (sidebar) / `40px` (commit feed)
- Fallback: colored initials — deterministic Google-spectrum hue from project name hash

### Card

See Section 6. `padding: 20px 24px`, `border-radius: 16px`, soft shadow, white background.

### Tabs (Workspace: PR / Issues)

- Underline variant — `2px solid var(--color-info)` on active tab
- Inactive: `text-secondary`, hover `text-primary`

### Modal / Dialog

- `background: var(--bg-surface)`, `border-radius: 20px`, soft shadow
- Backdrop: `rgba(0, 0, 0, 0.3)` (lighter than typical — the site has an airy feel)
- Animation: spring entrance (see Section 8)
- Max width: `600px` / `800px` for detail modals

### Input / Textarea

- Background: `var(--bg-elevated)`
- Border: `1px solid var(--border-default)`, `border-radius: 10px`
- Focus: `border-color: var(--color-info)` (Google Blue), `box-shadow: 0 0 0 3px hsl(217 91% 60% / 0.15)`
- Placeholder: `var(--text-tertiary)`

### Slider (Credits purchase)

- Track: `var(--bg-inset)`
- Fill: `var(--btn-primary-bg)` (near-black) — matches button style
- Thumb: white circle with `--shadow-card` shadow

### Status Badge — PR State

| State | Background | Text |
|---|---|---|
| Open | `hsl(142 71% 45% / 0.12)` | `var(--color-success)` |
| Closed | `hsl(4 90% 58% / 0.12)` | `var(--color-danger)` |
| Merged | `hsl(270 65% 58% / 0.12)` | `var(--color-merged)` |

### Status Badge — Issue Priority

| Priority | Background | Text |
|---|---|---|
| Low | `hsl(217 91% 60% / 0.12)` | `var(--color-info)` |
| Medium | `hsl(45 97% 50% / 0.12)` | `var(--color-warning)` |
| High | `hsl(4 90% 58% / 0.12)` | `var(--color-danger)` |

All badges: `font-size: 12px`, `font-weight: 500`, `letter-spacing: 0.03em`, `border-radius: 6px`, `padding: 2px 8px`.

### Toast

- Background: `var(--bg-surface)` (white card)
- Border: `1px solid var(--border-default)`
- Left accent bar: `3px` — `var(--color-success)` for success, `var(--color-danger)` for error
- `border-radius: 10px`, `box-shadow: var(--shadow-card-hover)`
- Position: bottom-right

### Empty State Block

- Centered: icon (`48px`, `text-tertiary`) + heading + subtext + optional CTA
- Background: none — sits on the page background naturally

---

## 10. Spacing & Layout Grid

### Sidebar
- Width: `240px`
- Background: `var(--bg-surface)` (white)
- Right border: `1px solid var(--border-subtle)`
- Padding: `16px 12px`
- Nav item height: `40px`, `border-radius: 8px`, `padding: 0 12px`, `gap: 10px`

### Main Content
- Left offset: `240px`
- Top bar: `56px`
- Content padding: `24px 32px`
- Max content width: `1080px`

### Card Grid
- Gap: `16px`
- Auto-fit: `minmax(280px, 1fr)`

### Spacing Scale

```
4px  — xs  (icon gap, tight inline spacing)
8px  — sm  (badge padding, small gaps)
12px — md  (nav item padding)
16px — lg  (card gap, section gap)
20px — xl  (card inner padding top/bottom)
24px — 2xl (card inner padding left/right, content padding)
32px — 3xl (page content padding, large section gaps)
48px — 4xl (landing page section spacing)
64px — 5xl (hero vertical padding)
```

---

## 11. Icon System

- Library: `lucide-react`
- Default size: `20px` (nav), `16px` (inline), `24px` (feature cards)
- Default color: `var(--text-secondary)`
- Active/hover: `var(--color-info)` (Google Blue) or `var(--text-primary)`

| Nav Item | Icon |
|---|---|
| Dashboard | `LayoutDashboard` |
| Q&A | `MessageSquare` |
| Workspace | `GitPullRequest` |
| Billing | `CreditCard` |
| + Create Project | `Plus` |
| Project in list | `FolderGit2` |

| Action | Icon |
|---|---|
| Archive | `Archive` |
| Invite | `UserPlus` |
| Ask / AI | `Sparkles` |
| GitHub link | `ExternalLink` |
| Commit | `GitCommit` |
| Copy | `Copy` |
| Close modal | `X` |
| Theme toggle (light) | `Sun` |
| Theme toggle (dark) | `Moon` |

---

## 12. States

| State | Treatment |
|---|---|
| **Empty** | Empty state block (icon + heading + subtext + optional CTA) |
| **Loading (general)** | Skeleton shimmer — `bg-inset` animated gradient on card/list shapes |
| **Loading (AI analysis)** | Pulsing label `"Analyzing…"` with `Loader2` spinner icon — `text-secondary` |
| **Success** | White toast, green left border, success message |
| **Error** | White toast, red left border, or inline red text below input |
| **Disabled** | `opacity: 0.45`, `cursor: not-allowed` |
| **Focus** | `border-color: var(--color-info)` + `box-shadow: 0 0 0 3px hsl(217 91% 60% / 0.15)` |

---

## 13. Theme Toggle

- Icon button in the top bar: `Moon` (switch to dark) / `Sun` (switch to light)
- Library: `next-themes`
- Persistence: `localStorage`
- Default: `light`
- Swap: CSS custom properties transition smoothly via `transition: background-color 200ms, color 200ms` on `:root`

---

## 14. Landing Page Design System

> The Landing Page uses all tokens above plus the atmosphere effects from Section 8. Atmosphere effects (floating chips, periwinkle edge wash, typewriter cursor) are Landing Page only — never inside the authenticated dashboard.

### Top Navigation Bar

- Full-width, `background: var(--bg-surface)` (white), `border-bottom: 1px solid var(--border-subtle)`, `sticky top-0`
- Height: `64px`
- Logo left: GitPulse wordmark — "GitPulse" in `var(--text-primary)`, with a small multicolor logo mark
- Nav links: **Features / How it Works / Pricing / Sign In** — `text-secondary`, hover `text-primary`, `font-weight: 400`
- CTA button right: "Get Started" — primary dark pill button

### Hero Section

- Background: `var(--bg-base)` (pale periwinkle) + subtle edge vignette wash at top
- Floating tool chips (see Section 8) arranged loosely in background
- Eyebrow: no badge — clean, just the heading
- H1: `3.5rem`, weight `500`, `var(--text-primary)` — plain dark text with a **typewriter animation** effect; the animated portion ends with a multicolor Google-spectrum cursor `|`
- Subheadline: `18px`, `var(--text-secondary)`, max-width `560px`, centered
- CTAs: Primary "Get Started Free" (dark pill) + Secondary "View on GitHub" (ghost pill) — side by side

### Feature Showcase Grid — 3 Cards

- 3-column grid (1-col mobile, 3-col desktop), `gap: 16px`
- Each card: white (`--bg-surface`), `border-radius: 16px`, `--shadow-card`
- Card top: a **dark black product block** (`card--dark`) acting as the card illustration — `border-radius: 12px`, height `~160px`, containing a simple centered icon or abstract element
- Card body: heading (`16px`, weight `500`) + description (`15px`, `text-secondary`)

1. **GitHub Repository Intelligence** — dark block with `GitBranch` icon
2. **Workspace: PR & Issue Intelligence** — dark block with `GitPullRequest` icon
3. **Credits & Billing** — dark block with `CreditCard` icon

### "How It Works" Section

- Section heading: `2rem`, weight `500`, centered
- 3 items in a row (horizontal on desktop, vertical on mobile)
- Each item: number label (`text-secondary`, `font-mono`, `"01"` `"02"` `"03"`) + icon + heading + body text
- No connector lines — clean vertical alignment with `gap: 32px`

### Pricing / Credits Teaser

- Simple centered block on `--bg-inset` background section
- Heading: "Simple, pay-as-you-go pricing"
- Credit bundle highlight: inside a white card — "100 Credits · $2.00" in `text-primary`, body explanation in `text-secondary`
- CTA: "Sign Up and Get 150 Free Credits" — dark pill button

### Footer

- Background: `var(--bg-base)` (same as page bg), `border-top: 1px solid var(--border-subtle)`
- Large wordmark **"GitPulse"** in `var(--text-primary)` at heavy weight — as a typographic footer anchor (mirrors the "Antigravity" giant wordmark seen on the real site's footer)
- Link columns: **Product** / **Resources** / **Google** sections
- Bottom bar: `© 2025 GitPulse · Privacy · Terms`

---

*This document is complete. It does not change after Step 1.*
