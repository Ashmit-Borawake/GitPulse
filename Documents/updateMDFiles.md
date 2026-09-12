I want to update and completely rewrite the GitPulse project documentation so it accurately reflects the CURRENT IMPLEMENTED CODEBASE.

IMPORTANT: Before modifying anything, carefully read and inspect:

1. The latest `GITPULSE_PROJECT_STRUCTURE.md`
2. The latest `PROJECT_SUMMARY.md`
3. The current actual source code across the repository
4. The existing documentation files:
   - `01_PROJECT_BLUEPRINT.md`
   - `03_PAGE_IMPLEMENTATION.md`
5. The current backend and frontend implementation, especially:
   - `src/app/`
   - `src/app/api/`
   - `src/lib/`
   - `src/server/`
   - `src/components/`
   - `prisma/schema.prisma`
   - authentication files
   - project creation flow
   - GitHub integration
   - commit processing
   - repository indexing
   - Gemini integration
   - RAG Q&A
   - streaming
   - embedding key rotation
   - generation key round-robin + failover

The latest source code and the latest `GITPULSE_PROJECT_STRUCTURE.md` are the PRIMARY SOURCE OF TRUTH.

Do NOT rely on old planning documents when they conflict with the actual implementation.

==================================================
FILES TO UPDATE
==================================================

Update ONLY these three files:

1. `01_PROJECT_BLUEPRINT.md`
2. `03_PAGE_IMPLEMENTATION.md`
3. `04_BACKEND_AND_RAG.md`

If `04_BACKEND_AND_RAG.md` does not yet exist, create it.

DO NOT MODIFY:

- `02_UI_DESIGN.md`
- `02_UI_DESIGN_SYSTEM.md`
- Any UI design documentation
- Any source code
- Any database records
- Any Prisma schema
- Any application functionality

This task is DOCUMENTATION ONLY.

Do not make any code changes.

==================================================
GENERAL DOCUMENTATION RULES
==================================================

These documents should be detailed, technical, and useful for future development.

The documentation must:

- Reflect the CURRENT ACTUAL CODEBASE.
- Use actual filenames.
- Use actual route paths.
- Use actual function names where useful.
- Use actual technologies currently implemented.
- Clearly distinguish IMPLEMENTED features from FUTURE features.
- Remove outdated assumptions.
- Remove references to technologies that are not actually used anymore.
- Do not mention Clerk if the current code uses Better Auth.
- Do not mention tRPC if the current implementation uses Next.js API routes instead.
- Do not document old planned features as implemented.
- Do not invent functionality that does not exist.
- Do not guess.
- If something is unclear, inspect the actual source code before documenting it.

Use:

- Clear Markdown headings
- Table of contents where appropriate
- Tables for structured information
- Code flow diagrams using plain text / ASCII where useful
- Architecture diagrams using text
- Clear status indicators such as:
  - ✅ Implemented
  - 🟡 Partially implemented
  - 🔵 Planned
  - ⚪ Not implemented

Avoid unnecessary marketing language.

These documents should feel like professional internal technical documentation for a real software project.

==================================================
01_PROJECT_BLUEPRINT.md
==================================================

This file should become the HIGH-LEVEL PRODUCT + ARCHITECTURE BLUEPRINT.

It should answer:

- What is GitPulse?
- What problem does it solve?
- Who is it for?
- What is currently implemented?
- How is the system architected?
- What are the major system flows?
- Why were the current technologies chosen?
- What is planned next?

Do NOT make this file a duplicate of `04_BACKEND_AND_RAG.md`.

Keep backend implementation details at a high level here.
The deep technical details belong in `04_BACKEND_AND_RAG.md`.

The new `01_PROJECT_BLUEPRINT.md` should contain detailed sections similar to:

# GitPulse — Project Blueprint

## 1. Document Status

Clearly state that this document reflects the current implemented GitPulse codebase.

Include:

- Current documentation phase
- What this document covers
- What it intentionally does not cover

---

## 2. Project Overview

Explain GitPulse as an AI-powered developer tool for understanding GitHub repositories.

