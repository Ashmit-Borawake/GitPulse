import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/server/db';
import type { InputJsonValue } from '@prisma/client/runtime/library';

/**
 * POST /api/QASave
 *
 * Persists a generated question + answer pair to the database.
 *
 * Request body (JSON):
 *   {
 *     projectId:      string   — required, must match a project the user belongs to
 *     question:       string   — required, non-empty
 *     answer:         string   — required, non-empty
 *     filesReferences: array  — optional code-reference objects from the X-File-References header
 *   }
 *
 * The userId is always taken from the server-side session — never from the request body.
 */
export async function POST(request: Request) {
    try {
        // ── 1. Authenticate ─────────────────────────────────────────────────────
        const session = await auth.api.getSession({
            headers: request.headers,
        });

        if (!session?.user) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 },
            );
        }

        // ── 2. Parse body ────────────────────────────────────────────────────────
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { error: 'Invalid JSON request body.' },
                { status: 400 },
            );
        }

        const { projectId, question, answer, filesReferences } =
            body as Record<string, unknown>;

        // ── 3. Validate required fields ──────────────────────────────────────────
        if (
            typeof projectId !== 'string' ||
            !projectId.trim() ||
            typeof question !== 'string' ||
            !question.trim() ||
            typeof answer !== 'string' ||
            !answer.trim()
        ) {
            return NextResponse.json(
                { error: 'projectId, question, and answer are required.' },
                { status: 400 },
            );
        }

        // ── 4. Validate optional filesReferences ─────────────────────────────────
        if (
            filesReferences !== undefined &&
            filesReferences !== null &&
            !Array.isArray(filesReferences)
        ) {
            return NextResponse.json(
                { error: 'filesReferences must be an array or null.' },
                { status: 400 },
            );
        }

        // ── 5. Authorise: confirm this user is a member of the project ───────────
        const projectAccess = await db.userToProject.findUnique({
            where: {
                userId_projectId: {
                    userId: session.user.id,
                    projectId: projectId.trim(),
                },
            },
            select: { projectId: true },
        });

        if (!projectAccess) {
            return NextResponse.json(
                { error: 'Project not found or access denied.' },
                { status: 403 },
            );
        }

        // ── 6. Persist ───────────────────────────────────────────────────────────
        const savedQuestion = await db.question.create({
            data: {
                question: question.trim(),
                answer,
                // Store the references array as JSON; null/undefined maps to Prisma JSON null.
                filesReferences: Array.isArray(filesReferences)
                    ? (filesReferences as InputJsonValue)
                    : undefined,
                projectId: projectId.trim(),
                userId: session.user.id,
            },
        });

        console.log(
            `[QASave] Saved question ${savedQuestion.id} for project ${projectId.trim()} by user ${session.user.id}`,
        );

        return NextResponse.json(
            {
                success: true,
                message: 'Answer saved successfully.',
                question: savedQuestion,
            },
            { status: 201 },
        );
    } catch (error) {
        console.error('[QASave] Failed to save answer:', error);

        return NextResponse.json(
            { error: 'Failed to save answer.' },
            { status: 500 },
        );
    }
}
