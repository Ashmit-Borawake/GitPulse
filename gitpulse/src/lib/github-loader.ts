import path from "path";
import pLimit from "p-limit";
import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { type Document } from "@langchain/core/documents";
import { summariseCode, generateEmbedding } from "./gemini";
import { db } from "@/server/db";

// ---------------------------------------------------------------------------
// RAG / Indexing constants
// ---------------------------------------------------------------------------

/** Maximum number of files sent to Gemini in a single summarisation batch. */
const MAX_FILES_PER_BATCH = 10;

/**
 * Maximum total character count of all file contents within a single
 * summarisation batch.
 */
const MAX_BATCH_INPUT_CHARS = 80_000;

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
  summary: string;
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
    const loader = new GithubRepoLoader(githubUrl, {
        accessToken: githubToken ?? "",
        branch: "main",
        ignoreFiles: [
        // Package manager lock files
        "package-lock.json",
        "yarn.lock",
        "pnpm-lock.yaml",
        "bun.lockb",

        // Build / generated output
        "dist",
        "build",
        ".next",
        "out",
        ".turbo",
        ".cache",

        // Dependencies
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
        "*.mp3",
        "*.mp4",
        "*.mov",
        "*.avi",
        "*.zip",
        "*.tar",
        "*.gz",
        "*.pdf",
    ],
        recursive: true,
        unknown: "warn",
        maxConcurrency: 5,
    });

    const docs = await loader.load();

    return docs;
};

// ---------------------------------------------------------------------------
// generateEmbeddings — LangChain/RAG pipeline orchestration
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full pipeline for a set of loaded repository documents:
 *
 * 1. Dynamically batch documents → call summariseCode once per batch.
 * 2. Build a filePath → summary map from all returned summaries.
 * 3. Split each document's source code into overlapping chunks.
 * 4. Attach the file-level summary to every chunk from that file.
 * 5. Generate one 768-d embedding per chunk (using the chunk content).
 * 6. Return one EmbeddingRecord per chunk.
 *
 * @param docs - All documents loaded from the GitHub repository.
 * @returns Array of EmbeddingRecord objects ready for DB insertion.
 */
export async function generateEmbeddings(
  docs: Document[]
): Promise<EmbeddingRecord[]> {
  // -------------------------------------------------------------------------
  // Step 1 - Dynamic batching + summarisation
  // -------------------------------------------------------------------------
  console.log(`[Summary] Summarising ${docs.length} files...`);

  const batches: Document[][] = [];
  let currentBatch: Document[] = [];
  let currentBatchChars = 0;

  for (const doc of docs) {
    const docChars = doc.pageContent.length;
    const wouldExceedFileCount = currentBatch.length >= MAX_FILES_PER_BATCH;
    const wouldExceedCharLimit =
      currentBatch.length > 0 &&
      currentBatchChars + docChars > MAX_BATCH_INPUT_CHARS;

    if (wouldExceedFileCount || wouldExceedCharLimit) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBatchChars = 0;
    }

    currentBatch.push(doc);
    currentBatchChars += docChars;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  const totalBatches = batches.length;
  console.log(
    `[Summary] ${docs.length} files -> ${totalBatches} batch(es) for Gemini summarisation`
  );

  const summaryMap = new Map<string, string>();

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex]!;
    console.log(
      `[Summary] Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} files)`
    );

    try {
      const batchSummaries = await summariseCode(batch);
      for (const { filePath, summary } of batchSummaries) {
        summaryMap.set(filePath, summary);
      }
      console.log(`[Summary] Batch ${batchIndex + 1} complete`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[Summary] Batch ${batchIndex + 1}/${totalBatches} failed: ${message}`
      );
    }
  }

  console.log(
    `[Summary] All ${docs.length} files summarised in ${totalBatches} batch(es)`
  );

  // -------------------------------------------------------------------------
  // Step 2 - Chunking
  // -------------------------------------------------------------------------
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
  });

  type ChunkMeta = {
    filePath: string;
    fileName: string;
    summary: string;
    chunkIndex: number;
    content: string;
  };

  const allChunks: ChunkMeta[] = [];

  for (const doc of docs) {
    const filePath =
      (doc.metadata?.source as string | undefined) ?? "unknown";
    const fileName = path.basename(filePath);
    const summary = summaryMap.get(filePath);

    if (!summary) {
      console.warn(
        `[Chunking] No summary found for "${filePath}" - skipping this file`
      );
      continue;
    }

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
        summary,
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
  // Step 3 - Embedding (chunked into MAX_EMBED_BATCH_SIZE sub-batches)
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

  // Build sub-batches: [ [chunk0, chunk1, ...], [chunk50, ...], ... ]
  const embedBatches: { globalIndex: number; content: string }[][] = [];
  for (let i = 0; i < allChunks.length; i += MAX_EMBED_BATCH_SIZE) {
    const slice = allChunks.slice(i, i + MAX_EMBED_BATCH_SIZE).map((c, j) => ({
      globalIndex: i + j,
      content: c.content,
    }));
    embedBatches.push(slice);
  }

  const totalEmbedBatches = embedBatches.length;

  for (let bi = 0; bi < embedBatches.length; bi++) {
    const subBatch = embedBatches[bi]!;
    const texts = subBatch.map((s) => s.content);

    try {
      // Happy path: one Gemini embedContent request for this sub-batch.
      const vectors = await generateEmbedding(texts);
      for (let j = 0; j < subBatch.length; j++) {
        embeddingVectors[subBatch[j]!.globalIndex] = vectors[j]!;
      }
      console.log(
        `[Embedding] Sub-batch ${bi + 1}/${totalEmbedBatches} complete (${subBatch.length} chunks)`
      );
    } catch (batchErr) {
      // Fallback: concurrency-limited individual requests for this sub-batch.
      const message =
        batchErr instanceof Error ? batchErr.message : String(batchErr);
      console.warn(
        `[Embedding] Sub-batch ${bi + 1}/${totalEmbedBatches} failed (${message}). ` +
          `Falling back to concurrency-limited individual requests (limit=${EMBEDDING_CONCURRENCY})`
      );

      const limit = pLimit(EMBEDDING_CONCURRENCY);
      const fallbackResults = await Promise.all(
        subBatch.map((item) =>
          limit(async () => {
            try {
              const [vector] = await generateEmbedding([item.content]);
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
    summary: chunk.summary,
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
 *     -> dynamic summarisation batches (Gemini)
 *     -> RecursiveCharacterTextSplitter (chunks)
 *     -> Gemini embeddings (text-embedding-004, 768-d)
 *     -> PostgreSQL SourceCodeEmbedding rows (two-step Prisma + $executeRaw)
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
          summary: embedding.summary,
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
