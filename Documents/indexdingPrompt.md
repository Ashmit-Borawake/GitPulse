# GitPulse — Repository Indexing Pipeline Implementation Prompt

We are now implementing the GitPulse repository indexing pipeline.

> **Source of Truth:** The actual repository code is the source of truth.
> The project structure document (`GITPULSE_PROJECT_STRUCTURE.md`) is provided only as contextual information and may lag behind newly implemented files.
> Newly added files such as `src/lib/github-loader.ts` and the `SourceCodeEmbedding` Prisma model may not appear in that document — always inspect the actual source files.

---

## Project Context

GitPulse currently uses:

- **Next.js 15** (App Router)
- **Prisma 6.19.3** with **Supabase PostgreSQL**
- **pgvector** (enabled via `postgresqlExtensions` preview feature)
- **LangChain** (`@langchain/community`, `langchain`)
- **Gemini API** via `@google/genai` SDK
- `GithubRepoLoader` from `@langchain/community`

### Important files for this indexing phase

| File | Purpose |
|------|---------|
| `src/lib/github-loader.ts` | `loadGithubRepo()` — already implemented |
| `src/lib/gemini.ts` | `aiSummariseCommits()` — batch pattern to follow |
| `src/server/db.ts` | Prisma `db` singleton — use this for all DB access |
| `prisma/schema.prisma` | `SourceCodeEmbedding` model — already exists |
| `src/app/api/project/route.ts` | Project creation route — will call `indexGithubRepo()` |

---

## Existing Code to Preserve and Follow

### `src/lib/github-loader.ts` — already implemented, do not rewrite

```ts
import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";

export const loadGithubRepo = async (
    githubUrl: string,
    githubToken?: string
) => {
    const loader = new GithubRepoLoader(githubUrl, {
        accessToken: githubToken || "",
        branch: "main",
        ignoreFiles: [
            // Package manager lock files
            "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
            // Build / generated output
            "dist", "build", ".next", "out", ".turbo", ".cache",
            // Dependencies
            "node_modules",
            // Environment / secrets
            ".env", ".env.local", ".env.development", ".env.production",
            // IDE / OS files
            ".DS_Store", "Thumbs.db", ".idea", ".vscode",
            // Coverage / test-generated files
            "coverage", ".nyc_output",
            // Logs, minified, binary/media
            "*.log", "*.min.js", "*.min.css", "*.map",
            "*.png", "*.jpg", "*.jpeg", "*.gif", "*.webp", "*.ico",
            "*.mp3", "*.mp4", "*.mov", "*.avi",
            "*.zip", "*.tar", "*.gz", "*.pdf",
        ],
        recursive: true,
        unknown: "warn",
        maxConcurrency: 5,
    });

    const docs = await loader.load();
    return docs;
};
```

Do not rewrite `loadGithubRepo` unless there is a concrete bug.

---

### `src/lib/gemini.ts` — existing batch pattern to follow

The existing `aiSummariseCommits()` function already demonstrates the required pattern:

- Multiple inputs are sent to Gemini in a **single API request**.
- Results are matched back to their source using a stable identifier (`commitHash`), **not** by array position.
- The function uses **structured JSON output** via `responseMimeType: 'application/json'` and `responseSchema`.
- It retries on `503 UNAVAILABLE` with exponential backoff using `ApiError` from `@google/genai`.
- It uses the `GoogleGenAI` client initialized as `new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })`.
- The generative model currently used is `gemini-3.6-flash`.

Follow these exact same patterns for repository file summarization. Do NOT duplicate or alter the existing commit summarization logic.

---

### `src/server/db.ts` — Prisma client singleton

```ts
export const db = ...;  // PrismaClient singleton
```

Always import `db` from `@/server/db`. Do not create a new PrismaClient instance.

---

### `prisma/schema.prisma` — existing `SourceCodeEmbedding` model

```prisma
model SourceCodeEmbedding {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  summary    String?
  content    String
  fileName   String
  filePath   String
  chunkIndex Int

  embedding  Unsupported("vector(768)")?

  projectId  String
  project    Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId])
}
```

