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
export const { GET, POST } = toNextJsHandler(auth);
