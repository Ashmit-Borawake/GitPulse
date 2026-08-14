# Master Prompt for Antigravity — "GitPulse" Project Planning Docs

Paste everything below into Antigravity. Attach the 8 UI screenshots (Dashboard, Q&A, Billing, Link GitHub Repo, project-linked Dashboard, plus the original card-list/modal screenshots) alongside this prompt — they are referenced throughout as the visual source of truth for structure. **Ignore anything in those screenshots specific to Meetings** (the Meetings nav item, meeting upload cards, meeting detail modal) — that module no longer exists in this product; treat those screenshots only as a reference for general card/list/modal styling patterns, not literal content to replicate.

---

## ROLE

You are acting as a senior full-stack architect. Before writing any application code, produce **4 markdown planning documents** that will act as the single source of truth for building this project section by section in later sessions. Do not generate app code yet — only the 4 docs described below. Ask me clarifying questions first if anything is ambiguous; otherwise state your assumption inline in the doc and move on.

---

## PROJECT CONTEXT

I am building a clone/adaptation of the "GitPulse" project taught in this tutorial: *"Build and Deploy Full Stack AI GitHub SaaS"* (Next.js 15, Google Gemini AI, Stripe). I am following the tutorial loosely for structure but want the docs written for **my own product scope and stack choices below** — this product is now a **focused, GitHub-only developer intelligence platform**, not a general meeting/PM tool.

**Reference material (also attached/linked):**
- Original hackathon version of this project for feature/concept reference only: https://github.com/Elliott-Chong/gitpulses — read its README for general feature framing (automatic code documentation, codebase search, commit summaries) and its architecture diagram for conceptual understanding of the RAG pipeline only. **Do not copy its roadmap, its meeting-transcription features, or its tech choices** — that version used a Python microservice, Cohere, Weaviate/Pinecone, and Docker/Vercel split-deployment; we are **not** doing any of that, and we are **not** building any meeting-related functionality at all. Wherever it says Cohere, treat it as **Google Gemini** in our version. Our version is a single Next.js monolith with tRPC, not a microservice split.
- The product-UI screenshots — use only for **general structural patterns** (sidebar layout, card placement, modal structure, list styling) — not literal content. Anything meeting-specific in them is void.
- https://antigravity.google — this defines the **visual skin/theme**: dark, futuristic, "agent-first" Google DevTools aesthetic. Use this for (a) the Landing Page, and (b) reskinning the core app UI's colors/typography/surface treatment, on top of a sidebar+card structural pattern inspired by the screenshots.

### What the product does
A **focused, AI-powered GitHub developer intelligence platform** — not a general project-management or collaboration tool. Every core feature revolves around repositories, commits, pull requests, issues, and AI-powered code understanding. Three pillars:

1. **GitHub Repository Intelligence**
   - Connect GitHub repositories (public via URL, private via optional personal access token)
   - Index repository files for RAG
   - Generate AI summaries of commits
   - RAG-powered repository Q&A with saved question/answer history
   - Semantic code search
   - Repository overview dashboard

2. **Workspace (Pull Requests + Issues)** — replaces any notion of a "Meetings" module entirely. This is a **future module**, built last (see Development Workflow, Step 5). Conceptually:
   - **Pull Request Intelligence:** fetch PRs via the GitHub API; AI-generated summary of each PR explaining what changed, which modules are affected, and flagging potential breaking changes or risky files; show changed files, PR status (Open/Closed/Merged), and a link back to the PR on GitHub.
   - **Issue Intelligence:** fetch repository issues; AI-generated summary explaining technical context; detect duplicate/similar issues; suggest labels; predict priority (Low/Medium/High); recommend likely affected modules; link back to the issue on GitHub.
   - The Workspace should feel like an **AI-powered GitHub companion**, not a generic project-management tool. No documentation generation, architecture visualization, or unrelated productivity features in v1.