**Use the actual field names from the schema.** Do not invent new field names.
The `content` field stores the actual chunk source code.
The `embedding` field is `vector(768)` — **768 dimensions exactly.**

---

## Function Names to Preserve

The following function names must remain consistent:

- `loadGithubRepo` — already implemented
- `summariseCode` — to be implemented (batch-based)
- `generateEmbedding` — to be implemented
- `generateEmbeddings` — to be implemented (orchestration)
- `indexGithubRepo` — to be implemented (top-level)

---

## Final Architecture

```
                    GitHub Repository
                           ↓
                    GithubRepoLoader
                           ↓
                  LangChain Documents
                           ↓
           DYNAMIC SUMMARY BATCHING
   (max 10 files per batch + max total input size)
                           ↓
             ONE Gemini request per batch
                           ↓
           ONE <=100-word summary per file
                           ↓
              Actual source-code content
                           ↓
          RecursiveCharacterTextSplitter
                           ↓
          Chunk 0 / Chunk 1 / Chunk 2 / ...
                           ↓
              Embedding for each chunk
                           ↓
          PostgreSQL + pgvector (vector(768))
                           ↓
                        Later:
                    User Question
                           ↓
              SAME embedding model + dimension
                           ↓
                  Question vector (768-d)
                           ↓
            pgvector cosine similarity search
                           ↓
                  Top relevant chunks
                           ↓
          Gemini + question + retrieved source code
                           ↓
                    Precise answer
```

---

## Part 1 — BATCHING vs. CHUNKING: Critical Distinction

These are two completely separate operations. **Do not confuse them.**

### BATCHING — solves API-request efficiency

Sending multiple files to Gemini in a single API call for summarization:

```
10 files -> ONE Gemini API request -> 10 independent summaries
```

### CHUNKING — solves retrieval precision

Splitting a single file's source code into smaller overlapping pieces so that similarity search can pinpoint specific logic, not entire files:

```
auth.ts (large file)
↓
Chunk 0: lines 1-80
Chunk 1: lines 60-140   (overlap with Chunk 0)
Chunk 2: lines 120-200  (overlap with Chunk 1)
...
```

**Each chunk gets its own embedding vector.**

Example demonstrating the distinction:

```
100 files
↓
Dynamic summary batches (~N Gemini requests)
↓
100 file summaries
↓
Chunk all 100 files
↓
Possibly hundreds of chunks
↓
One embedding per chunk
↓
pgvector
```

---

## Part 2 — Chunking Strategy

Use a **proper LangChain text splitter** — `RecursiveCharacterTextSplitter` — on the **actual source code** (`doc.pageContent`).

Do NOT truncate with `.slice(0, N)`. That discards code from large files.

### Chunk settings (configurable constants)

```ts
const CHUNK_SIZE = 1500;      // in the unit expected by the installed splitter
const CHUNK_OVERLAP = 150;    // overlap to preserve context across boundaries
```

> **Important:** LangChain's `RecursiveCharacterTextSplitter` measures `chunkSize` in **characters** by default, unless a custom `lengthFunction` is provided. Do NOT claim 1500 characters equals 1500 tokens. Start with a sensible code-oriented value and report the actual unit used after implementation.

These values must be defined as named constants at the top of the file — not scattered as magic numbers.

### Chunk metadata preservation

Every chunk must retain its original file metadata:

- `filePath` (from `doc.metadata.source` or derived)
- `fileName` (derived safely from `filePath` using `path.basename`)
- `chunkIndex` (0-based sequential index within that file)
- `projectId` (passed in from `indexGithubRepo`)

Do not lose the relationship between a chunk and its original file.

### Conceptual chunking structure

```ts
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
});

// For each document, split and tag chunks with metadata
for (const doc of docs) {
    const chunks = await splitter.splitDocuments([doc]);
    // chunks retain doc.metadata — add chunkIndex manually
}
```

---

## Part 3 — File Summarization (`summariseCode`)

### Key rules

