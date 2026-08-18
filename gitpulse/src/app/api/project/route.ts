import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/server/db';

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

        return NextResponse.json(
            {
                success: true,
                project,
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