3. **Credits & Billing**
   - Credits are consumed for: repository indexing (1 credit per supported source file), AI analysis of a Pull Request, AI analysis of an Issue (both configurable/flat costs — flag exact numbers as assumptions if unspecified)
   - Users buy more credits via Stripe (one-time top-ups, e.g. "Buy 100 Credits for $2.00")
   - No meeting-related credit costs exist in this product

**Hard rule:** the product should feel like a focused AI-powered GitHub developer platform. Do not introduce unrelated collaboration features (no meetings, no chat, no generic task boards). Every feature must directly improve the GitHub development workflow.

### Tech stack (must be used exactly)
- **Framework:** Next.js 15, App Router only
- **Language:** JavaScript only (strict JSX) — **no TypeScript anywhere**
- **Styling:** Tailwind CSS v4
- **API layer:** tRPC
- **Auth:** Clerk
- **ORM:** Prisma
- **Database:** PostgreSQL + `pgvector` extension (single database, no separate vector DB service)
- **AI / RAG:** LangChain + Google Gemini for embeddings & generation
- **GitHub data:** GitHub REST/GraphQL API (via Octokit)
- **Payments:** Stripe (one-time credit top-ups)
- **Version control:** Git/GitHub
- **Package manager:** pnpm

**Not part of this product's feature set — do not reference these anywhere in the docs, and do not implement them in code:** AssemblyAI, Firebase Storage, any audio/transcription libraries, or any Meeting-related functionality. These belonged only to the tutorial's Meetings module, which this product does not build.

### UI structural reference (patterns only, not literal meeting content)
1. Sidebar nav: **Dashboard, Q&A, Workspace, Billing**, then a "Your Projects" list of linked repos with colored avatar initials, then "+ Create Project"
2. "Link your GitHub Repository" form — project name, repo URL, optional GitHub token, a credit-cost warning banner, "Create Project" CTA
3. Billing page — credits remaining, an info banner explaining the credit-per-file rule, a slider, "Buy 100 Credits for $2.00" button, Transaction History list
4. Dashboard (project view) — "linked to [repo url]" banner, Invite/Archive buttons, an "Ask a question" card, and a commit feed below (avatar, author, commit message, "committed" link, relative timestamp)
5. Q&A page — question textarea, "Ask [Product]!" button, "Saved Questions" list below with avatar + question + AI answer preview + relative time
6. Workspace page (future) — two tabs, **Pull Requests** and **Issues**, each rendering a card/list pattern styled like the Q&A saved-questions list: title, status/priority badge, AI summary preview, "View Details" and "Open on GitHub" actions; clicking a row opens a detail modal/dialog (styled like the general modal pattern from the reference screenshots) showing full AI summary, GitHub metadata, changed files (PRs) or labels/priority (Issues), and a link to GitHub. Treat this list as directional inspiration only — the exact implementation is finalized later, in Step 5.

---

## DEVELOPMENT WORKFLOW

This project is built in a specific order, and the 4 planning documents below are written to match that order — they are not all meant to be "finished" at the same time.

**Step 1 — Generate the 4 planning documents (this session).**
Produce `01_PROJECT_BLUEPRINT.md`, `02_UI_DESIGN_SYSTEM.md`, `03_PAGE_IMPLEMENTATION.md`, and `04_ANIMATIONS_AND_SCROLL.md`. They will sit in the codebase from the start, but only one of them — `02_UI_DESIGN_SYSTEM.md` — is meant to be complete and final right now. The other three (`01`, `03`, `04`) are intentionally generic/skeletal at this stage: they describe purpose, responsibilities, and direction, but defer anything that can only be correctly determined from a real, working codebase (exact routes, folder structure, component hierarchy, tRPC procedure names, Prisma models, database schema, dialogs, filenames, animations tied to specific screens, loading states, etc.). See "Document Maturity" below for exactly what each file should and should not contain.

