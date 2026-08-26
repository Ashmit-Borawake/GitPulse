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

export default function AskQuestionCard() {
  const { project } = useProject();
  const [open, setOpen] = React.useState(false);
  const [question, setQuestion] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [filesReferences, setFilesReferences] = React.useState<
    {
      fileName: string;
      filePath: string;
      chunkIndex: number;
      similarity: number;
    }[]
  >([]);
  const [answer, setAnswer] = React.useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!project?.id) return;

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
        const errBody = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const errMsg =
          (errBody.error as string | undefined) ??
          `Request failed (${res.status})`;
        throw new Error(errMsg);
      }

      // Read file references from the response header BEFORE consuming the body.
      // Falls back to empty array if the header is missing or cannot be parsed.
      const referencesHeader = res.headers.get("X-File-References");
      try {
        const parsed = (referencesHeader ? JSON.parse(referencesHeader) : []) as unknown;
        setFilesReferences(Array.isArray(parsed) ? (parsed as { fileName: string; filePath: string; chunkIndex: number; similarity: number }[]) : []);
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <div className="flex items-center gap-2">
                <div className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-md font-bold">
                  G
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
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
            <Button type="submit">Ask GitPulse !</Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
