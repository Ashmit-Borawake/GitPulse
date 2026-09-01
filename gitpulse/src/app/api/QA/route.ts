import { askQuestionWithContext } from '@/lib/gemini';
import { NextResponse } from 'next/server';

/**
 * POST /api/QA
 *
 * Thin HTTP controller for the GitPulse RAG Q&A flow.
 *
 * Receives:
 *   { question: string, projectId: string }
 *
 * Validates the request, delegates all AI/retrieval work to gemini.ts,
 * and returns a native streaming HTTP Response consumed by ask-question-card.tsx.
 */
export async function POST(req: Request) {
  // 1. Parse JSON body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // 2. Validate question
  const { question, projectId } = body as Record<string, unknown>;

  console.log(`[API QA] Received question request for project ${String(projectId)}`);

  if (!question || typeof question !== 'string' || question.trim() === '') {
    console.warn(`[API QA] Validation failed: Empty question`);
    return NextResponse.json(
      { error: '`question` is required and must be a non-empty string.' },
      { status: 400 },
    );
  }

  if (question.trim().length > 2000) {
    console.warn(`[API QA] Validation failed: Question too long (${question.trim().length} chars)`);
    return NextResponse.json(
      { error: '`question` must be 2000 characters or fewer.' },
      { status: 400 },
    );
  }

  // 3. Validate projectId
  if (!projectId || typeof projectId !== 'string' || projectId.trim() === '') {
    console.warn(`[API QA] Validation failed: Invalid or missing projectId`);
    return NextResponse.json(
      { error: '`projectId` is required and must be a non-empty string.' },
      { status: 400 },
    );
  }

  // 4. Delegate to gemini.ts and return the stream
  try {
    console.log(`[API QA] Delegating question to Gemini pipeline...`);
    const { stream, filesReferences } = await askQuestionWithContext(
      question.trim(),
      projectId.trim(),
    );

    console.log(`[API QA] Stream created successfully. Returning HTTP response.`);
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        // Lightweight file references derived from the actual pgvector retrieval.
        // sourceCode is intentionally excluded to keep the header small.
        'X-File-References': JSON.stringify(filesReferences),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/QA] Error:', message);

    return NextResponse.json(
      { error: 'An error occurred while processing your question.' },
      { status: 500 },
    );
  }
}
