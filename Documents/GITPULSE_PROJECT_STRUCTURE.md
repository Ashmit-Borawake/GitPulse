# GitPulse — Project Structure Reference

> **Document status:** Current state as of the Authentication Phase implementation.
> This document describes what **actually exists** in the repository right now.
> It will need to be updated when new phases (dashboard layout, data models, etc.) are implemented.

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
│   └── GITPULSE_PROJECT_STRUCTURE.md
│
├── README.md                      ← Root-level placeholder README
│
└── gitpulse/                      ← Next.js application root
    │
    ├── prisma/
    │   └── schema.prisma          ← Prisma schema (PostgreSQL with auth models)
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
    │   │   ├── dashboard/         ← Protected dashboard area
    │   │   │   ├── page.tsx       ← Dashboard placeholder + session check
    │   │   │   └── components/
    │   │   │       └── logout-button.tsx
    │   │   │
    │   │   └── api/
    │   │       ├── auth/
    │   │       │   └── [...all]/
    │   │       │       └── route.ts  ← Better Auth Next.js API handler
    │   │       └── trpc/
    │   │           └── [trpc]/
    │   │               └── route.ts  ← tRPC HTTP handler
    │   │
    │   ├── components/
    │   │   └── ui/                ← shadcn / Base UI component library
    │   │       ├── button.tsx
    │   │       ├── card.tsx
    │   │       ├── checkbox.tsx
    │   │       ├── input.tsx
    │   │       ├── label.tsx
    │   │       └── separator.tsx
    │   │
    │   ├── lib/
    │   │   ├── utils.ts           ← cn() utility (clsx + tailwind-merge)
    │   │   ├── auth.ts            ← Better Auth server instance
    │   │   └── auth-client.ts     ← Better Auth React client instance
    │   │
    │   ├── server/
    │   │   ├── db.ts              ← Prisma client singleton
    │   │   └── api/
    │   │       ├── trpc.ts        ← tRPC server initialization & procedures
    │   │       ├── root.ts        ← Root tRPC router
    │   │       └── routers/       ← (empty — no domain routers yet)
    │   │
    │   ├── trpc/
    │   │   ├── react.tsx          ← tRPC React client + TRPCReactProvider
    │   │   ├── server.ts          ← tRPC server-side caller for RSC
    │   │   └── query-client.ts    ← TanStack Query client factory
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
Holds the Prisma ORM schema. Configured for PostgreSQL and contains the Better Auth models (`user`, `session`, `account`, `verification`). The Prisma client is generated into `node_modules/@prisma/client` during `postinstall`.

---

### `public/`
Static assets served directly by Next.js at the root URL. Currently contains only `favicon.ico`.

---

### `src/app/`
Next.js **App Router** directory. Every folder with a `page.tsx` inside it becomes a route.

| Subfolder | Route | Status |
|-----------|-------|--------|
| `app/` root | `/` | Placeholder page |
| `app/auth/login/` | `/auth/login` | ✅ Fully functional (Email + OAuth) |
| `app/auth/signup/` | `/auth/signup` | ✅ Fully functional (Email + password) |
| `app/dashboard/` | `/dashboard` | ✅ Protected route. Temporary proof-of-auth page. |
| `app/api/auth/[...all]/` | `/api/auth/*` | ✅ Better Auth API handler active |
| `app/api/trpc/[trpc]/` | `/api/trpc/*` | ✅ tRPC HTTP handler active |

---

### `src/app/auth/`
Contains the authentication UI pages (`login`, `signup`). They are fully connected to `authClient` and redirect to `/dashboard` upon successful authentication.

---

### `src/components/ui/`
Holds all **shadcn** component files. These are copied into the project (not imported from a package) so they can be customised. They are built on top of **Base UI** primitives from `@base-ui/react`.

Currently installed components: Button, Card, Checkbox, Input, Label, Separator.

> These components use shadcn's default styling as a base. The GitPulse Design System tokens (`--gp-*`) are applied on top via inline styles and Tailwind utilities in individual pages, without modifying the component source files.

---

### `src/lib/`
Utility functions and singleton instances shared across the application.
- `utils.ts` — UI styling utilities.
- `auth.ts` — **Server-side** Better Auth configuration and instance.
- `auth-client.ts` — **Client-side** Better Auth configuration and instance.

---

### `src/server/`
All server-side code that **must not run in the browser**. The `server-only` package is used where needed to enforce this boundary.

- `db.ts` — Prisma client singleton (instantiated once per server process, reused in dev to avoid connection pooling issues). Also used by Better Auth via the `prismaAdapter`.
- `api/trpc.ts` — tRPC initialization: context factory, router/procedure builders, timing middleware.
- `api/root.ts` — Root tRPC router that composes all domain sub-routers.
- `api/routers/` — Empty; individual feature routers go here (e.g., `post.ts`, `user.ts`).

