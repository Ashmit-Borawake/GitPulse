import path from "path";
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
 * Maximum number of chunks sent to the Gemini embedding API in one request.
 * Prevents a single huge request for large repositories while still using
 * the Gemini batch embedding capability for each sub-batch.
 */
const MAX_EMBED_BATCH_SIZE = 50;

/**
 * Pathological-file safeguard.
 *
 * A file producing MORE than this many chunks is almost certainly a huge
 * generated/data/asset file that slipped through the loader filters (e.g.
 * a large JSON data file or an obfuscated bundle). Such files dominate the
 * embedding corpus and actively degrade RAG retrieval quality.
 *
 * IMPORTANT: This is a FINAL SAFETY NET, not a size limit on source code.
 * Legitimate large source-code files (large-service.ts, large-schema.ts, etc.)
 * typically produce far fewer than 150 chunks at CHUNK_SIZE=1500.
 *
 * Files exceeding this limit are SKIPPED ENTIRELY (not truncated).
 * Silently dropping the tail of a source file is worse than skipping it,
 * because the AI would receive an incomplete and misleading picture.
 *
 * If a LEGITIMATE source file triggers this warning, do NOT lower the
 * threshold — instead inspect the warning, and update the filtering policy
 * (extension allowlist or path blocklist) so such files are handled earlier.
 */
const MAX_CHUNKS_PER_FILE = 150;

// ---------------------------------------------------------------------------
// File-extension allowlist for the post-load filter
// ---------------------------------------------------------------------------

/**
 * Known source/config/documentation extensions that are ALWAYS indexed.
 *
 * Known source extensions are explicitly allowed for fast, deterministic
 * classification without needing to inspect file content. Unknown extensions
 * are handled by the text/binary fallback in shouldIndexFile() so GitPulse
 * does not silently reject legitimate source code written in languages not
 * listed here (e.g. .dart, .zig, .ex, .sol, .tf, .proto, etc.).
 *
 * HOW to extend this:
 *   Add an extension here only if you want it to bypass the content inspection
 *   step (i.e., guaranteed include regardless of content). For unlisted
 *   extensions, the fallback will include them if they look like plain text.
 *
 * NOTE: .json is NOT listed here. JSON requires special-casing because
 * Lottie animations, chart data, and translation blobs are also JSON and
 * can produce hundreds of useless chunks. See INDEXABLE_JSON_FILENAMES.
 */
const KNOWN_SOURCE_EXTENSIONS = new Set([
  // Web / TypeScript / JavaScript
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  // Styles (CSS/SCSS can document component API via class names)
  ".css",
  ".scss",
  ".sass",
  ".less",
  // Common compiled languages
  ".py",
  ".java",
  ".go",
  ".rs",
  ".cpp",
  ".c",
  ".h",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".kts",
  ".scala",
  ".r",
  ".sh",
  ".bash",
  ".zsh",
  ".dart",
  ".ex",
  ".exs",
  ".lua",
  ".hs",
  ".fs",
  ".fsx",
  ".m",
  ".mm",
  ".zig",
  ".sol",
  ".tf",
  ".tfvars",
  ".proto",
  ".asm",
  // Config / project files (non-JSON)
  ".yaml",
  ".yml",
  ".toml",
  ".ini",
  // Documentation / markup
  ".md",
  ".mdx",
  ".txt",
  ".rst",
  // HTML / templates / frameworks
  ".html",
  ".htm",
  ".vue",
  ".svelte",
  // GraphQL / Prisma schema / SQL
  ".graphql",
  ".gql",
  ".prisma",
  ".sql",
]);

/**
 * Known binary / irrelevant extensions that are ALWAYS blocked.
 *
 * These extensions are never useful for code-level RAG. They are blocked here
 * as a fast path so the content-inspection fallback is not invoked for obvious
 * binary files (images, fonts, archives, etc.).
 *
 * Keep this list in sync with the ignoreFiles list in GithubRepoLoader, which
 * performs the same exclusion at load time. The two lists together form a
 * belt-and-suspenders defence.
 *
 * NOTE: .json is NOT in this blocklist because configuration JSON is useful.
 * JSON is handled as a special case in shouldIndexFile().
 */
