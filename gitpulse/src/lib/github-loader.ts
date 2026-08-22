import path from "path";
import pLimit from "p-limit";
import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { type Document } from "@langchain/core/documents";
import { generateEmbedding } from "./gemini";
import { db } from "@/server/db";

// ---------------------------------------------------------------------------
// RAG / Indexing constants
// ---------------------------------------------------------------------------

/**
 * Chunk size in characters for RecursiveCharacterTextSplitter.
 * NOTE: LangChain measures chunkSize in characters by default (not tokens).
 */
const CHUNK_SIZE = 1500;

/** Character overlap between adjacent chunks. */
const CHUNK_OVERLAP = 150;

/**
 * Maximum concurrent embedding requests used as fallback when a sub-batch fails.
 */
const EMBEDDING_CONCURRENCY = 5;

/**
 * Maximum number of chunks sent to the Gemini embedding API in one request.
 * Prevents a single huge request for large repositories while still using
 * the Gemini batch embedding capability for each sub-batch.
 */
const MAX_EMBED_BATCH_SIZE = 50;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EmbeddingRecord = {
  embedding: number[];
  sourceCode: string;
  fileName: string;
  filePath: string;
  chunkIndex: number;
};

// ---------------------------------------------------------------------------
// loadGithubRepo
// ---------------------------------------------------------------------------

/**
 * Loads documents from a GitHub repository, ignoring common build artifacts,
 * dependencies, and binary files.
 *
 * @param githubUrl   - The full GitHub repository URL.
 * @param githubToken - Optional personal access token for private repos.
 * @returns Array of loaded LangChain documents containing file contents and metadata.
 */
export const loadGithubRepo = async (
    githubUrl: string,
    githubToken?: string
) => {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const token = githubToken || process.env.GITHUB_TOKEN;

    console.log(
        `[GitHub Loader] Authentication: ${token ? "authenticated" : "unauthenticated"}`
    );

    const loader = new GithubRepoLoader(githubUrl, {
        // Only pass accessToken if a real token was provided.
        // An empty string causes a malformed Authorization header and
        // wastes the unauthenticated rate-limit quota (60 req/hr).
        ...(token ? { accessToken: token } : {}),
        branch: "main",
        ignoreFiles: [
            // Package manager lock files
            "package-lock.json",
            "yarn.lock",
            "pnpm-lock.yaml",
            "bun.lockb",
            "bun.lock",

            // Build / generated output
            "dist",
            "build",
            ".next",
            "out",
            ".turbo",
            ".cache",
            ".vercel",

            // Dependencies — individual files inside node_modules that
            // might slip through (directory exclusion is handled by ignorePaths)
            "node_modules",

            // Environment / secrets
            ".env",
            ".env.local",
            ".env.development",
            ".env.production",

            // IDE / OS files
            ".DS_Store",
            "Thumbs.db",
            ".idea",
            ".vscode",

            // Coverage / test-generated files
            "coverage",
            ".nyc_output",

            // Logs
            "*.log",

            // Minified / bundled files
            "*.min.js",
            "*.min.css",
            "*.map",

            // Binary / media files
            "*.png",
            "*.jpg",
            "*.jpeg",
            "*.gif",
            "*.webp",
            "*.ico",
            "*.svg",
            "*.woff",
            "*.woff2",
            "*.ttf",
            "*.eot",

            // Audio / video files
            "*.mp3",
            "*.mp4",
            "*.mov",
            "*.avi",
            "*.webm",

            // Archives
            "*.zip",
            "*.tar",
            "*.gz",
            "*.pdf",
        ],
        // Exclude node_modules directories at ANY depth.
        // ignorePaths is the correct option for directory-level exclusion;
        // ignoreFiles only matches individual filenames/extensions.
        ignorePaths: [
            "node_modules",
            "**/node_modules",
            "**/package-lock.json",
            "**/yarn.lock",
            "**/pnpm-lock.yaml",
            "**/bun.lock",
            "**/bun.lockb",
            "**/.DS_Store",
        ],
        recursive: true,
        // Silently ignore unknown/binary files instead of emitting a warning
        // for every file — this eliminates noise in the server logs.
        unknown: "ignore",
        // 5 concurrent requests as requested.
        maxConcurrency: 5,
    });

    const docs = await loader.load();

    return docs;
};

