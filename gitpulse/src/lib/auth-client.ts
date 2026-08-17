import { createAuthClient } from "better-auth/react";

/**
 * Better Auth client instance for use in React Client Components.
 *
 * Authentication model: session + HTTP-only cookie.
 * No JWT configuration. No access tokens. No JWKS.
 *
 * The session cookie is managed automatically by Better Auth.
 * Do not manually create, read, or delete authentication cookies.
 *
 * Available methods:
 *  - authClient.signUp.email({ name, email, password })
 *  - authClient.signIn.email({ email, password })
 *  - authClient.signIn.social({ provider: "google" | "github", callbackURL })
 *  - authClient.signOut()
 *  - authClient.useSession()  ← React hook
 */
export const authClient = createAuthClient({
  // Points to the Next.js app URL so the client knows where /api/auth/* lives.
  // In development this is http://localhost:3001.
  // In production this should be set to the deployed URL.
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
});

// Re-export the individual methods for cleaner imports in pages.
export const { signIn, signUp, signOut, useSession } = authClient;
