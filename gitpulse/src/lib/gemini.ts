import { GoogleGenAI, Type, ApiError } from '@google/genai';

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Commit summarisation types
// ---------------------------------------------------------------------------

type CommitInput = {
  commitHash: string;
  diff: string;
};

type CommitSummary = {
  commitHash: string;
  summary: string;
};

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

/** Gemini generative model used for commit summarisation. */
const SUMMARISE_MODEL = 'gemini-3.6-flash';

/**
 * Gemini embedding model. gemini-embedding-2 supports variable dimensions.
 * We explicitly set outputDimensionality: 768 for safety.
 */
const EMBEDDING_MODEL = 'gemini-embedding-2';

/** Number of dimensions required by the vector(768) pgvector column. */
const EMBEDDING_DIMENSIONS = 768;

/** Maximum Gemini retry attempts on 503 UNAVAILABLE. */
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Summarisation client (single key — not pooled)
// ---------------------------------------------------------------------------

/**
 * Single shared GoogleGenAI client used exclusively for commit summarisation.
 * This is NOT part of the embedding key pool; commit summarisation has
 * different quota characteristics and does not need key rotation.
 */
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY ?? process.env.GEMINI_API_KEY_1,
});

// ---------------------------------------------------------------------------
// Embedding key pool — multi-key round-robin for quota distribution
// ---------------------------------------------------------------------------

/**
 * Collects GEMINI_API_KEY_1 … GEMINI_API_KEY_10 from the environment and
 * returns one GoogleGenAI client per key.
 *
 * Falls back to GEMINI_API_KEY for single-key / legacy mode if no numbered
 * keys are found.
 *
 * Throws at startup if no key whatsoever is configured, so the error surfaces
 * immediately rather than at the first embedding request.
 */
function buildEmbeddingKeyPool(): GoogleGenAI[] {
  const pool: GoogleGenAI[] = [];

  for (let i = 1; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) {
      pool.push(new GoogleGenAI({ apiKey: key }));
    }
  }

  // Legacy / single-key fallback
  if (pool.length === 0) {
    const legacyKey = process.env.GEMINI_API_KEY;
    if (legacyKey) {
      pool.push(new GoogleGenAI({ apiKey: legacyKey }));
    }
  }

  if (pool.length === 0) {
    throw new Error(
      '[Gemini] No API keys configured. ' +
        'Set GEMINI_API_KEY_1 … GEMINI_API_KEY_N (or GEMINI_API_KEY) in your .env file.'
    );
  }

  console.log(`[Gemini] Embedding key pool: ${pool.length} key(s).`);
  return pool;
}

/** Pool of GoogleGenAI clients, one per API key — initialized once at module load. */
const embeddingPool: GoogleGenAI[] = buildEmbeddingKeyPool();

/**
 * Module-level round-robin cursor.
 *
 * Rules:
 * - After a SUCCESSFUL request, set to (successfulKeyIndex + 1) % poolSize.
 * - NOT modified during internal 429 rotation; stays frozen until a key succeeds.
 * - This guarantees the next batch always starts from the key immediately
 *   after the one that actually completed the previous batch.
 */
let embeddingKeyIndex = 0;

// ---------------------------------------------------------------------------
// isRateLimitError — quota/rate-limit detection helper
// ---------------------------------------------------------------------------

/**
 * Returns true only when `error` is a genuine quota/rate-limit 429 from Gemini
 * that benefits from key rotation.
 *
 * Both conditions must be true:
 *   1. error instanceof ApiError && error.status === 429
 *   2. error.message (lowercased) contains "quota", "rate limit",
 *      or "resource_exhausted"
 *
 * Auth failures, policy violations, and other 429 variants return false and
 * are re-thrown immediately without rotation.
 */
function isRateLimitError(error: unknown): boolean {
  if (!(error instanceof ApiError) || error.status !== 429) {
    return false;
  }

  const msg = (error.message ?? '').toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('resource_exhausted')
  );
}

// ---------------------------------------------------------------------------
// aiSummariseCommits — Git commit summarisation for the dashboard/commit log
// ---------------------------------------------------------------------------

