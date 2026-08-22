# GitPulse — Project Structure Reference

> **Document status:** Current state as of the Gemini API Key Rotation implementation.
> This document describes what **actually exists** in the repository right now.
> It will need to be updated when new phases (Q&A chat interface, dashboard expansions, etc.) are implemented.

---

## Table of Contents

1. [Folder Tree](#1-folder-tree)
2. [Folder Responsibilities](#2-folder-responsibilities)
3. [Important Files](#3-important-files)
4. [Architecture Overview](#4-architecture-overview)
5. [Technology Stack](#5-technology-stack)
6. [UI Architecture](#6-ui-architecture)
7. [Authentication — Current Status](#7-authentication--current-status)
8. [Database — Current Status](#8-database--current-status)
9. [Configuration Files](#9-configuration-files)
10. [Environment Variables](#10-environment-variables)
11. [Planned Next Steps](#11-planned-next-steps)

---

## 1. Folder Tree

The following tree reflects the **actual repository contents** at this point in development.
Generated files (`.next/`, `node_modules/`, `tsconfig.tsbuildinfo`) are omitted for clarity.

```text
GitPulse/                          ← Monorepo root
│
├── Documents/                     ← Project documentation (not deployed)
│   ├── 01_PROJECT_BLUEPRINT.md
│   ├── 02_UI_DESIGN_SYSTEM.md
│   ├── 03_PAGE_IMPLEMENTATION.md
│   ├── 04_ANIMATIONS_AND_SCROLL.md
│   ├── BETTER_AUTH_FLOW.md
│   ├── GeminiKeyRoation.md        ← Gemini API key rotation design & implementation plan
│   ├── GITPULSE_PROJECT_STRUCTURE.md
│   └── PROJECT_SUMMARY.md         ← High-level project overview & viva Q&A
│
├── README.md                      ← Root-level placeholder README
│
└── gitpulse/                      ← Next.js application root
    │
    ├── prisma/
    │   └── schema.prisma          ← Prisma schema (PostgreSQL with auth, Project, Commit, and vector embeddings)
    │
    ├── public/
    │   └── favicon.ico
    │
    ├── src/
    │   ├── env.js                 ← Validated environment variable schema
    │   │
    │   ├── app/                   ← Next.js App Router
    │   │   ├── layout.tsx         ← Root layout (fonts, providers)
    │   │   ├── page.tsx           ← Home page (placeholder)
    │   │   │
    │   │   ├── auth/              ← Authentication pages
    │   │   │   ├── login/
    │   │   │   │   └── page.tsx   ← Login UI (Connected to authClient)
    │   │   │   └── signup/
    │   │   │       └── page.tsx   ← Signup UI (Connected to authClient)
    │   │   │
    │   │   ├── (protected)/       ← Protected area layout group
    │   │   │   ├── layout.tsx     ← Dashboard layout (AppSidebar + Topbar) + Session check
    │   │   │   ├── QA/
    │   │   │   │   └── page.tsx   ← QA Page placeholder
    │   │   │   ├── dashboard/
    │   │   │   │   ├── page.tsx          ← Dashboard main page
    │   │   │   │   └── commit-log.tsx    ← UI component displaying AI summarized commits
    │   │   │   └── create-project/
    │   │   │       └── page.tsx   ← Create project UI form
    │   │   │
    │   │   └── api/
    │   │       ├── auth/[...all]/route.ts  ← Better Auth Next.js API handler
    │   │       ├── project/route.ts        ← Project creation, commit polling, and RAG indexing API
    │   │       └── commits/route.ts        ← Commit listing API
    │   │
    │   ├── components/
    │   │   ├── appsidebar.tsx     ← Dashboard Sidebar component
    │   │   ├── user-button.tsx    ← User profile / Logout component
    │   │   ├── providers.tsx      ← Client providers (React Query)
    │   │   └── ui/                ← shadcn / Base UI component library
    │   │       ├── button.tsx
    │   │       ├── card.tsx
    │   │       ├── checkbox.tsx
    │   │       ├── input.tsx
    │   │       ├── label.tsx
    │   │       └── separator.tsx
    │   │
    │   ├── hooks/
    │   │   ├── use-mobile.ts      ← shadcn mobile hook
    │   │   ├── use-project.ts     ← React Query hook for projects
    │   │   └── use-refetch.ts     ← React Query invalidation hook
    │   │
    │   ├── lib/
    │   │   ├── utils.ts           ← cn() utility (clsx + tailwind-merge)
    │   │   ├── auth.ts            ← Better Auth server instance
    │   │   ├── auth-client.ts     ← Better Auth React client instance
    │   │   ├── github.ts          ← Octokit integration for fetching un-processed repository commits
    │   │   ├── github-loader.ts   ← LangChain document loader and RAG indexing orchestration
    │   │   └── gemini.ts          ← Google GenAI integration (Commit summarization & Text Embeddings)
    │   │
    │   ├── server/
    │   │   └── db.ts              ← Prisma client singleton
    │   │
    │   └── styles/
    │       └── globals.css        ← Global styles + design tokens
    │
    ├── .env                       ← Local secrets (gitignored)
    ├── .env.example               ← Env template (committed, no secrets)
    ├── .gitignore
    ├── components.json            ← shadcn CLI configuration
    ├── eslint.config.js
    ├── next.config.js
    ├── next-env.d.ts              ← Auto-generated Next.js types (do not edit)
    ├── package.json
    ├── test-octokit.js            ← Scratch script for testing octokit functionality
    ├── postcss.config.js
    ├── prettier.config.js
    ├── start-database.sh          ← Docker helper script for local PostgreSQL
    └── tsconfig.json
```

---

## 2. Folder Responsibilities

### `Documents/`
Project documentation files — design system, blueprints, screenshots, and animation specs. These are reference documents only and are never deployed or imported by the application.

---

### `gitpulse/`
The Next.js application. Everything inside here is the actual codebase.

---

### `prisma/`
Holds the Prisma ORM schema. Configured for PostgreSQL and contains the Better Auth models (`user`, `session`, `account`, `verification`) as well as GitPulse models (`Project`, `Commit`, `SourceCodeEmbedding`). The Prisma client is generated into `node_modules/@prisma/client` during `postinstall`.

---

### `public/`
Static assets served directly by Next.js at the root URL. Currently contains `favicon.ico` and `createProject.png`.

---

### `src/app/`
Next.js **App Router** directory. Every folder with a `page.tsx` inside it becomes a route.

| Subfolder | Route | Status |
|-----------|-------|--------|
| `app/` root | `/` | Placeholder page |
| `app/auth/login/` | `/auth/login` | ✅ Fully functional (Email + OAuth) |
| `app/auth/signup/` | `/auth/signup` | ✅ Fully functional (Email + password) |
| `app/(protected)/` | `/QA`, `/create-project` | ✅ Protected layout group with Sidebar |
| `app/api/auth/[...all]/` | `/api/auth/*` | ✅ Better Auth API handler active |
| `app/api/project/` | `/api/project` | ✅ API for project creation, commit polling, and background RAG indexing |

---

### `src/app/auth/`
Contains the authentication UI pages (`login`, `signup`). They are fully connected to `authClient` and redirect to protected pages upon successful authentication.

---

### `src/components/`
Holds shared application components (like `AppSidebar` and `UserButton`).
The `ui/` subfolder holds all **shadcn** component files built on top of **Base UI**.

---

### `src/lib/`
Utility functions and singleton instances shared across the application.
- `utils.ts` — UI styling utilities.
- `auth.ts` — **Server-side** Better Auth configuration and instance.
- `auth-client.ts` — **Client-side** Better Auth configuration and instance.
- `github.ts` — Octokit integration for fetching un-processed repository commits.
- `github-loader.ts` — LangChain document loading, chunking, and RAG indexing orchestration. Delegates all Gemini API calls (embedding + 429/503 handling) to `gemini.ts`.
- `gemini.ts` — Google GenAI integration. Contains:
  - `aiSummariseCommits()` — single-key batch commit summarization via `gemini-3.6-flash`.
  - `generateEmbedding()` — multi-key round-robin embedding via `gemini-embedding-2` with transparent 429 key rotation and 503 exponential backoff. Key pool is built from `GEMINI_API_KEY_1` … `GEMINI_API_KEY_10` at module load.

---

### `src/server/`
All server-side code that **must not run in the browser**.
- `db.ts` — Prisma client singleton (instantiated once per server process, reused in dev to avoid connection pooling issues). Also used by Better Auth via the `prismaAdapter`.

---

### `src/styles/`
Contains `globals.css` — the single global stylesheet. This is where Tailwind CSS is imported and the design token system lives.

---

## 3. Important Files

### Application files

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root Next.js layout. Loads Geist and Space Grotesk fonts via `next/font/google`. |
| `src/app/(protected)/layout.tsx` | Protected dashboard layout containing Sidebar and Session check. |
| `src/components/providers.tsx` | TanStack React Query global provider wrapper. |
| `src/app/(protected)/create-project/page.tsx` | UI for creating a new project with form integration. |
| `src/app/api/auth/[...all]/route.ts` | The Better Auth API route handler. Automatically manages all auth requests. |
| `src/app/api/project/route.ts` | Handles project creation, triggers `pollCommits` synchronously, and kicks off `indexGithubRepo` in the background. |
| `src/env.js` | Type-safe environment variable validation using `@t3-oss/env-nextjs` and Zod. |
| `src/server/db.ts` | Exports the `db` Prisma client singleton. |
| `src/lib/auth.ts` | Better Auth server configuration. |
| `src/lib/auth-client.ts` | Better Auth React client. |

### Prisma & database

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Defines the database schema. Contains auth models + `Project`, `UserToProject`, `Commit`, and `SourceCodeEmbedding` with `pgvector`. |

---

## 4. Architecture Overview

```text
Browser / Client
       │
       ├── authClient (src/lib/auth-client.ts)
       │       │
       │       ▼ (HTTP)
       │   Better Auth API (src/app/api/auth/[...all]/route.ts)
       │
       ├── Project Creation (src/app/(protected)/create-project/page.tsx)
       │       │
       │       ▼ (HTTP)
       │   Project API (src/app/api/project/route.ts)
       │       │
       │       ├── Sync  → Octokit + Gemini API (pollCommits)
       │       └── Async → LangChain + Gemini Embedding Pool (indexGithubRepo)
       │                        │
       │                        ▼
       │                   gemini.ts — Key Pool (GEMINI_API_KEY_1…10)
       │                        │  429 quota → rotate key
       │                        │  503 → exponential backoff
       │                        ▼
       │                   Gemini Embedding API (gemini-embedding-2, 768-d)
       │
       ▼ (Prisma)
   Prisma Client (src/server/db.ts)
       │
       ▼
   PostgreSQL Database (with pgvector)
```

---

## 5. Technology Stack

### Authentication: Better Auth
GitPulse uses [Better Auth](https://better-auth.com/) for authentication. It manages user sessions using **HTTP-only cookies** and database session tables.

### Next.js 15 (App Router)
The full-stack React framework. Handles routing, server-side rendering, API routes, and static asset serving.

### React 19
The UI library. Next.js renders React components on the server (RSC) and hydrates them in the browser.

### Tailwind CSS v4
Utility-first CSS framework. Configured via `postcss.config.js`.

### TanStack React Query
Used for client-side data fetching, caching, and state synchronization (e.g., fetching user projects).

### shadcn / Base UI
Accessible UI components copied directly into `src/components/ui/`.

### AI & Integrations
- **Google GenAI (`@google/genai`)**: Used for commit summarization (`gemini-3.6-flash`) and 768-dimensional vector embeddings (`gemini-embedding-2`). Embedding calls use a **multi-key pool** (up to 10 keys) with round-robin rotation and transparent 429/503 error handling inside `gemini.ts`.
- **LangChain (`@langchain/community`)**: Used for robust repository loading (`GithubRepoLoader`) and intelligent chunking (`RecursiveCharacterTextSplitter`).
- **Octokit (`octokit`)**: Used to interact directly with the GitHub API for fetching commits and diffs.

### Prisma 6 & PostgreSQL (pgvector)
ORM for PostgreSQL. The schema lives in `prisma/schema.prisma`. Uses `pgvector` for storing and querying AI embeddings.

---

## 6. UI Architecture

```text
src/styles/globals.css
       │
       ├── Tailwind CSS v4 imports
       ├── shadcn base theme variables (--background, --foreground, --primary, etc.)
       └── GitPulse Design System tokens (--gp-bg-base, --gp-text-primary, etc.)
```

> **Design System priority rule:** The GitPulse Design System (`--gp-*` tokens) and `Space Grotesk` global font takes priority over default shadcn styling for custom page layouts.

---

## 7. Authentication — Current Status

Authentication is **fully implemented and active** using Better Auth.

| Feature | Status | Implementation Details |
|---------|--------|------------------------|
| Email/Password Login | ✅ Active | Uses `authClient.signIn.email()` |
| Email/Password Signup | ✅ Active | Uses `authClient.signUp.email()` |
| Google OAuth | ✅ Active | Uses `authClient.signIn.social({ provider: "google" })` |
| GitHub OAuth | ✅ Active | Uses `authClient.signIn.social({ provider: "github" })` |
| Protected Routes | ✅ Active | `(protected)` layout uses `auth.api.getSession()` |
| Logout | ✅ Active | `<UserButton>` calls `authClient.signOut()` |

---

## 8. Database — Current Status

The database contains the core Better Auth models + standard GitPulse models:

- `User`, `Session`, `Account`, `Verification` — Better Auth internal tables
- `Project` — Custom GitPulse table for workspace projects
- `UserToProject` — Many-to-many junction table linking Users to Projects
- `Commit` — Stores individual Git commits with AI-generated summaries
- `SourceCodeEmbedding` — Stores chunked repository code and `768`-dimensional pgvector embeddings.

---

## 9. Configuration Files

See section 3 for details. The `dev` script in `package.json` is explicitly pinned to port 3001.

---

## 10. Environment Variables

The following environment variables are used at runtime. Variables marked ✅ are strictly validated by `src/env.js`. Gemini keys are accessed directly via `process.env` inside `gemini.ts` and are **not** in the Zod schema.

| Variable | Validated | Purpose |
|----------|-----------|--------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (pooled). |
| `DIRECT_URL` | ✅ | PostgreSQL connection string for migrations (unpooled). |
| `BETTER_AUTH_SECRET` | ✅ | High-entropy secret for encrypting cookies. |
| `BETTER_AUTH_URL` | ✅ | Base URL of the application. |
| `GOOGLE_CLIENT_ID/SECRET` | ✅ | OAuth credentials for Google Sign-In. |
| `GITHUB_CLIENT_ID/SECRET` | ✅ | OAuth credentials for GitHub Sign-In. |
| `GITHUB_TOKEN` | — | Optional GitHub PAT for loading private repos / raising API rate limits. |
| `GEMINI_API_KEY_1` … `GEMINI_API_KEY_10` | — | Embedding key pool. Each key should be from a **different GCP project** for independent 30K TPM quotas. Supports 1–10 keys; pool size is logged at startup. |
| `GEMINI_API_KEY` | — | Legacy single-key fallback. Used for commit summarization if no `GEMINI_API_KEY_1` is set. |

---

## 11. Planned Next Steps

1. **Dashboard Data Integration** — ✅ Connect the `/create-project` form to a REST endpoint to insert into the `Project` database model.
2. **AI Commit Summarization** — ✅ End-to-end flow using Octokit + `gemini-3.6-flash` to automatically index and summarize new project commits.
3. **Repository Vector Search (RAG)** — ✅ `indexGithubRepo` using LangChain to chunk and embed source code into `SourceCodeEmbedding` via pgvector.
4. **Gemini Embedding Key Rotation** — ✅ 5-key (up to 10) round-robin pool in `gemini.ts` eliminating 429 TPM quota errors on large repos.
5. **Q&A Chat Interface** — **Next up:** Build the chat UI where users can ask questions about the indexed codebase, utilizing pgvector similarity search against the stored embeddings.
6. **Dashboard Overview UI** — Expand dashboard data sections (Commit log is complete; more sections to follow).