Explain the core purpose:

- Connect a GitHub repository
- Analyze repository code
- Process commits
- Generate commit summaries
- Index source code
- Ask questions about the repository
- Retrieve relevant code
- Generate answers grounded in actual source code

---

## 3. Problem Statement

Explain the actual developer problems GitPulse solves:

- Understanding unfamiliar repositories
- Developer onboarding
- Finding where functionality is implemented
- Understanding commit history
- Searching code semantically
- Reducing manual repository exploration

---

## 4. Core Product Features

Document the actual implemented features.

Clearly separate:

### Implemented Features

Include things such as:

- Authentication
- Project creation
- GitHub repository linking
- Optional GitHub token support
- Commit synchronization
- AI commit summarization
- Background repository indexing
- Hybrid file filtering
- Code chunking
- Gemini embeddings
- pgvector storage
- RAG retrieval
- Project-isolated code search
- Q&A
- Streaming answers
- File references
- Embedding API key rotation
- Generative API round-robin
- Generative failover
- 429 handling
- 503 retry handling
- cooldown behavior
- structured logging

Only document these if confirmed in the actual source code.

### Planned / Future Features

Clearly document only features that are genuinely planned and not implemented.

Examples may include:

- Improved Q&A answer presentation
- Markdown rendering
- Rich code blocks
- File reference UI
- Credits deduction
- Workspace
- PR analysis
- Issue analysis
- Multi-repository intelligence
- Advanced code analysis

Verify against current project documentation and source before listing them.

---

## 5. Technology Stack

Create a detailed table with:

Technology | Purpose | Where Used

Document the actual stack, including where applicable:

- Next.js
- React
- TypeScript
- Tailwind CSS
- Better Auth
- Prisma
- PostgreSQL
- Supabase
- pgvector
- Octokit
- LangChain
- Google Gemini
- `@google/genai`
- Gemini Embedding model
- Gemini generation model
- shadcn/Base UI if currently used

Do not include unused technologies.

---

## 6. High-Level System Architecture

Create a detailed architecture explanation.

Include the major layers:

User
↓
Next.js Frontend
↓
Next.js API Routes
↓
Authentication / Authorization
↓
GitHub / Gemini / Database
↓
PostgreSQL + pgvector

Also explain the separation between:

- Frontend
- API routes
- Business logic
- Gemini integration
- GitHub integration
- Database
- RAG pipeline

---

## 7. Main System Flows

Document the high-level versions of:

### A. Authentication Flow

User
→ Login / Signup
→ Better Auth
→ Session
→ Protected routes

Use actual implementation details.

---

### B. Project Creation Flow

Document the complete high-level flow:

User creates project
→ Project validation
→ Database project creation
→ User-project relationship
→ GitHub repository processing
→ Commit synchronization
→ Background indexing

Use actual behavior from the source code.

Clearly explain asynchronous/background behavior.

---

### C. Commit Intelligence Flow

GitHub
→ Fetch commits
→ Detect new commits
→ Gemini summarization
→ Database storage
→ Dashboard display

Explain duplicate/new commit detection.

---

### D. Repository Indexing Flow

GitHub Repository
→ LangChain loader
→ First-pass filtering
→ Second-pass filtering
→ Documents
→ Chunking
→ Batching
→ Gemini embeddings
→ pgvector
→ SourceCodeEmbedding records

Keep this high-level here.

Deep details belong in `04_BACKEND_AND_RAG.md`.

---

### E. RAG Q&A Flow

User Question
→ API
→ Query formatting
→ Query embedding
→ pgvector similarity search
→ Relevant code chunks
→ Context construction
→ Gemini
→ Streamed response
→ Frontend

Explain why RAG improves accuracy.

---

## 8. AI Architecture Overview

Explain:

- Embeddings
- Generative requests
- Why they are separate workloads
- Embedding key pool
- Generation key pool
- Why pools are independent

Keep this architectural rather than implementation-heavy.

---

## 9. Database Overview

Provide a high-level overview of actual models.