// ---------------------------------------------------------------------------
// generateEmbeddings — LangChain/RAG pipeline orchestration
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full RAG indexing pipeline for a set of loaded repository documents:
 *
 * 1. Split each document into overlapping chunks with RecursiveCharacterTextSplitter.
 * 2. Generate one 768-d embedding per chunk from the actual source-code content.
 * 3. Return one EmbeddingRecord per chunk.
 *
 * No Gemini text-generation is performed here — only the embedding API is used.
 * This preserves implementation-level detail (exact identifiers, function names,
 * logic) for accurate code retrieval at query time.
 *
 * @param docs - All documents loaded from the GitHub repository.
 * @returns Array of EmbeddingRecord objects ready for DB insertion.
 */
export async function generateEmbeddings(
  docs: Document[]
): Promise<EmbeddingRecord[]> {
  // -------------------------------------------------------------------------
  // Step 1 - Chunking
  // -------------------------------------------------------------------------
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  type ChunkMeta = {
    filePath: string;
    fileName: string;
    chunkIndex: number;
    content: string;
  };

  const allChunks: ChunkMeta[] = [];

  for (const doc of docs) {
    const filePath =
      (doc.metadata?.source as string | undefined) ?? "unknown";
    const fileName = path.basename(filePath);

    let chunks: Document[];
    try {
      chunks = await splitter.splitDocuments([doc]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[Chunking] Failed to split "${filePath}": ${message} - skipping`
      );
      continue;
    }

    chunks.forEach((chunk, chunkIndex) => {
      allChunks.push({
        filePath,
        fileName,
        chunkIndex,
        content: chunk.pageContent,
      });
    });
  }

  console.log(
    `[Chunking] ${docs.length} documents -> ${allChunks.length} chunks`
  );

  if (allChunks.length === 0) {
    console.warn("[Chunking] No chunks produced - nothing to embed or store.");
    return [];
  }

  // -------------------------------------------------------------------------
  // Step 2 - Embedding (chunked into MAX_EMBED_BATCH_SIZE sub-batches)
  //
  // Each chunk is embedded as:
  //   "File: <filePath>\nName: <fileName>\n\n<source code>"
  // This gives the embedding model lightweight file-location context without
  // calling Gemini's text-generation API. The raw source code is stored
  // separately in `content` for retrieval during Q&A.
  //
  // Sending every chunk in one request risks hitting API size limits on large
  // repos. We split chunks into sub-batches and call generateEmbedding once
  // per sub-batch, then stitch the vectors back in original order.
  // -------------------------------------------------------------------------
  console.log(
    `[Embedding] Processing ${allChunks.length} chunks in sub-batches of ${MAX_EMBED_BATCH_SIZE}`
  );

  // Pre-allocate the full vector array so we can write at known offsets.
  const embeddingVectors = Array.from<number[]>({ length: allChunks.length });

  // Build sub-batches. Each item carries the formatted embedding text so that
  // both the normal path and the fallback path use exactly the same input.
  const embedBatches: { globalIndex: number; embeddingText: string }[][] = [];
  
  for (let i = 0; i < allChunks.length; i += MAX_EMBED_BATCH_SIZE) {
    const slice = allChunks.slice(i, i + MAX_EMBED_BATCH_SIZE).map((c, j) => ({
      globalIndex: i + j,
      embeddingText: `title: ${c.filePath} | text: ${c.content}`,
    }));
    embedBatches.push(slice);
  }

  const totalEmbedBatches = embedBatches.length;

  for (let bi = 0; bi < embedBatches.length; bi++) {
    const subBatch = embedBatches[bi]!;
    const texts = subBatch.map((s) => s.embeddingText);

    // -----------------------------------------------------------------------
    // generateEmbedding() (gemini.ts) handles all transient errors internally:
    //   - 429 quota/rate-limit → key rotation across the pool; 61s sleep if all exhausted
    //   - 503 UNAVAILABLE      → exponential backoff (1s, 2s, 4s)
    // Any error that ultimately propagates here is non-recoverable at the
    // batch level — fall through to the per-chunk fallback below.
    // -----------------------------------------------------------------------
    let batchSucceeded = false;

    try {
      const vectors = await generateEmbedding(texts);
      for (let j = 0; j < subBatch.length; j++) {
        embeddingVectors[subBatch[j]!.globalIndex] = vectors[j]!;
      }
      console.log(
        `[Embedding] Sub-batch ${bi + 1}/${totalEmbedBatches} complete (${subBatch.length} chunks)`
      );
      batchSucceeded = true;
    } catch (err) {
      // generateEmbedding() exhausted all internal retries/keys — fall back
      // to concurrency-limited individual requests for this sub-batch.
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[Embedding] Sub-batch ${bi + 1}/${totalEmbedBatches} failed (${message}). ` +
          `Falling back to concurrency-limited individual requests (limit=${EMBEDDING_CONCURRENCY})`
      );
    }

    if (!batchSucceeded) {
      // Fallback: concurrency-limited individual requests for this sub-batch.
      const limit = pLimit(EMBEDDING_CONCURRENCY);
      const fallbackResults = await Promise.all(
        subBatch.map((item) =>
          limit(async () => {
            try {
              const [vector] = await generateEmbedding([item.embeddingText]);
              return { globalIndex: item.globalIndex, vector: vector! };
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              const chunk = allChunks[item.globalIndex]!;
              throw new Error(
                `[Embedding] Failed to embed chunk ${item.globalIndex} of "${chunk.filePath}": ${msg}`
              );
            }
          })
        )
      );

      for (const { globalIndex, vector } of fallbackResults) {
        embeddingVectors[globalIndex] = vector;
      }
    }
  }

  console.log(`[Embedding] Generated ${embeddingVectors.length} vectors`);

  const embeddingRecords: EmbeddingRecord[] = allChunks.map((chunk, i) => ({
    embedding: embeddingVectors[i]!,
    sourceCode: chunk.content,
    fileName: chunk.fileName,
    filePath: chunk.filePath,
    chunkIndex: chunk.chunkIndex,
  }));

  return embeddingRecords;
}

