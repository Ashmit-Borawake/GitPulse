# 01 — Project Blueprint

> **Document Status:** Living document. Updated with final implemented architecture.
> Last meaningful update: **Real Codebase Implementation (Phase 7).**

---

## 1. Product Vision

**GitPulse** is a focused, AI-powered GitHub developer intelligence platform. Every feature exists to make developers understand their codebases and GitHub workflows faster and more deeply — through AI-generated summaries, semantic code search, and repository Q&A. It is not a general project-management or collaboration tool.

**Core belief:** The most valuable thing AI can do for a developer today is help them understand code they didn't write, or code they wrote long ago.

---

## 2. Target User

- Individual developers and small engineering teams who work heavily with GitHub repositories.
- Developers onboarding onto unfamiliar codebases who want AI-powered walkthroughs.
- Engineers who want instant Q&A about their own codebase without leaving a browser tab.

---

## 3. Feature Pillars

### Pillar 1 — GitHub Repository Intelligence (Tutorial implementation, Steps 2–3)

| Feature                   | Description                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Connect GitHub Repository | Link a public repo by URL or a private repo using an optional personal access token.      |
| Repository Indexing       | Crawl and embed all supported source files into pgvector for RAG. 1 credit per file.      |
| AI Commit Summaries       | For each commit fetched via Octokit, generate a plain-English AI summary via Gemini.      |
| RAG Q&A                   | Ask any question about the codebase; Gemini answers by retrieving relevant embeddings.    |
| Saved Q&A History         | Each question + answer pair is persisted, viewable in the Q&A page.                       |
| Semantic Code Search      | Surface relevant code files by natural-language query against the vector index.           |
| Repository Dashboard      | Commit feed (avatar, author, message, timestamp) + linked repo banner + project controls. |

### Pillar 2 — Workspace: Pull Request & Issue Intelligence (Phase 4 — future)

> **Concept only at this stage.** Implementation details are deferred to Phase 4/5.

The Workspace is an AI-powered developer command center focused exclusively on GitHub Pull Requests and GitHub Issues. Its purpose is to enhance GitHub — not replace it. It must inherit all existing architectural conventions — routing, naming, backend patterns, auth flow, styling — rather than introducing a parallel structure.

**Pull Requests:**

- AI-generated PR summaries
- Code change explanations
- Risk analysis and breaking-change detection
- Changed-file insights and module impact analysis

**Issues:**

- AI-generated issue summaries and technical context
- Duplicate issue detection
- Label suggestions and priority prediction
- Affected module identification

**Search & Filtering:**

- Semantic search across PRs and Issues
- Filtering by state, priority, author, label

**Future AI Actions (post-launch):**

- Summarize on demand
- Refresh Analysis
- Compare Versions

**Explicitly out of scope for Workspace:** meetings, Kanban boards, team chat, sprint planning, documentation generation, architecture diagrams, GitHub Actions monitoring, CI/CD dashboards, project timelines, code editors.

**Do NOT define yet:** route names, folder structure, component hierarchy, tRPC procedures, Prisma models, database schema, dialogs, animations, loading states, or file names for the Workspace module.

### Pillar 3 — Credits & Billing (Tutorial implementation, Steps 2–3)

| Action                 | Credit Cost                                               |
| ---------------------- | --------------------------------------------------------- |
| Index 1 source file    | 1 credit                                                  |
| Analyze 1 Pull Request | 5 credits <!-- ASSUMPTION: flat cost; exact value TBD --> |
| Analyze 1 Issue        | 3 credits <!-- ASSUMPTION: flat cost; exact value TBD --> |

- Users buy credits via Stripe one-time top-ups (e.g. "Buy 100 Credits for $2.00").
- Transaction history is stored and displayed on the Billing page.
- No subscription model in v1.

<!-- ASSUMPTION: "100 credits for $2.00" is the default bundle. Additional bundle sizes TBD. -->

---

## 4. Approved Tech Stack

