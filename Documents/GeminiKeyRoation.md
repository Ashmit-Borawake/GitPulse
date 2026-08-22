# GitPulse — Gemini API Key Rotation Implementation Plan

> **Goal:** Eliminate `429 EmbedContentRequestsPerMinutePerUserPerProjectPerModel-FreeTier` errors
> by encapsulating a 5-key pool inside `gemini.ts`, rotating keys transparently on quota errors,
> while keeping `github-loader.ts` completely unaware of key management.

---

## 1. Problem Diagnosis

Your repository produces **1,063 chunks** split into **22 sub-batches of 50**.  
Each sub-batch is ONE `embedContent` API call. Total: **22 API requests**.

### Per-Project Free Tier Limits (Gemini Embedding 2)

| Limit | Value | Status |
|-------|-------|--------|
| **RPM** (Requests Per Minute) | **100** | ✅ 22 requests << 100 |
| **TPM** (Tokens Per Minute) | **30,000** | ❌ ~33K tokens > 30K |
| **RPD** (Requests Per Day) | **1,000** | ✅ 22 requests << 1,000 |

**Root cause: TPM exhaustion.** All 22 batches complete within ~60 seconds on a single key,
pushing ~33K tokens in one sliding window vs the 30K limit.

### What happened in the logs

```
Sub-batch  1/22 → 50 chunks ✅  (~1,500 tokens on Key 1)
Sub-batch  2/22 → 50 chunks ✅  (~1,500 tokens on Key 1)
Sub-batch  3/22 → 429 ❌         Key 1 TPM window exceeded
```

---

## 2. Current Architecture

```text
github-loader.ts
       ↓
generateEmbedding(texts)   ← gemini.ts (single key, no rotation)
       ↓
Gemini Embedding 2
       ↓
429 quota → crash ❌
```

The current `generateEmbedding()` uses one global `GoogleGenAI` client initialized from
`GEMINI_API_KEY`. There is no fallback, no key rotation, and no 429 handling.

---

## 3. Proposed Architecture

```text
GitHub Repository
       ↓
GithubRepoLoader
       ↓
Documents
       ↓
RecursiveCharacterTextSplitter
       ↓
1,063 chunks
       ↓
Batch into groups of 50
       ↓
generateEmbedding(texts)          ← github-loader.ts calls this
       ↓
┌──────────────────────────────────────────┐
│                gemini.ts                 │
│                                          │
│          Embedding Key Pool              │
│                                          │
│  Key 1 ──┐                               │
│  Key 2 ──┤                               │
│  Key 3 ──┼──→ Gemini Embedding 2         │
│  Key 4 ──┤                               │
│  Key 5 ──┘                               │
│                                          │
│  429 quota  → rotate to next key         │
│  503        → exponential backoff        │
│  all keys   → wait 61s → retry           │
└──────────────────────────────────────────┘
       ↓
768-dimensional vectors
       ↓
pgvector
       ↓
SourceCodeEmbedding
```

> **Core principle:**
> `github-loader.ts` knows that it needs embeddings.
> `gemini.ts` knows how to obtain them reliably.

### Token Distribution with 5 Keys (Round-Robin)

| Sub-batch | Key Used | Approx tokens on that key |
|-----------|----------|-----------------------------|
| 1 | Key 1 | ~1,650 |
| 2 | Key 2 | ~1,650 |
| 3 | Key 3 | ~1,650 |
| 4 | Key 4 | ~1,650 |
| 5 | Key 5 | ~1,650 |
| 6 | Key 1 | ~3,300 |
| ... | ... | ... |
| 22 | Key 2 | ~7,260 max per key |

**Each key sees ≈7K tokens — well under the 30K TPM limit ✅**

---

## 4. Implementation Constraints

- Make the smallest reasonable changes to the existing implementation.
- Do **not** redesign the RAG pipeline, chunk size, chunk overlap, or pgvector dimension.
- Do **not** change the database schema.
- Do **not** change GitHub loading behavior.
- Do **not** change commit summarization behavior.
- Keep TypeScript types strict.
- **Never print actual API keys in logs.** Logs may identify keys by index (`Key 1`, `Key 2`...).
- Preserve the existing 768-dimensional validation.
- Keep the rotation behavior easy to test and debug.

---

## 5. `gemini.ts` — Planned Changes

### 5.1 Key Pool Initialization

Replace the single `const ai = new GoogleGenAI(...)` with a pool builder.