const KNOWN_BINARY_EXTENSIONS = new Set([
  // Vector / raster images
  ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp",
  ".ico", ".bmp", ".tiff", ".avif",
  // Fonts
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  // Audio
  ".mp3", ".wav", ".ogg", ".flac", ".aac",
  // Video
  ".mp4", ".mov", ".avi", ".webm", ".mkv",
  // Archives / compiled binaries
  ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
  ".exe", ".dll", ".so", ".dylib", ".wasm",
  // Documents / data blobs
  ".pdf",
  // Source maps and minified outputs
  ".map",
  // Lottie native format
  ".lottie",
]);

/**
 * JSON files that are explicitly meaningful for RAG.
 *
 * JSON is intentionally special-cased. Configuration JSON (package.json,
 * tsconfig.json, etc.) is useful for RAG because it describes the project
 * structure, dependencies, and tooling. However, arbitrary JSON frequently
 * contains large generated/static data — Lottie animations, chart datasets,
 * and translation blobs can produce hundreds of chunks with zero code semantics.
 *
 * Therefore: known configuration JSON filenames → INCLUDE; everything else → EXCLUDE.
 * Do NOT convert this into a global *.json allowlist.
 */
const INDEXABLE_JSON_FILENAMES = new Set([
  "package.json",
  "tsconfig.json",
  "tsconfig.base.json",
  "tsconfig.node.json",
  "tsconfig.app.json",
  ".eslintrc.json",
  "eslint.config.json",
  ".prettierrc.json",
  "jest.config.json",
  "vitest.config.json",
  "babel.config.json",
  "next.config.json",
  ".babelrc",
  "turbo.json",
  "nx.json",
  "workspace.json",
  "angular.json",
  "project.json",
]);

/**
 * Directory path segments that are known to contain ONLY static/generated
 * assets (Lottie JSON, SVG sprites, images, fonts, animations).
 *
 * A file whose normalized path contains ANY of these segments is excluded
 * before any extension check, because even a .ts file in an assets/ directory
 * is probably a generated index file rather than meaningful application logic.
 *
 * WHY public/ is NOT in this list:
 *   public/ directories frequently contain robots.txt, sitemap.xml, useful
 *   manifests, and other text files that ARE useful for RAG. Blanket exclusion
 *   of public/ would silently discard them. More specific sub-paths
 *   (public/assets/, public/images/, etc.) remain excluded.
 *
 * Be conservative: only add segments that unambiguously refer to asset-only
 * directories, not general-purpose paths like "src" or "lib".
 */
const ASSET_PATH_SEGMENTS = [
  "/assets/",
  "\\assets\\",
  "/src/assets/",
  "\\src\\assets\\",
  "/public/assets/",
  "\\public\\assets\\",
  "/static/",
  "\\static\\",
  "/images/",
  "\\images\\",
  "/fonts/",
  "\\fonts\\",
  "/icons/",
  "\\icons\\",
  "/animations/",
  "\\animations\\",
  "/lottie/",
  "\\lottie\\",
  "/media/",
  "\\media\\",
];

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
// looksLikeText — binary-detection heuristic
// ---------------------------------------------------------------------------

/**
 * Returns true if the string content appears to be plain text / source code.
 *
 * This is used as a fallback for files with UNKNOWN extensions — those not
 * listed in KNOWN_SOURCE_EXTENSIONS and not in KNOWN_BINARY_EXTENSIONS.
 * The heuristic is intentionally simple and deterministic:
 *
 *   - Sample the first N characters of the content.
 *   - Count characters with code points that are NUL (0x00), or in the C0
 *     control range (0x01–0x08, 0x0E–0x1F) excluding common text controls
 *     (\t=0x09, \n=0x0A, \r=0x0D).
 *   - If the ratio of such control/binary characters exceeds the threshold,
 *     treat the file as binary and exclude it.
 *
 * Why this is sufficient:
 *   Real source code never contains NUL bytes or raw control characters in
 *   normal use. Binary files (compiled outputs, image data encoded as text,
 *   packed archives) virtually always contain some control bytes.
 *   A 1% ratio threshold provides a very wide safety margin.
 *
 * Limitations:
 *   Base64-encoded binary content embedded in a text file would pass this
 *   check. That is acceptable — if someone stores large base64 blobs in
 *   source files, they should add a path/extension exclusion explicitly.
 */
