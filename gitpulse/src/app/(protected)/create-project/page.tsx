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
      await axios.post("/api/project", data);
      await refetch();
      toast.success("Project created successfully");
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
    <div className="flex h-full items-center justify-center gap-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/createProject.png"
        className="h-56 w-auto"
        alt="create project"
      />
      <div>
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