// ---------------------------------------------------------------------------
// indexGithubRepo — top-level RAG indexing entry point
// ---------------------------------------------------------------------------

/**
 * Top-level function that indexes a GitHub repository into the database.
 *
 * Pipeline:
 *   GitHub URL -> GithubRepoLoader -> LangChain Documents
 *     -> RecursiveCharacterTextSplitter (source-code chunks)
 *     -> Gemini Embedding API (gemini-embedding-2, 768-d vectors)
 *     -> PostgreSQL SourceCodeEmbedding rows (Prisma + $executeRaw for vector)
 *
 * No Gemini text-generation is used during indexing — only the embedding API.
 * The actual source-code content is embedded directly, preserving identifiers,
 * function names, and implementation details for accurate retrieval.
 *
 * @param projectId   - The database ID of the project being indexed.
 * @param githubUrl   - The full GitHub repository URL.
 * @param githubToken - Optional personal access token for private repos.
 */
export const indexGithubRepo = async (
  projectId: string,
  githubUrl: string,
  githubToken?: string
) => {
  console.log("[GitHub Loader] Loading repository...");
  const docs = await loadGithubRepo(githubUrl, githubToken);
  console.log(`[GitHub Loader] Loaded ${docs.length} documents`);

  const allEmbeddings = await generateEmbeddings(docs);

  console.log(`[Database] Saving ${allEmbeddings.length} records...`);

  let insertedCount = 0;

  for (const embedding of allEmbeddings) {
    try {
      const record = await db.sourceCodeEmbedding.create({
        data: {
          content: embedding.sourceCode,
          fileName: embedding.fileName,
          filePath: embedding.filePath,
          chunkIndex: embedding.chunkIndex,
          projectId,
        },
      });

      await db.$executeRaw`
        UPDATE "SourceCodeEmbedding"
        SET "embedding" = ${embedding.embedding}::vector
        WHERE "id" = ${record.id}
      `;

      insertedCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[Database] Failed to insert record for "${embedding.filePath}" chunk ${embedding.chunkIndex}: ${message}`
      );
    }
  }

  console.log(
    `[Database] Inserted ${insertedCount} SourceCodeEmbedding records`
  );
};
