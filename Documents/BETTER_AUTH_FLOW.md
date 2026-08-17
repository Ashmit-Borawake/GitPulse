# GitPulse Authentication Process — A Complete Guide

This document is a beginner-friendly explanation of the authentication system currently implemented in GitPulse. It explains the entire architecture from first principles based on the actual source code.

---

## 1. Authentication Architecture

The core of GitPulse's authentication is **Better Auth**, which manages sessions via HTTP-only cookies and a PostgreSQL database.

```text
                         GitPulse Browser
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        Email/Password       Google           GitHub
              │                │                │
              └────────────────┼────────────────┘
                               ↓
          Better Auth Client (src/lib/auth-client.ts)
                               ↓
                        HTTP Request (Fetch)
                               ↓
             Next.js API Route (/api/auth/[...all])
                               ↓
            Better Auth Server (src/lib/auth.ts)
                               ↓
           Prisma Adapter (better-auth/adapters/prisma)
                               ↓
              Prisma Client (src/server/db.ts)
                               ↓
                          PostgreSQL
                               ↓
                 Create/Verify Session Record
                               ↓
               Return HTTP-only Session Cookie
                               ↓
                            Browser
                               ↓
              Protected Route (/dashboard/page.tsx)
```

**How it works (High Level):**
1. The user interacts with the UI (Email, Google, or GitHub) in the browser.
2. The React client (`authClient`) sends a request to the Next.js backend via the `/api/auth/*` route.
3. The server-side Better Auth instance receives the request, processes the credentials or OAuth callback, and uses the Prisma Adapter to query or update PostgreSQL.
4. If authentication succeeds, Better Auth creates a **Session** in the database and sends back an **HTTP-only cookie** to the browser.
5. The browser automatically attaches this cookie to future requests, proving the user is logged in.

---

## 2. Authentication-Related Files

Here is the exact list of files powering authentication in GitPulse, their responsibility, and where they run.

| File | Responsibility | Runs Where | Why It Exists |
| ---- | -------------- | ---------- | ------------- |
| `src/lib/auth.ts` | The core Better Auth server instance. | **Server** | Configures the database adapter, OAuth credentials, and base URL. |
| `src/lib/auth-client.ts` | The Better Auth React client. | **Client** | Provides React hooks and methods (`signIn`, `signOut`) to interact with the auth API. |
| `src/app/api/auth/[...all]/route.ts` | The HTTP endpoint for auth operations. | **Server** | Intercepts all `/api/auth/*` requests and passes them to Better Auth to process. |
| `src/app/auth/login/page.tsx` | The Login UI. | **Client** | Collects credentials or OAuth clicks and sends them to `authClient`. |
| `src/app/auth/signup/page.tsx` | The Signup UI. | **Client** | Collects signup info, validates passwords match, and calls `authClient`. |
| `src/app/dashboard/page.tsx` | Protected dashboard. | **Server** | Verifies the session cookie on the server. Redirects unauthenticated users. |
| `src/app/dashboard/components/logout-button.tsx` | The Logout UI. | **Client** | Calls `authClient.signOut()` to invalidate the session and cookie. |
| `src/server/db.ts` | The Prisma client singleton. | **Server** | Connects to PostgreSQL. Shared between the app and Better Auth. |
| `src/env.js` | Environment validation. | **Server** | Ensures all secret keys (OAuth, DB URL, Auth Secret) exist before starting the app. |
| `prisma/schema.prisma` | Database schema. | **Server / DB** | Defines the structure of the `User`, `Account`, `Session`, and `Verification` tables. |

---

## 3. `src/lib/auth.ts` — Better Auth Server

This file creates and exports the **server-side** Better Auth instance, simply called `auth`.

**What is it?**
It is the brain of the authentication system. It holds all the rules, secrets, and database connections.

**Key Configurations:**
* **`database: prismaAdapter(db, { provider: "postgresql" })`**
  * *What it is:* Tells Better Auth how to talk to PostgreSQL using our existing Prisma client (`db`).
  * *Why we need it:* So Better Auth can create users, sessions, and accounts without us writing raw SQL.