Document:

- User
- Session
- Account
- Verification
- Project
- UserToProject
- Commit
- SourceCodeEmbedding

Use actual relationships from Prisma.

Do not invent fields.

Explain the purpose of each model.

---

## 10. Current Implementation Status

Create a detailed table:

Feature | Status | Notes

Examples:

Authentication
Project creation
GitHub integration
Commit sync
Commit AI summaries
Repository indexing
File filtering
Chunking
Embeddings
pgvector
RAG
Q&A streaming
Embedding key pool
Generation key pool
Credits schema
Credits deduction
Workspace
PR analysis
Issue analysis

Use actual current status.

---

## 11. Important Architectural Decisions

Document WHY important decisions were made.

Include:

- Why Next.js API routes
- Why Better Auth
- Why PostgreSQL + pgvector
- Why LangChain
- Why embeddings
- Why chunking
- Why no per-chunk summaries
- Why hybrid file filtering
- Why projectId isolation
- Why streaming
- Why separate embedding/generation pools
- Why Round-Robin
- Why Failover
- Why cooldowns

---

## 12. Development Roadmap

Document future development in logical phases.

Only include realistic planned work.

Clearly mark future work.

Do not rewrite history.

---

## 13. Important Project Rules / Constraints

Include important development constraints that are relevant for future developers.

Especially:

- Documentation must reflect source code
- Do not invent features
- Preserve database data
- Do not reset/delete the existing database during testing
- Avoid destructive database commands unless explicitly required
- Preserve existing SourceCodeEmbedding records
- Maintain project isolation for RAG queries
- Do not mix embedding and generation key pool state

Only include constraints that are still relevant.

---

## 14. Quick Architecture Summary

End with a concise architecture summary.

==================================================
03_PAGE_IMPLEMENTATION.md
==================================================

This file should become the ACTUAL FRONTEND PAGE AND ROUTE IMPLEMENTATION REFERENCE.

It should document what pages and frontend functionality CURRENTLY EXIST.

This is NOT a UI design document.

Do not focus on colors, typography, animations, or visual specifications.

`02_UI_DESIGN...` owns visual design documentation and MUST NOT be modified.

The new `03_PAGE_IMPLEMENTATION.md` should include:

# GitPulse — Page Implementation

## 1. Document Status

State that this document reflects currently implemented routes and page behavior.

Explain that visual redesign documentation belongs in file 02.

---

## 2. Application Route Overview

Create a detailed route table.

For every actual route document:

Route | File | Access | Purpose | Status

Include actual routes such as:

- `/`
- login
- signup
- dashboard
- create-project
- QA if currently implemented
- protected route group

Only use actual routes from the source.

---

## 3. Root Application Structure

Document:

- Root layout
- Providers
- Global application structure
- Session/auth integration where relevant

Use actual filenames.

---

## 4. Authentication Pages

Document separately:

### Login

Include:

- File
- Purpose
- Form behavior
- Authentication API/client integration
- OAuth if implemented
- Redirect behavior
- Error handling

### Signup

Include:

- File
- Form behavior
- Validation
- Authentication integration
- Redirect behavior

Do not describe old Clerk behavior.

Document Better Auth if that is the current implementation.

---

## 5. Protected Application Shell

Document:

- Protected layout
- Authentication/session check
- Redirect behavior
- Sidebar
- Navigation
- Shared layout components

Use actual component names.

Explain how protected pages are organized.

---

## 6. Dashboard

Document the actual dashboard.

Include:

- Page file
- Project selection/loading
- Repository banner
- Commit log
- Ask Question card
- API calls
- Loading states
- Error states
- Data flow

Create a component hierarchy.

Example format:

Dashboard
├── Repository banner
├── CommitLog
└── AskQuestionCard

Use actual hierarchy.

---

## 7. Ask Question Feature

This should be detailed because it is currently one of the major implemented frontend features.

Document:

