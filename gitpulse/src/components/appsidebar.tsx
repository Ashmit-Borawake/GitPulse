'use client'

import { Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Bot, CreditCard, LayoutDashboard, Plus, Presentation, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const items = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Q&A",
    url: "/QA",
    icon: Bot,
  },
  {
    title: "Meetings",
    url: "/meetings",
    icon: Presentation,
  },
  {
    title: "Billing",
    url: "/billing",
    icon: CreditCard,
  }
]

const projects = [
  {
    name: 'Project 1',
  },
  {
    name: 'Project 2',
  },
  {
    name: 'Project 3',
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { open, toggleSidebar } = useSidebar()
  return (
    <Sidebar collapsible="icon" variant="floating">
      <SidebarHeader>
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
              G
            </div>
            <h1 className="text-xl font-bold text-primary/80 group-data-[collapsible=icon]:hidden">
              GitPulse
            </h1>
          </div>
          {open && (
            <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground">
              <PanelLeftClose />
            </Button>
          )}
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            Application
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => {
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      render={
                        <Link href={item.url} className={cn({
                          '!bg-primary !text-white': pathname === item.url
                        }, 'list-none')} />
                      }
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            Your Projects
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projects.map(project => {
                return (
                  <SidebarMenuItem key={project.name}>
                    <SidebarMenuButton className="group-data-[collapsible=icon]:!p-1">
                      <div className={cn(
                        'rounded-sm border size-6 flex items-center justify-center text-xs bg-white text-primary shrink-0',
                        {
                          'bg-primary text-primary-foreground': true
                          // 'bg-primary text-white' : project.id === ...
                        }
                      )}>
                        {project.name[0]}
                      </div>
                      <span className="group-data-[collapsible=icon]:hidden">{project.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
              <div className="h-2"></div>
              <SidebarMenuItem>
                <SidebarMenuButton variant="outline" render={<Link href='/create-project' />}>
                  <Plus />
                  <span className="group-data-[collapsible=icon]:hidden">Create Project</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {!open && (
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={toggleSidebar} className="mt-2 text-sidebar-foreground/70 hover:text-sidebar-foreground">
                    <PanelLeftOpen />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
