import { GoogleGenAI, Type, ApiError } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type CommitInput = {
  commitHash: string;
  diff: string;
};

type CommitSummary = {
  commitHash: string;
  summary: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
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