**Step 2 — Tutorial implementation (outside Antigravity, by me).**
I will follow the YouTube tutorial as closely as practical to get a fully working application, using the approved tech stack above. The only intentional deviations from the tutorial:
- Remove every Meeting-related feature entirely.
- Do not implement AssemblyAI.
- Do not implement Firebase Storage.
- Replace the Meetings nav item with a simple **Workspace** placeholder page, so the app's navigation flow stays intact.
- Do **not** design or implement the real Workspace module yet — the placeholder is a stub only.
Do **not** use the 4 markdown files as the basis for implementation or modify them until I explicitly confirm that the tutorial implementation is complete. The AI may still reference them when necessary (for example, to verify or remove outdated references such as Meetings or AssemblyAI), but must not treat them as the source of truth until they have been updated to match the completed codebase.

**Step 3 — Documentation alignment (after Step 2 is complete).**
Once the tutorial implementation is done, I update `01_PROJECT_BLUEPRINT.md`, `03_PAGE_IMPLEMENTATION.md`, and `04_ANIMATIONS_AND_SCROLL.md` so they accurately describe the real, existing codebase — routes, folder structure, component hierarchy, tRPC procedures, Prisma schema, filenames, and animations as they actually exist. `02_UI_DESIGN_SYSTEM.md` is **not** touched in this step — it was already complete from Step 1. From this point on, all three updated documents become the real source of truth for the app as built.

**Step 4 — UI redesign (Antigravity visual system).**
I apply the premade `02_UI_DESIGN_SYSTEM.md` visual system to the now-documented, real application. This step changes appearance only — colors, typography, surfaces, motion — not functionality, routes, or data flow. Only the application built in Steps 2–3 is redesigned; nothing that doesn't exist yet (i.e. Workspace) is touched here.

**Step 5 — Workspace implementation (last).**
Only now is the real Workspace module designed and built — Pull Request Intelligence and Issue Intelligence, as described conceptually above. It must inherit the project's existing architecture, routing conventions, backend patterns (tRPC style, Prisma conventions), UI organization, naming conventions, auth flow, and the now-applied Antigravity design system, rather than introducing a parallel structure. The Workspace should feel like a natural extension of the completed, redesigned application — its exact routes, components, procedures, schema, and animations are derived from the real codebase at this point, not invented in advance.

**Step 6 — Final documentation pass.**
I update `01_PROJECT_BLUEPRINT.md`, `03_PAGE_IMPLEMENTATION.md`, and `04_ANIMATIONS_AND_SCROLL.md` one more time so they fully and accurately reflect the finished product, including the Workspace module. `02_UI_DESIGN_SYSTEM.md` remains as originally written throughout the entire process.

---

## DOCUMENT MATURITY

Each of the 4 files has a distinct role. Write them accordingly.

Whenever the application has not yet been implemented, the planning documents must avoid inventing implementation details. If a piece of information cannot yet be determined from the unfinished codebase, do not guess — mark that section explicitly as:

> **To be completed after tutorial implementation.**

This applies to routes, page hierarchy, folder structure, component hierarchy, dialog hierarchy, API endpoints, backend procedure names, Prisma models, database schema, filenames, and any other implementation detail. Those decisions must be derived later from the completed application, not assumed in advance.

### `01_PROJECT_BLUEPRINT.md` — Living document
Define product vision, approved tech stack, target user, feature list by pillar, high-level architecture (client → tRPC → Prisma/Postgres+pgvector, Gemini, GitHub API/Octokit, Stripe), and engineering philosophy. A draft Prisma schema and tRPC router map for the **already-scoped tutorial-based features** (User, Project, SourceCodeEmbedding, Commit, Question/SavedAnswer, StripeTransaction, UserCredits, and their core procedures) can be sketched now as a working starting point, since these map closely to the tutorial. Anything specific to the **Workspace module** (its Prisma models, its router/procedure names, its exact schema) must be marked clearly as **"To be completed after tutorial implementation."** rather than locked in now. This document should not freeze implementation details before the project exists — wherever something truly depends on the completed codebase, use that same marker instead of guessing.