const BINARY_SAMPLE_SIZE = 4096; // bytes (characters) to inspect
const BINARY_THRESHOLD = 0.01;   // 1% control/NUL chars → treat as binary

function looksLikeText(content: string): boolean {
  const sample = content.slice(0, BINARY_SAMPLE_SIZE);
  if (sample.length === 0) return true; // empty files are harmless

  let controlCount = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    // NUL byte or C0 control chars excluding \t (9), \n (10), \r (13)
    if (code === 0 || (code >= 1 && code <= 8) || (code >= 14 && code <= 31)) {
      controlCount++;
    }
  }

  return controlCount / sample.length < BINARY_THRESHOLD;
}

// ---------------------------------------------------------------------------
// shouldIndexFile — hybrid post-load filter
// ---------------------------------------------------------------------------

/**
 * Returns true if the document should be included in the RAG corpus.
 *
 * Implements the hybrid KNOWN GOOD / KNOWN BAD / UNKNOWN TEXT FALLBACK policy:
 *
 *  1. Asset-path check     : file in a known asset directory  → EXCLUDE
 *  2. Known binary ext     : extension in KNOWN_BINARY_EXTENSIONS → EXCLUDE
 *  3. Known source ext     : extension in KNOWN_SOURCE_EXTENSIONS → INCLUDE
 *  4. Known config JSON    : ext=.json, filename in INDEXABLE_JSON_FILENAMES → INCLUDE
 *  5. Any other .json      : ext=.json (not in step 4)         → EXCLUDE
 *     JSON is always special-cased to prevent Lottie/data JSON from re-entering
 *     the corpus via the text fallback.
 *  6. Unknown extension    : run looksLikeText(content)
 *                              → text   → INCLUDE  (e.g. .dart, .zig, .sol)
 *                              → binary → EXCLUDE
 *
 * The principle is: UNKNOWN ≠ AUTOMATICALLY BAD.
 * Unknown text/source files get a chance to enter the corpus so GitPulse
 * does not silently reject legitimate source code in languages not explicitly
 * listed in KNOWN_SOURCE_EXTENSIONS.
 *
 * @param filePath - The file path from document metadata.
 * @param content  - The document's text content (used only for unknown extensions).
 * @returns [boolean, string] — [should index, human-readable reason for logging]
 */