---

### `src/trpc/`
Client-side and RSC-side tRPC wrappers. This directory is the **bridge** between the tRPC server and the UI.

- `react.tsx` — Creates the typed `api` hook used in Client Components; exports `TRPCReactProvider`
- `server.ts` — Creates a typed `api` caller used in React Server Components (RSC); exports `HydrateClient`
- `query-client.ts` — Factory for TanStack Query's `QueryClient` with SuperJSON serialization and SSR-safe dehydration settings

---

### `src/styles/`
Contains `globals.css` — the single global stylesheet. This is where Tailwind CSS is imported and the design token system lives.

---

## 3. Important Files

### Application files

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root Next.js layout. Loads DM Sans and Geist fonts via `next/font/google`. Wraps the app in `TRPCReactProvider`. |
| `src/app/page.tsx` | Home page at `/`. Currently a placeholder. |
| `src/app/auth/login/page.tsx` | Login page UI at `/auth/login`. Connected to Better Auth `authClient.signIn`. Supports Email+Password, Google, and GitHub OAuth. |
| `src/app/auth/signup/page.tsx` | Signup page UI at `/auth/signup`. Connected to Better Auth `authClient.signUp`. |
| `src/app/dashboard/page.tsx` | Protected dashboard Server Component. Validates session server-side using `auth.api.getSession({ headers })`. |
| `src/app/api/auth/[...all]/route.ts` | The Better Auth API route handler. Automatically manages all auth requests (signup, signin, signout, OAuth callbacks, session verification). |
| `src/app/api/trpc/[trpc]/route.ts` | The HTTP handler for the tRPC router. |
| `src/env.js` | Type-safe environment variable validation using `@t3-oss/env-nextjs` and Zod. Strict server-only rules (no `NEXT_PUBLIC_` variables) to prevent accidental secret leakage. |
| `src/server/db.ts` | Exports the `db` Prisma client singleton. |
| `src/lib/auth.ts` | Better Auth server configuration. Defines the database adapter, OAuth credentials, and base URL. |
| `src/lib/auth-client.ts` | Better Auth React client. Auto-detects the origin to route API calls accurately in development and production. |

### Prisma & database

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Defines the database schema. Contains `User`, `Session`, `Account`, and `Verification` models generated by Better Auth. |
| `start-database.sh` | Shell script to start a local PostgreSQL instance via Docker. |

### Configuration files

| File | Purpose |
|------|---------|
| `package.json` | Project dependencies, scripts, and metadata. Notice the `dev` script is pinned to `-p 3001` to match OAuth callback configurations. |
| `tsconfig.json` | TypeScript compiler options. Strict mode enabled. Path alias `@/*` → `./src/*`. |
| `next.config.js` | Next.js configuration. Imports `src/env.js` at startup to trigger env validation. |
| `components.json` | shadcn CLI configuration. Specifies style, RSC mode, icon library (Lucide), Tailwind CSS v4, and component path aliases. |
| `.env.example` | Template for the `.env` file. Includes documentation for Better Auth and OAuth variables. |

---

## 4. Architecture Overview

```
Browser / Client
       │
       ├── authClient (src/lib/auth-client.ts)
       │       │
       │       ▼ (HTTP)
       │   Better Auth API (src/app/api/auth/[...all]/route.ts)
       │       │
       │       ▼
       │   Better Auth Server (src/lib/auth.ts)
       │       │
       │       ▼
       │   Prisma Adapter
       │       │
       │       ▼
       │   Prisma Client (src/server/db.ts)
       │       │
       │       ▼
       │   PostgreSQL Database
       │
       ▼ (Page loads / RSC)
Next.js App Router (src/app/)
       │
       ├── Server Components (RSC) → check auth via `auth.api.getSession()`
       │       └── call tRPC via src/trpc/server.ts (no HTTP round-trip)
       │
       └── Client Components ("use client") → hydrate in browser
               └── call tRPC via src/trpc/react.tsx hooks (HTTP to /api/trpc)
```

---

## 5. Technology Stack

