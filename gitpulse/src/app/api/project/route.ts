import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/server/db';
import { pollCommits } from '@/lib/github';
import { indexGithubRepo } from '@/lib/github-loader';

export async function POST(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = (await request.json()) as {
            projectName?: string;
            repoUrl?: string;
            githubToken?: string;
        };
        const { projectName, repoUrl, githubToken } = body;

        if (!projectName || !repoUrl) {
            return NextResponse.json(
                { error: 'Invalid project data' },
                { status: 400 }
            );
        }

        // Step 1: Create a Project in Database
        const project = await db.project.create({
            data: {
                name: projectName,
                githubUrl: repoUrl, 
                githubToken: githubToken,
                userToProjects: {
                    create: {
                        userId: session.user.id,
                    }
                }
            }
        });

        /**
         * Step 2: Poll Commits
         *
         * Synchronously fetch the initial set of commits for the repository.
         * We await this so that the dashboard has immediate commit data to display,
         * but we wrap it in a try-catch so that a failure here doesn't roll back
         * the project creation.
         */
        let commitSyncError: string | null = null;
        try {
            await pollCommits(project.id);
        } catch (pollError) {
            const message = pollError instanceof Error ? pollError.message : String(pollError);
            console.error('[pollCommits] Failed to sync commits for project', project.id, ':', message);
            commitSyncError = message;
        }

        /**
         * Step 3: Index Repository for AI (Embeddings)
         *
         * Kick off the background process to chunk and embed the source code
         * for AI Q&A features. This operation can take a while for large repos,
         * so we do NOT await it. It runs independently and logs errors if it fails.
         */
        indexGithubRepo(
            project.id,
            repoUrl,
            githubToken,
        ).catch((indexError) => {
            const message = indexError instanceof Error ? indexError.message : String(indexError);
            console.error('[indexGithubRepo] Failed to index repository for project', project.id, ':', message);
        });

        return NextResponse.json(
            {
                success: true,
                project,
                ...(commitSyncError && { commitSyncError }),
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Failed to create project:', error);
        return NextResponse.json(
            { error: 'Failed to create project' },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    try {
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const projects = await db.project.findMany({
            where: {
                userToProjects: {
                    some: {
                        userId: session.user.id,
                    },
                },
            },
        });

        return NextResponse.json(projects);
    } catch (error) {
        console.error('Failed to fetch projects:', error);
        return NextResponse.json(
            { error: 'Failed to fetch projects' },
            { status: 500 }
        );
    }
}
