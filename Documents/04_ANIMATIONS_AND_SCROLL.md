# 04 — Animations & Scroll

> **Document Status:** Living document — intentionally incomplete at this stage.
> Last meaningful update: **Phase 1 planning.**
>
> This document captures animation *intentions* that can be described without a real codebase — general micro-interaction philosophy, transition timing conventions, and entrance/exit patterns drawn from `02_UI_DESIGN_SYSTEM.md`.
>
> Page-specific and Workspace-specific animation behavior (skeleton states, tab-switch transitions, modal open/close, loading badges, list scroll behavior) are marked **"To be completed after tutorial implementation."** — these are filled in during Phase 2 (for existing pages) and Phase 5 (for the Workspace module, only once it exists).

---

## 1. Animation Philosophy

GitPulse's motion language is **purposeful and restrained**. Animation exists to:
- Communicate state changes (loading → loaded, empty → populated, action → success/error).
- Provide spatial orientation (which direction did content enter from? What triggered a modal?).
- Add perceived polish without distracting from the developer's primary task.

**What animation is not for:** decoration, novelty, or filling visual space. Every animated element must earn its motion.

### Core Principles

1. **Subtlety over drama.** Durations are short (`150–300ms`). Nothing slides further than `8–12px`. Nothing scales more than `4%`.
2. **Easing is semantic.** Enter with `decelerate` (things arriving and settling). Exit with `accelerate` (things leaving quickly). Spring easing only for modals (feels organic, not robotic).
3. **Stagger sparingly.** List stagger animations are used only on first-mount of a list — not on data re-fetches or filter changes.
4. **Reduce motion by default — respect the user.** All animations must be gated by `prefers-reduced-motion`. When the user prefers reduced motion, skip transforms and use opacity-only fades at half duration.
5. **Atmosphere stays on the Landing Page.** The floating chip animations, glow orb drifts, and grid textures from the hero section are strictly Landing Page effects. They do not exist inside the authenticated dashboard.

---

## 2. Timing & Easing Reference

> Defined as CSS custom properties — the canonical source is `02_UI_DESIGN_SYSTEM.md` Section 8. This section is a quick reference for animation authoring.

```css
/* Durations */
--duration-fast:   150ms;   /* Hover states, icon swaps */
--duration-base:   200ms;   /* Most micro-interactions */
--duration-slow:   300ms;   /* Page transitions, list entrances */

/* Easing functions */
--ease-standard:   cubic-bezier(0.4, 0, 0.2, 1);   /* Default — hover, focus */
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);      /* Enter — content arriving */
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);      /* Exit  — content leaving */
--ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1); /* Modal open — slight overshoot */
```

---

## 3. Global Micro-Interaction Patterns

These patterns apply universally across all pages and components. They do not require page-specific knowledge.

### 3.1 Interactive Element Hover / Focus / Press

**All buttons:**
```css
transition: transform var(--duration-base) var(--ease-standard),
            box-shadow var(--duration-base) var(--ease-standard),
            opacity var(--duration-fast) var(--ease-standard);

/* Hover */
transform: translateY(-1px);
box-shadow: 0 4px 20px hsl(240 85% 65% / 0.3); /* primary only */

/* Active / Press */
transform: translateY(0);
```

**All cards:**
```css
transition: border-color var(--duration-base) var(--ease-standard),
            box-shadow var(--duration-base) var(--ease-standard);

/* Hover */
border-color: hsl(240, 50%, 40%);
box-shadow: 0 0 0 1px hsl(240 50% 40% / 0.3),
            0 8px 32px hsl(240 85% 65% / 0.08);
```

**Links and text actions:**
```css
transition: opacity var(--duration-fast) var(--ease-standard),
            color var(--duration-fast) var(--ease-standard);
/* Hover: opacity 0.8 or color → --text-primary */
```

**Sidebar nav items:**
```css
transition: background var(--duration-fast) var(--ease-standard),
            color var(--duration-fast) var(--ease-standard);
/* Active state: gradient pill background sweeps in */
```

**Focus rings (inputs, buttons, links):**
```css
outline: 2px solid var(--accent-blue);
outline-offset: 2px;
transition: outline-color var(--duration-fast) var(--ease-standard);
```

### 3.2 Modal / Dialog — Open & Close

**Open:**
```css
/* Backdrop */
animation: backdropIn var(--duration-base) var(--ease-decelerate) forwards;
@keyframes backdropIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* Panel */
animation: modalIn 250ms var(--ease-spring) forwards;
@keyframes modalIn {
  from { opacity: 0; transform: scale(0.96) translateY(4px); }
  to   { opacity: 1; transform: scale(1)    translateY(0);   }
}
```

**Close:**
```css
/* Panel */
animation: modalOut var(--duration-fast) var(--ease-accelerate) forwards;
@keyframes modalOut {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.96); }
}
```

### 3.3 Toast Notifications

```css
/* Enter (from bottom-right) */
animation: toastIn var(--duration-slow) var(--ease-spring) forwards;
@keyframes toastIn {
  from { opacity: 0; transform: translateX(16px) translateY(8px); }
  to   { opacity: 1; transform: translateX(0)    translateY(0);   }
}

/* Exit */
animation: toastOut var(--duration-base) var(--ease-accelerate) forwards;
@keyframes toastOut {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(16px); }
}
```

### 3.4 Dropdown / Popover

```css
animation: dropdownIn var(--duration-fast) var(--ease-decelerate) forwards;
transform-origin: top center;
@keyframes dropdownIn {
  from { opacity: 0; transform: scaleY(0.95); }
  to   { opacity: 1; transform: scaleY(1);    }
}
```

### 3.5 List Item Entrance (First Mount Only)

When a list loads for the first time (not on re-fetch), items stagger in:

