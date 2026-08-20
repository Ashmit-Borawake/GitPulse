import { GoogleGenAI, Type, ApiError } from '@google/genai';
import { type Document } from '@langchain/core/documents';

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
// Code summarisation types + constants
// ---------------------------------------------------------------------------

export type FileSummary = {
  filePath: string;
  summary: string;
};

/** Gemini generative model used for all summarisation tasks. */
const SUMMARISE_MODEL = 'gemini-3.6-flash';

/**
 * Gemini embedding model. text-embedding-004 produces 768-d vectors natively.
 * We explicitly set outputDimensionality: 768 for safety.
 */
const EMBEDDING_MODEL = 'text-embedding-004';

/** Number of dimensions required by the vector(768) pgvector column. */
const EMBEDDING_DIMENSIONS = 768;

/** Maximum Gemini retry attempts on 503 UNAVAILABLE. */
const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// aiSummariseCommits — unchanged
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
// summariseCode — file summarisation for RAG indexing
// ---------------------------------------------------------------------------

/**
 * Sends a batch of source-code documents to Gemini in ONE API request and
 * returns one summary per file, matched by filePath (never by array index).
 * Single-file structural failures are logged and skipped; 503s are retried.
 *
 * @param docs - A batch of LangChain Document objects.
 * @returns Array of { filePath, summary } for every successfully summarised file.
 */
export async function summariseCode(docs: Document[]): Promise<FileSummary[]> {
  if (docs.length === 0) return [];

  const fileBlocks = docs
    .map((doc, i) => {
      const filePath =
        (doc.metadata?.source as string | undefined) ?? `file_${i}`;
      return `FILE ${i + 1}\nPATH: ${filePath}\n\n${doc.pageContent}\n\n---`;
    })
    .join('\n\n');

  const systemPrompt = `You are an expert senior software engineer analyzing a software repository.

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

    For every file, produce a concise summary of approximately 90 to 110 words.
    This is a target range, not a strict exact count — aim for around 100 words.
    Summaries significantly shorter than 90 words may lack useful detail.
    Summaries significantly longer than 110 words should be trimmed.

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

    LENGTH GUIDELINE:

    Target 90-110 words per summary. Reasonable variation is acceptable.
    This guideline applies independently to EVERY file.

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
    - The response is valid JSON.
    - There is NO text before or after the JSON array.`;

  const userPrompt = `Here are the source-code files to summarise:\n\n${fileBlocks}`;

  // Build a lookup of filePath for each doc so we can isolate per-file failures.
  const docPaths = docs.map(
    (doc, i) => (doc.metadata?.source as string | undefined) ?? `file_${i}`
  );
  const inputPathSet = new Set(docPaths);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: SUMMARISE_MODEL,
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

      const raw = response.text;
      if (!raw) {
        throw new Error('[summariseCode] Gemini returned an empty response');
      }

      const parsed = JSON.parse(raw) as FileSummary[];

      if (!Array.isArray(parsed)) {
        throw new Error('[summariseCode] Response is not an array');
      }

      // -----------------------------------------------------------------------
      // Per-file validation: isolate problematic files rather than failing all.
      // -----------------------------------------------------------------------
      const returnedPaths = new Set<string>();
      const validSummaries: FileSummary[] = [];

      for (const item of parsed) {
        if (!item.filePath || !item.summary) {
          console.warn(
            `[Summary] Skipping entry with missing filePath or summary: ${JSON.stringify(item)}`
          );
          continue;
        }
        if (!inputPathSet.has(item.filePath)) {
          console.warn(
            `[Summary] Skipping unrecognised filePath in response: "${item.filePath}"`
          );
          continue;
        }
        if (returnedPaths.has(item.filePath)) {
          console.warn(
            `[Summary] Skipping duplicate filePath in response: "${item.filePath}"`
          );
          continue;
        }
        returnedPaths.add(item.filePath);
        validSummaries.push(item);
      }

      for (const p of inputPathSet) {
        if (!returnedPaths.has(p)) {
          console.warn(
            `[Summary] No summary returned for "${p}" — this file will be skipped`
          );
        }
      }

      return validSummaries;
    } catch (err) {
      const isUnavailable = err instanceof ApiError && err.status === 503;

      if (isUnavailable && attempt < MAX_RETRIES) {
        const delayMs = 1000 * Math.pow(2, attempt - 1);
        console.warn(
          `[Summary] 503 on attempt ${attempt}/${MAX_RETRIES} - retrying in ${delayMs}ms...`
        );
        await sleep(delayMs);
        continue;
      }

      throw err;
    }
  }

  throw new Error('[summariseCode] All retry attempts exhausted');
}

// ---------------------------------------------------------------------------
// generateEmbedding — 768-dimensional vector generation
// ---------------------------------------------------------------------------

/**
 * Generates 768-dimensional embeddings for an array of text strings using
 * the Gemini text-embedding-004 model.
 *
 * Accepts multiple texts and returns one vector per text in the same order.
 *
 * @param texts - Array of plain-text strings to embed (one vector each).
 * @returns Array of 768-dimensional number arrays, same order as `texts`.
 */
export async function generateEmbedding(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });

  const embeddings = response.embeddings;
  const embCount = embeddings?.length ?? 0;
  if (embCount !== texts.length) {
    throw new Error(
      `[generateEmbedding] Expected ${texts.length} embedding(s), got ${embCount}`
    );
  }

  return embeddings!.map((e, i) => {
    const dimCount = e.values?.length ?? 0;
    if (dimCount !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `[generateEmbedding] Embedding ${i} has ${dimCount} dimensions, expected ${EMBEDDING_DIMENSIONS}`
      );
    }
    return e.values!;
  });
}