function shouldIndexFile(filePath: string, content: string): [boolean, string] {
  const normalized = filePath.replace(/\\/g, "/");

  // ── Rule 1: Known asset directory ──────────────────────────────────────────
  for (const segment of ASSET_PATH_SEGMENTS) {
    const normalizedSegment = segment.replace(/\\/g, "/");
    if (normalized.includes(normalizedSegment)) {
      return [false, "asset path"];
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();

  // ── Rule 2: Known binary extension ─────────────────────────────────────────
  if (KNOWN_BINARY_EXTENSIONS.has(ext)) {
    return [false, "binary extension"];
  }

  // ── Rule 3: Known source/config/documentation extension ────────────────────
  if (KNOWN_SOURCE_EXTENSIONS.has(ext)) {
    return [true, "known source extension"];
  }

  // ── Rule 4 + 5: JSON special case ──────────────────────────────────────────
  // JSON is intentionally NOT allowed via the text fallback below.
  // Configuration JSON is useful; arbitrary JSON (Lottie, chart data) is not.
  if (ext === ".json") {
    if (INDEXABLE_JSON_FILENAMES.has(base)) {
      return [true, "known config JSON"];
    }
    return [false, "unsupported JSON"];
  }

  // ── Rule 6: Unknown extension — inspect content ─────────────────────────────
  // Unknown file types that look like plain text are allowed. This future-proofs
  // GitPulse against legitimate source code in languages not yet listed in
  // KNOWN_SOURCE_EXTENSIONS (e.g. .dart, .zig, .ex, .sol, .tf, .proto).
  if (looksLikeText(content)) {
    return [true, "unknown text/source file"];
  }

  return [false, "unknown binary file"];
}

// ---------------------------------------------------------------------------
// loadGithubRepo
// ---------------------------------------------------------------------------

/**
 * Loads documents from a GitHub repository, applying broad exclusions for
 * build artifacts, dependencies, binary files, and UI/static assets.
 *
 * The loader's ignoreFiles / ignorePaths handle the FIRST filter pass.
 * A second, extension-based filter pass is applied inside generateEmbeddings()
 * via shouldIndexFile() before any chunking occurs.
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
      // -----------------------------------------------------------------------
      // Package manager lock files — machine-generated, never useful for RAG.
      // -----------------------------------------------------------------------
      "package-lock.json",
      "yarn.lock",
      "pnpm-lock.yaml",
      "bun.lockb",
      "bun.lock",

      // -----------------------------------------------------------------------
      // Build / generated output directories.
      // These are produced by build tools and contain no original source.
      // -----------------------------------------------------------------------
      "dist",
      "build",
      ".next",
      "out",
      ".turbo",
      ".cache",
      ".vercel",

      // -----------------------------------------------------------------------
      // Dependencies — individual files that might slip past directory exclusion.
      // -----------------------------------------------------------------------
      "node_modules",

      // -----------------------------------------------------------------------
      // Environment / secrets — never index .env files.
      // -----------------------------------------------------------------------
      ".env",
      ".env.local",
      ".env.development",
      ".env.production",

      // -----------------------------------------------------------------------
      // IDE / OS metadata files — not relevant to the codebase.
      // -----------------------------------------------------------------------
      ".DS_Store",
      "Thumbs.db",
      ".idea",
      ".vscode",

      // -----------------------------------------------------------------------
      // Coverage / test-generated output.
      // -----------------------------------------------------------------------
      "coverage",
      ".nyc_output",

      // -----------------------------------------------------------------------
      // Log files.
      // -----------------------------------------------------------------------
      "*.log",

      // -----------------------------------------------------------------------
      // Minified / bundled / source-map files.
      // These are generated outputs, not original source code.
      // Embedding minified code would produce extremely low-quality chunks.
      // -----------------------------------------------------------------------
      "*.min.js",
      "*.min.css",
      "*.map",

      // -----------------------------------------------------------------------
      // UI / static asset files.
      //
      // These files are intentionally excluded from the RAG corpus.
      // A single SVG, Lottie animation, or raster image file can produce
      // 100–400+ chunks that contain no application logic, actively degrading
      // retrieval quality by crowding out real code in the top-10 results.
      //
      // IMPORTANT: Do NOT add "*.json" here — configuration files such as
      // package.json and tsconfig.json contain meaningful project data.
      // Instead, specific asset file types are blocked individually.
      // -----------------------------------------------------------------------

      // Vector graphics
      "*.svg",

      // Raster images
      "*.png",
      "*.jpg",
      "*.jpeg",
      "*.gif",
      "*.webp",
      "*.ico",
      "*.bmp",
      "*.tiff",
      "*.avif",

      // Fonts — binary, not useful for code RAG.
      "*.woff",
      "*.woff2",
      "*.ttf",
      "*.eot",
      "*.otf",

      // Audio
      "*.mp3",
      "*.wav",
      "*.ogg",
      "*.flac",
      "*.aac",

      // Video
      "*.mp4",
      "*.mov",
      "*.avi",
      "*.webm",
      "*.mkv",

      // Archives / binaries
      "*.zip",
      "*.tar",
      "*.gz",
      "*.bz2",
      "*.7z",
      "*.rar",
      "*.pdf",
      "*.exe",
      "*.dll",
      "*.so",
      "*.dylib",
      "*.wasm",

      // -----------------------------------------------------------------------
      // Generated / data files that masquerade as text but produce no useful
      // code semantics. Lottie animation JSON is the most common offender —
      // a single animation file routinely generates 200–400 chunks.
      //
      // Note: "*.json" is NOT included here. Only specific patterns are blocked.
      // -----------------------------------------------------------------------
      "*.lottie",
    ],

    // -------------------------------------------------------------------------
    // ignorePaths — directory-level exclusion.
    //
    // ignorePaths is the correct option for filtering entire directory trees;
    // ignoreFiles only matches individual filenames or glob extensions.
    // -------------------------------------------------------------------------
    ignorePaths: [
      // Dependency directories at any depth.
      "node_modules",
      "**/node_modules",

      // Lock files by path pattern (belt-and-suspenders alongside ignoreFiles).
      "**/package-lock.json",
      "**/yarn.lock",
      "**/pnpm-lock.yaml",
      "**/bun.lock",
      "**/bun.lockb",

      // OS metadata.
      "**/.DS_Store",

      // -----------------------------------------------------------------------
      // Asset directories.
      //
      // These paths are excluded because they are known to contain only
      // static/generated UI assets (Lottie JSON, SVG sprites, images, fonts).
      // They produce no useful chunks for code-level RAG.
      //
      // The "assets" and "src/assets" patterns are the most impactful because
      // frontend repositories commonly store large Lottie/image files there.
      // -----------------------------------------------------------------------
      "**/assets",
      "**/src/assets",
      "**/public/assets",
      "**/static",
      "**/images",
      "**/fonts",
      "**/icons",
      "**/animations",
      "**/lottie",
      "**/media",

      // Build/generated output directories (belt-and-suspenders).
      "**/.next",
      "**/dist",
      "**/build",
      "**/out",
      "**/.turbo",
      "**/.cache",
    ],

    recursive: true,
    // Silently ignore unknown/binary files instead of emitting a warning
    // for every file — this eliminates noise in the server logs.
    unknown: "ignore",
    // 5 concurrent requests to GitHub API.
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
 * 1. Post-load filter: remove any remaining non-code/asset files via shouldIndexFile().
 * 2. Split each remaining document into overlapping chunks with RecursiveCharacterTextSplitter.
 * 3. Pathological-file safeguard: skip files producing > MAX_CHUNKS_PER_FILE chunks.
 * 4. Generate one 768-d embedding per chunk from the actual source-code content.
 * 5. Return one EmbeddingRecord per chunk.
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
  // Step 1 - Post-load file filter
  //
  // The GithubRepoLoader already excludes common binary and lock files.
  // This second pass removes any remaining non-code/asset files using the
  // deterministic allowlist defined in shouldIndexFile().
  //
  // Filtering BEFORE chunking means we never spend Gemini quota on
  // Lottie animations, SVG sprites, or other irrelevant static assets.
  // -------------------------------------------------------------------------
  const filteredDocs: Document[] = [];
  const filteredOut: string[] = [];

  for (const doc of docs) {
    const filePath = (doc.metadata?.source as string | undefined) ?? "unknown";
    const content = doc.pageContent ?? "";
    const [include, reason] = shouldIndexFile(filePath, content);
    if (include) {
      filteredDocs.push(doc);
      console.log(`[Filter] INCLUDED ${filePath} — ${reason}`);
    } else {
      filteredOut.push(filePath);
      console.log(`[Filter] EXCLUDED ${filePath} — ${reason}`);
    }
  }

  console.log(
    `[GitHub Loader] Documents after post-load filter: ${filteredDocs.length} / ${docs.length} ` +
    `(${filteredOut.length} filtered out)`
  );

  if (filteredOut.length > 30) {
    console.log(
      `[GitHub Loader] (${filteredOut.length} filtered-out files — see [Filter] lines above for details)`
    );
  }

  if (filteredDocs.length === 0) {
    console.warn(
      "[GitHub Loader] No indexable documents remain after filtering. Nothing to embed."
    );
    return [];
  }

  // -------------------------------------------------------------------------
  // Step 2 - Chunking (with per-file logging + pathological-file safeguard)
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

  // Track chunk count per file so we can log the top offenders.
  const chunkCountByFile = new Map<string, number>();
  let skippedPathologicalCount = 0;

  for (const doc of filteredDocs) {
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

    // -----------------------------------------------------------------------
    // Pathological-file safeguard.
    //
    // A file producing more than MAX_CHUNKS_PER_FILE chunks is almost certainly
    // a large generated/data/asset file that slipped through the loader filters.
    //
    // Legitimate source-code files (even large ones) typically stay well below
    // this threshold. The limit is deliberately conservative to avoid false
    // positives on large-but-legitimate code files.
    //
    // The entire file is SKIPPED rather than truncated, because silently
    // dropping the tail of a large code file would give the AI an incomplete
    // and misleading picture of the implementation.
    // -----------------------------------------------------------------------
    if (chunks.length > MAX_CHUNKS_PER_FILE) {
      console.warn(
        `[Chunking] SKIPPED "${filePath}" — produced ${chunks.length} chunks ` +
        `(limit: ${MAX_CHUNKS_PER_FILE}). ` +
        `This file is likely a large generated/data file that passed loader filters. ` +
        `Add its path or extension to the exclusion list if it is not meaningful source code.`
      );
      skippedPathologicalCount++;
      continue;
    }

    console.log(`[Chunking]   ${filePath} → ${chunks.length} chunks`);
    chunkCountByFile.set(filePath, chunks.length);

    chunks.forEach((chunk, chunkIndex) => {
      allChunks.push({
        filePath,
        fileName,
        chunkIndex,
        content: chunk.pageContent,
      });
    });
  }

  // -------------------------------------------------------------------------
  // Chunking summary with top files by chunk count.
  // -------------------------------------------------------------------------
  const sortedByChunkCount = [...chunkCountByFile.entries()].sort(
    ([, a], [, b]) => b - a
  );

  console.log("");
  console.log("=== [Chunking] Summary ===");
  console.log(`  Documents processed      : ${filteredDocs.length}`);
  console.log(`  Pathological files skipped: ${skippedPathologicalCount}`);
  console.log(`  Total chunks             : ${allChunks.length}`);
  console.log("  Top files by chunk count :");
  const topN = Math.min(10, sortedByChunkCount.length);
  for (let i = 0; i < topN; i++) {
    const [fp, cnt] = sortedByChunkCount[i]!;
    console.log(`    ${i + 1}. ${fp} (${cnt} chunks)`);
  }
  console.log("=========================");
  console.log("");

  if (allChunks.length === 0) {
    console.warn("[Chunking] No chunks produced - nothing to embed or store.");
    return [];
  }

  // -------------------------------------------------------------------------
  // Step 3 - Embedding (chunked into MAX_EMBED_BATCH_SIZE sub-batches)
  //
  // Each chunk is embedded as:
  //   "title: <filePath> | text: <source code>"
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

  // Build sub-batches. Each item carries the formatted embedding text.
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
    //   - 503 UNAVAILABLE      → exponential backoff, then key rotation
    // Any error that ultimately propagates here is non-recoverable at the
    // batch level — throw to fail the repository indexing operation.
    // -----------------------------------------------------------------------
    try {
      const vectors = await generateEmbedding(texts);
      for (let j = 0; j < subBatch.length; j++) {
        embeddingVectors[subBatch[j]!.globalIndex] = vectors[j]!;
      }
      console.log(
        `[Embedding] Sub-batch ${bi + 1}/${totalEmbedBatches} complete (${subBatch.length} chunks)`
      );
    } catch (err) {
      // generateEmbedding() exhausted all internal retries/keys.
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[Embedding] Sub-batch ${bi + 1}/${totalEmbedBatches} failed: ${message}`
      );
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
 *   GitHub URL -> GithubRepoLoader (first-pass load-time filters)
 *     -> shouldIndexFile() (second-pass post-load extension allowlist)
 *     -> RecursiveCharacterTextSplitter (source-code chunks)
 *     -> Pathological-file safeguard (> MAX_CHUNKS_PER_FILE → skip)
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
  console.log(`[GitHub Loader] Loaded ${docs.length} documents from GitHub`);

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
