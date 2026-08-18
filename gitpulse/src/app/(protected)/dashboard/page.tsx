"use client";

import { useProject } from "@/hooks/use-project";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import React from "react";

const DashboardPage = () => {
  const { project } = useProject();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-y-4">
        {/* github link */}
        <div className="bg-primary w-full rounded-md px-4 py-3 sm:w-fit">
          <div className="flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-5 shrink-0 text-white"
            >
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
              <path d="M9 18c-4.51 2-5-2-7-2" />
            </svg>
            <div className="ml-2 w-full min-w-0">
              <p className="flex flex-wrap items-center gap-1 text-xs font-medium text-white sm:flex-nowrap sm:gap-1.5 sm:text-sm">
                <span className="shrink-0">This project is linked to</span>
                <Link
                  href={project?.githubUrl ?? ""}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center text-white/80 hover:underline"
                >
                  <span className="xs:max-w-[180px] max-w-[120px] truncate sm:max-w-[250px] md:max-w-[350px] lg:max-w-[450px]">
                    {project?.githubUrl}
                  </span>
                  <ExternalLink className="ml-1 size-4 shrink-0" />
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="h-4"></div>

        <div className="flex items-center gap-4">
          {/* <TeamMembers /> */}
          {/* <InviteButton /> */}
          {/* <ArchiveButton /> */}
        </div>
      </div>


      <div className="mt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          {/* <AskQuestionCard /> */}
          {/* <WorkSpaceCard /> */}
        </div>
      </div>
      <div className="mt-8"></div>
      {/* <CommitLog /> */}
    </div>
  );
};

export default DashboardPage;
