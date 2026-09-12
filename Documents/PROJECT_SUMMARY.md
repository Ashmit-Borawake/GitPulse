# GitPulse - Project Summary

## 1. Project Overview
GitPulse is an intelligent developer tool that helps teams and individual developers quickly understand large or unfamiliar GitHub repositories. It acts as an AI-powered assistant for your codebase, allowing you to ask questions about the code, analyze commit history, and get smart summaries of complex files.

## 2. Problem Statement
When joining a new project or reviewing a large codebase, developers often struggle to understand how different parts of the system connect. Reading through hundreds of files, deciphering complex logic, and tracking down what recent commits actually achieved takes a massive amount of time. There is a need for a tool that can instantly read, summarize, and answer questions about an entire repository without manual effort.

## 3. Core Features
* **GitHub Repository Analysis:** Connect any public (or private) GitHub repository to start analyzing its contents immediately.
* **Commit Summaries:** Automatically fetches and explains recent commits in simple English, helping developers understand the progress and changes over time.
* **Repository Indexing:** Intelligently reads and processes the entire codebase, automatically ignoring unnecessary build files and dependencies.
* **AI-Powered Code Understanding:** Provides human-readable summaries of complex code files to make them easier to grasp.
* **RAG-based Q&A:** Allows developers to chat directly with their codebase. You can ask specific questions like "How does the authentication work?" and get accurate, streamed answers grounded directly on the project's actual source code — not Gemini's general knowledge.
* **File Reference Tracking:** When answering a question, GitPulse returns metadata about the exact retrieved code files (file name, path, chunk index, similarity score) that were used to construct the answer, available for future display in the UI.
* **Quota-Resilient Embedding Pipeline:** Uses a pool of **6 Gemini API keys** (`GEMINI_API_KEY_1` – `GEMINI_API_KEY_6`) with automatic round-robin rotation and refined 429 detection (`isRateLimitError()`), transparently recovering from quota errors without interrupting the indexing process.
* **Quota-Resilient Generative AI Pipeline:** Uses a separate pool to load-balance RAG Q&A and Commit Summarization across all 6 keys with round-robin selection, automatic 429 failover, and smart 1-hour cooldowns.
* **Hybrid File-Filtering System:** A two-pass filter eliminates non-code assets before any chunking or embedding occurs. The first pass uses `GithubRepoLoader`'s `ignoreFiles`/`ignorePaths` lists. The second pass applies the `shouldIndexFile()` function which classifies files using an extension allowlist, a binary extension blocklist, JSON special-casing, asset-path segment detection, and a binary-content heuristic for unknown extensions.
* **Detailed Pipeline Logging:** Every stage of the indexing and Q&A pipeline emits structured console logs (`[GitHub Loader]`, `[Filter]`, `[Chunking]`, `[Embedding]`, `[Database]`, `[API QA]`, `[Gemini Q&A]`) for production-level observability.