### `02_UI_DESIGN_SYSTEM.md` — Complete, final, from the start
This is the **only** document that is fully finished right now and stays that way. Do not insert placeholders, do not treat it as a living document, do not postpone any part of it. Importantly, it does not describe the temporary tutorial UI that Step 2 will produce — it describes the **desired final visual system**: the finished Antigravity-inspired visual specification — dark theme, accent gradient system, semantic colors, surface treatment, typography, motion/atmosphere cues, component inventory with shadcn/ui mappings, spacing/layout grid, icon system, states, theme toggle, and the full Landing Page system — that will later be applied wholesale to the completed, real application in Step 4. It serves as the visual *target* for the redesign phase, not documentation of whatever the raw tutorial UI happens to look like. State upfront in the doc: "**Structural patterns** are inspired by the reference screenshots (sidebar layout, card placement, modal structure, list hierarchy) — meeting-specific content from those screenshots is void. **Visual skin** comes from antigravity.google."

Cover:
- **Theme base:** dark mode default — near-black/deep charcoal background (not pure #000), off-white/light-gray primary text, muted-gray secondary/tertiary text
- **Accent system:** a signature gradient accent (blue → purple/violet, "liftoff" feel) used sparingly for primary CTAs, active nav state, focus rings, and glow effects — not flooding every surface
- **Semantic colors:** green for success/credits-added, amber/orange for warnings and "Medium" priority / in-progress states, red for destructive actions and "High" priority, blue/gray for "Low" priority and neutral status badges
- **Surface treatment:** subtle glassmorphism / soft-bordered cards (low-opacity border, faint inner glow on hover)
- **Typography:** bold, large, tight-tracking display font for hero/section headings, clean sans-serif for body/UI text, monospace accents for code/commit-hash/diff snippets
- **Motion/atmosphere cues from antigravity.google:** floating tool/icon chips drifting in hero backgrounds, soft gradient glow orbs, subtle grid or particle texture behind hero sections — Landing Page only, not inside the dashboard app
- Component inventory with shadcn/ui mappings (dark-theme variants): Sidebar nav item (icon + label, active state = gradient-accent pill/glow), top search bar, avatar, Card (glass surface), Button (primary = gradient-filled pill, secondary = outline/ghost), **Status Badge** (Open/Closed/Merged for PRs; Low/Medium/High for Issue priority), Tabs (for the Workspace's Pull Requests / Issues switch), Modal/Dialog (dark surface, backdrop blur, used for PR Detail and Issue Detail), Textarea, Input, Slider, Toast, empty-state illustration block
- Spacing/layout grid: fixed-width left sidebar + main content structure, consistent card padding/gap
- Icon set (lucide-react) mapped to each nav item and card, monochrome with accent-color highlight on active/hover
- States to design for: empty, loading (e.g. "Analyzing PR…"), success toast, error
- **Theme toggle:** dark is default; ship a light/dark toggle in the top bar/sidebar with both palettes fully specified as design tokens (CSS variables). Persist via `next-themes` + local storage.
- **Landing Page–specific system:** top nav — **Features / How it Works / Pricing / Sign In** — full-bleed dark hero with headline + subheadline + primary/secondary CTA buttons, feature showcase grid (3 cards: GitHub Repository Intelligence, Workspace/PR & Issue Intelligence, Credits & Billing), a "how it works" section, pricing/credits teaser linking to sign-up, footer with grouped link columns. No meeting-related copy anywhere on the landing page.

### `03_PAGE_IMPLEMENTATION.md` — Living document, intentionally incomplete at first
At this stage, before the tutorial implementation exists, document only:
- Major application areas (e.g. Landing Page, Auth, Dashboard, Q&A, Billing, Workspace)
- The responsibility of each area (what it's for, not how it's built)
- Navigation concepts (the sidebar groupings described above)
- Implementation notes and open questions
- Sections marked **"To be completed after tutorial implementation."** wherever a decision depends on the real codebase, so the doc clearly shows what's settled versus what's pending

Do **not** yet define: route paths, page hierarchy, folder structure, component hierarchy, dialog hierarchy, backend procedure names, API endpoints, Prisma models, database schema, or filenames. Those must be derived from the real, completed codebase in Step 3 (for the tutorial-based app) and Step 6 (for Workspace) — not invented ahead of time.

### `04_ANIMATIONS_AND_SCROLL.md` — Living document, intentionally incomplete at first
Document only animation *intentions* that can reasonably be described without a real codebase — general micro-interaction philosophy (hover/press states, transition timing/easing conventions, entrance/exit patterns) drawn from the `02_UI_DESIGN_SYSTEM.md` motion language. Do not tie any of it to specific pages, components, or the Workspace module yet. Mark page-specific and Workspace-specific animation/scroll behavior (skeleton states, tab-switch transitions, modal open/close, loading badges, list scroll behavior) as **"To be completed after tutorial implementation."** — these get filled in during Step 3 (for existing pages) and Step 6 (for Workspace, only once it exists).

---

## WORKSPACE (Concept Only)

Workspace is intentionally a future feature, built last (Step 5). At this planning stage, describe it only conceptually — its purpose and responsibilities, not its implementation.

It is a GitHub-focused AI companion covering:
- AI summaries of Pull Requests
- Explaining code changes
- Detecting potential breaking changes
- Highlighting risky files
- Summarizing GitHub Issues
- Explaining technical context
- Detecting duplicate/similar issues
- Suggesting labels
- Predicting issue priority
- Recommending affected modules

**Do NOT define yet, anywhere in the 4 docs:**
- Route names
- Folder structure
- Component hierarchy
- tRPC procedure names
- Prisma models
- Database schema
- Dialogs
- Animations
- Loading states
- UI hierarchy
- File names
- API endpoints

All of the above must be derived later, in Step 5/Step 6, from the completed application. The Workspace module must never introduce a separate architecture — when it is eventually implemented, it inherits the existing application's conventions, including but not limited to:
- routing conventions
- folder organization / project structure
- naming conventions
- backend architecture
- API organization
- authentication flow
- authorization flow
- state management
- UI component patterns
- styling conventions
- error handling
- loading states
- data fetching patterns
- validation strategy

The completed application should naturally determine these implementation details. The planning documents must not attempt to predict or define them before the tutorial implementation has been completed. Workspace should feel like a native extension of the existing application rather than a separately designed module.

The Workspace must be implemented using the same architectural patterns established by the completed application, even if those patterns differ from assumptions made during planning.

---

## PROCESS INSTRUCTIONS

- Work through the docs in order; don't start `03` until `01` and `02` are settled.
- Where exact values are unspecified for the tutorial-scoped features (e.g. credit costs per PR/Issue analysis, exact Stripe price IDs), state a reasonable default and flag it as `<!-- ASSUMPTION: ... -->`. Vector store is settled — always pgvector, not a topic to re-flag.
- Before writing anything, scan every reference screenshot and the original README and **strip out anything meeting-related** — it must not surface anywhere in the 4 docs (no Meeting model, no meeting nav item, no meeting credit cost, no AssemblyAI/Firebase mention).
- Keep all 4 files as living documents I will hand back to you section-by-section as each development step (above) is completed — except `02_UI_DESIGN_SYSTEM.md`, which is written once, now, and stays final.
- **The implementation always has higher priority than the planning documents.** The documents exist to accurately describe the implementation — not to force the implementation to match assumptions made before the application existed. Whenever the implementation and a document disagree, update the document to match the implementation, unless I'm explicitly asking for an intentional architectural change.

---

**Questions for you before I proceed** (only if truly blocking — otherwise assume and flag):
1. Anything else?