* **`baseURL: env.BETTER_AUTH_URL`**
  * *What it is:* The absolute URL of our app (e.g., `http://localhost:3001`).
  * *Why we need it:* Better Auth uses this to generate OAuth callback URLs and verify request origins for security (CSRF protection).
* **`secret: env.BETTER_AUTH_SECRET`**
  * *What it is:* A high-entropy random string.
  * *Why we need it:* It is used to securely sign cookies and encrypt sensitive internal tokens. If missing, the app refuses to start.
* **`emailAndPassword: { enabled: true }`**
  * *What it is:* Turns on the built-in email/password features.
* **`socialProviders: { google, github }`**
  * *What it is:* Injects the `CLIENT_ID` and `CLIENT_SECRET` for Google and GitHub, enabling OAuth login.

---

## 4. `src/lib/auth-client.ts` — Better Auth Client

This file creates and exports the **client-side** Better Auth instance, called `authClient`.

**What is it?**
It is a JavaScript SDK that runs in the browser. It knows how to format network requests and send them to the server-side Better Auth API.

**Key exports:**
* `signIn`: Methods to log in (e.g., `signIn.email()`, `signIn.social()`).
* `signUp`: Methods to register (e.g., `signUp.email()`).
* `signOut`: Method to log out and destroy the session.
* `useSession`: A React hook to read the current user state in client components.

### `auth` vs `authClient`

| | `authClient` | `auth` |
| --- | --- | --- |
| **Runs** | In the Browser (Client) | On the Node.js Server |
| **Used by** | React UI Components (e.g., Login Page) | API Routes, Server Components (e.g., Dashboard) |
| **Purpose** | Sends HTTP requests to the server | Processes HTTP requests, talks to the database |
| **Example** | `authClient.signIn.email(...)` | `auth.api.getSession({ headers })` |

---

## 5. `/api/auth/[...all]` — The Authentication API

The file `src/app/api/auth/[...all]/route.ts` is the bridge between the browser and the server.

It contains:
```ts
export const { GET, POST } = toNextJsHandler(auth);
```

**What is this route?**
In Next.js, `[...all]` is a "catch-all" route. It means this single file will intercept *any* HTTP request that starts with `/api/auth/`.

**Why is it useful?**
GitPulse does NOT need to manually create separate files for every auth action. Better Auth handles everything automatically inside this one file.
For example:
* A `POST` request to `/api/auth/sign-in/email` is caught and processed.
* A `GET` request to `/api/auth/callback/google` is caught and processed.
* A `POST` request to `/api/auth/sign-out` is caught and processed.

---

## 6. Prisma + PostgreSQL Authentication Database

GitPulse uses PostgreSQL. Better Auth needs specific tables to store user data, which are defined in `prisma/schema.prisma`.

```text
Better Auth  →  Prisma Adapter  →  Prisma Client  →  PostgreSQL
```

### The 4 Core Models

1. **`User`**
   * *What it represents:* The actual human being.
   * *Important fields:* `id`, `name`, `email`.
   * *When created:* When a user signs up via email, or logs in via Google/GitHub for the first time.
2. **`Account`**
   * *What it represents:* A third-party identity (Google, GitHub) linked to a `User`.
   * *Important fields:* `providerId` (e.g., "google"), `accountId` (the ID Google gave us), `userId` (links back to the User table).
   * *Why it exists:* Because one `User` might log in with multiple providers. (Ashmit can log in with Google *and* GitHub, resulting in 1 `User` but 2 `Account`s).
3. **`Session`**
   * *What it represents:* An active login state.
   * *Important fields:* `token` (a secure random string), `expiresAt`, `userId`.
   * *When created:* Every time a user successfully logs in.
   * *When deleted:* When the user logs out or the session expires.
4. **`Verification`**
   * *What it represents:* Temporary tokens used for email verification or password resets (not currently utilized in GitPulse, but required by Better Auth).

---

## 7. Email/Password Signup — COMPLETE FLOW