## 4. Technology Stack
* **Frontend: Next.js, React, Tailwind CSS:** Used to build a fast, responsive, and beautiful user interface where developers can view their dashboards and chat with the AI.
* **Backend/API: Next.js API routes:** Handles the server-side logic, securely processing requests between the frontend, database, and external services.
* **Authentication: Better Auth:** Manages user sign-ups and logins securely, ensuring that only authorized users can access their projects.
* **Database: PostgreSQL / Supabase:** A reliable relational database used to store user data, project details, and analyzed commits.
* **ORM: Prisma:** Acts as a bridge between the backend code and the PostgreSQL database, making it easy and safe to read and write data.
* **GitHub Integration: Octokit:** The official tool used to securely communicate with GitHub to fetch repository details and commit history.
* **AI: Google Gemini:** The core intelligence engine that summarizes commits (`gemini-3.6-flash`) and generates embeddings (`gemini-embedding-2`).
* **LangChain:** Used to efficiently load files directly from GitHub and split large code files into smaller, manageable chunks.
* **RAG (Retrieval-Augmented Generation):** The system design that allows the AI to search the database for relevant code chunks before answering a question, ensuring answers are highly accurate and specific to the repository.
* **Embeddings: Gemini Embedding 2 (`gemini-embedding-2`):** Converts chunks of code into 768-dimensional numerical vectors that capture semantic meaning, enabling accurate similarity searches at query time.
* **Multi-Key Embedding Pool:** **6 Gemini API keys** (`GEMINI_API_KEY_1` – `GEMINI_API_KEY_6`, one per GCP project) are pooled with round-robin rotation in `gemini.ts`. A refined `isRateLimitError()` helper distinguishes genuine quota 429s from auth failures and policy violations before triggering rotation. On a 429 quota error, the pool transparently rotates to the next key. If all 6 keys are exhausted, it sleeps 61 seconds for the TPM window to reset, then retries — all without any code changes in the calling layer.
* **Generative Key Pool:** A dedicated generation key pool intelligently load-balances Commit Summarization and Q&A streaming across all 6 available API keys independently of the embedding pool. It employs round-robin selection with automatic 429 quota failover, smart 1-hour cooldowns for rate-limited keys, and 503 exponential backoff retries.
* **Vector Database: pgvector:** An extension for PostgreSQL that stores the numerical embeddings and allows for efficient similarity searches when retrieving code for the AI.
* **Hybrid File-Filtering System:** Two-pass filter in `github-loader.ts`. First pass: `GithubRepoLoader` `ignoreFiles` + `ignorePaths`. Second pass: `shouldIndexFile()` with 6 rules — extension allowlist (`KNOWN_SOURCE_EXTENSIONS`), binary blocklist (`KNOWN_BINARY_EXTENSIONS`), JSON special-casing (`INDEXABLE_JSON_FILENAMES`), asset-path segment exclusion (`ASSET_PATH_SEGMENTS`), and `looksLikeText()` binary heuristic for unknown extensions.

## 5. How the System Works
GitPulse operates using two main flows:

**The Q&A Flow (RAG):**
`GitHub Repository → Load Files → Chunk Code → Generate Embeddings (gemini-embedding-2) → Store in pgvector`
`User Question → Query Embedding ("task: code retrieval | query: ...") → pgvector Similarity Search → Top-10 Relevant Code Chunks → Gemini 3.6 Flash → Streamed Answer`

*First, the system downloads the code, breaks it into smaller pieces, and turns those pieces into searchable numbers (embeddings). When a user asks a question, the system formats the query using the asymmetric retrieval prefix and performs a cosine similarity search to retrieve the most relevant code chunks. These chunks are then provided to Gemini 3.6 Flash as a grounded context, which streams the answer back to the browser. The retrieved file references (fileName, filePath, chunkIndex, similarity) are sent in the `X-File-References` response header, separate from the streaming text body.*

**Note:** GitPulse does NOT generate per-chunk LLM summaries during indexing. Source code is embedded and stored directly. This avoids consuming unnecessary Gemini generation API quota during repository indexing.

**The Commit Flow:**
`GitHub Repository → Fetch Recent Commits → Summarize Commits → Store in Database → Display on Dashboard`
*In the background, the system fetches recent changes from GitHub and uses AI to explain what those changes actually mean in plain English.*

## 6. Why GitPulse is Useful
* **Saves Time:** Drastically reduces the time spent reading code and figuring out how a project is structured.
* **Improves Onboarding:** Helps new developers get up to speed on a codebase in a fraction of the usual time.
* **Better Code Reviews:** Makes it easier to understand the context of recent changes and commits.
* **Accessible Knowledge:** Acts as an always-available expert that can instantly answer questions about the repository.

## 7. Future Scope
* **Q&A Answer Display:** Render the streamed answer in the Dialog with Markdown and code block formatting; show a file-reference panel listing retrieved files.
* **Credits System:** `User.credits` field (default 150) is already in the schema; deduction logic per Q&A call and UI credits display are planned.
* **GitHub Issues and Pull Request Analysis:** Summarizing active issues and explaining the impact of open pull requests.
* **Advanced Code-Quality Metrics:** Automatically detecting overly complex files or suggesting refactoring improvements.
* **Multi-Repository Context:** Allowing the AI to answer questions that span across multiple connected microservices or repositories.
* **Automated Code Documentation:** Generating complete `README.md` files or API documentation with a single click.

## 8. Viva / Common Questions

