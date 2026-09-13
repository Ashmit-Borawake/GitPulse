<h1 align="center">🔮 GitPulse</h1>

<p align="center">AI-powered GitHub repository intelligence — understand any codebase in seconds.</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js" />
  <img src="https://img.shields.io/badge/Google_Gemini-AI-blue?style=flat-square&logo=google" />
  <img src="https://img.shields.io/badge/pgvector-PostgreSQL-336791?style=flat-square&logo=postgresql" />
  <img src="https://img.shields.io/badge/LangChain-RAG-3DDC84?style=flat-square" />
  <img src="https://img.shields.io/badge/Better_Auth-Auth-orange?style=flat-square" />
</p>

---

## What is GitPulse?

**GitPulse** helps developers understand GitHub repositories faster — through AI-generated commit summaries, semantic code search, and codebase Q&A grounded in your actual source code.

> *The most valuable thing AI can do for a developer today is help them understand code they didn't write, or code they wrote long ago.*

---

## Features

| Feature | Description |
|---|---|
| **Connect Any Repo** | Link public or private GitHub repos with an optional personal access token |
| **AI Commit Summaries** | Recent commits explained in plain English |
| **Repository Indexing** | Crawls and embeds source files into a vector database, skipping binaries and build output |
| **RAG Q&A** | Chat with your codebase — answers are grounded in actual retrieved source code |
| **Streaming Answers** | AI responses stream live in the browser |
| **File References** | Every answer includes the exact files and similarity scores used to generate it |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | JavaScript / JSX |
| Styling | Tailwind CSS v4 |
| UI | shadcn / Base UI |
| Auth | Better Auth (Email + Google + GitHub OAuth) |
| ORM | Prisma 6 |
| Database | PostgreSQL + pgvector |
| AI | Google Gemini (`gemini-embedding-2` + `gemini-3.6-flash`) |
| GitHub | Octokit |
| Data Fetching | TanStack React Query |
| Package Manager | pnpm |

---

## Architecture

```
Browser
    ↓
Next.js API Routes
    ├── Better Auth       → session management
    ├── Prisma            → PostgreSQL + pgvector
    ├── Octokit           → GitHub commits & diffs
    └── Google Gemini     → embeddings + RAG generation
```

**Q&A Flow**
```
User question
    → embed query (gemini-embedding-2, 768-d)
    → pgvector cosine search (top-10 chunks, scoped to project)
    → Gemini 3.6 Flash generates answer from retrieved code
    → streamed to browser; file references sent in response header
```

**Indexing Flow**
```
New project created
    → pollCommits (sync)   — commits fetched + AI-summarized → DB
    → indexGithubRepo (background)
          → load files from GitHub
          → filter (lock files, binaries, build output excluded)
          → chunk (1500 chars / 150 overlap)
          → embed → store in pgvector
```

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- pnpm
- PostgreSQL with `pgvector` enabled (or a [Supabase](https://supabase.com) project)
- A Google Gemini API key
- GitHub OAuth App (and optionally Google OAuth App)

### Install

```bash
git clone https://github.com/your-username/GitPulse.git
cd GitPulse/gitpulse

pnpm install
cp .env.example .env   # fill in your credentials

pnpm prisma migrate dev
pnpm dev               # http://localhost:3001
```

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Better Auth
BETTER_AUTH_SECRET="your-secret"
BETTER_AUTH_URL="http://localhost:3001"

# OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GITHUB_CLIENT_ID=""
GITHUB_CLIENT_SECRET=""

# GitHub (optional — for private repos or higher rate limits)
GITHUB_TOKEN=""

# Google Gemini
GEMINI_API_KEY="AIza..."
```

---

## Project Structure

```
gitpulse/
├── prisma/schema.prisma          ← DB schema (auth models + pgvector)
└── src/
    ├── app/
    │   ├── auth/                 ← Login & signup pages
    │   ├── (protected)/
    │   │   ├── dashboard/        ← Commit log + Q&A card
    │   │   └── create-project/   ← Link a GitHub repo
    │   └── api/
    │       ├── project/          ← Create & list projects
    │       ├── commits/          ← Fetch commits
    │       └── QA/               ← Streaming RAG endpoint
    ├── lib/
    │   ├── github.ts             ← Octokit commit fetching
    │   ├── github-loader.ts      ← File loading, filtering, chunking
    │   └── gemini.ts             ← Embeddings, RAG retrieval, streaming
    ├── components/               ← Sidebar, UI components (shadcn)
    ├── hooks/                    ← useProject, useRefetch
    └── server/db.ts              ← Prisma client singleton
```

---

## Database Models

| Model | Purpose |
|---|---|
| `User` | Auth + `credits` balance (default 150) |
| `Project` | Linked GitHub repo + optional token |
| `UserToProject` | Many-to-many user↔project membership |
| `Commit` | Git commits with AI-generated summaries |
| `SourceCodeEmbedding` | Chunked source code + `vector(768)` embeddings |

---

## License

MIT — see [LICENSE](LICENSE)

---

<p align="center">Built with Next.js 15 · Google Gemini · LangChain · pgvector · Better Auth</p>