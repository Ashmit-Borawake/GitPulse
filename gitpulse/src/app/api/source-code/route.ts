import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/server/db';

/**
 * GET /api/source-code?projectId=<id>&filePath=<path>
 *
 * Returns indexed source-code for a specific file within a project.
 * Requires a valid session and verified project membership — same auth
 * pattern used by /api/commits and /api/project.
 *
 * Chunk reconstruction:
 *   Chunks are stored with CHUNK_OVERLAP=150 character overlap between
 *   adjacent chunks (CHUNK_SIZE=1500). To reconstruct without duplicating
 *   the overlap, we take the full first chunk and only the non-overlapping
 *   suffix (i.e., characters after the first CHUNK_OVERLAP chars) of each
 *   subsequent chunk.
 */

const CHUNK_OVERLAP = 150;

export async function GET(request: Request) {
  // 1. Session check
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const filePath = searchParams.get('filePath');

  if (!projectId || !filePath) {
    return NextResponse.json(
      { error: '`projectId` and `filePath` are required.' },
      { status: 400 },
    );
  }

  // 2. Project membership check — same pattern as /api/commits
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
      { error: 'Project not found or access denied.' },
      { status: 403 },
    );
  }

  // 3. Fetch all chunks for this file, ordered by chunkIndex
  const chunks = await db.sourceCodeEmbedding.findMany({
    where: { projectId, filePath },
    orderBy: { chunkIndex: 'asc' },
    select: { content: true, chunkIndex: true },
  });

  if (chunks.length === 0) {
    return NextResponse.json({ sourceCode: '' });
  }

  // 4. Reconstruct original file content without duplicating the overlap.
  //    Adjacent chunks overlap by CHUNK_OVERLAP characters. To avoid
  //    repeating content, take the full first chunk and only the
  //    non-overlapping tail of each subsequent chunk.
  let sourceCode = chunks[0]!.content;
  for (let i = 1; i < chunks.length; i++) {
    const content = chunks[i]!.content;
    // The first CHUNK_OVERLAP chars of this chunk overlap with the end of
    // the previous one — drop them.
    const uniqueSuffix = content.slice(CHUNK_OVERLAP);
    if (uniqueSuffix.length > 0) {
      sourceCode += uniqueSuffix;
    }
  }

  return NextResponse.json({ sourceCode });
}
