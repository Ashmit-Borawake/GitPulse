import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Better Auth HTTP handler.
 *
 * This single catch-all route handles ALL authentication operations:
 *  - POST /api/auth/sign-in/email
 *  - POST /api/auth/sign-up/email
 *  - POST /api/auth/sign-out
 *  - GET  /api/auth/session
 *  - GET  /api/auth/callback/google
 *  - GET  /api/auth/callback/github
 *  - ... and any other Better Auth endpoints
 *
 * Do NOT create additional custom routes for login, signup, or OAuth.
 * Better Auth handles all of these internally.
 */
import { db } from "@/server/db";
import { NextRequest, NextResponse } from "next/server";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/auth/sign-in/email") {
    const clonedRequest = request.clone();
    try {
      const body = await clonedRequest.json();
      if (body && body.email) {
        const user = await db.user.findUnique({
          where: { email: body.email },
          select: { id: true },
        });

        if (!user) {
          return NextResponse.json(
            { message: "Email not registered. Please sign up." },
            { status: 400 }
          );
        }
      }
    } catch {
      // Ignore JSON parse errors; let Better Auth handle it
    }
  }

  return handler.POST(request);
}