**1. Why did you use LangChain?**
GitPulse uses LangChain to efficiently load the GitHub repository and split large source files into smaller, manageable chunks before we generate their embeddings.

**2. Why do you need embeddings?**
Embeddings convert pieces of code into numerical vectors that represent their actual semantic meaning. This allows the system to retrieve the most relevant code when a user asks a specific question.

**3. Why did you use pgvector?**
pgvector allows us to store these embeddings and perform similarity searches directly inside our existing PostgreSQL database, which avoids the complexity of setting up a separate vector database.

**4. What is RAG and why are you using it?**
Retrieval-Augmented Generation (RAG) means we search and retrieve the relevant project code first, and then ask Gemini to answer the question based on that code. This ensures answers are highly accurate and grounded in the actual codebase rather than general guesses.

**5. Why do you split the code into chunks?**
Large code files cannot be processed efficiently by the AI all at once. By dividing the code into smaller overlapping chunks, each piece can be embedded and retrieved independently, making searches much more accurate.

**6. What problem does GitPulse solve?**
It drastically reduces the time developers spend trying to understand unfamiliar repositories, complex code, and recent commits by providing AI-powered summaries and instant, codebase-specific Q&A.

**7. Why do you use multiple Gemini API keys for embeddings?**
The Gemini free tier limits each API key (per GCP project) to 30,000 tokens per minute (TPM). A typical repository produces ~1,000+ code chunks, which can push ~33K+ tokens through the embedding API in under a minute — exceeding the limit. By maintaining a pool of **6 keys** (`GEMINI_API_KEY_1` – `GEMINI_API_KEY_6`, each from a different GCP project with its own independent 30K TPM quota), the system distributes token usage across keys using round-robin rotation. If a key still hits its quota, it automatically rotates to the next one. If all 6 keys are exhausted simultaneously, it sleeps 61 seconds for the quota window to reset, then retries — completely transparently to the rest of the application.

**8. How does GitPulse stream the Q&A answer?**
`gemini.ts` calls `generateContentStream()` on a client selected by `executeWithGenerationFailover()` from the Generative Key Pool. This returns a `@google/genai` async iterable which is converted into a native web `ReadableStream<Uint8Array>` — with text chunks enqueued as they arrive and `controller.close()` called only on successful completion. The `/api/QA` route returns this as a standard HTTP `Response` with `Content-Type: text/plain`. The browser reads it via `res.body.getReader()` and `TextDecoder`, appending each streamed chunk directly to the answer state — producing a live typing effect without any third-party streaming libraries.

**9. Why do you use a response header for file references instead of the response body?**
The HTTP response body is already occupied by the raw streaming text of the Gemini answer. Switching the body to JSON would break the streaming behavior entirely. Instead, the lightweight file reference metadata (`fileName`, `filePath`, `chunkIndex`, `similarity`) is sent in the `X-File-References` response header as a JSON-encoded string. The frontend reads this header synchronously before starting to consume the body stream, so both pieces of information are available independently without interfering with each other.

**10. How does the file-filtering system prevent bad files from entering the RAG corpus?**
GitPulse uses a **two-pass** strategy. The first pass happens at load time inside `GithubRepoLoader` via `ignoreFiles` (file/glob patterns) and `ignorePaths` (directory trees) — this eliminates lock files, build outputs, dependencies, secrets, and binary assets before files are even downloaded. The second pass runs inside `shouldIndexFile()` after loading, classifying each file using six rules in order: (1) asset-path segment check, (2) known binary extension blocklist, (3) known source extension allowlist, (4-5) JSON special-case, (6) `looksLikeText()` heuristic for unknown extensions. Files that slip through both passes and produce more than 150 chunks trigger a pathological-file safeguard and are skipped entirely rather than truncated.

**11. Why skip the entire file rather than truncating it when it exceeds the chunk limit?**
Silently dropping the tail of a large source file would give the AI an incomplete and misleading picture of the implementation — the retrieved chunks would appear coherent but actually represent only a fraction of the file's logic. Skipping the file entirely surfaces the problem in the logs (`[Chunking] SKIPPED`) so the developer can investigate and add the appropriate exclusion rule, rather than silently degrading retrieval quality.