- One independent summary per file — **never merge two files into one summary.**
- Maximum 100 words per summary — enforced strictly.
- Based only on the provided source code — no hallucinated functionality.
- Map summaries back to their document using `filePath` — **not** by array position.
- Validate the response before proceeding.

### Function signature

```ts
type FileSummary = {
    filePath: string;
    summary: string;
};

export async function summariseCode(
    docs: Document[]       // a BATCH of documents, not a single document
): Promise<FileSummary[]> {
    // 1. Build one prompt containing all files in the batch.
    // 2. Call Gemini ONCE for the entire batch.
    // 3. Parse structured JSON.
    // 4. Validate: one result per input file, matching filePaths.
    // 5. Return summaries mapped by filePath.
}
```

`summariseCode` accepts a **batch** of documents, not a single document.

### Dynamic batching rules

Do NOT use a fixed batch size of exactly 5 or exactly 10.

Use **DYNAMIC batching** with two limits:

1. **Maximum file count per batch:** 10
2. **Maximum total input size per batch:** a configurable safe character limit appropriate for the selected Gemini model (e.g., `MAX_BATCH_INPUT_CHARS = 80000`)

The batching algorithm:

```
Start new batch.
For each document:
    IF adding it would exceed MAX_FILES_PER_BATCH (10)
        OR adding it would exceed MAX_BATCH_INPUT_CHARS:
        -> send current batch as one Gemini request
        -> start a new batch
    Add document to current batch.
Send final batch.
```

Expose these as named constants:

```ts
const MAX_FILES_PER_BATCH = 10;
const MAX_BATCH_INPUT_CHARS = 80_000;
```

Example outcome for 100 files:

```
Batch 1 -> 8 small files     (hit size limit)
Batch 2 -> 10 small files    (hit file count limit)
Batch 3 -> 4 large files     (hit size limit)
Batch 4 -> 10 small files    (hit file count limit)
...
```

The number of summarization Gemini requests is not fixed — it depends on actual file sizes.

### Gemini prompt for summarization

Use this exact semantic structure as the system prompt:

```
You are an expert senior software engineer analyzing a software repository.

You will receive multiple source-code files in a single request.

Analyze every file independently.

For EVERY input file, return exactly ONE summary.

Rules:
1. Never combine multiple files into one summary.
2. Never omit an input file.
3. Never create a summary for a file that was not provided.
4. The number of output objects must exactly equal the number of input files.
5. Preserve the exact filePath provided for every file.
6. Use filePath to associate each summary with its source file.
7. Base the summary only on the provided code.
8. Do not invent functionality, dependencies, APIs, or behavior.
9. Each summary must be 100 words or fewer.
10. The 100-word limit applies independently to every file.
11. Keep summaries concise and technically useful.
12. Mention important functions/classes/components when relevant.
13. Do not include unnecessary introductory text.

Return ONLY valid JSON.

Required output format:
[
  {
    "filePath": "exact/path/from/input",
    "summary": "summary of this specific file"
  }
]

Before returning, verify:
- every input file has exactly one result
- no file is missing
- no extra file exists
- every filePath exactly matches an input filePath
- every summary is <= 100 words
- the response is valid JSON
- there is no text before or after the JSON array
```

Construct the file input dynamically like this:

```
FILE 1
PATH: src/lib/auth.ts

<source code here>

---

FILE 2
PATH: src/lib/github.ts

<source code here>

---
```

### Gemini config for summarization

Use the same SDK pattern as `aiSummariseCommits`:

```ts
const response = await ai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: [systemPrompt, userPrompt],
    config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    filePath: { type: Type.STRING },
                    summary: { type: Type.STRING },
                },
                required: ['filePath', 'summary'],
            },
        },
    },
});
```

### Summary validation (application-side)

After Gemini responds, validate **before** continuing:

- Response is valid JSON.
- Response is an array.
- Number of results equals number of input files.
- Every `filePath` matches exactly one input file path.
- No duplicate `filePath` in results.
- No missing `filePath`.
- Every summary is <= 100 words.