1. User opens `/auth/signup` in their browser. (If they are already logged in, the `useSession` hook will detect their session and redirect them to `/dashboard`).
2. React renders the signup form (Client Component).
3. User enters their Name, Email, and Password.
4. GitPulse runs **client-side validation** (e.g., verifying passwords match).
5. The form calls `authClient.signUp.email(...)`.
6. `authClient` sends a `POST` HTTP request to `/api/auth/sign-up/email`.
7. The catch-all API route intercepts the request and passes it to the Better Auth Server.
8. Better Auth checks if the email already exists in the database.
9. **Password Hashing:** Better Auth internally hashes the password securely using standard crypto (GitPulse never stores plain-text passwords).
10. Better Auth creates a new `User` record in PostgreSQL.
11. Better Auth creates a new `Session` record in PostgreSQL.
12. Better Auth generates an **HTTP-only cookie** containing the session token and attaches it to the HTTP response.
13. The browser receives the response and securely stores the cookie.
14. `authClient` resolves successfully, and GitPulse code triggers `router.push("/dashboard")`.
15. The browser navigates to the Dashboard, sending the cookie along with the request.

---

## 8. Email/Password Login — COMPLETE FLOW

1. User opens `/auth/login`. (If they are already logged in, the `useSession` hook will detect their session and redirect them to `/dashboard`).
2. User enters Email and Password and clicks Login.
3. The form calls `authClient.signIn.email(...)`.
4. `authClient` sends a `POST` request to `/api/auth/sign-in/email`.
5. The API route passes the request to Better Auth.
6. Better Auth looks up the `User` by email in PostgreSQL.
   * *If not found:* Returns an error.
7. Better Auth retrieves the hashed password from the database and verifies it against the provided password.
   * *If incorrect:* Returns an error.
8. Better Auth creates a new `Session` record.
9. Better Auth returns the HTTP-only cookie.
10. The browser stores the cookie.
11. GitPulse redirects the user to `/dashboard`.

---

## 9. Google OAuth — COMPLETE FLOW

1. User clicks "Sign in with Google" on the login page.
2. GitPulse calls `authClient.signIn.social({ provider: "google" })`.
3. Better Auth generates a secure Google Authorization URL and tells the browser to redirect there.
4. The browser **leaves GitPulse** and goes to `accounts.google.com`.
5. The user logs into Google and grants GitPulse permission to see their email and profile.
6. Google redirects the browser back to GitPulse's **Redirect URI** (`http://localhost:3001/api/auth/callback/google`), passing a temporary authorization code.
7. The catch-all API route intercepts the callback.
8. Better Auth takes the code, communicates server-to-server with Google (using the `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`), and exchanges it for the user's profile data.
9. Better Auth looks at the Google email:
   * *Does this user exist?* Yes/No.
   * *Does this Google Account exist?* Yes/No.
10. Better Auth creates or links the `User` and `Account` (see section 10).
11. Better Auth creates a `Session` and sets the HTTP-only cookie.
12. Better Auth automatically redirects the browser to `/dashboard`.

### OAuth Variables
* **`GOOGLE_CLIENT_ID`**: The public identifier for the GitPulse app on Google Cloud. Safe to expose, but kept secret in GitPulse just to be clean.
* **`GOOGLE_CLIENT_SECRET`**: A private password used by the GitPulse server to prove its identity to Google. **MUST NEVER LEAK.**
* **Redirect URI**: Google refuses to redirect users anywhere except pre-approved URLs. This prevents attackers from stealing authorization codes.

---

## 10. First-Time Google User

If a user has **never** signed up for GitPulse and clicks "Continue with Google":

1. Google returns their profile (e.g., Ashmit, ashmit@example.com).
2. Better Auth checks PostgreSQL: "Do I have a user with ashmit@example.com?" -> **No**.
3. Better Auth automatically creates a new `User` record for Ashmit.
4. Better Auth creates an `Account` record representing Ashmit's Google identity, linked to the `User`.
5. Better Auth creates a `Session` and logs the user in.

GitPulse handles this seamlessly. The user does NOT need to manually fill out a signup form first.

---

## 11. GitHub OAuth — COMPLETE FLOW

The GitHub flow is functionally identical to Google:

1. User clicks "Continue with GitHub".
2. `authClient` sends the browser to GitHub for authorization.
3. User approves GitPulse.
4. GitHub redirects to `/api/auth/callback/github` with a code.
5. Better Auth (using `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`) exchanges the code for the user's GitHub profile.
6. Better Auth finds or creates the `User` and GitHub `Account` in the database.
7. Better Auth creates a `Session` and sets the HTTP-only cookie.
8. Better Auth redirects the browser to `/dashboard`.

