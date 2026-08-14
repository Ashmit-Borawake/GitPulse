# 03 — Page Implementation

> **Document Status:** Living document — intentionally incomplete at this stage.
> Last meaningful update: **Phase 1 planning.**
>
> Sections marked **"To be completed after tutorial implementation."** will be filled in during Phase 2 (for tutorial-based pages) and Phase 5 (for the Workspace module). Do not invent implementation details before the codebase exists.

---

## Overview

GitPulse's application is divided into two major surface areas:

1. **Public / Marketing surface** — Landing Page and auth flows, accessible without signing in.
2. **Authenticated application** — All product functionality, protected by Clerk, organized under a persistent sidebar-driven shell.

---

## Application Areas

### 1. Landing Page

**Responsibility:** Marketing and acquisition. Communicates the product's value proposition, explains the three feature pillars, outlines the credit system, and funnels visitors to sign up.

**Key sections (see `02_UI_DESIGN_SYSTEM.md` Section 14 for visual spec):**
- Sticky top navigation: Features / How it Works / Pricing / Sign In + "Get Started" CTA
- Full-bleed hero: headline, subheadline, primary + secondary CTAs, atmosphere background effects
- Feature showcase grid: GitHub Repository Intelligence, Workspace (PR & Issue Intelligence), Credits & Billing
- "How it Works" 3-step flow
- Pricing / Credits teaser + sign-up CTA
- Footer with grouped link columns

**No meeting-related copy anywhere on this page.**

**Navigation concepts:** Clicking "Sign In" or "Get Started" routes the user into Clerk's auth flow. After authentication, the user lands in the authenticated application.

> Route paths and folder structure: **To be completed after tutorial implementation (Phase 2).**

---

### 2. Auth

**Responsibility:** Handled entirely by Clerk. GitPulse does not own auth UI — sign-in and sign-up are Clerk-hosted or Clerk-component pages.

