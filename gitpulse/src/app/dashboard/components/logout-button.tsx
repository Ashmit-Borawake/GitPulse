"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Logout button — Client Component.
 *
 * Calls authClient.signOut() which:
 *  1. Sends a POST to /api/auth/sign-out
 *  2. Better Auth invalidates the session in the database
 *  3. Better Auth clears the session cookie
 *  4. We redirect to /auth/login
 *
 * Do NOT manually delete cookies or manipulate session IDs here.
 * Better Auth handles all of that internally.
 */
export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await authClient.signOut();
      router.push("/auth/login");
      router.refresh(); // Flush RSC cache so dashboard re-checks session
    } catch {
      // Even if signOut errors, redirect away
      router.push("/auth/login");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="inline-flex h-9 items-center justify-center rounded-full px-5 text-[0.875rem] font-medium transition-opacity duration-100 hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
      style={{
        backgroundColor: "var(--gp-btn-primary-bg)",
        color: "var(--gp-btn-primary-text)",
      }}
    >
      {isLoading ? "Signing out…" : "Sign out"}
    </button>
  );
}