| Layer           | Choice                    | Notes                                 |
| --------------- | ------------------------- | ------------------------------------- |
| Framework       | Next.js 15, App Router    | No Pages Router                       |
| Language        | JavaScript / JSX only     | **No TypeScript anywhere**            |
| Styling         | Tailwind CSS v4           |                                       |
| API Layer       | Next.js API Routes (REST)|                                       |
| Auth            | Better Auth               |                                       |
| ORM             | Prisma                    |                                       |
| Database        | PostgreSQL + `pgvector`   | Single DB, no separate vector service |
| AI / RAG        | LangChain + Google Gemini | Embeddings & generation               |
| GitHub Data     | Octokit (REST + GraphQL)  |                                       |
| Payments        | Stripe (one-time top-ups) |                                       |
| Version Control | Git / GitHub              |                                       |
| Package Manager | pnpm                      |                                       |

**Explicitly excluded (do not reference anywhere):** AssemblyAI, Firebase Storage, any audio/transcription library, Cohere, Weaviate, Pinecone, Docker split-deployment, Python microservice, meeting-related functionality.

---

## 5. High-Level Architecture

```
Browser (Next.js App Router)
        │
        │  React Server Components + Client Components
        │
        ▼
   Next.js API Routes (REST)
        │
        ├── Prisma ORM ──► PostgreSQL + pgvector
        │                  (Users, Projects, Commits, Embeddings)
        │
        ├── Google Gemini ◄── LangChain
        │   (embeddings + generation)
        │
        ├── Octokit ──► GitHub REST / GraphQL API
        │   (repo metadata, commits, files, PRs, Issues)
        │
        └── Stripe ──► Payment processing
                       (one-time credit top-ups)

Auth: Better Auth (wraps Next.js API routes)
```

**Data flow for RAG Q&A:**

1. User submits a question on the Q&A page.
2. `POST /api/QA` embeds the question via Gemini.
3. pgvector performs a cosine-similarity search over `SourceCodeEmbedding` rows for the active project.
4. Top-K relevant chunks are retrieved and injected into a Gemini prompt.
5. Gemini generates an answer grounded in the retrieved code.
6. The question + answer is saved to `Question` in Postgres.

---

## 6. Prisma Schema (Implemented)

> This is the real, implemented schema using Better Auth and pgvector.

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  directUrl  = env("DIRECT_URL")
  extensions = [vector]
}

model User {
  id             String          @id
  name           String
  email          String
  emailVerified  Boolean         @default(false)
  image          String?
  firstName      String?
  lastName       String?
  credits        Int             @default(150)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  sessions       Session[]
  accounts       Account[]
  userToProjects UserToProject[]

  @@unique([email])
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([token])
  @@index([userId])
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  issuer                String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@index([userId])
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([identifier])
}

model Project {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  name        String
  githubUrl   String
  githubToken String?

  deletedAt            DateTime?
  userToProjects       UserToProject[]
  commits              Commit[]
  sourceCodeEmbeddings SourceCodeEmbedding[]
}

model UserToProject {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  userId    String
  projectId String

  user    User    @relation(fields: [userId], references: [id])
  project Project @relation(fields: [projectId], references: [id])

  @@unique([userId, projectId])
}

model Commit {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  projectId String
  project   Project @relation(fields: [projectId], references: [id])

  commitMessage      String
  commitHash         String
  commitAuthorName   String
  commitAuthorAvatar String
  commitDate         DateTime

  // ai summary
  summary String

  @@unique([projectId, commitHash])
}