```typescript
// Collects GEMINI_API_KEY_1 … GEMINI_API_KEY_N from .env (supports up to 10)
// Falls back to GEMINI_API_KEY for single-key / legacy mode.
function buildEmbeddingKeyPool(): GoogleGenAI[] { ... }

const embeddingPool: GoogleGenAI[] = buildEmbeddingKeyPool();
```

- Iterates `GEMINI_API_KEY_1` through `GEMINI_API_KEY_10`.
- Falls back to `GEMINI_API_KEY` if no numbered keys are found.
- Throws at startup if no key whatsoever is configured.
- Logs pool size at startup: `[Gemini] Embedding key pool: 5 key(s)`.

### 5.2 Summarization Client (Unchanged)

```typescript
// Single shared client for aiSummariseCommits — unchanged
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY_1,
});
```

Commit summarization is **not** coupled to the embedding key pool.

### 5.3 Round-Robin Counter

```typescript
let embeddingKeyIndex = 0; // module-level
```

**Advancement rules:**
- After a successful request, set **`embeddingKeyIndex = (successfulKeyIndex + 1) % poolSize`**.
- `successfulKeyIndex` is the actual index of the key that successfully completed the request — not the starting key for that batch.
- The global counter is **not modified** during internal 429 rotation; it stays frozen until a key succeeds.
- This guarantees that the next batch always starts from the key immediately after the one that just succeeded.

Example with 5 keys and no quota hits:
```text
Batch 1 → Key 1 ✅ → next = Key 2
Batch 2 → Key 2 ✅ → next = Key 3
Batch 3 → Key 3 ✅ → next = Key 4
...
Batch 6 → Key 1 ✅ → next = Key 2  (wraps around)
```

Example with a quota hit on batch 3:
```text
Batch 3 → Key 3 ❌ 429 → rotate → Key 4 ✅ → next = Key 5
Batch 4 → Key 5 ✅ → next = Key 1
```

`successfulKeyIndex` for batch 3 is **Key 4** (the key that actually succeeded),
so the next batch starts from Key 5 — not Key 4 again.
Internal 429 rotation does not modify the global counter until success.

### 5.4 `isRateLimitError(error)` Helper

A small, defensive helper that decides whether a caught error represents a
quota/rate-limit condition worth rotating keys for.

```typescript
function isRateLimitError(error: unknown): boolean
```

Decision logic:
```text
429
 ↓
Inspect ApiError status + message/details
 ↓
Is it RESOURCE_EXHAUSTED / quota / rate-limit related?
 ├─ YES → return true  (rotate to next key)
 └─ NO  → return false (rethrow immediately)
```

Specifically:
- Requires `error instanceof ApiError && error.status === 429` as the primary gate.
- Then checks `error.message` (lowercased) for at least one of: `"quota"`, `"rate limit"`, `"resource_exhausted"`.
- **Both conditions must be true** to return `true`.
- Returns `false` for any error that does not match — these are re-thrown immediately without rotation.

> **Why require message inspection in addition to status 429?**
> HTTP 429 from Gemini can arise from multiple distinct causes. Only quota/rate-limit exhaustion
> benefits from key rotation. Authentication failures, malformed requests, or policy violations
> that happen to return 429 should surface as real errors, not be silently swallowed by key cycling.

### 5.5 Updated `generateEmbedding()` Internals

**Public API stays identical:**
```typescript
export async function generateEmbedding(texts: string[]): Promise<number[][]>
```

**Internal rotation flow:**

```text
1. startIndex = embeddingKeyIndex % poolSize   (snapshot global counter)
2. triedKeyCount = 0                            (local offset; does not touch global)
3. Loop:
   a. currentKey = (startIndex + triedKeyCount) % poolSize
   b. Call embedContent with embeddingPool[currentKey]
   c. ✅ Success:
        → validate embeddings (count + dimensions)
        → embeddingKeyIndex = (currentKey + 1) % poolSize   ← set to key AFTER the successful key
        → return vectors
   d. ❌ isRateLimitError (quota 429):
        → log: "[Gemini] Key N quota-limited (429), rotating..."
        → triedKeyCount++       ← local only; global counter unchanged
        → if triedKeyCount < poolSize → continue loop (try next key)
        → else all keys exhausted:
             log: "[Gemini] All N keys quota-limited. Sleeping 61s..."
             sleep(61_000)
             triedKeyCount = 0  ← reset local offset; retry from startIndex
   e. ❌ 429 but NOT isRateLimitError:
        → re-throw immediately (auth failure, policy violation, etc.)
   f. ❌ 503 ApiError:
        → exponential backoff (1s, 2s, 4s) — existing behavior, unchanged
   g. ❌ Any other error:
        → re-throw immediately
```

