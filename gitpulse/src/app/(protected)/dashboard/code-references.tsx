"use client";

import React from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { lucario } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CodeFileReference = {
  fileName: string;
  filePath: string;
  chunkIndex: number;
  similarity: number;
};

type Props = {
  filesReferences: CodeFileReference[];
  projectId: string;
};

// ---------------------------------------------------------------------------
// Language helper — maps file extension to a Prism language name
// ---------------------------------------------------------------------------

function getLanguage(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "py":
      return "python";
    case "java":
      return "java";
    case "cpp":
    case "cc":
    case "cxx":
      return "cpp";
    case "css":
      return "css";
    case "html":
    case "htm":
      return "html";
    case "json":
      return "json";
    case "sql":
      return "sql";
    case "md":
    case "mdx":
      return "markdown";
    case "sh":
    case "bash":
      return "bash";
    case "yaml":
    case "yml":
      return "yaml";
    case "prisma":
      return "javascript"; // Prism has no prisma, JS highlights reasonably
    default:
      return "text";
  }
}

// ---------------------------------------------------------------------------
// CodeReferences
// ---------------------------------------------------------------------------

export default function CodeReferences({ filesReferences, projectId }: Props) {
  // De-duplicate by filePath so each file appears as one tab
  const uniqueFiles = React.useMemo(() => {
    const seen = new Set<string>();
    return filesReferences.filter((f) => {
      if (seen.has(f.filePath)) return false;
      seen.add(f.filePath);
      return true;
    });
  }, [filesReferences]);

  const [tab, setTab] = React.useState<string>(
    uniqueFiles[0]?.filePath ?? "",
  );

  // sourceCode cache: filePath → string
  const [sourceCodeMap, setSourceCodeMap] = React.useState<
    Record<string, string>
  >({});
  const [loadingPath, setLoadingPath] = React.useState<string | null>(null);

  // Fetch source code for a given filePath (lazy, cached)
  const fetchSourceCode = React.useCallback(
    async (filePath: string) => {
      if (sourceCodeMap[filePath] !== undefined) return; // already loaded
      if (loadingPath === filePath) return; // already in flight

      setLoadingPath(filePath);
      try {
        const res = await fetch(
          `/api/source-code?projectId=${encodeURIComponent(projectId)}&filePath=${encodeURIComponent(filePath)}`,
        );
        if (res.ok) {
          const data = (await res.json()) as { sourceCode: string };
          setSourceCodeMap((prev) => ({ ...prev, [filePath]: data.sourceCode }));
        } else {
          setSourceCodeMap((prev) => ({ ...prev, [filePath]: "// Could not load source code." }));
        }
      } catch {
        setSourceCodeMap((prev) => ({ ...prev, [filePath]: "// Could not load source code." }));
      } finally {
        setLoadingPath(null);
      }
    },
    [projectId, sourceCodeMap, loadingPath],
  );

  // Load the first tab automatically
  React.useEffect(() => {
    if (uniqueFiles[0]?.filePath) {
      void fetchSourceCode(uniqueFiles[0].filePath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueFiles[0]?.filePath]);

  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    void fetchSourceCode(newTab);
  };

  if (uniqueFiles.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Code References
      </h3>

      <Tabs value={tab} onValueChange={handleTabChange}>
        {/* Tab triggers — horizontally scrollable for long lists */}
        <div className="overflow-x-auto">
          <TabsList className="flex h-auto w-max flex-nowrap gap-1 rounded-lg p-1">
            {uniqueFiles.map((file) => (
              <TabsTrigger
                key={file.filePath}
                value={file.filePath}
                className="whitespace-nowrap text-sm cursor-pointer"
              >
                {file.fileName}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Tab content — each file's highlighted source code */}
        {uniqueFiles.map((file) => (
          <TabsContent key={file.filePath} value={file.filePath}>
            <div className="w-full max-h-[40vh] overflow-y-auto overflow-x-hidden rounded-lg [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700">
              {loadingPath === file.filePath ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  Loading source…
                </div>
              ) : (
                <SyntaxHighlighter
                  language={getLanguage(file.fileName)}
                  style={lucario}
                  customStyle={{
                    margin: 0,
                    borderRadius: "0.5rem",
                    fontSize: "0.9rem",
                  }}
                  showLineNumbers
                  wrapLines={true}
                  wrapLongLines={true}
                  lineProps={{
                    style: { wordBreak: "break-all", whiteSpace: "pre-wrap" },
                  }}
                >
                  {sourceCodeMap[file.filePath] ?? ""}
                </SyntaxHighlighter>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