If validation fails, use the existing retry/error-handling strategy (retry on 503, fail clearly on configuration errors).
Do not silently insert incomplete results.

---

## Part 4 — Embeddings

### CRITICAL: The generative Gemini model is NOT the embedding model

The model used for summaries (`gemini-3.6-flash`) does **not** produce embeddings.

Embeddings require a separate embedding model from the Gemini API.

### Dimension requirement

The Prisma schema defines:

```prisma
embedding Unsupported("vector(768)")?
```

Therefore the embedding model **must** produce exactly **768 dimensions**.

Before using any model, verify that it supports 768-dimensional output. Use the `outputDimensionality` parameter if the Gemini embedding API supports it. Do not assume any model produces 768 dimensions without verifying.

The same embedding model and dimensionality **must** later be used for user questions. Do not mix embedding models or dimensions.

### `generateEmbedding` function structure

```ts
export async function generateEmbedding(
    texts: string[]
): Promise<number[][]> {
    // Call the selected Gemini embedding model.
    // Generate one 768-dimensional vector for each input text.
    // Return vectors in the same order as the input texts.
}
```

### Batch embeddings

Where the Gemini embedding API supports multiple inputs in one request, use that capability.

Conceptual flow:

```
Chunk 1
Chunk 2
...
Chunk N
↓
ONE embedding API request (where supported)
↓
Embedding 1 (768-d)
Embedding 2 (768-d)
...
Embedding N (768-d)
```

Do NOT concatenate chunks into one text before embedding — each chunk needs its own vector.

If the installed SDK does not safely support batch embedding, use limited concurrency (e.g., `p-limit`) instead of uncontrolled parallel requests. Expose the concurrency limit as a named constant:

```ts
const EMBEDDING_CONCURRENCY = 5;
```

### CRITICAL: Embed chunks, not summaries

The source-code embedding pipeline must embed the **actual chunk content**, not the file summary.

```ts
// CORRECT — for RAG retrieval:
generateEmbedding([chunkContent])

// WRONG — the summary is NOT the retrieval target:
generateEmbedding([fileSummary])
```

The summary is useful metadata stored alongside the chunk. The vector must represent the source code chunk.

---

## Part 5 — `generateEmbeddings` Orchestration

```ts
export async function generateEmbeddings(docs: Document[]) {
    // 1. Dynamically batch docs and call summariseCode(batch) per batch.
    // 2. Map returned summaries back to their docs using filePath.
    // 3. Chunk the actual source code of each document.
    // 4. Attach the file summary to every chunk from that file.
    // 5. Generate embeddings for the chunk content.
    // 6. Return one record per chunk.
}
```

### Returned record shape per chunk

```ts
{
    summary: string;        // file-level summary (same for all chunks from this file)
    embedding: number[];    // 768-dimensional vector of the chunk content
    sourceCode: string;     // the actual chunk text (maps to `content` field in schema)
    fileName: string;       // basename of the file
    filePath: string;       // full repository-relative path
    chunkIndex: number;     // 0-based index within the file
}
```

A large file will produce multiple records:

```
auth.ts
↓
Chunk 0 -> vector 0
Chunk 1 -> vector 1
Chunk 2 -> vector 2
Chunk 3 -> vector 3
```

Do **not** return one vector for the entire file.

---

## Part 6 — `indexGithubRepo` Orchestration

```ts
export const indexGithubRepo = async (
    projectId: string,
    githubUrl: string,
    githubToken?: string
) => {
    const docs = await loadGithubRepo(githubUrl, githubToken);

    const allEmbeddings = await generateEmbeddings(docs);

    // Save all chunk records to SourceCodeEmbedding.
    // Use the two-step Prisma + $executeRaw pattern (see Part 7).
};
```

Preserve this function name and signature exactly.

---

## Part 7 — Database Insert Pattern

Prisma does not handle `Unsupported("vector(768)")` fields as normal scalar values. Use the established two-step pattern:

```ts
// Step 1: Create the record with normal Prisma fields
const record = await db.sourceCodeEmbedding.create({
    data: {
        summary: embedding.summary,
        content: embedding.sourceCode,
        fileName: embedding.fileName,
        filePath: embedding.filePath,
        chunkIndex: embedding.chunkIndex,
        projectId,
    },
});

// Step 2: Update the vector field using parameterized raw SQL
await db.$executeRaw`
    UPDATE "SourceCodeEmbedding"
    SET "embedding" = ${embedding.embedding}::vector
    WHERE "id" = ${record.id}
`;
```

**Do NOT construct SQL by string concatenation of embedding values.** Always use Prisma's tagged template literal (`$executeRaw`) for parameterized queries.

Use the exact field names from the actual `prisma/schema.prisma`:

- `content` — the chunk source code
- `summary` — the file-level summary
- `fileName`
- `filePath`
- `chunkIndex`
- `projectId`
- `embedding` — the `vector(768)` column

---

## Part 8 — Project Creation Flow

The existing `src/app/api/project/route.ts` currently calls only `pollCommits`. Update it to also call `indexGithubRepo` **before** `pollCommits`:

```ts
// After project is created in the database:

try {
    await indexGithubRepo(
        project.id,
        repoUrl,          // field name from current body: repoUrl
        githubToken
    );
} catch (indexError) {
    const message = indexError instanceof Error ? indexError.message : String(indexError);
    console.error('[indexGithubRepo] Failed to index repository for project', project.id, ':', message);
}

try {
    await pollCommits(project.id);
} catch (pollError) {
    // existing error handling
}
```

Do not remove `pollCommits`. Do not redesign project creation. The sequence must remain:

```
Create project
↓
indexGithubRepo(...)
↓
pollCommits(...)
```

---

## Part 9 — Error Handling, try/catch, and Logging

Use proper `try/catch` around every major asynchronous operation.

### What must be clearly logged

For every major stage, log a prefixed message so failures are easy to locate:

```ts
console.log("[GitHub Loader] Loading repository...");
console.log(`[GitHub Loader] Loaded ${docs.length} documents`);

console.log(`[Summary] Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} files)`);
console.log(`[Summary] Batch ${batchIndex + 1} complete`);

console.log(`[Chunking] ${docs.length} documents -> ${totalChunks} chunks`);

console.log(`[Embedding] Processing ${chunks.length} chunks`);
console.log(`[Embedding] Generated ${embeddings.length} vectors`);

console.log(`[Database] Saving ${allEmbeddings.length} records...`);
console.log(`[Database] Inserted ${allEmbeddings.length} SourceCodeEmbedding records`);
```

Do **not** print full source code or full embedding vectors to the console.

### Failure categories

| Failure | Behavior |
|---------|----------|
| Single problematic file (e.g., Gemini cannot summarize it) | Log the `filePath`, skip that file, continue |
| Temporary Gemini 503/rate-limit | Retry with exponential backoff (same as `aiSummariseCommits`) |
| Invalid API key / missing `GEMINI_API_KEY` | Fail clearly — do not continue |
| Database unavailable | Fail clearly |
| Embedding model unavailable | Fail clearly |
| pgvector insert failure | Fail clearly |
| Entire batch summarization failure after retries | Log and fail — do not silently skip batch |

Do not use empty catch blocks. Every catch block must log at minimum the error message and the relevant file path or batch index.

---

## Part 10 — Avoiding Uncontrolled API Calls

Do NOT write:

```ts
// BAD — one uncontrolled Gemini request per file:
await Promise.all(docs.map(async doc => {
    await gemini(doc);
}));
```

Instead:

1. **Summarization** — dynamic batches (max 10 files + max total input size) -> one Gemini request per batch.
2. **Embeddings** — batch where the API supports it; otherwise use limited concurrency.
3. Expose all batch sizes and concurrency limits as named constants.

---

## Part 11 — File Path and Metadata

Use the metadata provided by `GithubRepoLoader`. For LangChain documents loaded by this loader, the relevant field is typically:

```ts
doc.metadata.source  // repository-relative file path
```

Store:

```ts
filePath = doc.metadata.source;
fileName = path.basename(filePath);
```