**Key invariant:** After success, `embeddingKeyIndex` is set to `(successfulKeyIndex + 1) % poolSize`
— where `successfulKeyIndex` is the actual key that completed the request.
This is **not** a simple increment of the starting key; if 429 rotation occurred internally,
the next batch starts from the key after the one that actually succeeded,
keeping the distribution correct regardless of how many keys were skipped.

**Validation preserved** (after successful call):
- `embeddings.length === texts.length` — throw if mismatch
- `embedding.values.length === 768` — throw if mismatch

---

## 6. `github-loader.ts` — Planned Changes

### What does NOT change

- `loadGithubRepo()` — completely unchanged
- `generateEmbeddings()` chunking logic — unchanged
- `MAX_EMBED_BATCH_SIZE = 50` — unchanged
- `EMBED_MAX_RETRIES = 3` — unchanged
- `EMBEDDING_CONCURRENCY = 5` — unchanged
- The batch loop structure — unchanged
- The fallback individual embedding path — unchanged
- Database insertion logic — unchanged

### What changes

The existing retry loop inside `generateEmbeddings()` currently only retries on `503`.
We need to **remove** the 503-specific guard from there, since `generateEmbedding()` in
`gemini.ts` will now handle both 503 (backoff) and 429 (key rotation) internally.

The call site simplifies to:

```typescript
// github-loader.ts — simplified call (key rotation is handled inside gemini.ts)
const vectors = await generateEmbedding(texts);
```

The outer try/catch in `github-loader.ts` still exists to:
1. Catch any error that `generateEmbedding()` ultimately throws after exhausting all retries.
2. Log the failure and fall through to the existing individual-chunk fallback.

`github-loader.ts` does **not** need to:
- Select a Gemini key
- Know how many keys exist
- Maintain a `triedKeys` set
- Catch `RateLimitError` (no custom error class leaks to the caller)
- Know anything about the embedding key pool

---

## 7. 429 vs 503 — Error Handling Summary

| Error | Detection | Action |
|-------|-----------|--------|
| **429 quota/rate-limit** | `isRateLimitError(err)` | Rotate to next key; sleep 61s if all exhausted |
| **503 UNAVAILABLE** | `err instanceof ApiError && err.status === 503` | Exponential backoff: 1s → 2s → 4s |
| **Other errors** | Everything else | Re-throw immediately, do not swallow |

These two paths are handled **separately and independently** inside `generateEmbedding()`.

---

## 8. Environment Variable Changes

### `.env` (already configured)
```env
GEMINI_API_KEY_1="..."   # GitPulse 1 project
GEMINI_API_KEY_2="..."   # GitPulse 2 project
GEMINI_API_KEY_3="..."   # GitPulse 3 project
GEMINI_API_KEY_4="..."   # GitPulse 4 project
GEMINI_API_KEY_5="..."   # GitPulse 5 project
```

### `.env.example` (needs update)
```env
# ── Gemini API ────────────────────────────────────────────────────────────────
# Create API keys at: https://aistudio.google.com/apikey
# IMPORTANT: Each key must be from a DIFFERENT GCP project to get independent
# 30K TPM limits. Keys from the same project share one quota.
# Add as many as needed (GEMINI_API_KEY_1 through GEMINI_API_KEY_10 supported).
# Falls back to GEMINI_API_KEY if no numbered keys are present (legacy/single-key mode).
GEMINI_API_KEY_1=""
GEMINI_API_KEY_2=""
GEMINI_API_KEY_3=""
GEMINI_API_KEY_4=""
GEMINI_API_KEY_5=""
```

---

## 9. Expected Log Output

### Normal run (no quota hit)

```
[Gemini] Embedding key pool: 5 key(s).
[Embedding] Processing 1063 chunks in sub-batches of 50
[Embedding] Sub-batch  1/22 complete (Key 1, 50 chunks)
[Embedding] Sub-batch  2/22 complete (Key 2, 50 chunks)
[Embedding] Sub-batch  3/22 complete (Key 3, 50 chunks)
...
[Embedding] Sub-batch 22/22 complete (Key 2, 13 chunks)
[Embedding] Generated 1063 vectors
[Database] Inserting 1063 SourceCodeEmbedding records...
[Database] Inserted 1063 SourceCodeEmbedding records ✅
```