### Authentication: Better Auth
GitPulse uses [Better Auth](https://better-auth.com/) for authentication. It manages user sessions using **HTTP-only cookies** and database session tables.
- **NO JWTs** are used or configured.
- **OAuth Providers:** Google and GitHub are configured and active.
- **Database Adapter:** Uses the bundled Prisma adapter (`better-auth/adapters/prisma`).
- **Server Instance:** `src/lib/auth.ts`
- **Client Instance:** `src/lib/auth-client.ts`

### Next.js 15 (App Router)
The full-stack React framework. Handles routing, server-side rendering, API routes, and static asset serving. GitPulse uses the **App Router** (the `src/app/` directory convention), not the older Pages Router.

### React 19
The UI library. Next.js renders React components on the server (RSC) and hydrates them in the browser.

### TypeScript 5
Strict TypeScript is enforced throughout. The `@/*` path alias maps to `src/`, so `import { cn } from "@/lib/utils"` works from any file.

### Tailwind CSS v4
Utility-first CSS framework. Configured via `postcss.config.js` (the v4 PostCSS approach — no `tailwind.config.ts` file is needed). All class names are applied inline in JSX.

### shadcn / Base UI
shadcn provides pre-built accessible UI components copied directly into `src/components/ui/`. In this project, shadcn uses **Base UI** (`@base-ui/react`) as its headless primitive layer instead of Radix UI.

### tRPC 11 & TanStack Query 5
Type-safe API layer. Defines API procedures on the server (in `src/server/api/`) and calls them from the client with full TypeScript inference.

### Prisma 6
ORM for PostgreSQL. The schema lives in `prisma/schema.prisma`. The Prisma client is accessed via `src/server/db.ts`. Contains Better Auth models (`user`, `session`, `account`, `verification`).

### Zod
Schema validation library. Used in `src/env.js` to ensure required environment variables are present and correctly typed at startup.

---

## 6. UI Architecture

```
src/styles/globals.css
       │
       ├── Tailwind CSS v4 imports
       ├── shadcn base theme variables (--background, --foreground, --primary, etc.)
       └── GitPulse Design System tokens (--gp-bg-base, --gp-text-primary, etc.)
               │
               ▼
src/components/ui/
       │
       └── Reusable shadcn primitives (Button, Card, Input, Label, Checkbox, Separator)
               │
               ▼
src/app/ (pages)
       │
       └── Page-level UI assembles primitives + custom layout
```

> **Design System priority rule:** The GitPulse Design System (`--gp-*` tokens) take priority over default shadcn styling for custom page layouts.

---

## 7. Authentication — Current Status

Authentication is **fully implemented and active** using Better Auth.

| Feature | Status | Implementation Details |
|---------|--------|------------------------|
| Email/Password Login | ✅ Active | Uses `authClient.signIn.email()` |
| Email/Password Signup | ✅ Active | Uses `authClient.signUp.email()` |
| Session management | ✅ Active | Database sessions + HTTP-only cookies |
| Google OAuth | ✅ Active | Uses `authClient.signIn.social({ provider: "google" })` |
| GitHub OAuth | ✅ Active | Uses `authClient.signIn.social({ provider: "github" })` |
| Protected Routes | ✅ Active | `/dashboard` uses `auth.api.getSession()` Server Component check |
| Logout | ✅ Active | `<LogoutButton>` calls `authClient.signOut()` |

---

## 8. Database — Current Status

The database contains the core Better Auth models:

- `user` — User profile data (name, email, etc.)
- `session` — Active authentication sessions tied to HTTP-only cookies
- `account` — OAuth provider identities (Google, GitHub linked to Users)
- `verification` — Email verification tokens

The database is in sync with the Prisma schema.

---

## 9. Configuration Files

See section 3 for details. The `dev` script in `package.json` is explicitly pinned to port 3001 (`next dev --turbo -p 3001`) to match the `BETTER_AUTH_URL` and OAuth callback configurations registered with Google and GitHub.

---

## 10. Environment Variables

The following environment variables are strictly validated by `src/env.js` at runtime. **All secrets are server-side only.**

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (pooled). |
| `DIRECT_URL` | Direct PostgreSQL connection string (for migrations). |
| `NODE_ENV` | `development`, `test`, or `production`. |
| `BETTER_AUTH_SECRET` | High-entropy secret (minimum 32 chars) for encrypting cookies and tokens. |
| `BETTER_AUTH_URL` | Base URL of the application (e.g. `http://localhost:3001`). Used for absolute redirect generation. |
| `GOOGLE_CLIENT_ID/SECRET` | OAuth credentials for Google Sign-In. |
| `GITHUB_CLIENT_ID/SECRET` | OAuth credentials for GitHub Sign-In. |

---

## 11. Planned Next Steps

Now that the core Authentication infrastructure is complete, the next logical phases are:

1. **Dashboard Architecture** — Building out the real dashboard layout (sidebar, header, content area) replacing the temporary proof-of-auth dashboard.
2. **tRPC Protected Procedures** — Extending `src/server/api/trpc.ts` with a `protectedProcedure` middleware that verifies the Better Auth session before allowing database access.
3. **Domain Data Models** — Adding GitPulse-specific Prisma models (Workspaces, Projects, Issues) linked to the existing `user` model.
