import { Octokit } from "octokit";

/**
 * Reusable Octokit instance for accessing public GitHub repositories.
 * Configured without an authentication token intentionally for development/testing.
 */
export const octokit = new Octokit();
