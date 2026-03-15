"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/lib/sidebar-context";
import { useApiHealth } from "@/hooks/use-api-health";
import { AlertCircle } from "lucide-react";

interface MainContentProps {
  children: ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const { isCollapsed } = useSidebar();
  const { apiDown, isMounted } = useApiHealth();

  return (
    <main
      className={cn(
        "flex-1 flex flex-col overflow-hidden transition-all duration-300 ease-in-out",
        isCollapsed ? "pl-16" : "pl-64"
      )}
    >
      {isMounted && apiDown && (
        <div className="bg-destructive/15 text-destructive border-b border-destructive/20 px-4 py-3 flex items-center justify-center gap-2 text-sm font-medium z-50">
          <AlertCircle className="h-4 w-4" />
          Backend API is unreachable. Please ensure it is running (uv run serve).
        </div>
      )}
      {children}
    </main>
  );
}