Do not invent file paths. If the metadata structure differs from the above, inspect an actual returned document and derive the paths correctly.

---

## Part 12 — What NOT to Introduce

Do not add:

- Queues, Redis, BullMQ, or background workers
- Pinecone, Chroma, Qdrant, or any vector database other than pgvector
- Additional databases
- Complicated caching
- New Prisma models (use the existing `SourceCodeEmbedding`)

---

## Part 13 — Validation After Implementation

After implementing, run:

```powershell
npx tsc --noEmit
npx prisma generate
```

Log output for a test run against a small public repository should resemble:

```
[GitHub Loader] Loading repository...
[GitHub Loader] Loaded 42 documents
[Summary] Processing batch 1/5 (10 files)
[Summary] Processing batch 2/5 (10 files)
...
[Summary] All 42 files summarized in 5 batches
[Chunking] 42 documents -> 137 chunks
[Embedding] Processing 137 chunks
[Embedding] Generated 137 vectors
[Database] Saving 137 records...
[Database] Inserted 137 SourceCodeEmbedding records
```

---

## Part 14 — Complete Gemini Summarization Prompt

This is the full strict prompt to include in `summariseCode`. It must be included literally (or semantically equivalent) in the implementation:

```
You are an expert senior software engineer analyzing a software repository.

You will receive MULTIPLE source-code files in a single request.

Your task is to independently analyze EVERY file and produce EXACTLY ONE summary for EACH file.

IMPORTANT RULES:

1. Treat every file as an independent input.
2. NEVER combine two or more files into a single summary.
3. NEVER omit a file.
4. NEVER create a summary for a file that was not provided.
5. The number of output objects MUST exactly match the number of input files.
6. Preserve the exact filePath provided in the input.
7. Use filePath as the identifier to associate each summary with its original file.
8. Do not rely on output ordering for matching files; the filePath must be included in every result.
9. Base the summary ONLY on the provided source code.
10. Do not invent functionality, dependencies, APIs, database behavior, or architectural responsibilities.

SUMMARY REQUIREMENTS:

For every file, produce a concise summary of NO MORE THAN 100 WORDS.

The summary should explain:
- What the file is responsible for.
- Its main purpose in the project.
- Important functions, classes, components, or logic it contains.
- Important interactions with other parts of the application when clearly visible.

Do NOT:
- Explain every line of code.
- Include unnecessary implementation details.
- Repeat the file path inside the summary.
- Add introductory phrases such as "This file contains..."
- Use vague statements such as "This file handles various things."
- Guess functionality that cannot be determined from the code.

STRICT LENGTH RULE:

Every summary MUST contain 100 words or fewer.
This limit applies independently to EVERY file.

OUTPUT FORMAT:

Return ONLY a valid JSON array. Each object MUST contain exactly these fields:

{
  "filePath": "<exact input file path>",
  "summary": "<summary of that specific file>"
}

FINAL VALIDATION BEFORE RESPONDING:

Before returning the answer, verify that:
- Every input file has exactly one output object.
- No input file is missing.
- No extra output object exists.
- Every filePath exactly matches one of the provided input file paths.
- Every summary is 100 words or fewer.
- The response is valid JSON.
- There is NO text before or after the JSON array.
```

---

## Summary: Architectural Rules

| Rule | Requirement |
|------|-------------|
| Chunking target | Actual source code (`doc.pageContent`) |
| Embedding target | Each chunk's content individually |
| Summary target | Entire file (one per file) |
| Embedding model | Separate Gemini embedding model — not the generative model |
| Embedding dimension | Exactly 768 — verify before using any model |
| Batching strategy | Dynamic — max 10 files + max total input chars |
| Fixed batch size | Never — always dynamic |
| pgvector insert | Two-step: Prisma create + `$executeRaw` parameterized SQL |
| Field names | Use actual schema field names — `content`, not `sourceCode` |
| Error handling | Fail clearly on systemic errors; log and continue on single-file errors |
| Logging | Prefixed console logs at every major pipeline stage |