```css
/* Each item, delay = index × 20ms, max 10 items staggered */
animation: listItemIn var(--duration-slow) var(--ease-decelerate) forwards;
animation-delay: calc(var(--item-index) * 20ms);
opacity: 0; /* initial */

@keyframes listItemIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0);    }
}
```

### 3.6 Page Transition

```css
/* On route change, new page content enters */
animation: pageIn var(--duration-slow) var(--ease-decelerate) forwards;
@keyframes pageIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0);   }
}
```

### 3.7 Skeleton Shimmer (Loading State)

```css
/* Applied to skeleton placeholder shapes */
background: linear-gradient(
  90deg,
  var(--bg-elevated) 0%,
  var(--bg-overlay)  50%,
  var(--bg-elevated) 100%
);
background-size: 200% 100%;
animation: shimmer 1.5s var(--ease-standard) infinite;

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

---

## 4. `prefers-reduced-motion` Rule

All animations must be wrapped or overridden by:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

For opacity-only fades (acceptable even with reduced motion), use a separate class or property rather than relying on the blanket reset — e.g. short `opacity` transitions at `100ms` are acceptable even under reduced-motion.

---

## 5. Landing Page — Atmosphere Animations

> These effects are **Landing Page only**. They do not exist inside the authenticated application.

### 5.1 Floating Tool / Icon Chips

Small pill-shaped chips containing developer-tool icons (terminal, code bracket, git branch, sparkles, etc.) drift slowly across the hero background.

```css
@keyframes chipDrift {
  0%   { transform: translate(0,     0)    rotate(0deg);   opacity: 0.2; }
  50%  { transform: translate(12px, -18px) rotate(3deg);   opacity: 0.35; }
  100% { transform: translate(0,     0)    rotate(0deg);   opacity: 0.2; }
}

.chip {
  animation: chipDrift linear infinite;
  /* Each chip: unique duration 20s–40s, unique delay 0s–15s */
}
```

Chips are non-interactive (`pointer-events: none`), `z-index` behind hero content.

### 5.2 Gradient Glow Orbs

Two or three large, blurred radial gradient circles positioned behind the hero headline.

```css
.orb-blue {
  width: 700px; height: 700px;
  background: radial-gradient(circle, hsl(213 94% 60% / 0.18) 0%, transparent 70%);
  filter: blur(80px);
  position: absolute;
  top: -200px; left: -150px;
  pointer-events: none;
}

.orb-violet {
  width: 600px; height: 600px;
  background: radial-gradient(circle, hsl(270 80% 62% / 0.14) 0%, transparent 70%);
  filter: blur(100px);
  position: absolute;
  top: 50px; right: -100px;
  pointer-events: none;
}
```

Optionally: a very slow drift keyframe (`30–60s cycle`, `≤ 30px` travel) to make orbs feel alive.

### 5.3 Dot-Grid Texture

```css
.hero-grid {
  background-image: radial-gradient(
    circle,
    hsl(210 20% 60% / 0.06) 1px,
    transparent 1px
  );
  background-size: 28px 28px;
  position: absolute;
  inset: 0;
  pointer-events: none;
}
```

### 5.4 Parallax Scroll (Optional Enhancement)

Glow orbs shift at ~25% of the user's scroll distance:

```js
// Implemented as a lightweight scroll listener in a client component
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  orbBlue.style.transform  = `translateY(${y * 0.25}px)`;
  orbViolet.style.transform = `translateY(${y * 0.2}px)`;
}, { passive: true });
```

Apply only when `!prefersReducedMotion`. Use `requestAnimationFrame` for performance.

---

## 6. Page-Specific & Component-Specific Animations

> **To be completed after tutorial implementation.**

The following topics cannot be correctly specified until the real codebase exists. They will be documented in Step 3 by reviewing the actual components, page structure, and data-loading patterns in the implemented application.

### 6.1 Dashboard
- Commit feed scroll behavior and virtual scrolling (if any)
- Commit card entrance animation (stagger vs. immediate)
- AI summary expand/collapse animation
- Project-switching transition (sidebar click → content swap)

### 6.2 Q&A
- Textarea submit — button loading state animation
- Answer streaming animation (if Gemini streams token-by-token)
- Saved question list entrance and expand behavior
- Answer reveal (typing effect vs. fade-in vs. instant)

### 6.3 Billing
- Slider animation (credit/price display updating on drag)
- Credit purchase loading → success → credit balance update animation
- Transaction history list entrance

### 6.4 Create / Link Repository
- Form validation feedback animation (field error shake or border pulse)
- Indexing progress state (progress bar, spinner, step indicators)
- Post-creation redirect transition

### 6.5 Workspace (Pull Requests & Issues tab)
> **To be completed after tutorial implementation (Phase 5).** The Workspace module does not exist yet. Animations for tab switching, PR/Issue list loading, detail modal open/close, AI analysis loading badges, and skeleton states will be defined once the module is implemented, derived from patterns already established in the existing application.

---

## 7. Performance Notes

- **Never animate `width`, `height`, `top`, `left`, `margin`, or `padding`** — these trigger layout. Animate `transform` and `opacity` only.
- **Use `will-change: transform` sparingly** — only on elements that animate on every frame (parallax orbs, drifting chips). Remove after animation completes where possible.
- **Prefer CSS animations over JS animations** for anything that doesn't require scroll-driven or interactive values.
- **Stagger cap:** Do not stagger more than 10 items. Items beyond index 10 should appear immediately or with the same delay as item 10.
- **`passive: true`** on all scroll listeners.

---

*Next update: Phase 2 — after tutorial implementation is complete. Section 6 sub-sections will be filled in from the real codebase. Phase 5 will add the Workspace animation spec.*
