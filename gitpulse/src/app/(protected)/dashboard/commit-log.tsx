"use client";

import { useProject } from "@/hooks/use-project";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

type Commit = {
  id: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  commitMessage: string;
  commitHash: string;
  commitAuthorName: string;
  commitAuthorAvatar: string;
  commitDate: string;
  summary: string;
};

export default function CommitLog() {
  const { projectId, project } = useProject();

  const { data: commits, isLoading } = useQuery({
    queryKey: ["commits", projectId],
    queryFn: async () => {
      const response = await axios.get<Commit[]>("/api/commits", {
        params: { projectId },
      });
      return response.data;
    },
    enabled: !!projectId,
  });

  if (isLoading) return <p>Loading commits...</p>;
  if (!commits || commits.length === 0) return <p>No commits found.</p>;

  return (
    <ul className="space-y-6">
      {commits?.map((commit, commitIdx) => {
        return (
          <li key={commit.id} className="relative flex gap-x-4">
            <div
              className={cn(
                commitIdx === commits.length - 1 ? "h-6" : "-bottom-6",
                "absolute top-0 left-0 flex w-6 justify-center",
              )}
            >
              <div className="w-px translate-x-1 bg-gray-200"></div>
            </div>

            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={commit.commitAuthorAvatar}
                alt="commit avatar"
                className="relative mt-4 size-8 flex-none rounded-full bg-gray-50"
              />
              <div className="flex-auto rounded-md bg-white p-3 ring-1 ring-gray-200 ring-inset">
                <div className="flex justify-between gap-x-4">
                  <Link
                    target="_blank"
                    href={`${project?.githubUrl}/commit/${commit.commitHash}`}
                    className="py-0.5 text-xs leading-5 text-gray-500"
                  >
                    <span className="font-medium text-gray-900">
                      {commit.commitAuthorName}
                    </span>{" "}
                    <span className="inline-flex items-center">
                      committed
                      <ExternalLink className="ml-1 size-4" />
                    </span>
                  </Link>
                </div>
                <span className="font-semibold">{commit.commitMessage}</span>
                <pre className="mt-2 text-sm leading-6 whitespace-pre-wrap text-gray-500">
                  {commit.summary}
                </pre>
              </div>
            </>
          </li>
        );
      })}
    </ul>
  );
}