model SourceCodeEmbedding {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  content    String
  fileName   String
  filePath   String
  chunkIndex Int

  embedding Unsupported("vector(768)")?

  projectId String
  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
}
```

---

## 7. API Route Map

> Reflects the implemented Next.js API routes.

| Route | Method | Description |
|---|---|---|
| `/api/auth/[...all]` | POST/GET | Better Auth handler. |
| `/api/project` | POST/GET | Create project + background index / List projects. |
| `/api/commits` | GET | Fetch commits for a project. |
| `/api/QA` | POST | Embed query → pgvector search → stream Gemini answer + file refs. |
| `/api/source-code` | GET | Fetch reconstructed source code chunks. |

> **To be completed in the future.** Procedures for PR Intelligence and Issue Intelligence are defined when Workspace module is implemented.

---

## 8. Engineering Philosophy

1. **App Router first.** No `getServerSideProps`, no `getStaticProps`. RSC where possible, client components only when interactivity requires it.
2. **Next.js API Routes are the API boundary.** No tRPC.
3. **Single database.** pgvector lives inside the same Postgres instance. No separate vector service.
4. **Gemini for everything AI.** Do not introduce other AI providers.
5. **Credits protect costs.** Every Gemini call that costs money must deduct credits before execution.
6. **Soft deletes.** Projects are archived, not hard-deleted, to preserve referential integrity for embeddings and Q&A history.
7. **No meetings. Ever.** The word "meeting" must not appear in code, schema, or UI copy.
8. **Workspace inherits, never reinvents.** When built, it reuses every pattern already established — no new state management, no new styling approach, no new backend conventions.

---

## 9. Open Assumptions

| #   | Assumption                                                                     | Flag       |
| --- | ------------------------------------------------------------------------------ | ---------- |
| 1   | 150 free credits granted on new account creation.                              | ASSUMPTION |
| 2   | Default credit bundle: 100 credits for $2.00.                                  | ASSUMPTION |
| 3   | PR analysis cost: 5 credits.                                                   | ASSUMPTION |
| 4   | Issue analysis cost: 3 credits.                                                | ASSUMPTION |
| 5   | Gemini embedding dimension: 768.                                              | RESOLVED |
| 6   | GitHub token stored encrypted server-side (encryption strategy TBD in Step 3). | ASSUMPTION |

---

## 10. Development Phases

This project is built in five sequential phases. The planning documents are frozen during Phase 1 and updated only at the transitions described below.

| Phase | Name                                    | Docs status                                                              |
| ----- | --------------------------------------- | ------------------------------------------------------------------------ |
| **1** | Functional tutorial implementation      | All 4 docs frozen — do not read, modify, or reference them               |
| **2** | Documentation update                    | Update `01`, `03`, `04` to reflect the real codebase; `02` untouched     |
| **3** | UI redesign (Antigravity visual system) | Apply `02_UI_DESIGN_SYSTEM.md` to the real app; no functionality changes |
| **4** | Workspace implementation                | Build PR & Issue Intelligence; inherits all existing conventions         |
| **5** | Landing page                            | Build marketing page per `02_UI_DESIGN_SYSTEM.md` Section 14             |

### Phase 1 — Functional Tutorial Implementation

Follow the YouTube tutorial as closely as possible using the approved tech stack. Intentional deviations:

- Remove every Meeting-related feature.
- Do not implement AssemblyAI or Firebase Storage.
- Replace the Meetings nav item with a simple **Workspace stub page** (placeholder only — not implemented).
- Do not design or implement the real Workspace module yet.

**All 4 planning documents are frozen during this phase.** Do not read, analyze, or modify them.

### Phase 2 — Documentation Update

Once the tutorial implementation is complete, update `01_PROJECT_BLUEPRINT.md`, `03_PAGE_IMPLEMENTATION.md`, and `04_ANIMATIONS_AND_SCROLL.md` so they accurately reflect the real codebase — actual routes, folder structure, component hierarchy, tRPC procedures, Prisma schema, and filenames. `02_UI_DESIGN_SYSTEM.md` is not touched.

### Phase 3 — UI Redesign

Apply `02_UI_DESIGN_SYSTEM.md` to the completed, documented application. Changes appearance only — colors, typography, surfaces, motion. No functionality changes, no route changes, no data flow changes.

### Phase 4 — Workspace Implementation

Design and build the real Workspace module (Pull Request Intelligence + Issue Intelligence) as defined conceptually in Pillar 2 above. The Workspace must inherit every convention established by the completed application. Implementation details are derived from the real codebase at this point, not from this document.

### Phase 5 — Landing Page

Build the public marketing landing page per the Landing Page system defined in `02_UI_DESIGN_SYSTEM.md` Section 14.

---

_Next update: Workspace Implementation._
