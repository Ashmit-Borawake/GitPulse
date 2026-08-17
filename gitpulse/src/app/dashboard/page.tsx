import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LogoutButton } from "./components/logout-button";

/**
 * GitPulse Dashboard — Server Component.
 *
 * Authentication check:
 *  1. Read incoming request headers (contains the session cookie)
 *  2. Call auth.api.getSession() — Better Auth validates the session cookie
 *     against the database session table
 *  3. If no valid session → redirect to /auth/login
 *  4. If session exists → render the dashboard with user data
 *
 * This pattern (auth.api.getSession + headers) is the correct Better Auth
 * server-side session check for Next.js App Router Server Components.
 * Do NOT query the Prisma session table directly to validate sessions.
 */
export default async function DashboardPage() {
  // Retrieve the Better Auth session from the incoming request cookies
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Unauthenticated — redirect to login
  if (!session) {
    redirect("/auth/login");
  }

  const { user } = session;

  return (
    <div
      className="flex min-h-svh flex-col"
      style={{ backgroundColor: "var(--gp-bg-base)" }}
    >
      {/* Top bar */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{
          backgroundColor: "var(--gp-bg-surface)",
          borderBottom: "1px solid var(--gp-border-default)",
        }}
      >
        <div className="flex items-center gap-3">
          {/* GitPulse wordmark (text fallback — logo assets TBD) */}
          <span
            className="text-lg font-semibold tracking-tight"
            style={{ color: "var(--gp-text-primary)" }}
          >
            GitPulse
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: "var(--gp-accent-subtle, #eff6ff)",
              color: "var(--gp-accent, #2563eb)",
            }}
          >
            Dashboard
          </span>
        </div>
        <LogoutButton />
      </header>

      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-16">
        {/* Session proof card */}
        <div
          className="w-full max-w-lg rounded-2xl p-8"
          style={{
            backgroundColor: "var(--gp-bg-surface)",
            border: "1px solid var(--gp-border-default)",
            boxShadow: "var(--gp-shadow-card)",
          }}
        >
          {/* Status badge */}
          <div className="mb-6 flex items-center gap-2">
            <span
              className="inline-block size-2.5 rounded-full"
              style={{ backgroundColor: "var(--gp-semantic-success, #16a34a)" }}
            />
            <span
              className="text-[0.8125rem] font-medium"
              style={{ color: "var(--gp-semantic-success, #16a34a)" }}
            >
              Authenticated
            </span>
          </div>

          <h1
            className="mb-1 text-2xl font-semibold tracking-tight"
            style={{ color: "var(--gp-text-primary)" }}
          >
            Welcome, {user.name}
          </h1>
          <p
            className="mb-8 text-[0.9375rem]"
            style={{ color: "var(--gp-text-secondary)" }}
          >
            You are signed in and your session is active.
          </p>

          {/* Session details */}
          <div className="flex flex-col gap-4">
            <SessionRow label="Name" value={user.name} />
            <SessionRow label="Email" value={user.email} />
            <SessionRow
              label="Email verified"
              value={user.emailVerified ? "Yes" : "No"}
            />
            <SessionRow label="User ID" value={user.id} mono />
            <SessionRow label="Authentication" value="Better Auth" />
            <SessionRow label="Session" value="Active (HTTP-only cookie)" />
          </div>
        </div>

        {/* Placeholder notice */}
        <p
          className="max-w-sm text-center text-[0.8125rem]"
          style={{ color: "var(--gp-text-tertiary)" }}
        >
          This dashboard is a temporary authentication proof page.
          The real GitPulse dashboard will be implemented in a future phase.
        </p>
      </main>
    </div>
  );
}

// ── Small helper component ───────────────────────────────────────────────────

function SessionRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span
        className="min-w-[130px] text-[0.8125rem] font-medium"
        style={{ color: "var(--gp-text-secondary)" }}
      >
        {label}
      </span>
      <span
        className={[
          "text-right text-[0.8125rem]",
          mono ? "font-mono text-xs break-all" : "",
        ].join(" ")}
        style={{ color: "var(--gp-text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}
