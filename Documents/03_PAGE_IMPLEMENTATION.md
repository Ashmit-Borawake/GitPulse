# 03 — GitPulse Page Implementation

> **Document Status:** Reflects currently implemented routes, pages, and frontend components.
> This document is the frontend implementation reference. Visual design specification belongs in `02_UI_DESIGN_SYSTEM.md`. Backend implementation details belong in `04_BACKEND_AND_RAG.md`.

---

## Table of Contents

1. [Document Status](#1-document-status)
2. [Application Route Overview](#2-application-route-overview)
3. [Root Application Structure](#3-root-application-structure)
4. [Authentication Pages](#4-authentication-pages)
5. [Protected Application Shell](#5-protected-application-shell)
6. [Dashboard](#6-dashboard)
7. [Ask Question Feature](#7-ask-question-feature)
8. [Create Project Page](#8-create-project-page)
9. [Commit Log](#9-commit-log)
10. [Sidebar and Shared Components](#10-sidebar-and-shared-components)
11. [Frontend-to-API Integration](#11-frontend-to-api-integration)
12. [Client-Side Data Flow](#12-client-side-data-flow)
13. [Loading and Error Handling](#13-loading-and-error-handling)
14. [Current Page Implementation Status](#14-current-page-implementation-status)
15. [Known Future Frontend Work](#15-known-future-frontend-work)

---

## 1. Document Status

This document describes the **currently implemented** routes, pages, components, and frontend behavior.

It does **not** cover visual design (colors, typography, animations) — that is `02_UI_DESIGN_SYSTEM.md`.

It does **not** cover backend internals — that is `04_BACKEND_AND_RAG.md`.

---

## 2. Application Route Overview

| Route | File | Access | Purpose | Status |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Public | Home/landing page | ✅ Placeholder page |
| `/auth/login` | `src/app/auth/login/page.tsx` | Public | User login | ✅ Implemented |
| `/auth/signup` | `src/app/auth/signup/page.tsx` | Public | User registration | ✅ Implemented |
| `/dashboard` | `src/app/(protected)/dashboard/page.tsx` | Protected | Main dashboard with Commit Log + Ask Question | ✅ Implemented |
| `/create-project` | `src/app/(protected)/create-project/page.tsx` | Protected | Link a new GitHub repository | ✅ Implemented |
| `/QA` | `src/app/(protected)/QA/page.tsx` | Protected | QA page placeholder | 🟡 Placeholder |
| `/api/auth/[...all]` | `src/app/api/auth/[...all]/route.ts` | — | Better Auth API handler | ✅ Implemented |
| `/api/project` | `src/app/api/project/route.ts` | Auth required | Create/list projects | ✅ Implemented |
| `/api/commits` | `src/app/api/commits/route.ts` | Auth required | Fetch commits for a project | ✅ Implemented |
| `/api/QA` | `src/app/api/QA/route.ts` | Auth not checked (projectId validates scope) | RAG Q&A streaming endpoint | ✅ Implemented |

---

## 3. Root Application Structure

### `src/app/layout.tsx`

Root Next.js layout. Applies globally to every page.

- Loads **Space Grotesk** (weights 300–700, via `Space_Grotesk` from `next/font/google`) and **Geist** (sans-serif, via `Geist` from `next/font/google`) fonts. Both are exposed as CSS variables.
- Sets the root `<html>` language and applies both font CSS variables to the `<html>` tag.
- Wraps all children in `<Providers>`.
- Renders `<Toaster />` (Sonner) **inside the root layout** alongside `<Providers>` — not inside the Providers component itself.

### `src/components/providers.tsx`

Client-side provider wrapper. Currently wraps the app with:
- **TanStack React Query** `QueryClientProvider` — enables data fetching, caching, and invalidation across the app.

### `src/app/page.tsx`

Public home/landing page. Currently a placeholder — contains basic content but no full landing page implementation yet.

---

## 4. Authentication Pages

Authentication is fully implemented using **Better Auth**.

### Login — `/auth/login`

**File:** `src/app/auth/login/page.tsx`

**Purpose:** Allows existing users to log into their account.

**Behavior:**
- Email/password login form
- Google OAuth button (calls `authClient.signIn.social({ provider: "google" })`)
- GitHub OAuth button (calls `authClient.signIn.social({ provider: "github" })`)
- Successful authentication → redirected to `/dashboard`
- Errors displayed inline (invalid credentials, server error)

**Integration:** Uses `authClient` from `src/lib/auth-client.ts` → communicates with `/api/auth/[...all]` → Better Auth API handler → session created in PostgreSQL.

---

### Signup — `/auth/signup`

**File:** `src/app/auth/signup/page.tsx`

**Purpose:** Allows new users to create an account.

**Behavior:**
- Email, password, (name) form fields
- `react-hook-form` for form state management
- Calls `authClient.signUp.email()` on submit
- Successful signup → session created → redirected to dashboard
- Validation errors shown inline

---

## 5. Protected Application Shell

### Protected Layout Group

**File:** `src/app/(protected)/layout.tsx`

All routes inside `(protected)/` use this layout. It:

1. Calls `auth.api.getSession({ headers })` server-side to verify the session.
2. If no session → redirects to `/auth/login`.
3. If session valid → renders the full dashboard shell.
4. Renders the **AppSidebar** and **top bar**.
5. Wraps content in a scrollable main area.

### Route Protection Mechanism

```
Request to /dashboard
    ↓
(protected)/layout.tsx
    ↓
auth.api.getSession() → checks session cookie
    ↓ no session
Redirect → /auth/login

    ↓ valid session
Render sidebar + content
```

No middleware file — protection is implemented at the layout level using server-side session checking.

---

## 6. Dashboard

**File:** `src/app/(protected)/dashboard/page.tsx`

**Type:** Client component (`"use client"`)

### Purpose

Main workspace for an authenticated user. Displays:
- The linked GitHub repository URL as a banner
- The Ask Question card
- The Commit Log

### Data Source

Uses the `useProject()` hook (`src/hooks/use-project.ts`) to get the currently selected project from React Query cache.

### Component Hierarchy

```
DashboardPage
├── GitHub Repository Banner
│       └── Link to GitHub URL (ExternalLink icon)
├── Grid Layout (grid-cols-5)
│   └── AskQuestionCard    (spans 3 cols)
│       (WorkspaceCard — commented out, not yet implemented)
└── CommitLog
```

### Key Behaviors

- If `project` is null (no project selected), the banner URL is empty and Ask Question is non-functional (guards `if (!project?.id) return`).
- Dashboard is client-rendered with no SSR data fetching — all data comes from React Query hooks.
- Several components are commented out (TeamMembers, InviteButton, ArchiveButton, WorkSpaceCard) — not yet implemented.

---

## 7. Ask Question Feature

**File:** `src/app/(protected)/dashboard/ask-question-card.tsx`

**Type:** Client component (`"use client"`)

This is the primary implemented AI interaction feature.

### Component State

| State | Type | Purpose |
|---|---|---|
| `open` | `boolean` | Controls the Dialog open/close |
| `question` | `string` | Text input controlled value |
| `loading` | `boolean` | Whether a Q&A request is in flight |
| `answer` | `string` | Accumulated streaming answer text |
| `filesReferences` | `{ fileName, filePath, chunkIndex, similarity }[]` | Parsed file references from response header |

### Submission Flow — Step by Step

```
User submits the form (onSubmit)
    ↓
e.preventDefault()
if (!project?.id) return   ← guard: no project selected
    ↓
setLoading(true)
setOpen(true)              ← Dialog opens immediately
setAnswer("")              ← clear previous answer
setFilesReferences([])     ← clear previous references
    ↓
toast.loading("GitPulse is thinking…")
    ↓
POST /api/QA
    body: { question: string, projectId: string }
    Content-Type: application/json
    ↓
if (!res.ok)
    → parse error body
    → throw Error with message
    ↓
Read X-File-References header
    res.headers.get("X-File-References")
    → JSON.parse() → setFilesReferences()
    → fallback: setFilesReferences([]) on parse failure
    ↓
if (!res.body) → throw Error("No response body")
    ↓
res.body.getReader()       ← ReadableStream reader
new TextDecoder()
    ↓
Loop:
    const { done, value } = await reader.read()
    if done → break
    const text = decoder.decode(value, { stream: true })
    setAnswer(prev => prev + text)    ← incremental append
    ↓
toast.success("Answer ready!")
    ↓
catch (error):
    toast.error(message)
    setOpen(false)
finally:
    setLoading(false)
```

### Current Dialog Content

The Dialog currently renders for testing purposes:
- The raw `answer` string (plain text, no Markdown rendering)
- An `<h1>Files References</h1>` heading
- A `<span>` for each `filesReference.fileName`

This is intentionally minimal — proper styled rendering is planned in a future phase.

### Why the Header is Read Before the Body

The `X-File-References` header must be parsed **before** `res.body` is consumed. Once the stream starts being read, some browser implementations may not guarantee header availability. Reading the header immediately after checking `res.ok` ensures it is always available.

### Why `sourceCode` is NOT in the References

Source code from retrieved chunks can contain Unicode characters (em dashes, smart quotes, etc.) that exceed the ASCII/Latin-1 limit of HTTP header values. Including `sourceCode` caused a `ByteString` error (`character at index N has value > 255`). File references contain only lightweight metadata.

---

## 8. Create Project Page

**File:** `src/app/(protected)/create-project/page.tsx`

**Type:** Client component (`"use client"`)

### Form Fields

| Field | Input | Required | Notes |
|---|---|---|---|
| `projectName` | Text input | ✅ Yes | Display name for the project |
| `repoUrl` | URL input | ✅ Yes | Full GitHub repository URL |
| `githubToken` | Text input | ❌ Optional | PAT for private repos or higher rate limits |

**Form Library:** `react-hook-form` — handles registration, validation, and reset.

### Submission Flow

```
User fills form → submits
    ↓
handleSubmit(onSubmit) ← react-hook-form validates required fields
    ↓
setIsLoading(true) → button disabled + "Creating..." text
    ↓
axios.post("/api/project", { projectName, repoUrl, githubToken })
    ↓
await refetch()         ← invalidates React Query cache → sidebar refreshes
toast.success("Project created successfully")
    ↓
if (res.data.commitSyncError)
    → toast.warning(commitSyncError, { duration: 6000 })
    (project still saved; commits may be unavailable)
    ↓
reset()                 ← clears the form
    ↓
catch (error):
    parse error body if AxiosError
    toast.error(message)
finally:
    setIsLoading(false)
```

### Important Behaviors

- Project creation succeeds even if commit synchronization fails (graceful error handling in the API).
- A `commitSyncError` warning toast appears when the API returns it (e.g., GitHub rate limit or private repo without token).
- There is no navigation redirect after creation — the form resets in place. The sidebar updates via React Query refetch.
- Empty string GitHub token is treated as `undefined` server-side.

---

## 9. Commit Log

**File:** `src/app/(protected)/dashboard/commit-log.tsx`

**Type:** Client component (`"use client"`)

### Purpose

Displays the AI-summarized commit history for the currently selected project.

### Data Fetching

Uses TanStack React Query (`useQuery`) to fetch commits:

```typescript
useQuery({
    queryKey: ["commits", projectId],
    queryFn: async () => {
        const response = await axios.get<Commit[]>("/api/commits", {
            params: { projectId },
        });
        return response.data;
    },
    enabled: !!projectId,   // only runs if a project is selected
})
```

Query key `["commits", projectId]` means commits refresh when the selected project changes.

### Rendered Commit Fields

| Field | Displayed As |
|---|---|
| `commitAuthorAvatar` | Circular author avatar image |
| `commitAuthorName` | Author name text |
| `commitHash` | Used to construct the GitHub commit link |
| `commitMessage` | Bold commit message |
| `summary` | Pre-formatted AI-generated bullet points |

### States

| State | Display |
|---|---|
| Loading | `<p>Loading commits...</p>` |
| Empty | `<p>No commits found.</p>` |
| Data | Vertical timeline list of commits |

### Commit Link

Each commit author links to `${project.githubUrl}/commit/${commit.commitHash}` — opens the GitHub commit page in a new tab.

### Summary Display

The `summary` field (AI-generated bullet points) is rendered inside a `<pre>` tag with `whitespace-pre-wrap` — preserves the `* bullet` line format from the Gemini summarization prompt.

---

## 10. Sidebar and Shared Components

### AppSidebar

**File:** `src/components/appsidebar.tsx`

The main navigation sidebar. Contains:
- GitPulse brand identity
- Navigation items (Dashboard, Q&A, etc.)
- Project list from user's projects
- Create Project link
- User button

Uses shadcn `Sidebar` primitives from `src/components/ui/sidebar.tsx`.

### UserButton

**File:** `src/components/user-button.tsx`

Displayed in the sidebar or top bar. Shows:
- User avatar/image
- User name or email
- Logout action (`authClient.signOut()`)

### useProject Hook

**File:** `src/hooks/use-project.ts`

Manages project selection state. Provides:
- `project` — the currently selected project object
- `projectId` — the ID of the selected project
- Projects are fetched from `/api/project` via React Query.

### useRefetch Hook

**File:** `src/hooks/use-refetch.ts`

Provides a `refetch()` function that invalidates React Query caches (e.g., used after project creation to refresh the sidebar project list).

### UI Components (`src/components/ui/`)

All from **shadcn** — copied directly into the project:

| Component | Used In |
|---|---|
| `button.tsx` | All forms and actions |
| `card.tsx` | AskQuestionCard, dashboard sections |
| `checkbox.tsx` | Forms |
| `dialog.tsx` | Q&A answer dialog |
| `input.tsx` | Create Project form |
| `label.tsx` | Forms |
| `separator.tsx` | Layout |
| `sheet.tsx` | Mobile sidebar drawer |
| `sidebar.tsx` | AppSidebar primitives |
| `skeleton.tsx` | Loading states |
| `textarea.tsx` | Q&A question input |
| `tooltip.tsx` | Hover hints |

---

## 11. Frontend-to-API Integration

| Frontend Component | API Route | Method | Purpose |
|---|---|---|---|
| Login page | `/api/auth/[...all]` | POST | Better Auth sign-in |
| Signup page | `/api/auth/[...all]` | POST | Better Auth sign-up |
| UserButton | `/api/auth/[...all]` | POST | Better Auth sign-out |
| Create Project page | `/api/project` | POST | Create project + trigger commit sync + background indexing |
| AppSidebar / useProject hook | `/api/project` | GET | Fetch user's projects |
| CommitLog | `/api/commits` | GET `?projectId` | Fetch commits for selected project |
| AskQuestionCard | `/api/QA` | POST | Submit question, receive stream + file references |

---

## 12. Client-Side Data Flow

### Project Selection Flow

```
App mounts
    ↓
useProject() → React Query fetches GET /api/project
    ↓
Projects stored in Query cache
    ↓
AppSidebar renders project list
User selects a project
    ↓
projectId stored in hook state
    ↓
CommitLog useQuery: enabled when projectId exists
    → GET /api/commits?projectId=...
    ↓
Commits rendered in timeline
```

### Q&A Data Flow

```
User types question → setQuestion(value)
    ↓
User submits form → onSubmit()
    ↓
setLoading(true), setOpen(true), setAnswer(""), setFilesReferences([])
    ↓
fetch POST /api/QA { question, projectId }
    ↓
Response arrives (header first)
    ↓
Parse X-File-References → setFilesReferences(parsed)
    ↓
Read body stream incrementally
    for each chunk:
        setAnswer(prev => prev + decoded_text)
    ↓
Dialog displays answer as it streams
    ↓
Stream ends → toast.success()
```

### Project Creation Data Flow

```
User fills Create Project form
    ↓
handleSubmit → axios.post("/api/project", data)
    ↓
API returns 201 { success, project, commitSyncError? }
    ↓
refetch() → invalidates useProject query → sidebar refreshes
    ↓
toast.success()
if commitSyncError → toast.warning(message)
    ↓
reset() → form cleared
```

---

## 13. Loading and Error Handling

### Loading States

| Component | Loading Behavior |
|---|---|
| Create Project form | Button disabled + text "Creating..." |
| CommitLog | `<p>Loading commits...</p>` text |
| AskQuestionCard | `toast.loading("GitPulse is thinking…")` — persisted during stream |
| Sidebar project list | React Query loading state (no explicit skeleton currently) |

### Error Handling

| Scenario | Behavior |
|---|---|
| Login failure | Inline error message from Better Auth |
| Signup failure | Inline error message |
| Project creation API error | `toast.error(message)` from error response body |
| GitHub rate limit on commit sync | `commitSyncError` returned in 201 response → `toast.warning()` |
| Q&A: non-OK response | Parse error body → `toast.error(message)`, Dialog closes |
| Q&A: stream missing body | `throw new Error("No response body")` → `toast.error` |
| Q&A: header parse failure | Caught silently → `setFilesReferences([])` fallback |
| Q&A: general error | `toast.error(message)`, `setOpen(false)` |
| Commit fetch failure | React Query error state (no explicit UI for this currently) |

---

## 14. Current Page Implementation Status

| Page / Feature | Status | Notes |
|---|---|---|
| Landing page (`/`) | 🟡 Placeholder | Basic content, no full landing page |
| Login page | ✅ Implemented | Email + Google + GitHub OAuth |
| Signup page | ✅ Implemented | Email/password |
| Protected layout | ✅ Implemented | Session check + redirect |
| AppSidebar | ✅ Implemented | Navigation + project list |
| Dashboard page | ✅ Implemented | Banner + grid layout |
| Ask Question card | ✅ Implemented | Form + streaming dialog |
| Q&A Dialog | 🟡 Partial | Raw text answer + plain file name list |
| Commit Log | ✅ Implemented | Timeline with AI summaries |
| Create Project page | ✅ Implemented | Form with optional token |
| QA page (`/QA`) | 🟡 Placeholder | Exists but minimal content |
| Markdown rendering | ⚪ Not implemented | Answer shown as plain text |
| File reference panel | 🟡 Partial | File names only, no styled panel |
| Credits display | ⚪ Not implemented | Planned |
| Team members | ⚪ Not implemented | Component commented out |
| Invite button | ⚪ Not implemented | Component commented out |
| Archive project | ⚪ Not implemented | Component commented out |
| Workspace card | ⚪ Not implemented | Component commented out |

---

## 15. Known Future Frontend Work

### Immediate Next Steps

- **Markdown rendering for Q&A answers:** Replace plain text with `react-markdown` or similar. Add syntax-highlighted code blocks (e.g., `react-syntax-highlighter` or `shiki`).
- **File reference panel:** Replace raw `<span>` list with a styled panel showing file name, path, and similarity score. Potentially syntax-highlight the relevant chunk on click.
- **Q&A Dialog polish:** Style the Dialog header with GitPulse branding. Add copy-to-clipboard for answers.

### Medium-Term

- **Credits display:** Show `User.credits` in the sidebar or top bar.
- **Full landing page:** Implement the design from `02_UI_DESIGN_SYSTEM.md`.
- **Workspace module:** PR list, issue list, AI summaries for PRs and issues.
- **Loading skeletons:** Replace plain text loading states with skeleton components.

### Longer-Term

- **Conversation history:** Save Q&A conversations per project.
- **Multi-project Q&A:** Ask questions across multiple linked repositories.
- **Project settings:** Manage linked GitHub token, rename project, delete project.
- **Responsive mobile improvements:** Full mobile-first layout review.
