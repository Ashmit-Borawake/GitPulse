import { db } from "@/server/db";
import { Octokit } from "octokit";

export const octokit = new Octokit();

type Response = {
    commitHash: string;
    commitMessage: string;
    commitAuthorName: string;
    commitAuthorAvatar: string;
    commitDate: string;
};

type GitHubCommit = NonNullable<Awaited<ReturnType<typeof octokit.rest.repos.listCommits>>["data"][0]>;

// Fetches and returns the top 10 most recent commits from a given GitHub repository URL.
export const getCommitHashes = async (
    githubUrl: string
): Promise<Response[]> => {
    // Parse owner and repo from github URL
    const urlParts = githubUrl.split("/");
    const owner = urlParts[urlParts.length - 2];
    const repo = urlParts[urlParts.length - 1];

    if (!owner || !repo) {
        throw new Error("Invalid github url");
    }

    const { data } = await octokit.rest.repos.listCommits({
        owner,
        repo,
    });

    const sortedCommits = data.sort(
        (a: GitHubCommit, b: GitHubCommit) =>
            new Date(b.commit.author?.date ?? "").getTime() -
            new Date(a.commit.author?.date ?? "").getTime()
    );

    return sortedCommits.slice(0, 10).map((commit: GitHubCommit) => ({
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
        select: { githubUrl: true },
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

// Orchestrates the process of fetching a project's URL, getting its commits, and filtering for new ones.
export const pollCommits = async (projectId: string) => {
    const { githubUrl } = await fetchProjectGithubUrl(projectId);

    const commitHashes = await getCommitHashes(githubUrl);

    const unprocessedCommits = await filterUnprocessedCommits(
        projectId,
        commitHashes
    );

    console.log(unprocessedCommits);

    return unprocessedCommits;
};  

// Test invocation - comment out if no valid project ID is available
// console.log(await pollCommits('cmsyzlsk10003ds8gyecytxhe'));