---

## 12. User vs Account — VERY IMPORTANT

In Better Auth, a **User** and an **Account** are two different things.

* A **User** is the human being using GitPulse.
* An **Account** is a specific 3rd-party identity (Google, GitHub, Apple) used to sign in.

**Example:**
If Ashmit signs up using Email/Password, he gets 1 `User` record, and 0 `Account` records (email auth doesn't use the Account table).
Later, he clicks "Sign in with Google". Because his Google email matches his `User` email, Better Auth simply links them.
Now he has 1 `User` record, and 1 `Account` record (Google).
If he then clicks "Sign in with GitHub", Better Auth links that too.
Now he has 1 `User` record, and 2 `Account` records (Google, GitHub).

He can log in via any of those 3 methods, and he will always end up logged into the exact same GitPulse `User`.

---

## 13. Sessions — FROM FIRST PRINCIPLES

### What is a Session?
HTTP is a "stateless" protocol. When a browser asks for `/dashboard`, the server has no memory of the previous request where the user logged in. A **session** is a way to give the server a memory.

### How it works in GitPulse:
1. When you log in, Better Auth creates a **Session record in PostgreSQL** with a random, unguessable string called a token.
2. Better Auth sends that token to the browser inside an **HTTP-only cookie**.
3. Every time the browser requests a new page, it automatically includes that cookie.
4. The server reads the cookie, looks up the token in PostgreSQL, finds the matching `User`, and says "Ah, you are logged in as Ashmit!"

This is how the browser stays logged in even if you refresh the page or close the tab.

### Session Lifespan
In GitPulse, the session is explicitly configured in `src/lib/auth.ts` to last for **2 days**. If the session is not renewed within that time, it expires and the user will need to log in again.

---

## 14. HTTP-ONLY COOKIES — FROM FIRST PRINCIPLES

### What is an HTTP cookie?
A small piece of text stored by the browser on behalf of a website.

### What does `HttpOnly` mean?
It is a security flag. It tells the browser: **"Never let JavaScript read this cookie."**
If a hacker manages to inject malicious JavaScript into GitPulse (XSS attack), they cannot steal the session cookie because the browser hides it from JavaScript entirely.

### Why not `localStorage`?
`localStorage` CAN be read by JavaScript. If we stored session tokens there, they could be easily stolen by malicious scripts.

### How does the server get the cookie?
Even though JavaScript can't read it, the browser itself automatically attaches the cookie to the HTTP headers of every request sent to the GitPulse server.

---

## 15. Protected Dashboard

File: `src/app/dashboard/page.tsx`

This file is a **React Server Component**. It runs entirely on the server.

```tsx
export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(), // reads the incoming HTTP cookies
  });

  if (!session) {
    redirect("/auth/login");
  }

  // Render dashboard for session.user
}
```

**What happens:**
1. A user visits `/dashboard`.
2. The Next.js server starts rendering the page.
3. It extracts the cookies from the request `headers()`.
4. It calls `auth.api.getSession()`, which asks Better Auth to look up the cookie token in PostgreSQL.
5. **Unauthenticated:** If the cookie is missing or invalid, `session` is null. GitPulse immediately executes `redirect("/auth/login")`. The browser is sent away before seeing any dashboard HTML.
6. **Authenticated:** If the session is valid, the server renders the dashboard HTML containing the user's name and sends it to the browser.

This is a **protected route** because it is impossible to view the content without a valid database session.

---

## 16. Logout — COMPLETE FLOW

File: `src/app/dashboard/components/logout-button.tsx`

1. User clicks the "Sign out" button on the dashboard.
2. The React client component calls `authClient.signOut()`.
3. `authClient` sends a `POST` request to `/api/auth/sign-out`.
4. Better Auth receives the request and reads the session cookie.
5. Better Auth **deletes the Session record from PostgreSQL**.
6. Better Auth sends a response telling the browser to **clear the HTTP-only cookie**.
7. `authClient` resolves successfully.
8. GitPulse executes `router.push("/auth/login")`.
9. The user is now on the login page.
10. If they try to press the "Back" button to go to `/dashboard`, the server will check for the cookie, find it missing, and immediately redirect them back to `/auth/login`.

---

## 17. Environment Variables

All authentication secrets are stored in `.env` and strictly validated by `src/env.js`.

| Variable | Purpose | Client/Server | Secret? |
| -------- | ------- | ------------- | ------- |
| `DATABASE_URL` | Connects Prisma to PostgreSQL. | Server | YES |
| `BETTER_AUTH_SECRET` | Encrypts cookies and tokens. | Server | YES |
| `BETTER_AUTH_URL` | Base URL of the app (e.g. `localhost:3001`). | Server | NO |
| `GOOGLE_CLIENT_ID` | Public ID for Google OAuth. | Server | NO |
| `GOOGLE_CLIENT_SECRET` | Private password for Google OAuth. | Server | YES |
| `GITHUB_CLIENT_ID` | Public ID for GitHub OAuth. | Server | NO |
| `GITHUB_CLIENT_SECRET` | Private password for GitHub OAuth. | Server | YES |

**Important:** None of these variables are prefixed with `NEXT_PUBLIC_`. This guarantees they will never be accidentally bundled into the browser's JavaScript code.

---

## 18. COMPLETE END-TO-END AUTH FLOW

```text
                    USER
                     │ (Clicks Login)
       ┌─────────────┼─────────────┐
       │             │             │
    Email          Google        GitHub
       │             │             │
       └─────────────┼─────────────┘
                     ↓
      Better Auth Client (authClient.signIn)
                     ↓
           HTTP POST / GET Request
                     ↓
     Next.js API Route (/api/auth/[...all])
                     ↓
        Better Auth Server (auth instance)
                     ↓
      Prisma Adapter (better-auth/adapters)
                     ↓
           Prisma Client (db instance)
                     ↓
              PostgreSQL Database
                     ↓
        Create User/Account & Session
                     ↓
             HTTP-only Cookie
                     ↓
                  Browser
                     ↓
         Redirect to /dashboard
                     ↓
       getSession() check on server
                     ↓
        Render Authenticated HTML
```

**Summary:** The user interacts with the UI. The Client SDK sends an HTTP request to the Next.js API route. The API route hands it to the Better Auth Server, which uses Prisma to write to PostgreSQL. Better Auth creates a session, generates a secure cookie, and sends it back. The browser stores the cookie and navigates to the dashboard, where the server verifies the cookie against the database before rendering the page.

---

## 19. WHO DOES WHAT?

| Responsibility | Handled By |
| -------------- | ---------- |
| Rendering the login/signup forms | **GitPulse Code** (React) |
| Client-side validation (passwords match) | **GitPulse Code** |
| Sending the authentication HTTP request | **Better Auth Client** (`authClient`) |
| Catching the `/api/auth` HTTP request | **GitPulse Code** (`route.ts`) |
| Password hashing & verification | **Better Auth Server** (Internal) |
| Handling OAuth redirects and callbacks | **Better Auth Server** (Internal) |
| Creating Users, Accounts, Sessions | **Better Auth Server** |
| Executing SQL queries | **Prisma** |
| Storing data persistently | **PostgreSQL** |
| Generating HTTP-only cookies | **Better Auth Server** |
| Storing HTTP-only cookies | **Browser** |
| Checking cookies on page load | **GitPulse Code** (`getSession()`) |

---

## 20. NO JWT ARCHITECTURE

**GitPulse does NOT use JWT (JSON Web Tokens) for application authentication.**

There are no JWT plugins, no JWKS, no Bearer tokens, and no access/refresh token rotation for the main application session.

The architecture strictly uses:
```text
Better Auth → Database Session → HTTP-only Cookie
```

**Why this works beautifully:**
1. **Security:** HTTP-only cookies are immune to JavaScript XSS attacks.
2. **Control:** Because sessions live in the database, a user can be instantly logged out, banned, or have their session revoked by simply deleting the row in PostgreSQL. (With JWTs, a token remains valid until it expires, making instant revocation very difficult).
3. **Simplicity:** The browser handles cookie management automatically. No complex React state or `localStorage` management is required.

---

## 21. Authentication vs Authorization

**Authentication** answers: *"Who is this user?"*
(e.g., "This is Ashmit.")
Currently, GitPulse implements Authentication. If you have a valid cookie, you are authenticated and can view `/dashboard`.

**Authorization** answers: *"Is this user allowed to do this specific action?"*
(e.g., "Is Ashmit allowed to delete this GitPulse project?")
GitPulse has not yet implemented Authorization. In the future, this will be handled by tRPC protected procedures checking user permissions against workspace databases.

---

## 22. Common Questions

1. **Why do we need Better Auth if we already have Prisma?**
   Prisma only talks to the database. It doesn't know how to hash passwords, generate secure tokens, or talk to Google's OAuth servers. Better Auth does all the security work, and uses Prisma simply to save the results.
2. **Why do we need both `auth.ts` and `auth-client.ts`?**
   `auth.ts` holds the secrets and talks to the database (Server). `auth-client.ts` lives in the browser (Client) and formats the HTTP requests to send to the server.
3. **Why do we need `/api/auth/[...all]`?**
   It acts as a funnel. Better Auth has dozens of endpoints (`/sign-in`, `/sign-up`, `/callback/google`). Instead of manually creating 20 files, Next.js catches all of them here and hands them to Better Auth.
4. **Where does password hashing happen?**
   Internally inside the Better Auth server package. GitPulse never sees or touches plain-text passwords on the server.
5. **Why aren't we using `localStorage`?**
   `localStorage` can be read by JavaScript, making it vulnerable to XSS attacks. HTTP-only cookies cannot be read by JavaScript.

---

## 23. Runtime Walkthroughs

### Scenario A — Signup
`User (Browser)` fills form → `authClient.signUp` → HTTP POST → `/api/auth` → `auth` server → hashes password → creates `User` & `Session` in DB via Prisma → returns HTTP-only cookie → `router.push("/dashboard")`.

### Scenario B — Email Login
`User (Browser)` fills form → `authClient.signIn` → HTTP POST → `/api/auth` → `auth` server → looks up `User` in DB via Prisma → verifies password → creates `Session` in DB → returns HTTP-only cookie → `router.push("/dashboard")`.

### Scenario C — First-Time Google Login
`User` clicks Google → `authClient.signIn.social` → `auth` server creates redirect URL → `Browser` goes to Google → User approves → Google redirects to `/api/auth/callback/google` with a code → `auth` server exchanges code with Google → fetches profile → creates `User` and `Account` in DB via Prisma → creates `Session` in DB → sets cookie → redirects to `/dashboard`.

### Scenario D — Logout
`User` clicks Logout → `authClient.signOut()` → HTTP POST → `/api/auth` → `auth` server → deletes `Session` from PostgreSQL via Prisma → clears HTTP-only cookie in browser → `router.push("/auth/login")`.

---

## 24. Learning Map

Recommended study order:
1. **HTTP Request / Response**: How browsers talk to servers.
2. **Cookies**: How browsers remember state.
3. **Sessions**: How servers remember state securely in a database.
4. **Better Auth Server (`auth.ts`)**: How the server is configured with secrets.
5. **Catch-all API Routes (`route.ts`)**: How Next.js intercepts requests.
6. **Better Auth Client (`auth-client.ts`)**: How React talks to the API route.
7. **Authentication Database Models (`schema.prisma`)**: How Users, Accounts, and Sessions relate.
8. **Protected Server Components (`dashboard/page.tsx`)**: How the server blocks unauthorized access.

---

## 25. FINAL "MENTAL MODEL"

```text
LOGIN

Browser
   ↓ (Sends credentials/OAuth code)
Better Auth API
   ↓ (Hashes/Verifies)
Database
   ↓ (Creates Session Record)
Cookie
   ↓ (Stores securely)
Browser


EVERY PROTECTED REQUEST

Browser
   ↓ (Automatically attaches Cookie)
Server Component (/dashboard)
   ↓ (getSession)
Better Auth API
   ↓ (Looks up Cookie in DB)
Valid Session?
   ↓
Yes → Show Dashboard
No  → Redirect to Login


LOGOUT

Browser
   ↓ (Clicks Logout)
Better Auth API
   ↓ (Deletes Session Record in DB)
Cookie Cleared
   ↓
Logged out
```