### 429 rotation triggered

```
[Embedding] Sub-batch 8/22 — Key 3 returned quota 429, rotating to Key 4...
[Embedding] Sub-batch 8/22 complete (Key 4, 50 chunks)
```

### All keys exhausted (edge case for very large repos)

```
[Gemini] All 5 embedding keys quota-limited. Sleeping 61s for window reset...
[Embedding] Sub-batch 8/22 complete (Key 1, 50 chunks)  ← after sleep
```

---

## 10. Files Changed Summary

| File | Change |
|------|--------|
| `src/lib/gemini.ts` | Key pool init, `buildEmbeddingKeyPool()`, `isRateLimitError()`, updated `generateEmbedding()` with internal rotation |
| `src/lib/github-loader.ts` | Simplify retry loop — remove 503-only guard; `generateEmbedding()` call remains identical |
| `.env.example` | Add `GEMINI_API_KEY_1..5` documentation |

## Files Intentionally Unchanged

| File | Reason |
|------|--------|
| `src/lib/github.ts` | Not related to embedding |
| `src/app/api/project/route.ts` | Not related to embedding |
| `src/app/(protected)/create-project/page.tsx` | Frontend — not related |
| `prisma/schema.prisma` | Database schema unchanged |
| `src/server/db.ts` | Database client unchanged |

---

## 11. Verification Checklist

After implementation, verify the following:

- [ ] `npm run lint` — passes with zero errors
- [ ] `npx tsc --noEmit` — passes with zero type errors
- [ ] `npm run build` — compiles and builds successfully

### Database Reset (Clean-Slate Integration Test)

```bash
npx prisma db push --force-reset
```

This wipes all existing `SourceCodeEmbedding` rows so the test starts from zero.

### Indexing Test

1. Start GitPulse: `npm run dev`
2. Create a new project using the test repository.
3. Let the background indexing run.

### Verify in terminal logs

- [ ] Pool initialized with correct number of keys
- [ ] ~1,063 chunks produced
- [ ] Embedding requests distributed across multiple keys (visible in logs)
- [ ] No `429` errors in the terminal
- [ ] 503 errors (if any) produce backoff logs, not crashes
- [ ] Non-quota 429 errors (e.g. invalid key) are NOT silently swallowed
- [ ] All embeddings contain exactly 768 dimensions
- [ ] `[Database] Inserted 1063 SourceCodeEmbedding records` logged at the end
- [ ] No chunks silently lost

---

## 12. Edge Case & Failure Handling

| Scenario | Behavior |
|----------|----------|
| Only 1 key configured (`GEMINI_API_KEY`) | Rotates to same key → eventually sleeps 61s on quota |
| A key is invalid/expired | `isRateLimitError` returns false → error re-thrown; not confused with quota |
| All 5 keys hit quota simultaneously | 61-second sleep, then retry from Key 1 |
| 503 UNAVAILABLE | Existing exponential backoff: 1s, 2s, 4s |
| Non-quota 429 | Re-thrown immediately, not treated as rotation candidate |
| Pool build fails (no keys in env) | Hard error at server startup with clear message |
| Embedding count mismatch | Existing validation throws — unchanged |
| Dimension mismatch (not 768) | Existing validation throws — unchanged |

---

## 13. Implementation Order

1. **`src/lib/gemini.ts`**
   - Add `buildEmbeddingKeyPool()` and `embeddingPool`
   - Add `isRateLimitError()` helper
   - Add round-robin `embeddingKeyIndex` counter
   - Update `generateEmbedding()` with internal rotation loop
   - Preserve `aiSummariseCommits()` unchanged

2. **`src/lib/github-loader.ts`**
   - Simplify retry loop (remove the 503-only guard from the outer catch)
   - Keep the call to `generateEmbedding(texts)` identical

3. **`.env.example`**
   - Add `GEMINI_API_KEY_1..5` documentation block

4. **Validation**
   - Run: `npm run lint`
   - Run: `npx tsc --noEmit`
   - Run: `npm run build`
   - Fix any errors with minimum necessary changes, then re-run all three.

5. **Database reset**
   - Run: `npx prisma db push --force-reset`

6. **Integration test**
   - Start dev server and index the test repository.
   - Verify all checklist items in Section 11.
