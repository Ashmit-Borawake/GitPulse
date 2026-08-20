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
* **RAG-based Q&A:** Allows developers to chat directly with their codebase. You can ask specific questions like "How does the authentication work?" and get accurate answers based directly on the project's actual code.

## 4. Technology Stack
* **Frontend: Next.js, React, Tailwind CSS:** Used to build a fast, responsive, and beautiful user interface where developers can view their dashboards and chat with the AI.
* **Backend/API: Next.js API routes:** Handles the server-side logic, securely processing requests between the frontend, database, and external services.
* **Authentication: Better Auth:** Manages user sign-ups and logins securely, ensuring that only authorized users can access their projects.
* **Database: PostgreSQL / Supabase:** A reliable relational database used to store user data, project details, and analyzed commits.
* **ORM: Prisma:** Acts as a bridge between the backend code and the PostgreSQL database, making it easy and safe to read and write data.
* **GitHub Integration: Octokit:** The official tool used to securely communicate with GitHub to fetch repository details and commit history.
* **AI: Google Gemini:** The core intelligence engine that summarizes code, explains commits, and answers user questions.
* **LangChain:** Used to efficiently load files directly from GitHub and split large code files into smaller, manageable chunks.
* **RAG (Retrieval-Augmented Generation):** The system design that allows the AI to search the database for relevant code chunks before answering a question, ensuring answers are highly accurate and specific to the repository.
* **Embeddings: Gemini Text Embeddings:** Converts chunks of code into numerical vectors (lists of numbers). This helps the system understand the "meaning" of the code so it can find relevant files when a user asks a question.
* **Vector Database: pgvector:** An extension for PostgreSQL that stores the numerical embeddings and allows for efficient similarity searches when retrieving code for the AI.

## 5. How the System Works
GitPulse operates using two main flows:

**The Q&A Flow (RAG):**
`GitHub Repository → Load Files → Summarize Files → Chunk Code → Generate Embeddings → Store in pgvector → Retrieve Relevant Code → AI Answers`
*First, the system downloads the code, breaks it into smaller pieces, and turns those pieces into searchable numbers (embeddings). When a user asks a question, the system performs a similarity search on the stored code embeddings to retrieve the most relevant code chunks, which are then provided to Gemini to generate the answer.*

**The Commit Flow:**
`GitHub Repository → Fetch Recent Commits → Summarize Commits → Store in Database → Display on Dashboard`
*In the background, the system fetches recent changes from GitHub and uses AI to explain what those changes actually mean in plain English.*

## 6. Why GitPulse is Useful
* **Saves Time:** Drastically reduces the time spent reading code and figuring out how a project is structured.
* **Improves Onboarding:** Helps new developers get up to speed on a codebase in a fraction of the usual time.
* **Better Code Reviews:** Makes it easier to understand the context of recent changes and commits.
* **Accessible Knowledge:** Acts as an always-available expert that can instantly answer questions about the repository.

## 7. Future Scope
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
