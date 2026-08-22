"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import axios from "axios";
import { useRefetch } from "@/hooks/use-refetch";

type FormInput = {
  repoUrl: string;
  projectName: string;
  githubToken?: string;
};

const CreatePage = () => {
  const { register, handleSubmit, reset } = useForm<FormInput>();
  const [isLoading, setIsLoading] = useState(false);
  const refetch = useRefetch();

  async function onSubmit(data: FormInput) {
    setIsLoading(true);
    try {
      const res = await axios.post<{ commitSyncError?: string }>("/api/project", data);
      await refetch();
      toast.success("Project created successfully");

      // Warn if commit summarisation failed (project was still saved)
      if (res.data.commitSyncError) {
        toast.warning(
          res.data.commitSyncError,
          { duration: 6000 }
        );
      }

      reset();
    } catch (error) {
      console.error("Create Project Error:", error);
      if (axios.isAxiosError(error) && error.response?.data) {
        const data = error.response.data as { error?: string };
        if (data.error) {
          toast.error(data.error);
          return;
        }
      }
      toast.error("Something went wrong, please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col sm:flex-row items-center justify-center gap-6 sm:gap-12 p-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/createProject.png"
        className="h-40 sm:h-56 w-auto hidden sm:block"
        alt="create project"
      />
      <div className="w-full sm:w-auto max-w-md">
        <div>
          <h1 className="text-2xl font-semibold">
            Link your GitHub Repository
          </h1>
          <p className="text-muted-foreground text-sm">
            Enter the URL of your repository to link it to GitPulse.
          </p>
        </div>
        <div className="h-4"></div>
        <div>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Input
              {...register("projectName", { required: true })}
              placeholder="Project Name"
              required
            />
            <div className="h-2"></div>
            <Input
              {...register("repoUrl", { required: true })}
              placeholder="Github URL"
              type="url"
              required
            />
            <div className="h-2"></div>
            <Input
              {...register("githubToken")}
              placeholder="Github Token (Optional)"
            />
            <div className="h-4"></div>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Project"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreatePage;
