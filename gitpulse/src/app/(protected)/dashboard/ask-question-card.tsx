"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useProject } from "@/hooks/use-project";
import React from "react";
import { toast } from "sonner";
import MDEditor from "@uiw/react-md-editor";
import CodeReferences, { type CodeFileReference } from "./code-references";

export default function AskQuestionCard() {
  const { project } = useProject();
  const [open, setOpen] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [answer, setAnswer] = React.useState("");
  const [filesReferences, setFilesReferences] = React.useState<
    CodeFileReference[]
  >([]);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!project?.id) return;
    if (!question.trim()) {
      toast.error("Please enter a question before asking!");
      return;
    }

    setLoading(true);
    setOpen(true);
    setAnswer("");
    setFilesReferences([]);

    const loadingToastId = toast.loading("GitPulse is thinking…");

    try {
      const res = await fetch("/api/QA", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          projectId: project.id,
        }),
      });

      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        const errMsg =
          (errBody.error as string | undefined) ??
          `Request failed (${res.status})`;
        throw new Error(errMsg);
      }

      // Read file references from the response header BEFORE consuming the body.
      // Falls back to empty array if the header is missing or cannot be parsed.
      const referencesHeader = res.headers.get("X-File-References");
      try {
        const parsed = (
          referencesHeader ? JSON.parse(referencesHeader) : []
        ) as unknown;
        setFilesReferences(
          Array.isArray(parsed)
            ? (parsed as CodeFileReference[])
            : [],
        );
      } catch {
        setFilesReferences([]);
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        setAnswer((ans) => ans + text);
      }

      toast.success("Answer ready!", { id: loadingToastId });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      console.error("[AskQuestionCard]", error);
      toast.error(message, { id: loadingToastId });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog 
        open={open} 
        onOpenChange={setOpen}
        disablePointerDismissal
      >
        <DialogContent className="sm:max-w-[90vw] max-h-[90vh] border-2 border-black p-0 overflow-hidden block">
          <div className="w-full max-h-[90vh] overflow-y-auto p-4 grid gap-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-gray-700">
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md font-bold">
                  G
                </div>
                <span className="text-base font-semibold">GitPulse</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Answer area — loader until first chunk arrives */}
          {loading && !answer ? (
            <div className="flex items-center justify-center py-10">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-primary" />
              </div>
            </div>
          ) : (
            <div data-color-mode="light">
              <MDEditor.Markdown
                source={answer}
                className="w-full rounded-lg p-4 text-sm"
              />
            </div>
          )}

          {/* Code references — shown only after streaming is complete */}
          {!loading && filesReferences.length > 0 && project?.id && (
            <CodeReferences
              filesReferences={filesReferences}
              projectId={project.id}
            />
          )}

          <div className="h-2" />

          {/* Close button */}
          <Button
            type="button"
            className="w-full bg-black text-white hover:bg-black/90 cursor-pointer"
            onClick={() => {
              setOpen(false);
              setAnswer("");
              setFilesReferences([]);
            }}
          >
            Close
          </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card className="relative col-span-3">
        <CardHeader>
          <CardTitle>Ask a question</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <Textarea
              placeholder="Which file should I edit to change the home page?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <div className="h-4"></div>
            <Button type="submit" disabled={loading}>Ask GitPulse !</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