/**
 * Summarises multiple git diffs in a SINGLE Gemini API call.
 * Accepts an array of { commitHash, diff } and returns { commitHash, summary }[]
 * matched by hash — never by array index.
 * Retries up to 3 times (with exponential backoff) on 503 UNAVAILABLE.
 */
export const aiSummariseCommits = async (
  commits: CommitInput[]
): Promise<CommitSummary[]> => {
  if (commits.length === 0) return [];

  const commitBlocks = commits
    .map((c) => `COMMIT: ${c.commitHash}\nDIFF:\n${c.diff}`)
    .join('\n\n---\n\n');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: SUMMARISE_MODEL,
        contents: [
          `You are an expert programmer, and you are trying to summarize git diffs.
      Reminders about the git diff format:
      For every file, there are a few metadata lines, like (for example):
      \`\`\`
      diff --git a/lib/index.js b/lib/index.js
      index aadf691..bfef603 100644
      --- a/lib/index.js
      +++ b/lib/index.js
      \`\`\`
      This means that \`lib/index.js\` was modified in this commit. Note that this is only an example.
      Then there is a specifier of the lines that were modified.
      A line starting with \`+\` means it was added.
      A line that starting with \`-\` means that line was deleted.
      A line that starts with neither \`+\` nor \`-\` is code given for context and better understanding.
      It is not part of the diff.
      [...]
      EXAMPLE SUMMARY COMMENTS:
      \`\`\`
      * Raised the amount of returned recordings from \`10\` to \`100\` [packages/server/recordings_api.ts], [packages/server/constants.ts]
      * Fixed a typo in the github action name [.github/workflows/gpt-commit-summarizer.yml]
      * Moved the \`octokit\` initialization to a separate file [src/octokit.ts], [src/index.ts]
      * Added an OpenAI API for completions [packages/utils/apis/openai.ts]
      * Lowered numeric tolerance for test files
      \`\`\`
      Most commits will have less comments than this examples list.
      The last comment does not include the file names,
      because there were more than two relevant files in the hypothetical commit.
      Do not include parts of the example in your summary.
      It is given only as an example of appropriate comments.

      You are receiving MULTIPLE commits. For each commit:
      - Analyse only that commit's diff.
      - Produce exactly one concise summary for it.
      - Do NOT combine different commits into one summary.
      - Do NOT omit any commit.
      - Mention relevant file names where appropriate, following the example style above.
      - Base each summary solely on that commit's diff.
      
      FORMATTING RULES FOR SUMMARY:
      - The summary MUST be a multiline string containing concise bullet points.
      - Each distinct change MUST be on its own line and MUST start with \`* \`.
      - NEVER combine multiple distinct changes into one comma-separated sentence.
      - NEVER return the summary as a single paragraph when the commit contains multiple changes.
      - Keep each bullet concise and focused on one change.
      - If a commit has only one meaningful change, a single \`* \` bullet is sufficient.
      - Do not create unnecessary bullets for trivial details that belong to the same logical change.
      - The output must remain valid JSON. The bullet points should be contained inside the \`summary\` string using newline characters (\\n).

      Return a JSON array with one object per commit:
      [{ "commitHash": "<hash>", "summary": "<summary>" }]
      Include every commitHash exactly as provided. Do not add extra fields.`,

          `Here are the commits to summarise:\n\n${commitBlocks}`,
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                commitHash: { type: Type.STRING },
                summary: { type: Type.STRING },
              },
              required: ['commitHash', 'summary'],
            },
          },
        },
      });

      const raw = response.text;
      if (!raw) {
        throw new Error('Gemini returned an empty response');
      }

      const parsed: CommitSummary[] = JSON.parse(raw) as CommitSummary[];
      return parsed;

    } catch (err) {
      // Retry only on 503 UNAVAILABLE (temporary overload); rethrow everything else.
      const isUnavailable = err instanceof ApiError && err.status === 503;

      if (isUnavailable && attempt < MAX_RETRIES) {
        const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        console.warn(`[Gemini] 503 on attempt ${attempt}/${MAX_RETRIES} — retrying in ${delayMs}ms…`);
        await sleep(delayMs);
        continue;
      }

      throw err;
    }
  }

  // Should never reach here
  throw new Error('Gemini: all retry attempts exhausted');
};

// ---------------------------------------------------------------------------
// generateEmbedding — 768-dimensional vector generation with key rotation
// ---------------------------------------------------------------------------