**Post-auth behavior:**
- New users: receive starting credits (see `01_PROJECT_BLUEPRINT.md`, Open Assumptions #1); land on the Dashboard or a "Create your first project" prompt.
- Returning users: land on the Dashboard for their last active project, or a project list if no project is selected.

> Exact redirect routes, Clerk configuration, and middleware: **To be completed after tutorial implementation (Phase 2).**

---

### 3. Dashboard (Project View)

**Responsibility:** The primary day-to-day view for a linked repository. Surfaces the most recent activity and provides the entry point for core interactions.

**Key responsibilities:**
- Display which GitHub repository this project is linked to (repo URL banner).
- Surface project management actions: Invite collaborators, Archive project.
- Provide an "Ask a question" entry point that routes to Q&A (or opens an inline prompt).
- Display a commit feed: avatar, author name, commit message, "View on GitHub" link, relative timestamp, and the AI-generated commit summary.

**Navigation concepts:**
- Accessible from the sidebar under the project name.
- Each project in the sidebar "Your Projects" list navigates to that project's Dashboard.

> Route paths, page hierarchy, folder structure, component hierarchy, exact commit feed implementation, and dialog hierarchy: **To be completed after tutorial implementation.**

---

### 4. Q&A

**Responsibility:** The core RAG interaction surface. Users ask natural-language questions about the codebase and receive AI-generated answers grounded in indexed source files. All previous Q&A pairs for the project are listed below the input.

**Key responsibilities:**
- A question textarea with a primary "Ask GitPulse!" CTA.
- Submit triggers the `qa.askQuestion` tRPC mutation: embed → pgvector search → Gemini generation → save.
- Saved Questions list below: avatar, question text, AI answer preview, relative timestamp. Clicking a saved question expands the full answer (modal or inline expand — TBD).
- Credit deduction handling: surface an error if the user has insufficient credits.

**Navigation concepts:**
- Accessible from the sidebar "Q&A" nav item, scoped to the currently active project.

> Route paths, component hierarchy, exact answer-expansion pattern (modal vs. inline), file-reference display: **To be completed after tutorial implementation.**

---

### 5. Billing

**Responsibility:** Credit balance management and payment. Users see their current credits, understand how they are spent, purchase more, and review transaction history.

**Key responsibilities:**
- Credits remaining display (prominent, top of page).
- Informational banner explaining the credit-per-file indexing rule and any other credit costs.
- Credit purchase UI: a slider or bundle selector showing cost → credit amount; "Buy X Credits for $Y" primary CTA.
- Stripe checkout: triggered by the purchase CTA, handled via a tRPC mutation → Stripe Payment Intent or Checkout Session → redirect or embedded modal.
- Transaction History list: date, credit amount added, dollar amount, payment status.

**Navigation concepts:**
- Accessible from the sidebar "Billing" nav item.
- Not project-scoped — applies to the user's account across all projects.

> Route paths, Stripe implementation specifics (Payment Intent vs. Checkout Session), slider vs. bundle UI, webhook route structure: **To be completed after tutorial implementation.**

---

### 6. Create / Link Repository

**Responsibility:** Onboarding a new GitHub repository into GitPulse. This is the primary onboarding step for new users and for users adding additional projects.

**Key responsibilities:**
- Form fields: Project name (display name), GitHub Repository URL, optional GitHub Personal Access Token (for private repos).
- Credit-cost warning banner: show how many credits indexing will cost based on the repo's estimated file count (or a static warning if file count is unknown pre-index).
- "Create Project" primary CTA: submits the form, triggers the `project.create` tRPC mutation, which starts the indexing job in the background.
- Validation: URL format, required fields, token format (optional).
- Feedback: loading state during creation, success redirect to the new project's Dashboard, error handling for invalid repos or insufficient credits.

**Navigation concepts:**
- Triggered from the "+ Create Project" sidebar item.

> Route paths, folder structure, form component hierarchy, background job handling (queue vs. inline async): **To be completed after tutorial implementation.**

---

### 7. Workspace (Stub → Phase 4 Module)

**Responsibility:** During Phase 1 (tutorial implementation), this is a **stub placeholder page only** — a simple page with the correct sidebar nav item rendering and a “Coming Soon” state. The real Workspace module (Pull Request Intelligence + Issue Intelligence) is designed and built in Phase 4.

**Concept (for planning purposes only):**

The Workspace is an AI-powered GitHub companion. It is organized into two tabs: **Pull Requests** and **Issues**.

- **Pull Requests tab:** Lists PRs fetched from the GitHub API for the active project. Each row shows: PR title, status badge (Open / Closed / Merged), author, relative date, AI summary preview, “View Details” and “Open on GitHub” actions. Clicking a row opens a detail modal with full AI summary, changed files list, module-impact notes, breaking-change flags, and a link to GitHub.

- **Issues tab:** Lists GitHub Issues for the active project. Each row shows: issue title, priority badge (Low / Medium / High, AI-predicted), status, AI summary preview, “View Details” and “Open on GitHub” actions. Detail modal shows full AI summary, detected duplicates, suggested labels, priority reasoning, affected-module recommendation, and a link to GitHub.

- **Search & Filtering:** Semantic search bar + filter controls (state, priority, author, label) scoped to the active project’s PRs or Issues.

**Hard rule for planning docs:** Do not define route names, folder structure, component hierarchy, tRPC procedures, Prisma models, database schema, dialogs, animations, loading states, file names, or any implementation detail for the Workspace module. All of these are derived from the completed codebase in Phase 4/5.

---

## Sidebar Navigation Structure

The persistent sidebar — visible in all authenticated views — contains:

```
┌─────────────────────────────┐
│  [GitPulse Logo]            │
├─────────────────────────────┤
│  LayoutDashboard  Dashboard │
│  MessageSquare    Q&A       │
│  GitPullRequest   Workspace │
│  CreditCard       Billing   │
├─────────────────────────────┤
│  YOUR PROJECTS              │
│  [Avatar] Project A         │
│  [Avatar] Project B         │
│  [Avatar] Project C         │
├─────────────────────────────┤
│  Plus  + Create Project     │
└─────────────────────────────┘
```

- Active nav item: gradient-accent pill background + left-edge accent bar + accent-colored icon (see `02_UI_DESIGN_SYSTEM.md` Section 9).
- Project list items: colored avatar with initials (deterministic HSL from project name) + project display name.
- Clicking a project in the list switches the active project context for Dashboard, Q&A, and Workspace.

> Sidebar component location, project context state management (global store, URL param, or cookie), and project-switching behavior: **To be completed after tutorial implementation (Phase 2).**

---

## Open Questions & Implementation Notes

1. **Project context:** How is the "active project" persisted between navigations — via URL param (e.g. `/dashboard?projectId=...`), a route segment (e.g. `/dashboard/[projectId]`), or a client-side global store? This determines the entire routing structure. **To be completed after tutorial implementation.**

2. **Indexing job:** Is repository indexing handled inline (async within the tRPC mutation, blocking the response) or via a background queue? This affects loading state design. **To be completed after tutorial implementation.**

3. **Q&A answer expansion:** Does clicking a saved question open a modal (like the reference screenshots suggest) or expand inline? **To be completed after tutorial implementation.**

4. **Stripe integration:** Payment Intent (embedded) vs. Checkout Session (redirect)? **To be completed after tutorial implementation.** <!-- ASSUMPTION: Checkout Session redirect is simpler and assumed for the tutorial path. -->

5. **Workspace stub page:** The stub must be in place after Phase 1 so the sidebar nav item renders without errors. Its exact form (empty state component, "Coming Soon" copy) is a minor implementation detail left to the tutorial step.

---

*Next update: Phase 2 — after tutorial implementation is complete. Sections marked “To be completed” will be filled in with real routes, file paths, component hierarchy, and implementation specifics derived from the actual codebase. Phase 5 will add the Workspace page spec.*
