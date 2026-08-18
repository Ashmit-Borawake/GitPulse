import React from 'react'
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/appsidebar"
import { UserButton } from "@/components/user-button"

type Props = {
  children: React.ReactNode
}

const SidebarLayout = async ({ children }: Props) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full bg-sidebar">
        <AppSidebar />
        <main className="flex-1 m-2 flex flex-col min-w-0">
          {/* //search box */}
          <div className="flex h-14 items-center gap-2 border-sidebar-border bg-sidebar border shadow rounded-md p-2 px-4">
            {/* <SearchBar /> */}
            <div className="ml-auto"></div>
            <UserButton />
          </div>
          
          <div className="h-4"></div>

          {/* //main box */}
          {/* main content */}
          <div className="flex-1 border-sidebar-border bg-sidebar border shadow rounded-md overflow-y-auto p-4">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  )
}

export default SidebarLayout