- Component file
- Input state
- Submission flow
- POST request to `/api/QA`
- Request body
- Project ID handling
- File references header
- Streaming body reading
- `ReadableStream`
- `getReader()`
- `TextDecoder`
- incremental answer state updates
- loading state
- toast behavior
- error handling
- dialog behavior if implemented

Explain the frontend streaming flow step by step.

---

## 8. Create Project Page

Document:

- Form
- Inputs
- Repository URL
- GitHub token if supported
- Submission
- API request
- Success behavior
- Error handling
- Navigation/redirect

Use actual implementation.

---

## 9. Commit Log / Commit Display

Document:

- Component
- API request
- Project ID
- Loading behavior
- Empty state
- Commit data displayed
- AI summary display
- Refresh behavior

Use actual code.

---

## 10. Sidebar and Shared Components

Document:

- AppSidebar
- User button
- Project navigation
- Shared UI components
- Relevant providers

Use actual filenames and responsibilities.

---

## 11. Frontend-to-API Integration

Create a table:

Frontend Component | API Route | Method | Purpose

For example:

Create project
→ `/api/project`

Commit log
→ `/api/commits`

Ask question
→ `/api/QA`

Authentication
→ Better Auth route

Use actual routes and methods.

---

## 12. Client-Side Data Flow

Explain actual data movement.

For example:

User action
→ component state
→ fetch/API call
→ API response
→ state update
→ UI

Document each major page flow.

---

## 13. Loading and Error Handling

Document actual implemented behavior.

Include:

- loading states
- disabled buttons
- toasts
- API errors
- stream errors
- missing response body
- JSON/header parsing failures

Only document what exists.

---

## 14. Current Page Implementation Status

Create a table:

Page / Feature | Status | Notes

Clearly separate:

- implemented
- partial
- planned

---

## 15. Known Future Frontend Work

Document planned frontend work separately.

Examples only if still applicable:

- Better Q&A answer rendering
- Markdown
- Syntax-highlighted code
- File reference UI
- Credits display
- Workspace UI
- PR/Issue UI
- UI redesign

Do not mark these as implemented.

==================================================
04_BACKEND_AND_RAG.md
==================================================

This is the MOST TECHNICAL document.

It should become the definitive backend, AI, indexing, and RAG implementation reference.

It should explain the system deeply enough that a future developer can understand how GitPulse works without reading every backend file.

Create:

# GitPulse — Backend and RAG Architecture

## 1. Document Purpose

Explain that this document covers:

- API routes
- Authentication/authorization
- Database
- GitHub integration
- Commit processing
- Repository loading
- File filtering
- Chunking
- Embeddings
- Gemini
- pgvector
- RAG retrieval
- Q&A
- Streaming
- API key resilience

---

## 2. Backend Architecture Overview

Create a complete text architecture diagram.

Example structure:

Frontend
↓
Next.js API Routes
↓
Authentication / Membership Validation
↓
Business Logic (`src/lib`)
↓
External Services
├── GitHub
├── Gemini
└── PostgreSQL / Supabase / pgvector

Use actual architecture.

---

## 3. API Route Documentation

Document every actual API route separately.

For each route include:

- File path
- HTTP method
- Purpose
- Authentication
- Request body/query params
- Validation
- Processing steps
- Response
- Error handling
- Related frontend component

Document at least the actual routes:

### Authentication API

Better Auth catch-all route.

### `/api/project`

Document:

POST:

- authentication
- project creation
- GitHub repo handling
- commit synchronization
- background indexing

GET:

- project retrieval
- ownership/membership behavior

Use actual implementation.

### `/api/commits`

Document:

- projectId
- membership validation
- commit retrieval
- ordering
- response

### `/api/QA`

Document deeply:

- POST body
- validation
- project ownership/membership check
- question forwarding
- Gemini pipeline
- stream response
- content type
- file references header
- error behavior

Use actual header implementation.

Important:
Document that file references contain metadata only if that is the current implementation.

---

## 4. Authentication and Authorization

Document actual Better Auth architecture.

Explain:

- server auth instance
- client auth instance
- API handler
- session retrieval
- protected routes
- project membership authorization

Separate:

