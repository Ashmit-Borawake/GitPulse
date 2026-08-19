import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";

export const loadGithubRepo = async (
    githubUrl: string,
    githubToken?: string
) => {
    const loader = new GithubRepoLoader(githubUrl, {
        accessToken: githubToken || "",
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

// console.log(
//     await loadGithubRepo("https://github.com/AtharvaChaudharii/civic-connect")
// );