import { db } from "@/server/db";
import { Octokit } from "octokit";
import { aiSummariseCommits } from "./gemini";

// The global octokit instance is removed to ensure we select the token dynamically.

type Response = {
    commitHash: string;
    commitMessage: string;
    commitAuthorName: string;
    commitAuthorAvatar: string;
    commitDate: string;
};



// Fetches and returns the top 10 most recent commits from a given GitHub repository URL.
export const getCommitHashes = async (
    githubUrl: string,
    githubToken?: string
): Promise<Response[]> => {
    // Parse owner and repo from github URL
    const urlParts = githubUrl.split("/");
    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1];

    if (!owner || !repo) {
        throw new Error("Invalid github url");
    }

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const token = githubToken || process.env.GITHUB_TOKEN;
    const octokit = new Octokit({
        ...(token ? { auth: token } : {}),
    });

    const { data } = await octokit.rest.repos.listCommits({
        owner,
        repo,
    });

    const sortedCommits = data.sort(
        (a, b) =>
            new Date(b.commit.author?.date ?? "").getTime() -
            new Date(a.commit.author?.date ?? "").getTime()
    );

    return sortedCommits.slice(0, 10).map((commit) => ({
        commitHash: commit.sha,
        commitMessage: commit.commit.message ?? "",
        commitAuthorName: commit.commit.author?.name ?? "",
        commitAuthorAvatar: commit.author?.avatar_url ?? "",
        commitDate: commit.commit.author?.date ?? "",
    }));
};

// Retrieves the GitHub repository URL for a specific project from the database.
export const fetchProjectGithubUrl = async (projectId: string) => {
    const project = await db.project.findUnique({
        where: { id: projectId },
        select: { githubUrl: true, githubToken: true },
    });

    if (!project?.githubUrl) {
        throw new Error("Project has no github url");
    }

    return { project, githubUrl: project.githubUrl };
};

// Filters a list of commits to return only those that haven't been saved to the database yet.
export const filterUnprocessedCommits = async (
    projectId: string,
    commitHashes: Response[]
) => {
    const processedCommits = await db.commit.findMany({
        where: { projectId },
    });

    const processedHashes = new Set(
        processedCommits.map((record) => record.commitHash)
    );

    return commitHashes.filter(
        (ghCommit) => !processedHashes.has(ghCommit.commitHash)
    );
};

// Fetches the raw .diff content for a single commit from GitHub.
const fetchCommitDiff = async (
    githubUrl: string,
    commitHash: string,
    githubToken?: string
): Promise<string> => {
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const token = githubToken || process.env.GITHUB_TOKEN;
    const res = await fetch(`${githubUrl}/commit/${commitHash}.diff`, {
        headers: { 
            Accept: "application/vnd.github.v3.diff",
            ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
    });

    if (!res.ok) {
        throw new Error(
            `Failed to fetch diff for ${commitHash}: ${res.status} ${res.statusText}`
        );
    }

    return res.text();
};

// Orchestrates: fetch commits → filter unprocessed → fetch all diffs → ONE Gemini call → save to DB.
export const pollCommits = async (projectId: string, githubToken?: string) => {
    const { githubUrl, project } = await fetchProjectGithubUrl(projectId);

    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const tokenToUse = githubToken || project.githubToken || undefined;

    const commitHashes = await getCommitHashes(githubUrl, tokenToUse);

    const unprocessedCommits = await filterUnprocessedCommits(
        projectId,
        commitHashes
    );

    if (unprocessedCommits.length === 0) {
        console.log("No new commits to process.");
        return [];
    }

    // Fetch each commit's diff from GitHub (multiple GitHub requests — this is fine).
    const diffResults = await Promise.allSettled(
        unprocessedCommits.map(async (commit) => {
            const diff = await fetchCommitDiff(githubUrl, commit.commitHash, tokenToUse);
            return { commitHash: commit.commitHash, diff };
        })
    );

    // Keep only successfully fetched diffs; warn on failures.
    const commitDiffs: { commitHash: string; diff: string }[] = [];
    for (const result of diffResults) {
        if (result.status === "fulfilled") {
            commitDiffs.push(result.value);
        } else {
            console.error("Failed to fetch a commit diff:", result.reason);
        }
    }

    if (commitDiffs.length === 0) {
        console.error("No diffs could be fetched; skipping Gemini call.");
        return [];
    }

    // ONE Gemini API call for the entire batch.
    const summaries = await aiSummariseCommits(commitDiffs);

    // Build a lookup map so we match by commitHash — not by array index.
    const summaryByHash = new Map(
        summaries.map((s) => [s.commitHash, s.summary])
    );

    // Build the DB records, only for commits that received a valid summary.
    const records = unprocessedCommits.flatMap((commit) => {
        const summary = summaryByHash.get(commit.commitHash);
        if (!summary) {
            console.warn(`No summary returned for commit ${commit.commitHash}; skipping.`);
            return [];
        }
        return [
            {
                projectId,
                commitHash: commit.commitHash,
                commitMessage: commit.commitMessage,
                commitAuthorName: commit.commitAuthorName,
                commitAuthorAvatar: commit.commitAuthorAvatar,
                commitDate: commit.commitDate,
                summary,
            },
        ];
    });

    const commits = await db.commit.createMany({ data: records });

    return commits;
};