Authentication = who is the user?

Authorization = does the user have access to this project?

---

## 5. Database Architecture

Document actual Prisma schema.

For each model include:

- Purpose
- Important fields
- Relationships
- Cascade behavior if implemented

Cover:

- User
- Session
- Account
- Verification
- Project
- UserToProject
- Commit
- SourceCodeEmbedding

Explain:

Project
↔ UserToProject
↔ User

Project
→ Commit

Project
→ SourceCodeEmbedding

Explain project isolation.

Document the pgvector column accurately.

Document the current embedding dimension accurately.

Do not use outdated dimensions.

---

## 6. GitHub Integration

Document:

### `github.ts`

Explain:

- Octokit
- repository URL parsing if implemented
- commit retrieval
- new commit detection
- duplicate prevention
- GitHub token handling
- error handling

---

## 7. Project Creation and Background Processing

Document the full sequence in detail.

Example:

User submits project
↓
API validates request
↓
User authenticated
↓
Project created
↓
User linked to project
↓
GitHub commits synchronized
↓
Commit summaries generated
↓
Repository indexing starts asynchronously

Use actual ordering from source.

Clearly explain whether indexing blocks the response or runs asynchronously.

This is important.

---

## 8. Repository Loading

Document `github-loader.ts`.

Explain:

- LangChain
- GithubRepoLoader
- repository loading
- metadata
- file paths
- GitHub token usage
- document creation

---

## 9. Hybrid File Filtering System

Document this VERY DETAILED.

Explain the two-pass architecture.

### Pass 1: Loader-Level Filtering

Document:

- `ignoreFiles`
- `ignorePaths`

Explain why filtering before download is useful.

Document actual ignored categories.

Do not necessarily dump every pattern unless useful.

---

### Pass 2: `shouldIndexFile()`

Document every actual decision rule in the correct order.

Explain:

1. Asset path segment detection
2. Binary extension exclusion
3. Source extension allowlist
4. JSON handling
5. Unknown extension handling
6. Text/binary heuristic

Use the actual code order.

Document:

- `KNOWN_SOURCE_EXTENSIONS`
- `KNOWN_BINARY_EXTENSIONS`
- `INDEXABLE_JSON_FILENAMES`
- `ASSET_PATH_SEGMENTS`
- `looksLikeText()`

Explain why this hybrid system exists.

Explain the philosophy:

KNOWN GOOD
KNOWN BAD
UNKNOWN → heuristic

---

## 10. Chunking Pipeline

Document:

- RecursiveCharacterTextSplitter
- actual chunk size
- actual overlap
- metadata preservation
- chunk indexing
- per-file chunk grouping

Document the pathological-file safeguard.

Explain:

Why files producing too many chunks are skipped rather than truncated.

Use actual maximum.

Explain the reasoning.

---

## 11. Embedding Pipeline

Document:

### `generateEmbedding()`

Explain:

- input text array
- embedding model
- batching
- 768-dimensional vectors
- returned vectors

Document:

- batch size
- error handling
- logs

Use actual values.

---

## 12. Embedding API Key Pool

Document separately from generation.

Explain:

- 6 API keys
- pool creation
- independent state
- round-robin selection
- 429 detection
- `isRateLimitError()`
- key rotation
- 503 retries/backoff
- all-key exhaustion behavior
- wait/retry behavior if implemented

Explain why embedding and generation pools are independent.

Do not mix the two architectures.

---

## 13. Database Vector Storage

Document:

`SourceCodeEmbedding`

Explain stored data:

- projectId
- fileName
- filePath
- content
- chunkIndex
- embedding

Explain:

- Prisma
- raw SQL where needed
- pgvector cast
- vector dimension

Document insertion strategy.

Explain why projectId is stored with each chunk.

---

## 14. RAG Retrieval Pipeline

Document `retrieveRelevantCode()` in detail.

Explain:

### Step 1 — Query Formatting

Document the asymmetric retrieval format:

`task: code retrieval | query: <question>`

Explain why query formatting helps retrieval.

---

### Step 2 — Query Embedding

