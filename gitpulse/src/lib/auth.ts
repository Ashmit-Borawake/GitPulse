import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/server/db";
import { env } from "@/env";

/**
 * Better Auth server instance.
 *
 * Authentication model: session + HTTP-only cookie only.
 * No JWT plugin. No JWKS. No custom token signing.
 *
 * Supports:
 *  - Email + password
 *  - Google OAuth
 *  - GitHub OAuth
 */
export const auth = betterAuth({
  // ── Database ────────────────────────────────────────────────────────────────
  // Re-uses the existing Prisma singleton from src/server/db.ts.
  // No second database connection is created.
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  // ── Base URL ─────────────────────────────────────────────────────────────────
  // Used by Better Auth to build OAuth callback URLs, CSRF checks, etc.
  // Matches BETTER_AUTH_URL in .env (http://localhost:3001 in dev).
  baseURL: env.BETTER_AUTH_URL,

  // ── Secret ───────────────────────────────────────────────────────────────────
  secret: env.BETTER_AUTH_SECRET,

  // ── Session ──────────────────────────────────────────────────────────────────
  session: {
    expiresIn: 60 * 60 * 24 * 2, // 2 days in seconds
    updateAge: 60 * 60 * 24, // update the session in the DB every 1 day
  },

  // ── User ─────────────────────────────────────────────────────────────────────
  user: {
    additionalFields: {
      firstName: {
        type: "string",
        required: false,
      },
      lastName: {
        type: "string",
        required: false,
      },
      imageUrl: {
        type: "string",
        required: false,
      },
    },
  },

  // ── Account ──────────────────────────────────────────────────────────────────
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github"],
      requireLocalEmailVerified: false,
    },
  },

  // ── Email & Password ─────────────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
  },

  // ── Social Providers ─────────────────────────────────────────────────────────
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      mapProfileToUser: (profile) => ({
        firstName: profile.given_name,
        lastName: profile.family_name,
        imageUrl: profile.picture,
      }),
    },
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      mapProfileToUser: (profile) => ({
        // GitHub does not provide a reliable separate first/last name
        // We map avatar_url to our custom imageUrl field
        imageUrl: profile.avatar_url,
      }),
    },
  },
});

// Export helper types so pages can type-check session data.
export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
