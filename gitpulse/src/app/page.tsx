import { HydrateClient } from "@/trpc/server";

export default async function Home() {
  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Welcome to <span className="text-blue-500">GitPulse</span>
          </h1>
          <p className="text-2xl text-gray-300">
            A clean foundation for your project.
          </p>
        </div>
      </main>
    </HydrateClient>
  );
}