Explain:

question
→ generation of embedding

---

### Step 3 — pgvector Similarity Search

Document:

- projectId filter
- cosine similarity
- similarity calculation
- actual threshold
- ordering
- actual LIMIT

Use actual code.

Explain why project isolation is critical.

---

### Step 4 — Retrieved Chunks

Document returned fields:

- fileName
- filePath
- sourceCode
- chunkIndex
- similarity

---

## 15. Context Construction

Document `buildCodeContext()`.

Explain how retrieved chunks become Gemini context.

Include a conceptual example.

Explain:

- source file information
- chunk content
- context ordering
- why only relevant chunks are provided

Do not copy massive source code examples.

---

## 16. Q&A Generation Pipeline

Document `askQuestionWithContext()` step by step.

Full flow:

User Question
↓
Retrieve Code
↓
Build Context
↓
Build Prompt
↓
Generative Key Selection
↓
Gemini `generateContentStream`
↓
Async Iterable
↓
Native ReadableStream
↓
API Response
↓
Browser

Explain prompt grounding.

Explain why the model should use repository context.

Explain behavior when retrieval returns no useful chunks, based on actual prompt/code behavior.

---

## 17. Q&A Streaming Architecture

Document this in detail.

Backend:

`generateContentStream()`

↓

Async iterable

↓

Text chunks

↓

`TextEncoder`

↓

`ReadableStream<Uint8Array>`

↓

HTTP Response

Frontend:

fetch

↓

response body

↓

`getReader()`

↓

`TextDecoder`

↓

incremental state updates

↓

live answer

Explain why no third-party streaming library is required.

Explain why stream creation is protected by failover but active stream failures are not automatically restarted.

Explain duplicate chunk prevention.

---

## 18. File References

Document:

- why references are returned
- what metadata is included
- where references originate
- how frontend receives them
- why source code should NOT be included in headers
- header/body separation

Use actual current implementation.

---

## 19. Generative API Key Pool

Document the NEW current implementation in detail.

This is important.

Explain:

- `buildGenerationKeyPool()`
- generation pool objects
- key number logging
- independent pool state
- `generationKeyIndex`
- `generationCooldowns`
- `COOLDOWN_MS`
- Round-Robin

Document:

Key 1
→ Key 2
→ Key 3
→ ...
→ Key 6
→ Key 1

Explain that both:

- Commit Summarization
- Q&A

share this generation pool.

---

## 20. Round-Robin + Failover

Document `executeWithGenerationFailover()` deeply.

Explain:

### Normal Case

Round-Robin selection.

---

### 429 Case

429
↓
identify rate limit
↓
put key into cooldown
↓
advance
↓
next available key
↓
retry operation

---

### 503 Case

Explain exponential retry:

1 second
→ 2 seconds
→ 4 seconds

Use actual behavior.

Explain what happens if retries fail.

---

### Non-Retryable Errors

Explain:

- auth errors
- validation errors
- other permanent errors

Should fail immediately rather than unnecessarily rotating keys.

---

### All Keys Unavailable

Explain actual current behavior.

Do not claim infinite protection.

Document the actual descriptive error if all keys fail.

---

## 21. Commit Summarization Pipeline

Document:

GitHub commits
↓
new commit detection
↓
batch preparation
↓
Gemini generation pool
↓
summary generation
↓
database storage

Explain:

- model
- batching
- failover
- database relationship
- logs

Use actual implementation.

---

## 22. Logging and Observability

Document actual structured log prefixes.

Examples may include:

- `[GitHub Loader]`
- `[Filter]`
- `[Chunking]`
- `[Embedding]`
- `[Database]`
- `[API QA]`
- `[Gemini Q&A]`
- `[Gemini]`
- `[GitHub Commits]`

Verify actual log names from source.

Explain why logs are useful for:

- debugging
- quota issues
- retrieval issues
- indexing failures
- GitHub failures

---

## 23. Error Handling and Resilience

Create a detailed table:

Scenario | Behavior | Recovery

Include:

