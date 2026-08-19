import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/server/db';
import { pollCommits } from '@/lib/github';

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

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json(
                { error: 'projectId is required' },
                { status: 400 }
            );
        }

        // Verify the project belongs to the authenticated user
        const membership = await db.userToProject.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId,
                },
            },
        });

        if (!membership) {
            return NextResponse.json(
                { error: 'Project not found or access denied' },
                { status: 403 }
            );
        }

        pollCommits(projectId).then().catch(console.error);

        const commits = await db.commit.findMany({
            where: { projectId },
            orderBy: { commitDate: 'desc' },
        });

        return NextResponse.json(commits);
    } catch (error) {
        console.error('Failed to fetch commits:', error);
        return NextResponse.json(
            { error: 'Failed to fetch commits' },
            { status: 500 }
        );
    }
}
