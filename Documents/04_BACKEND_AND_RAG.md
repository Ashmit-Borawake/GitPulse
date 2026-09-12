# 04 — GitPulse Backend and RAG Architecture

> **Document Status:** Reflects the currently implemented backend, AI, indexing, and RAG pipeline as of Phase 6 complete.
> This is the primary deep-technical reference. High-level architecture belongs in `01_PROJECT_BLUEPRINT.md`. Frontend details belong in `03_PAGE_IMPLEMENTATION.md`.

---

## Table of Contents

1. [Document Purpose](#1-document-purpose)
2. [Backend Architecture Overview](#2-backend-architecture-overview)
3. [API Route Documentation](#3-api-route-documentation)
4. [Authentication and Authorization](#4-authentication-and-authorization)
5. [Database Architecture](#5-database-architecture)
6. [GitHub Integration](#6-github-integration)
7. [Project Creation and Background Processing](#7-project-creation-and-background-processing)
8. [Repository Loading](#8-repository-loading)
9. [Hybrid File Filtering System](#9-hybrid-file-filtering-system)
10. [Chunking Pipeline](#10-chunking-pipeline)
11. [Embedding Pipeline](#11-embedding-pipeline)
12. [Embedding API Key Pool](#12-embedding-api-key-pool)
13. [Database Vector Storage](#13-database-vector-storage)
14. [RAG Retrieval Pipeline](#14-rag-retrieval-pipeline)
15. [Context Construction](#15-context-construction)
16. [Q&A Generation Pipeline](#16-qa-generation-pipeline)
17. [Q&A Streaming Architecture](#17-qa-streaming-architecture)
18. [File References](#18-file-references)
19. [Generative API Key Pool](#19-generative-api-key-pool)
20. [Round-Robin + Failover](#20-round-robin--failover)
21. [Commit Summarization Pipeline](#21-commit-summarization-pipeline)
22. [Logging and Observability](#22-logging-and-observability)
23. [Error Handling and Resilience](#23-error-handling-and-resilience)
24. [Performance and Scalability Considerations](#24-performance-and-scalability-considerations)
25. [Security Considerations](#25-security-considerations)
26. [Current Backend Status](#26-current-backend-status)
27. [Future Backend Improvements](#27-future-backend-improvements)
28. [End-to-End Complete Architecture](#28-end-to-end-complete-architecture)

---

## 1. Document Purpose

This document covers the complete backend, AI, and data pipeline implementation:

- API route design and behavior
- Authentication and project authorization
- Database schema and relationships
- GitHub integration (commit fetching, diff retrieval)
- Repository source code loading
- Two-pass hybrid file filtering
- Code chunking strategy
- Gemini embedding generation
- Embedding API key pool (round-robin + 429 rotation)
- pgvector vector storage
- RAG retrieval (similarity search)
- Q&A pipeline (prompt construction + Gemini generation)
- Native streaming architecture
- File reference delivery via HTTP header
- Generative API key pool (round-robin + failover + cooldowns)
- Commit summarization
- Logging and observability
- Error handling

---

## 2. Backend Architecture Overview

```
Frontend (React / Next.js Client)
    ↓ HTTP
Next.js API Routes (src/app/api/)
    ↓ Better Auth session validation
Authentication / Authorization
    ↓ Prisma ORM
Database Logic (src/server/db.ts)
    ↓ Business logic delegation
src/lib/
    ├── github.ts         ← Commit fetching, diff retrieval, pollCommits
    ├── github-loader.ts  ← Repo loading, filtering, chunking, embedding orchestration
    └── gemini.ts         ← Embedding pool, generation pool, RAG retrieval, streaming
    ↓ External API calls
External Services
    ├── GitHub REST API (via Octokit + fetch)
    ├── Google Gemini API (gemini-embedding-2, gemini-3.6-flash)
    └── PostgreSQL / Supabase (with pgvector)
```

---

## 3. API Route Documentation

### Authentication API

**File:** `src/app/api/auth/[...all]/route.ts`

Better Auth catch-all route. Handles all authentication operations:
- `POST /api/auth/sign-in/email` — email/password login
- `POST /api/auth/sign-up/email` — email/password registration
- `GET /api/auth/session` — session retrieval
- `POST /api/auth/sign-out` — logout
- `GET /api/auth/callback/google` — Google OAuth callback
- `GET /api/auth/callback/github` — GitHub OAuth callback

No custom logic — routes directly to the Better Auth handler.

---

### `POST /api/project` — Create Project

**File:** `src/app/api/project/route.ts`

| Property | Value |
|---|---|
| Method | POST |
| Auth | Required — session validated via `auth.api.getSession()` |
| Content-Type | `application/json` |

**Request Body:**
```json
{
  "projectName": "string (required)",
  "repoUrl": "string (required)",
  "githubToken": "string (optional)"
}
```

**Validation:**
- Session must exist → 401 if not
- `projectName` and `repoUrl` must be non-empty strings → 400 if missing
- Empty string `githubToken` is coerced to `undefined`

**Processing Steps:**
1. Create `Project` record in DB with `name`, `githubUrl`, `githubToken`
2. Create `UserToProject` junction record linking the session user to the project
3. Call `pollCommits(project.id, githubToken)` **synchronously** (awaited — errors caught gracefully)
4. Start `indexGithubRepo(project.id, repoUrl, githubToken)` **asynchronously** (NOT awaited — `.catch()` logs errors)

**Response (201):**
```json
{
  "success": true,
  "project": { ...projectObject },
  "commitSyncError": "optional string if commit sync failed"
}
```

**Error Handling:**
- GitHub rate limit → `commitSyncError: "GitHub API rate limit reached..."`
- Private repo without token → `commitSyncError: "Unable to access the GitHub repository..."`
- Other commit errors → `commitSyncError: "We couldn't finish indexing..."`
- Project still created even on commit sync failure
- 500 only if the `db.project.create` itself fails

---

### `GET /api/project` — List Projects

**File:** `src/app/api/project/route.ts`

| Property | Value |
|---|---|
| Method | GET |
| Auth | Required |

Returns all `Project` records where the current user has a `UserToProject` membership. Filters by `userToProjects.some { userId: session.user.id }`.

**Response (200):** Array of `Project` objects.

---

### `GET /api/commits` — Fetch Commits

**File:** `src/app/api/commits/route.ts`

| Property | Value |
|---|---|
| Method | GET |
| Auth | Required |
| Query | `?projectId=<string>` |

**Processing Steps:**
1. Validate session → 401 if missing
2. Validate `projectId` query param → 400 if missing
3. Verify `UserToProject` membership → 403 if user has no access to the project
4. Fire `pollCommits(projectId)` non-blocking (`.then().catch()`) — checks for new commits in background
5. Query `db.commit.findMany({ where: { projectId }, orderBy: { commitDate: 'desc' } })`

**Response (200):** Array of `Commit` objects ordered newest-first.

---

### `POST /api/QA` — RAG Q&A Streaming

**File:** `src/app/api/QA/route.ts`

| Property | Value |
|---|---|
| Method | POST |
| Auth | Not session-checked (but projectId scopes all retrieval) |
| Content-Type | `application/json` |

**Request Body:**
```json
{
  "question": "string (required, max 2000 chars)",
  "projectId": "string (required, non-empty)"
}
```

**Validation:**
- Invalid JSON body → 400
- Missing or empty `question` → 400
- `question.length > 2000` → 400
- Missing or empty `projectId` → 400

**Processing:**
1. Parse and validate body
2. Call `askQuestionWithContext(question.trim(), projectId.trim())`
3. Returns `{ stream: ReadableStream<Uint8Array>, filesReferences: FileReference[] }`

**Response (200):**
```
Body:    streaming text/plain (the AI answer — chunks arrive progressively)
Headers:
  Content-Type: text/plain; charset=utf-8
  X-File-References: JSON.stringify(filesReferences)
```

`filesReferences` contains only metadata — `fileName`, `filePath`, `chunkIndex`, `similarity`. No `sourceCode`.

**Error (500):** If `askQuestionWithContext` throws (e.g., all keys unavailable):
```json
{ "error": "An error occurred while processing your question." }
```

---

## 4. Authentication and Authorization

### Concepts

**Authentication** = confirming who the user is (session cookie → user identity).

**Authorization** = confirming whether that user can access a specific resource (project membership check).

### Server Auth Instance

**File:** `src/lib/auth.ts`

Better Auth server configuration. Configured with:
- PostgreSQL adapter via `prismaAdapter(db, { provider: "postgresql" })`
- Email/password provider
- Google OAuth social provider
- GitHub OAuth social provider

Used in API routes via `auth.api.getSession({ headers })`.

### Client Auth Instance

**File:** `src/lib/auth-client.ts`

Better Auth React client. Used in frontend pages and components:
- `authClient.signIn.email()`
- `authClient.signUp.email()`
- `authClient.signIn.social({ provider: "google" | "github" })`
- `authClient.signOut()`
- `authClient.useSession()` — reactive session state

### Session Flow

```
HTTP request arrives at protected route
    ↓
auth.api.getSession({ headers: request.headers })
    ↓ reads session cookie
Validates session token against Session table in PostgreSQL
    ↓ returns Session + User data
Used for userId in all subsequent DB queries
```

### Project Authorization

For project-specific operations (`/api/commits`, dashboard data):

```typescript
const membership = await db.userToProject.findUnique({
    where: {
        userId_projectId: {
            userId: session.user.id,
            projectId,
        },
    },
});
if (!membership) → 403 "Project not found or access denied"
```

`/api/QA` currently does not validate project membership explicitly — the `projectId` filter in the pgvector query naturally scopes retrieval to that project's data, preventing cross-project leakage. Authentication-level ownership check is not implemented on this endpoint.

---

## 5. Database Architecture

**ORM:** Prisma 6
**Database:** PostgreSQL (Supabase-hosted)
**Extension:** pgvector (enabled via `extensions = [vector]` in `datasource`)

### Better Auth Models

#### `User`
```
id             String   @id
name           String
email          String   @unique
emailVerified  Boolean  @default(false)
image          String?
firstName      String?
lastName       String?
credits        Int      @default(150)
createdAt      DateTime @default(now())
updatedAt      DateTime @updatedAt
```

Relations: `sessions`, `accounts`, `userToProjects`

`credits` is schema-ready for a future credits system. Deduction logic is not yet implemented.

#### `Session`
Managed by Better Auth. Stores active session tokens with expiry timestamps.

#### `Account`
Managed by Better Auth. Links a user to OAuth provider accounts (Google, GitHub).

#### `Verification`
Managed by Better Auth. Email verification tokens.

---

### GitPulse Models

#### `Project`
```
id           String    @id @default(cuid())
name         String
githubUrl    String
githubToken  String?
deletedAt    DateTime?
createdAt    DateTime  @default(now())
updatedAt    DateTime  @updatedAt
```
Relations: `userToProjects`, `commits`, `sourceCodeEmbeddings`

`githubToken` is optional — provided by user for private repos or higher API rate limits. Stored in plaintext in the DB (not encrypted at rest by application layer).

`deletedAt` is present in the schema (`DateTime?`) but **soft-delete logic is not implemented** — no queries currently filter by `deletedAt`. The field exists for future use.


#### `UserToProject`
```
id        String   @id @default(cuid())
userId    String
projectId String
@@unique([userId, projectId])
```
Junction table implementing the many-to-many relationship between users and projects. A user can belong to multiple projects; a project can have multiple users.

#### `Commit`
```
id                 String   @id @default(cuid())
projectId          String
commitHash         String
commitMessage      String
commitAuthorName   String
commitAuthorAvatar String
commitDate         DateTime
summary            String
@@unique([projectId, commitHash])
```
Stores one record per commit per project. The `@@unique` constraint prevents duplicate insertions if `pollCommits` runs concurrently.

#### `SourceCodeEmbedding`
```
id         String   @id @default(cuid())
content    String
fileName   String
filePath   String
chunkIndex Int
embedding  Unsupported("vector(768)")?
projectId  String
@@index([projectId])
onDelete: Cascade (from Project relation)
```

The `embedding` column uses pgvector's native `vector(768)` type. Prisma does not natively support it, so it is declared as `Unsupported("vector(768)")` — raw SQL is used for insertion and similarity search.

`onDelete: Cascade` means deleting a `Project` also deletes all its `SourceCodeEmbedding` records.

### Relationships

```
User
  ↔ UserToProject (many-to-many)
  ↔ Project

Project
  → Commit[] (one-to-many, cascade on delete)
  → SourceCodeEmbedding[] (one-to-many, cascade on delete)
  → UserToProject[] (one-to-many)
```

---

## 6. GitHub Integration

**File:** `src/lib/github.ts`

**Library:** `octokit` — official GitHub API client

### `getCommitHashes(githubUrl, githubToken?)`

Parses owner and repo from the GitHub URL, creates an Octokit instance (with auth token if provided), and calls `octokit.rest.repos.listCommits()`.

Returns the **top 10 commits** sorted by date descending.

Fields returned per commit: `commitHash`, `commitMessage`, `commitAuthorName`, `commitAuthorAvatar`, `commitDate`.

Token resolution:
```
githubToken argument
    ↓ if not provided
process.env.GITHUB_TOKEN
    ↓ if not set
Unauthenticated request (60 req/hour limit)
```

---

### `filterUnprocessedCommits(projectId, commitHashes)`

Queries the DB for all existing commits for the project. Returns only the commits from `commitHashes` that are not already in the DB.

```typescript
const processedHashes = new Set(processedCommits.map(r => r.commitHash));
return commitHashes.filter(c => !processedHashes.has(c.commitHash));
```

---

### `fetchCommitDiff(githubUrl, commitHash, githubToken?)`

Fetches the raw `.diff` content for a single commit via:
```
GET ${githubUrl}/commit/${commitHash}.diff
Accept: application/vnd.github.v3.diff
Authorization: Bearer <token>  (if provided)
```

Returns the raw diff text. Throws on non-OK HTTP response.

---

### `pollCommits(projectId, githubToken?)`

Top-level orchestrator with a concurrency guard.

**`inFlightPolls` guard:**
```typescript
const inFlightPolls = new Map<string, Promise<unknown>>();

if (inFlightPolls.has(projectId)) {
    return inFlightPolls.get(projectId); // return existing promise
}
```

Prevents duplicate concurrent execution for the same project. If `pollCommits` is called while it is already running for a project, the second call simply awaits the first's result.

**Full flow:**
```
fetchProjectGithubUrl(projectId)         → get githubUrl and stored token
getCommitHashes(githubUrl, token)        → top-10 commits from GitHub
filterUnprocessedCommits(projectId, ...)  → only new commits
if unprocessedCommits.length === 0 → return []

fetchCommitDiff() × N (Promise.allSettled — parallel, failures don't abort others)
→ commitDiffs: { commitHash, diff }[]

aiSummariseCommits(commitDiffs)          → { commitHash, summary }[] from Gemini

Build DB records, skip commits with no matching summary

db.commit.createMany({ data: records, skipDuplicates: true })
→ return commit count
```

Errors during diff fetching are logged but don't abort the batch — `Promise.allSettled` ensures other commits are still processed.

---

## 7. Project Creation and Background Processing

**Sequence from `POST /api/project`:**

```
1. Validate request body
2. Create Project + UserToProject in DB (single Prisma call with nested write)
3. SYNCHRONOUS: await pollCommits(project.id, githubToken)
        Commits fetched, summarized, saved to DB before response
        If pollCommits fails → error captured, stored as commitSyncError
        Project is still created and returned
4. ASYNCHRONOUS: indexGithubRepo(...).catch(console.error)
        NOT awaited — runs in background
        Response returned immediately after pollCommits completes
5. Return 201 with project object (and optional commitSyncError)
```

**Critical detail:** `indexGithubRepo` is **fire-and-forget**. For a large repository, indexing may take several minutes. The API response is returned to the user long before indexing completes. The `/dashboard` is immediately accessible; Q&A only becomes useful once indexing finishes.

---

## 8. Repository Loading

**File:** `src/lib/github-loader.ts`

**Library:** `@langchain/community` — `GithubRepoLoader`

### `loadGithubRepo(githubUrl, githubToken?)`

Creates a `GithubRepoLoader` with:
- `branch: "main"` — **hardcoded** to the `main` branch (no auto-detection of default branch)
- `recursive: true` — loads all files in all subdirectories
- `unknown: "ignore"` — silently ignores unrecognized/binary files (not `"warn"` — prevents log noise)
- `maxConcurrency: 5` — 5 concurrent requests to the GitHub API
- `ignoreFiles`: array of glob patterns (first-pass filter, see Section 9)
- `ignorePaths`: array of directory path prefixes to skip entirely

Returns an array of LangChain `Document` objects, each with:
- `pageContent` — the file's text content
- `metadata.source` — the file path within the repository

---

## 9. Hybrid File Filtering System

The filtering system uses **two passes** to eliminate non-code assets before embedding.

### Philosophy

```
KNOWN GOOD  → Extension allowlist → Index immediately
KNOWN BAD   → Binary extension blocklist → Reject immediately
UNKNOWN     → Path check → JSON check → looksLikeText() → accept or reject
```

---

### Pass 1: Loader-Level Filtering (Before Download)

Configured directly on `GithubRepoLoader` via `ignoreFiles` and `ignorePaths`.

**`ignoreFiles`** — glob patterns for files to skip at load time:
- Lock files: `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, `bun.lockb`, etc.
- Generated files: `*.min.js`, `*.min.css`, `*.bundle.js`, `*.map`
- Environment files: `.env*` (except `.env.example`)
- Build artifacts: `*.d.ts`, output files

**`ignorePaths`** — directory prefixes to skip entirely:
- `node_modules/`
- `.next/`
- `dist/`
- `build/`
- `.git/`

**Why filter before download?** Fetching files from GitHub consumes API rate limit and memory. Eliminating large categories (e.g., `node_modules`) before download is critical for performance.

---

### Pass 2: `shouldIndexFile()` — Post-Load Filter

Applied to each loaded document after retrieval. Returns `true` to index, `false` to skip.

**Rule order (evaluated in sequence):**

#### Rule 1: Asset Path Segment Detection

```typescript
const ASSET_PATH_SEGMENTS = ['/assets/', '/static/', '/images/', '/img/', '/icons/', '/fonts/', '/media/', '/public/'];
if (ASSET_PATH_SEGMENTS.some(seg => filePath.includes(seg))) return false;
```

Excludes files in directories that conventionally contain only static assets, regardless of file extension.

---

#### Rule 2: Binary Extension Blocklist

```typescript
const KNOWN_BINARY_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp4', '.mp3', '.wav', '.ogg', '.webm',
    '.zip', '.tar', '.gz', '.rar', '.7z', '.pdf', '.exe', '.dll'];
```

If the file extension is in this blocklist → reject immediately. No text/heuristic check needed.

---

#### Rule 3: Source Extension Allowlist

```typescript
const KNOWN_SOURCE_EXTENSIONS = ['.js', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java',
    '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.swift', '.kt',
    '.vue', '.svelte', '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.md', '.mdx', '.sh', '.bash', '.yaml', '.yml', '.toml', '.prisma',
    '.graphql', '.sql', '.dockerfile', /* etc. */];
```

If the extension is known-good → accept immediately. No further checks.

---

#### Rule 4 & 5: JSON Special-Casing

```typescript
const INDEXABLE_JSON_FILENAMES = ['package.json', 'tsconfig.json', 'jsconfig.json',
    '.eslintrc.json', 'next.config.json', /* etc. */];

if (extension === '.json') {
    return INDEXABLE_JSON_FILENAMES.includes(fileName);
}
```

Most `.json` files should NOT be indexed (Lottie animations, i18n data, config dumps). Only specific, named JSON config files are whitelisted.

---

#### Rule 6: Unknown Extension — Binary Heuristic

```typescript
function looksLikeText(content: string): boolean {
    const sample = content.slice(0, 4096);
    const controlChars = sample.split('').filter(c => {
        const code = c.charCodeAt(0);
        return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 0;
    });
    return (controlChars.length / sample.length) <= 0.01;  // >1% control chars → binary
}
```

For completely unknown extensions: sample the first 4096 characters. If more than 1% are control/NUL characters → the file is likely binary → reject. Otherwise → accept.

---

## 10. Chunking Pipeline

**Library:** `RecursiveCharacterTextSplitter` from LangChain

**Configuration:**
```typescript
new RecursiveCharacterTextSplitter({
    chunkSize: 1500,        // maximum characters per chunk
    chunkOverlap: 150,      // overlap between adjacent chunks
})
```

**Metadata preservation:** Each chunk inherits the source document's metadata. The `chunkIndex` is added per-file (0-based index within that file's chunks).

**Pathological File Safeguard:**
```typescript
const MAX_CHUNKS_PER_FILE = 150;

if (fileChunks.length > MAX_CHUNKS_PER_FILE) {
    console.warn(`[Chunking] SKIPPED: ${filePath} produced ${fileChunks.length} chunks (>${MAX_CHUNKS_PER_FILE})`);
    continue; // Skip entire file
}
```

**Why skip rather than truncate?**
Truncating silently gives the AI an incomplete picture of the implementation. The first `N` chunks may appear coherent but represent only a fraction of the file's logic. Skipping and logging forces explicit investigation and exclusion.

---

## 11. Embedding Pipeline

**File:** `src/lib/gemini.ts`

### `generateEmbedding(texts: string[])`

Converts an array of text strings into 768-dimensional numerical vectors.

**Model:** `gemini-embedding-2`
**Output Dimensionality:** 768 (explicitly set via `outputDimensionality: 768`)
**Batch limit:** `MAX_EMBED_BATCH_SIZE = 50` chunks per API call

**Asymmetric Retrieval Format:** Two different text formats are used to separate storage from retrieval semantics:
- **Storage (indexing):** each chunk is embedded as `"title: <filePath> | text: <source code>"` — gives the embedding model lightweight file-location context alongside the code.
- **Retrieval (Q&A):** the query is embedded as `"task: code retrieval | query: <question>"` — explicitly signals retrieval intent to the model.

**Input:** `formattedContents` — each text wrapped in `{ parts: [{ text }] }` to produce separate embedding vectors per chunk.

**Output:** `{ vectors: number[][], keyIndex: number }` — array of 768-d arrays plus the 1-based index of the key that succeeded.

**Validation:** Verifies that the API returned exactly `texts.length` embeddings, each with exactly 768 dimensions.

---

## 12. Embedding API Key Pool

**File:** `src/lib/gemini.ts`

### Architecture

```typescript
function buildEmbeddingKeyPool(): GoogleGenAI[]
const embeddingPool: GoogleGenAI[] = buildEmbeddingKeyPool();
let embeddingKeyIndex = 0;
```

`buildEmbeddingKeyPool()` discovers keys by iterating `GEMINI_API_KEY_1` through `GEMINI_API_KEY_10`, plus a legacy `GEMINI_API_KEY` fallback. Throws at module load if no keys are configured.

### Round-Robin Mechanism

The **global** `embeddingKeyIndex` advances to the next key only on **success**:
```typescript
embeddingKeyIndex = (currentKeyIdx + 1) % poolSize;
```

During internal 429 rotation (within a single call), a **local** `triedKeyCount` offset is used — the global cursor is not mutated until a key succeeds. This ensures the next independent batch always starts from the key after the one that successfully completed the previous batch.

### 429 Handling

```
429 detected by isRateLimitError():
    error instanceof ApiError
    AND error.status === 429
    AND message contains "quota" OR "rate limit" OR "resource_exhausted"
        ↓
Rotate local key pointer (triedKeyCount++)
    ↓
If untried keys remain → try next key immediately
    ↓
If all keys tried:
    If all were 503 (not 429) → throw immediately
    Otherwise → sleep 61 seconds → reset local offset → retry all keys
```

**Why 61 seconds?** Gemini's per-minute quota window is 60 seconds. Sleeping 61 seconds allows the TPM limit to reset.

### 503 Handling (Per Key)

Before outer key rotation, each key gets up to `MAX_RETRIES = 3` attempts on 503:
- Attempt 1 → 1s wait
- Attempt 2 → 2s wait
- Attempt 3 → throw to outer catch → triggers key rotation

### `isRateLimitError(error)`

```typescript
function isRateLimitError(error: unknown): boolean {
    if (!(error instanceof ApiError) || error.status !== 429) return false;
    const msg = (error.message ?? '').toLowerCase();
    return msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource_exhausted');
}
```

Prevents auth failures, policy violations, and other 429-adjacent errors from triggering unnecessary key rotation.

---

## 13. Database Vector Storage

**File:** `src/lib/gemini.ts` (within `indexGithubRepo`)

### Insertion Strategy

Prisma does not support the `vector(768)` type natively, so a **two-step** strategy is used:

**Step 1 — Create the scalar fields via Prisma:**
```typescript
const record = await db.sourceCodeEmbedding.create({
    data: { content, fileName, filePath, chunkIndex, projectId },
});
```

**Step 2 — Write the embedding vector via raw SQL:**
```typescript
await db.$executeRaw`
    UPDATE "SourceCodeEmbedding"
    SET "embedding" = ${embedding.embedding}::vector
    WHERE "id" = ${record.id}
`;
```

The `::vector` cast converts the JavaScript `number[]` array to pgvector's native `vector(768)` type. The record ID from Step 1 is used as the update key, ensuring the vector is written to exactly the correct row.

This two-step approach avoids needing a full raw INSERT and lets Prisma handle ID generation, timestamps, and relations — while delegating only the unsupported `vector` column to raw SQL.

### Why `projectId` is Stored with Each Chunk

Project isolation: every similarity search MUST filter by `projectId`. Without it, a user could retrieve embeddings from another user's project. Storing `projectId` on each embedding row enables efficient index-backed filtering at query time via `@@index([projectId])`.

---

## 14. RAG Retrieval Pipeline

**File:** `src/lib/gemini.ts` — `retrieveRelevantCode(question, projectId)`

### Step 1 — Query Formatting

```typescript
const queryText = `task: code retrieval | query: ${question}`;
```

The `gemini-embedding-2` model supports **asymmetric retrieval** — the query format differs from the storage format. Using this prefix improves similarity matching by telling the model that this embedding is for retrieval rather than storage.

---

### Step 2 — Query Embedding

Embeds `queryText` using the embedding pool (`generateEmbedding([queryText])`).

Returns a single 768-d vector.

---

### Step 3 — pgvector Similarity Search

Uses Prisma's `$queryRaw` tagged template literal for parameterized SQL:
```sql
SELECT
    "fileName",
    "filePath",
    "content",
    "chunkIndex",
    1 - ("embedding" <=> ${vectorQuery}::vector) AS similarity
FROM "SourceCodeEmbedding"
WHERE
    "projectId" = ${projectId}
    AND 1 - ("embedding" <=> ${vectorQuery}::vector) > 0.5
ORDER BY similarity DESC
LIMIT 10
```

(`$queryRaw` is used here for SELECT because it returns typed rows. `$executeRaw` is used for the UPDATE in vector storage because it returns row count, not data.)

- `<=>` — pgvector cosine distance operator
- `1 - cosine_distance` = cosine similarity (range: 0 to 1, 1 being identical)
- `RETRIEVAL_SIMILARITY_THRESHOLD = 0.5` — chunks below 0.5 similarity are not returned
- `LIMIT 10` — maximum 10 chunks per query
- `WHERE projectId = ?` — project isolation (critical)

### Step 4 — Retrieved Chunks

Each returned row contains:

| Field | Source | Purpose |
|---|---|---|
| `fileName` | `SourceCodeEmbedding.fileName` | Display name of the file |
| `filePath` | `SourceCodeEmbedding.filePath` | Full path within the repository |
| `sourceCode` | `SourceCodeEmbedding.content` | The actual code chunk text (used for context) |
| `chunkIndex` | `SourceCodeEmbedding.chunkIndex` | Position of this chunk within the file |
| `similarity` | Computed from cosine distance | Relevance score (0–1) |

---

## 15. Context Construction

**File:** `src/lib/gemini.ts` — `buildCodeContext(chunks)`

```typescript
function buildCodeContext(chunks: RetrievedCodeChunk[]): string {
    return chunks
        .map(chunk => `source: ${chunk.filePath}\ncode content:\n${chunk.sourceCode}`)
        .join('\n\n---\n\n');
}
```

**Conceptual example:**

```
source: src/lib/auth.ts
code content:
import { betterAuth } from "better-auth";
...

---

source: src/app/api/auth/[...all]/route.ts
code content:
import { auth } from "@/lib/auth";
...
```

The separator `---` clearly delineates chunk boundaries for the model. Each chunk is labeled with its file path so the model can reason about which file a piece of code belongs to.

**Why only relevant chunks?** Providing the entire codebase in the prompt is impractical (context window limits, token costs). Using only the top-10 most semantically similar chunks gives the model focused, highly relevant context.

---

## 16. Q&A Generation Pipeline

**File:** `src/lib/gemini.ts` — `askQuestionWithContext(question, projectId)`

### Full Step-by-Step Flow

```
Step 1: retrieveRelevantCode(question, projectId)
        → top-10 RetrievedCodeChunk[]
        (includes sourceCode for context building)

Step 2: Derive FileReference[] from chunks
        → removes sourceCode from each reference
        → { fileName, filePath, chunkIndex, similarity }[]

Step 3: buildCodeContext(chunks)
        → human-readable context string

Step 4: Build Gemini prompt
        System persona: expert AI code assistant
        Grounding instruction: "Take into account any CONTEXT BLOCK"
        Context block: retrieved code
        Question block: user's question
        Fallback instruction: "If the context does not provide the answer...
            say 'I'm sorry, but I don't know the answer based on the available
            repository context.'"
        Format: Answer in Markdown with code snippets

Step 5: executeWithGenerationFailover('Starting Q&A stream', async (client) => {
            return await client.models.generateContentStream({
                model: 'gemini-3.6-flash',
                contents: [{ parts: [{ text: prompt }] }],
            });
        });

Step 6: Convert async iterable → ReadableStream<Uint8Array>
        (see Section 17)

Step 7: return { stream, filesReferences }
```

### When Retrieval Returns No Useful Chunks

If pgvector finds no chunks above 0.5 similarity, `chunks` is empty. `buildCodeContext([])` returns `''`. The prompt receives:

```
START CONTEXT BLOCK
No relevant code context was found for this question.
END OF CONTEXT BLOCK
```

The AI is instructed to respond with the fallback message rather than hallucinate an answer.

---

## 17. Q&A Streaming Architecture

### Backend — Stream Creation

```typescript
const geminiStream = await client.models.generateContentStream({...});

const encoder = new TextEncoder();
const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
        try {
            for await (const chunk of geminiStream) {
                const text = chunk.text;
                if (text) {
                    controller.enqueue(encoder.encode(text));
                }
            }
            controller.close();
        } catch (err) {
            controller.error(err);
        }
    },
});
```

`generateContentStream()` returns a `@google/genai` **async iterable**. Each iteration yields a partial response chunk. These are encoded as `Uint8Array` and enqueued into a native `ReadableStream`.

`controller.close()` is called only on **successful completion**.
`controller.error(err)` is called on failure — no `finally` block.

### Frontend — Stream Consumption

```typescript
const reader = res.body.getReader();
const decoder = new TextDecoder();

while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    setAnswer(prev => prev + text);   // incremental append
}
```

`{ stream: true }` in `TextDecoder.decode()` handles multi-byte characters that may span chunk boundaries (e.g., CJK characters, emojis).

**Why no third-party streaming library?** The Web Streams API (`ReadableStream`, `TextEncoder`, `TextDecoder`) is available natively in modern browsers and Node.js. No additional dependencies are needed.

### Why Failover Only Applies to Stream Creation

`executeWithGenerationFailover` wraps only the `generateContentStream()` call — the point where the connection to Gemini is established and the key is selected.

Once the stream is open and chunks are being actively received, it is **not** automatically restarted on failure. Restarting mid-stream would cause duplicate content (the portion already received + the content from a fresh generation start) to reach the frontend — producing a corrupted or duplicated answer.

If the stream itself fails mid-way, `controller.error(err)` propagates the failure to the frontend, which catches it and displays a toast error.

---

## 18. File References

### Purpose

After retrieval, the exact code chunks that influenced the AI's answer are returned to the frontend. This allows users to see which files were consulted, verify accuracy, and navigate to the source.

### What Is Included

`FileReference` type (from `gemini.ts`):
```typescript
type FileReference = {
    fileName: string;     // e.g., "gemini.ts"
    filePath: string;     // e.g., "src/lib/gemini.ts"
    chunkIndex: number;   // 0-based position within the file
    similarity: number;   // cosine similarity score (0–1)
};
```

### What Is Explicitly Excluded

`sourceCode` is **not** included in `FileReference`. It is only available internally in `RetrievedCodeChunk` for building the prompt context.

**Why exclude source code from headers?**

HTTP header values are limited to **ISO-8859-1** (Latin-1) characters only — values 0–255. Source code frequently contains:
- Unicode characters (em dashes `—`, smart quotes `"`, CJK characters)
- Characters with code points > 255

Including source code caused a hard crash:
```
Cannot convert argument to a ByteString because the character at index N
has a value of 8212 which is greater than 255.
```

Additionally, HTTP headers are not designed to carry large payloads. The metadata-only approach keeps the header small and safe.

### Header/Body Separation

```
Response body:   streaming text/plain (the AI answer)
X-File-References header: JSON-encoded file metadata array
```

The body is already occupied by the streaming answer. Encoding file references into the body would require a non-streaming JSON format, breaking the live-typing user experience. The header is the correct channel for this small, structured metadata.

---

## 19. Generative API Key Pool

**File:** `src/lib/gemini.ts`

### Key Pool Construction

```typescript
type KeyClient = { client: GoogleGenAI; index: number };

function buildGenerationKeyPool(): KeyClient[] {
    const pool: KeyClient[] = [];
    for (let i = 1; i <= 10; i++) {
        const key = process.env[`GEMINI_API_KEY_${i}`];
        if (key) pool.push({ client: new GoogleGenAI({ apiKey: key }), index: i });
    }
    // Legacy fallback
    if (pool.length === 0) { ... }
    // Throws if no keys at all
    return pool;
}

const generationPool: KeyClient[] = buildGenerationKeyPool();
let generationKeyIndex = 0;
const generationCooldowns = new Map<number, number>();
const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
```

`generationPool` stores `{ client, index }` pairs — the `index` is the original 1-based key number from the environment variable, used for clear logging (`"API Key 3"`) without revealing the actual key value.

### State Variables

| Variable | Purpose |
|---|---|
| `generationKeyIndex` | Global round-robin cursor (0-based, advances after each request) |
| `generationCooldowns` | `Map<keyIndex, expiryTimestamp>` — tracks temporarily exhausted keys |
| `COOLDOWN_MS` | `3,600,000` ms = 1 hour — duration of a key cooldown after 429 |

### Round-Robin Sequence

For a 6-key pool:

```
Request 1 → Key 1 → generationKeyIndex = 1
Request 2 → Key 2 → generationKeyIndex = 2
Request 3 → Key 3 → generationKeyIndex = 3
Request 4 → Key 4 → generationKeyIndex = 4
Request 5 → Key 5 → generationKeyIndex = 5
Request 6 → Key 6 → generationKeyIndex = 0
Request 7 → Key 1 → ...
```

Both `aiSummariseCommits` and `askQuestionWithContext` share the same `generationPool`, `generationKeyIndex`, and `generationCooldowns`. They advance the cursor on every use.

---

## 20. Round-Robin + Failover

**File:** `src/lib/gemini.ts` — `executeWithGenerationFailover<T>(operationName, operation)`

### Function Signature

```typescript
async function executeWithGenerationFailover<T>(
    operationName: string,
    operation: (client: GoogleGenAI) => Promise<T>
): Promise<T>
```

Generic over `T` — works for both `generateContent()` (returns a response object) and `generateContentStream()` (returns an async iterable).

### Normal Case — Round-Robin

```
Get current key from generationPool[generationKeyIndex]
Advance generationKeyIndex = (generationKeyIndex + 1) % poolSize
Check if key is in cooldown → skip if yes (attempts++)
Execute operation(current.client)
Log success
Return result
```

---

### 429 Case — Quota Failover

```
429 detected by isRateLimitError()
    ↓
console.warn("API Key N hit rate limit (429). Failing over...")
    ↓
generationCooldowns.set(key.index, Date.now() + COOLDOWN_MS)
    (key is now in cooldown for 1 hour)
    ↓
break inner retry loop
    ↓
attempts++ → outer loop tries next key
```

The cooldown prevents future requests from repeatedly hitting the same exhausted key. When `Date.now() < cooldownExpiry`, the key is skipped entirely. When the cooldown expires, it is removed from the Map and the key becomes available again.

---

### 503 Case — Exponential Backoff on Same Key

```
503 on attempt 1 → wait 1s → retry
503 on attempt 2 → wait 2s → retry
503 on attempt 3 (MAX_RETRIES) → log "failed after N attempts. Failing over..."
    ↓
break inner retry loop → outer loop tries next key
```

Delays: `1000 * Math.pow(2, retryAttempt - 1)` → 1000ms, 2000ms, 4000ms.

---

### Non-Retryable Errors

Any error that is neither a 429 rate limit nor a 503 unavailable error is immediately re-thrown without rotation:
```typescript
// Non-retryable error (e.g. 400 Bad Request, auth failure)
throw error;
```

Examples: invalid API key (401), content policy violation (400), prompt safety block.

Rotating keys for these errors would be wasteful — the same error would occur on every key.

---

### All Keys Unavailable

If all pool keys are either in cooldown or exhausted from 503s:

```typescript
throw new Error(
    'All available Gemini generation API keys are currently unavailable or quota-exhausted.'
);
```

The API route catches this and returns HTTP 500 to the client:
```json
{ "error": "An error occurred while processing your question." }
```

This does **not** provide infinite protection — if all 6 daily RPD limits are truly exhausted, Q&A will fail until the next day's quota resets.

---

## 21. Commit Summarization Pipeline

**File:** `src/lib/gemini.ts` — `aiSummariseCommits(commits)`

### Input
```typescript
type CommitInput = {
    commitHash: string;
    diff: string;
};
```

### Processing

All commit diffs are merged into a single text block:
```
COMMIT: abc123
DIFF:
diff --git a/...
...

---

COMMIT: def456
DIFF:
...
```

This entire block is sent as ONE Gemini API call. Batching all commits reduces API requests and allows the model to see all changes in context.

### Model Behavior

The model is instructed to:
- Produce exactly one summary per commit
- NOT combine or omit any commit
- Return structured JSON: `[{ "commitHash": "...", "summary": "..." }]`
- Use multiline bullet points (`* change\n* change`) as the summary format
- Be specific and accurate — reference actual file paths

Response is validated as JSON with `responseSchema` enforcing the array structure.

### Failover Integration

```typescript
return executeWithGenerationFailover('Starting summarization', async (client) => {
    const response = await client.models.generateContent({ ... });
    const raw = response.text;
    const parsed = JSON.parse(raw) as CommitSummary[];
    return parsed;
});
```

The entire Gemini call and JSON parsing are wrapped in the failover helper.

### Result Matching

Summaries are matched to commits by `commitHash` via a `Map`, not by array index:
```typescript
const summaryByHash = new Map(summaries.map(s => [s.commitHash, s.summary]));
```

This prevents mismatched summaries if the model returns entries in a different order.

---

## 22. Logging and Observability

Structured log prefixes used throughout the pipeline:

| Prefix | Location | Covers |
|---|---|---|
| `[GitHub Loader]` | `github-loader.ts` | Repo loading progress |
| `[Filter]` | `github-loader.ts` | File filtering decisions |
| `[Chunking]` | `github-loader.ts` | Chunk counts, skipped files |
| `[Embedding]` | `github-loader.ts` + `gemini.ts` | Batch progress, key selection |
| `[Gemini]` | `gemini.ts` | Embedding pool events (429, 503, key rotation) |
| `[Gemini Generation]` | `gemini.ts` | Generation pool events (round-robin, failover, cooldown) |
| `[Gemini Q&A]` | `gemini.ts` | Retrieval results, context construction |
| `[GitHub Commits]` | `github.ts` | Commit detection, diff fetching |
| `[Database]` | `github.ts`, `github-loader.ts` | DB insertions |
| `[API QA]` | `api/QA/route.ts` | Q&A request lifecycle |

**Why structured prefixes?** Makes it trivial to `grep` specific subsystems from production logs. For example, `grep "[Gemini Generation]"` shows only generation pool events.

---

## 23. Error Handling and Resilience

| Scenario | Behavior | Recovery |
|---|---|---|
| Invalid JSON in API request | `400 { error: "Invalid JSON body." }` | Client must fix request |
| Missing `question` or `projectId` | `400` with specific message | Client must fix request |
| `question` > 2000 characters | `400` | Client must shorten |
| Unauthenticated project request | `401 { error: "Unauthorized" }` | Client must login |
| No project membership | `403 { error: "Project not found or access denied" }` | Client must check project ID |
| GitHub API rate limit during project creation | `commitSyncError` in 201 response | User can retry later or add GitHub token |
| Private repo without token | `commitSyncError` in 201 response | User must provide GitHub token |
| Commit diff fetch failure | Logged; that commit skipped; others proceed | Partial result saved |
| Binary file detected | `shouldIndexFile()` returns false; skipped | No action needed |
| Pathological file (>150 chunks) | `[Chunking] SKIPPED` logged; file not indexed | Add to explicit exclusion if needed |
| Embedding 429 | Rotate to next key in pool immediately | Transparent to caller |
| All embedding keys exhausted (429) | Sleep 61s, reset cursor, retry | 61-second delay |
| All embedding keys 503 | Throw immediately | Pipeline fails; retry indexing |
| Generation 429 | 1-hour cooldown on key, advance to next | Transparent to caller |
| Generation 503 | Exponential backoff (1s/2s/4s), then failover | Transparent if next key available |
| Non-retryable Gemini error | Throw immediately, no key rotation | Error surfaces to API caller |
| All generation keys unavailable | Throw descriptive error | HTTP 500 to client |
| Stream creation fails | Caught in API try/catch → 500 | Toast error shown to user |
| Active stream fails mid-way | `controller.error(err)` → stream terminated | Toast error; answer may be partial |
| Header `X-File-References` parse failure | Caught silently; `filesReferences = []` | Graceful — answer still streams |
| Commit summarization JSON parse failure | Throws; caught by route's pollCommits error handler | commitSyncError returned |
| DB insert failure | Logged; throws up to API handler | 500 response |

---

## 24. Performance and Scalability Considerations

### Current Strengths

- **Filtering before embedding:** Eliminating non-code files before chunking significantly reduces the number of API calls and DB writes for large repositories.
- **Batch embedding:** Up to 50 chunks per Gemini embedding call — much more efficient than one call per chunk.
- **pgvector index on `projectId`:** `@@index([projectId])` enables fast similarity searches scoped to a project without full table scans.
- **LIMIT 10 in retrieval:** Caps context size — prevents excessively long prompts for the generation model.
- **Streaming:** Answers begin appearing immediately rather than after the full response is buffered — much better perceived performance.
- **Multi-key distribution:** Round-robin spreading prevents any single key from hitting its TPM limit during high-volume indexing.

### Current Limitations

| Limitation | Description |
|---|---|
| **In-memory key state** | `generationKeyIndex`, `generationCooldowns`, and `embeddingKeyIndex` are in-memory module-level variables. Server restart resets them. |
| **Multi-instance incompatibility** | In a multi-server deployment (e.g., multiple Vercel serverless instances), each instance has its own key cursor and cooldown state. Round-robin is not globally coordinated. |
| **No incremental indexing** | Repositories are fully re-indexed from scratch — no diffing of changed files. |
| **Synchronous commit sync** | `pollCommits` is awaited in `POST /api/project`. For repos with many new commits and large diffs, this adds latency to the project creation response. |
| **Single similarity threshold** | `RETRIEVAL_SIMILARITY_THRESHOLD = 0.5` is hardcoded — cannot be tuned per project. |
| **No re-ranking** | Retrieved chunks are ordered by cosine similarity only — no cross-encoder re-ranking for higher precision. |

---

## 25. Security Considerations

| Area | Implementation |
|---|---|
| **API keys never reach the frontend** | All Gemini API calls happen server-side in `src/lib/gemini.ts` |
| **API key logging** | Only key index numbers are logged (e.g., "API Key 3") — actual key values are never logged |
| **Authentication required** | All project/commit operations require a valid Better Auth session |
| **Project authorization** | Commit endpoint verifies `UserToProject` membership before returning data |
| **pgvector project isolation** | All similarity searches include `WHERE projectId = ?` — cross-project data leakage is impossible at the query level |
| **GitHub token storage** | Stored in plaintext in `Project.githubToken` — no application-level encryption |
| **SQL injection prevention** | pgvector raw queries use Prisma's tagged template literals (`$executeRaw`) which safely parameterize all values |
| **CORS** | Managed by Next.js default behavior |
| **Session cookies** | HTTP-only cookies via Better Auth — not accessible via JavaScript |
| **Environment variables** | Secrets in `.env` (gitignored); `GEMINI_API_KEY_*` accessed via `process.env` server-side only |

---

## 26. Current Backend Status

| Subsystem | Status | Notes |
|---|---|---|
| Authentication (email) | ✅ Implemented | Better Auth |
| Authentication (Google OAuth) | ✅ Implemented | Better Auth social |
| Authentication (GitHub OAuth) | ✅ Implemented | Better Auth social |
| Session management | ✅ Implemented | PostgreSQL-backed sessions |
| Project authorization | ✅ Implemented | UserToProject membership check |
| Q&A authorization | 🟡 Partial | `projectId` scopes data; no explicit membership check |
| Project CRUD | ✅ Implemented | Create + list; no update/delete yet |
| GitHub commit fetching | ✅ Implemented | `getCommitHashes()` via Octokit |
| Duplicate commit prevention | ✅ Implemented | Schema constraint + skipDuplicates |
| Concurrent poll guard | ✅ Implemented | `inFlightPolls` Map |
| Commit diff fetching | ✅ Implemented | Raw diff via fetch |
| Commit AI summarization | ✅ Implemented | Gemini 3.6 Flash, batch |
| Repository loading | ✅ Implemented | LangChain GithubRepoLoader |
| Pass 1 file filtering | ✅ Implemented | GithubRepoLoader ignoreFiles/ignorePaths |
| Pass 2 file filtering | ✅ Implemented | `shouldIndexFile()` 6-rule hybrid |
| Code chunking | ✅ Implemented | RecursiveCharacterTextSplitter 1500/150 |
| Pathological file safeguard | ✅ Implemented | >150 chunks/file → skip |
| Embedding generation | ✅ Implemented | `gemini-embedding-2`, 768-d |
| Embedding key pool | ✅ Implemented | Round-robin, 429 rotation, 503 backoff |
| Vector storage | ✅ Implemented | pgvector `vector(768)` column |
| RAG retrieval | ✅ Implemented | pgvector cosine similarity, 0.5 threshold, LIMIT 10 |
| Context construction | ✅ Implemented | `buildCodeContext()` |
| Q&A streaming | ✅ Implemented | `ReadableStream<Uint8Array>` |
| File references | ✅ Implemented | Metadata-only in `X-File-References` header |
| Generation key pool | ✅ Implemented | Round-robin, 429 failover, 503 retry, cooldowns |
| 429 failover (generation) | ✅ Implemented | `executeWithGenerationFailover()` |
| 503 exponential backoff (generation) | ✅ Implemented | 1s, 2s, 4s per key |
| Smart cooldowns | ✅ Implemented | 1-hour in-memory Map |
| Non-retryable error detection | ✅ Implemented | Immediate throw without rotation |
| Credits deduction | ⚪ Not implemented | `User.credits` in schema; logic not built |
| Workspace / PR / Issues | ⚪ Not implemented | Planned |
| Re-indexing | ⚪ Not implemented | Full re-index only option currently |
| Distributed key state | ⚪ Not implemented | In-memory only; resets on server restart |

---

## 27. Future Backend Improvements

All items below are genuinely planned and not currently implemented.

| Improvement | Description |
|---|---|
| **Redis key state** | Distribute `generationKeyIndex` and `generationCooldowns` to Redis for multi-instance correctness |
| **Persistent cooldown tracking** | Store cooldowns in DB so server restarts don't lose cooldown information |
| **Semantic re-ranking** | Post-retrieval cross-encoder re-ranking for higher precision Q&A |
| **Hybrid search** | Combine pgvector similarity with BM25/full-text keyword search for better recall |
| **Configurable threshold** | Allow per-project similarity threshold tuning |
| **Dynamic top-K** | Adjust LIMIT based on question complexity or context window remaining |
| **Chat history** | Store previous Q&A turns; include recent conversation in the Gemini prompt |
| **Conversation persistence** | Save Q&A conversations in DB per project |
| **Background job queue** | Replace fire-and-forget `indexGithubRepo` with a proper job queue (e.g., Inngest, BullMQ) |
| **Incremental indexing** | Index only changed/new files since last indexing run |
| **Credits deduction** | Deduct `User.credits` per Q&A call; block when depleted |
| **Usage analytics** | Track Q&A usage, indexing stats, and key utilization per project |
| **Q&A authorization** | Add explicit `UserToProject` membership check in `/api/QA` |

---

## 28. End-to-End Complete Architecture

### PROJECT CREATION

```
User fills Create Project form (projectName, repoUrl, githubToken?)
    ↓
POST /api/project
    ↓
Better Auth session validated
    ↓
db.project.create + db.userToProject.create (single Prisma write)
    ↓
[SYNCHRONOUS] pollCommits(projectId)
    ├── Octokit: getCommitHashes → top-10 commits
    ├── DB filter: filterUnprocessedCommits → new commits only
    ├── GitHub fetch: fetchCommitDiff × N (Promise.allSettled)
    ├── Gemini [Generation Pool]: aiSummariseCommits → JSON summaries
    └── db.commit.createMany(skipDuplicates)
    ↓
[ASYNCHRONOUS - fire and forget] indexGithubRepo(projectId, repoUrl, token)
    ├── LangChain GithubRepoLoader → Documents (with Pass 1 filtering)
    ├── shouldIndexFile() per document (Pass 2 filtering)
    ├── RecursiveCharacterTextSplitter → chunks (1500 chars, 150 overlap)
    ├── Pathological file guard (>150 chunks → skip)
    ├── Gemini [Embedding Pool]: generateEmbedding(batch of 50) → 768-d vectors
    └── $executeRaw: INSERT INTO SourceCodeEmbedding ... ::vector
    ↓
201 response returned (project live; indexing continues in background)
```

---

### Q&A

```
User types question in AskQuestionCard → submits form
    ↓
POST /api/QA { question, projectId }
    ↓
Validate question (max 2000 chars) + projectId (non-empty)
    ↓
askQuestionWithContext(question, projectId)
    ↓
    retrieveRelevantCode(question, projectId)
        ├── Format: "task: code retrieval | query: <question>"
        ├── Gemini [Embedding Pool]: embed query → 768-d vector
        └── pgvector: cosine similarity search
                WHERE projectId = ? AND similarity > 0.5
                ORDER BY similarity DESC LIMIT 10
        → top-10 RetrievedCodeChunk[]
    ↓
    Derive FileReference[] (no sourceCode)
    buildCodeContext(chunks) → context string
    Build grounded Gemini prompt
    ↓
    executeWithGenerationFailover('Starting Q&A stream', async (client) => {
        return client.models.generateContentStream({ model, prompt })
    })
    ↓
    Async iterable → ReadableStream<Uint8Array>
    ↓
    return { stream, filesReferences }
↓
new Response(stream, {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-File-References': JSON.stringify(filesReferences)
})
↓
Browser: res.headers.get("X-File-References") → setFilesReferences()
Browser: res.body.getReader() + TextDecoder → setAnswer() incrementally
↓
Dialog: streaming answer displayed live + file names listed
```

---

### COMMIT PROCESSING

```
[Triggered by: POST /api/project (sync) OR GET /api/commits (async, background)]
    ↓
pollCommits(projectId, token?)
    ↓
inFlightPolls guard: if already running → await existing promise
    ↓
fetchProjectGithubUrl(projectId) → githubUrl, stored token
    ↓
getCommitHashes(githubUrl, token) → top-10 commits from GitHub
    ↓
filterUnprocessedCommits(projectId, commits) → only new commits
    ↓
if 0 new commits → return []
    ↓
fetchCommitDiff × N → commitDiffs (parallel, Promise.allSettled)
    ↓
executeWithGenerationFailover → aiSummariseCommits(commitDiffs)
    [Gemini Generation Pool — round-robin key selection]
    → structured JSON { commitHash, summary }[]
    ↓
Match summaries by commitHash (Map lookup)
    ↓
db.commit.createMany({ data: records, skipDuplicates: true })
    ↓
inFlightPolls.delete(projectId)
    ↓
Commits available on Dashboard CommitLog
```