- invalid API request
- unauthorized user
- unauthorized project access
- GitHub failure
- invalid repository
- no new commits
- bad file
- binary file
- huge pathological file
- embedding 429
- generation 429
- Gemini 503
- non-retryable Gemini error
- no query vector
- no response body
- active stream failure
- all generation keys unavailable

Use actual behavior.

---

## 24. Performance and Scalability Considerations

Explain:

- chunking
- batching
- filtering before embedding
- pgvector search
- project isolation
- top-K retrieval
- streaming
- multi-key distribution

Clearly state current limitations.

For example:

- in-memory cooldown state
- server restart resets cooldown state
- multi-instance deployments do not share in-memory key cursor/cooldown state

Only include this if architecturally true for current implementation.

---

## 25. Security Considerations

Document actual security behavior:

- secrets in environment variables
- API keys never sent to frontend
- authentication
- project authorization
- parameterized SQL
- projectId isolation
- GitHub token handling

Do not claim encryption unless actually implemented.

---

## 26. Current Backend Status

Create a comprehensive table:

Subsystem | Status | Notes

Include:

Authentication
Authorization
Projects
GitHub commits
Commit summaries
Repository loading
Filtering
Chunking
Embeddings
Embedding key pool
Vector storage
RAG retrieval
Q&A
Streaming
File references
Generation key pool
Round-robin
429 failover
503 retry
Cooldowns

---

## 27. Future Backend Improvements

Clearly mark as future.

Possible examples:

- Redis/distributed key state
- persistent cooldown tracking
- semantic reranking
- hybrid keyword + vector search
- configurable similarity threshold
- dynamic top-K
- chat history
- stored Q&A conversations
- citation UI
- background job queue
- repository re-indexing strategy
- incremental indexing
- credits deduction
- usage tracking

Do not present them as implemented.

---

## 28. End-to-End Complete Architecture

End the document with a complete end-to-end architecture diagram covering:

PROJECT CREATION

User
→ Create Project
→ API
→ Database
→ GitHub
→ Commit Processing
→ Background RAG Indexing
→ SourceCodeEmbedding

Then:

Q&A

User
→ Ask Question
→ API
→ Query Embedding
→ pgvector
→ Relevant Code
→ Context
→ Gemini
→ Streaming
→ Frontend

Then:

COMMIT PROCESSING

GitHub
→ New Commit
→ Generation Pool
→ Gemini
→ Summary
→ Database
→ Dashboard

==================================================
IMPORTANT SOURCE-OF-TRUTH CHECK
==================================================

Before finalizing each document:

1. Compare every major statement against the actual source code.
2. Compare against the latest `GITPULSE_PROJECT_STRUCTURE.md`.
3. Compare against the latest `PROJECT_SUMMARY.md`.
4. Remove outdated planning assumptions.
5. Remove old technologies that are no longer used.
6. Update references to `04_ANIMATIONS_AND_SCROLL.md` to the new `04_BACKEND_AND_RAG.md`.
7. Make sure `01`, `03`, and `04` do NOT unnecessarily duplicate each other.

Division of responsibility:

`01_PROJECT_BLUEPRINT.md`
= What GitPulse is + why it exists + high-level architecture + current status + roadmap.

`03_PAGE_IMPLEMENTATION.md`
= What pages/routes/components exist + how the frontend behaves + frontend/API integration.

`04_BACKEND_AND_RAG.md`
= How the backend, database, GitHub, Gemini, indexing, embeddings, pgvector, RAG, streaming, and failover systems work internally.

==================================================
FINAL VERIFICATION
==================================================

After updating the documentation:

- Do not modify source code.
- Do not modify `02_UI_DESIGN...`.
- Do not modify database data.
- Do not run destructive database commands.
- Do not reset the database.
- Do not change Prisma schema.

Then provide a concise summary containing:

1. Which documentation files were updated.
2. The major outdated information removed.
3. The major current implementation details added.
4. Any parts that could not be documented because they were not clearly implemented.
5. Confirmation that `02_UI_DESIGN...` was not modified.
