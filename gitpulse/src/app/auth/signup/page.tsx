"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { authClient, useSession } from "@/lib/auth-client";
import { toast } from "sonner";

// ── Password visibility toggle button ──────────────────────────────────────
// Small, self-contained — only used inside this file.

interface PasswordFieldProps {
  id: string;
  label: string;
  autoComplete: string;
  placeholder: string;
  value: string; // field value
  showPassword: boolean; // eye-toggle state
  disabled?: boolean;
  onChange: (v: string) => void;
  onToggle: () => void;
}

function PasswordField({
  id,
  label,
  autoComplete,
  placeholder,
  value,
  showPassword,
  disabled,
  onChange,
  onToggle,
}: PasswordFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={id}
        className="text-[0.8125rem] font-medium"
        style={{ color: "var(--gp-text-primary)" }}
      >
        {label}
      </Label>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="h-10 rounded-[10px] px-3 pr-10 text-[0.9375rem]"
          style={{
            backgroundColor: "var(--gp-bg-elevated)",
            borderColor: "var(--gp-border-default)",
            color: "var(--gp-text-primary)",
          }}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={showPassword ? `Hide ${label}` : `Show ${label}`}
          className={cn(
            "absolute top-1/2 right-3 -translate-y-1/2",
            "flex items-center justify-center rounded p-0.5",
            "cursor-pointer transition-colors duration-150",
            "focus-visible:ring-2 focus-visible:outline-none",
          )}
          style={{ color: "var(--gp-text-tertiary)" }}
        >
          {showPassword ? (
            <Eye className="size-4" aria-hidden="true" />
          ) : (
            <EyeOff className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Signup Page ─────────────────────────────────────────────────────────────

export default function SignupPage() {
  const router = useRouter();
  const { data: session, isPending: isSessionLoading } = useSession();

  useEffect(() => {
    if (session) {
      router.push("/dashboard");
    }
  }, [session, router]);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ── Eye toggle state ────────────────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(false);

  // ── Submit handler ───────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    // Client-side validation
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await authClient.signUp.email({
        name: `${firstName.trim()} ${lastName.trim()}`,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        password,
      });

      if (result.error) {
        // Map common Better Auth errors to user-friendly messages
        const msg = result.error.message ?? "";
        if (msg.toLowerCase().includes("email")) {
          toast.error("An account with that email already exists.");
        } else {
          toast.error(msg || "Failed to create account. Please try again.");
        }
        return;
      }

      // Better Auth has created the user, account, and session cookie.
      toast.success("Account created successfully!");
      router.push("/dashboard");
    } catch (error) {
      console.error("Signup Error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (isSessionLoading) {
    return (
      <div
        className="flex min-h-svh items-center justify-center px-4 py-12"
        style={{ backgroundColor: "var(--gp-bg-base)" }}
      ></div>
    );
  }

  return (
    <div
      className="flex min-h-svh items-center justify-center px-4 py-12"
      style={{ backgroundColor: "var(--gp-bg-base)" }}
    >
      {/* Auth Card */}
      <div
        className="w-full max-w-[400px] rounded-2xl p-8"
        style={{
          backgroundColor: "var(--gp-bg-surface)",
          border: "1px solid var(--gp-border-default)",
          boxShadow: "var(--gp-shadow-card)",
        }}
      >
        {/* Header */}
        <div className="mb-6">
          <h1
            className="mb-1.5 text-2xl font-semibold tracking-tight"
            style={{ color: "var(--gp-text-primary)" }}
          >
            Sign Up
          </h1>
          <p
            className="text-[0.9375rem] leading-relaxed"
            style={{ color: "var(--gp-text-secondary)" }}
          >
            Enter your information to create an account
          </p>
        </div>

        {/* Form */}
        <form
          className="flex flex-col gap-5"
          onSubmit={handleSubmit}
          noValidate
        >
          {/* Name fields */}
          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label
                htmlFor="signup-first-name"
                className="text-[0.8125rem] font-medium"
                style={{ color: "var(--gp-text-primary)" }}
              >
                First Name
              </Label>
              <Input
                id="signup-first-name"
                type="text"
                autoComplete="given-name"
                placeholder="John"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isLoading}
                className="h-10 rounded-[10px] px-3 text-[0.9375rem]"
                style={{
                  backgroundColor: "var(--gp-bg-elevated)",
                  borderColor: "var(--gp-border-default)",
                  color: "var(--gp-text-primary)",
                }}
              />
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              <Label
                htmlFor="signup-last-name"
                className="text-[0.8125rem] font-medium"
                style={{ color: "var(--gp-text-primary)" }}
              >
                Last Name
              </Label>
              <Input
                id="signup-last-name"
                type="text"
                autoComplete="family-name"
                placeholder="Doe"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isLoading}
                className="h-10 rounded-[10px] px-3 text-[0.9375rem]"
                style={{
                  backgroundColor: "var(--gp-bg-elevated)",
                  borderColor: "var(--gp-border-default)",
                  color: "var(--gp-text-primary)",
                }}
              />
            </div>
          </div>

          {/* Email field */}
          <div className="flex flex-col gap-1.5">
            <Label
              htmlFor="signup-email"
              className="text-[0.8125rem] font-medium"
              style={{ color: "var(--gp-text-primary)" }}
            >
              Email
            </Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder="your@email.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-10 rounded-[10px] px-3 text-[0.9375rem]"
              style={{
                backgroundColor: "var(--gp-bg-elevated)",
                borderColor: "var(--gp-border-default)",
                color: "var(--gp-text-primary)",
              }}
            />
          </div>

          {/* Password field */}
          <PasswordField
            id="signup-password"
            label="Password"
            autoComplete="new-password"
            placeholder="Password"
            value={password}
            showPassword={showPassword}
            disabled={isLoading}
            onChange={setPassword}
            onToggle={() => setShowPassword((v) => !v)}
          />

          {/* Confirm Password field */}
          <PasswordField
            id="signup-confirm-password"
            label="Confirm Password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirmPassword}
            showPassword={showConfirmPassword}
            disabled={isLoading}
            onChange={setConfirmPassword}
            onToggle={() => setShowConfirmPassword((v) => !v)}
          />

          {/* Primary Create Account button */}
          <button
            type="submit"
            disabled={isLoading}
            className="flex h-11 w-full cursor-pointer items-center justify-center rounded-full text-[0.9375rem] font-medium transition-opacity duration-100 hover:opacity-85 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              backgroundColor: "var(--gp-btn-primary-bg)",
              color: "var(--gp-btn-primary-text)",
            }}
          >
            {isLoading ? "Creating account…" : "Create an account"}
          </button>
        </form>

        {/* Bottom nav */}
        <div className="mt-6">
          <div
            className="border-t"
            style={{ borderColor: "var(--gp-border-subtle)" }}
          />
          <p
            className="mt-4 text-center text-[0.8125rem]"
            style={{ color: "var(--gp-text-secondary)" }}
          >
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium underline-offset-4 transition-colors duration-150 hover:underline"
              style={{ color: "var(--gp-text-primary)" }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