/**
 * Generates 768-dimensional embeddings for an array of text strings using
 * the Gemini gemini-embedding-2 model.
 *
 * Accepts multiple texts and returns one vector per text in the same order.
 *
 * Internally manages a pool of up to 10 API keys (GEMINI_API_KEY_1 … _10)
 * with round-robin rotation and transparent 429 quota-exhaustion handling:
 *
 *   - 429 quota/rate-limit  → rotate to next key; sleep 61s if all exhausted
 *   - 503 UNAVAILABLE       → exponential backoff (1s, 2s, 4s)
 *   - Any other error       → re-thrown immediately
 *
 * The public API is unchanged: callers pass texts, receive vectors.
 *
 * @param texts - Array of plain-text strings to embed (one vector each).
 * @returns Array of 768-dimensional number arrays, same order as `texts`.
 */
export async function generateEmbedding(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const poolSize = embeddingPool.length;

  // Snapshot the starting key for this call.
  // Internal 429 rotation advances a local offset; the global counter is only
  // updated once a key succeeds (or after a 61s sleep resets).
  const startIndex = embeddingKeyIndex % poolSize;
  let triedKeyCount = 0; // local offset within this call — never touches global

  // gemini-embedding-2 requires separate Content objects to return separate embeddings
  const formattedContents = texts.map((text) => ({
    parts: [{ text }],
  }));

  while (true) {
    const currentKeyIdx = (startIndex + triedKeyCount) % poolSize;
    const client = embeddingPool[currentKeyIdx]!;

    try {
      // ── 503 UNAVAILABLE: exponential backoff ────────────────────────────
      let response: Awaited<ReturnType<typeof client.models.embedContent>>;
      for (let attempt503 = 1; attempt503 <= MAX_RETRIES; attempt503++) {
        try {
          response = await client.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: formattedContents,
            config: {
              outputDimensionality: EMBEDDING_DIMENSIONS,
            },
          });
          break; // success — exit 503-retry loop
        } catch (err503) {
          const isUnavailable =
            err503 instanceof ApiError && err503.status === 503;

          if (isUnavailable && attempt503 < MAX_RETRIES) {
            const delayMs = 1000 * Math.pow(2, attempt503 - 1); // 1s, 2s
            console.warn(
              `[Gemini] Key ${currentKeyIdx + 1} — 503 on attempt ${attempt503}/${MAX_RETRIES}, retrying in ${delayMs}ms…`
            );
            await sleep(delayMs);
            continue;
          }

          // Not a 503, or all 503 retries exhausted — propagate to outer catch
          throw err503;
        }
      }

      // ── Validate response ────────────────────────────────────────────────
      const embeddings = response!.embeddings;
      const embCount = embeddings?.length ?? 0;
      if (embCount !== texts.length) {
        throw new Error(
          `[generateEmbedding] Expected ${texts.length} embedding(s), got ${embCount}`
        );
      }

      const vectors = embeddings!.map((e, i) => {
        const dimCount = e.values?.length ?? 0;
        if (dimCount !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `[generateEmbedding] Embedding ${i} has ${dimCount} dimensions, expected ${EMBEDDING_DIMENSIONS}`
          );
        }
        return e.values!;
      });

      // ── Advance global round-robin cursor past the key that succeeded ────
      embeddingKeyIndex = (currentKeyIdx + 1) % poolSize;

      return vectors;

    } catch (err) {
      // ── 429 quota/rate-limit: rotate to next key ─────────────────────────
      if (isRateLimitError(err)) {
        console.warn(
          `[Gemini] Key ${currentKeyIdx + 1} quota-limited (429), rotating…`
        );
        triedKeyCount++;

        if (triedKeyCount < poolSize) {
          // Still have untried keys — loop immediately
          continue;
        }

        // All keys exhausted — sleep 61s and reset local offset
        console.warn(
          `[Gemini] All ${poolSize} embedding key(s) quota-limited. Sleeping 61s for window reset…`
        );
        await sleep(61_000);
        triedKeyCount = 0; // reset local offset; retry from startIndex
        continue;
      }

      // ── Any other error: re-throw immediately ────────────────────────────
      throw err;
    }
  }
}
