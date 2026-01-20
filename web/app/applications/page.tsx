"use client";

import { useState, useEffect } from "react";
import { Table, LayoutGrid } from "lucide-react";
import { Header } from "@/components/layout/header";
import { ApplicationsTable } from "@/components/applications/applications-table";
import { KanbanBoard } from "@/components/applications/kanban-board";
import { Button } from "@/components/ui/button";

type ViewMode = "table" | "kanban";

export default function ApplicationsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("table");

  // Load view preference from localStorage on mount
  useEffect(() => {
    const savedView = localStorage.getItem("applications-view-mode") as ViewMode;
    if (savedView && (savedView === "table" || savedView === "kanban")) {
      setViewMode(savedView);
    }
  }, []);

  // Save view preference to localStorage when it changes
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("applications-view-mode", mode);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header
        title="Applications"
        description="Manage all your job applications"
      >
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            variant={viewMode === "table" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("table")}
            className="gap-2"
          >
            <Table className="h-4 w-4" />
            Table
          </Button>
          <Button
            variant={viewMode === "kanban" ? "default" : "ghost"}
            size="sm"
            onClick={() => handleViewChange("kanban")}
            className="gap-2"
          >
            <LayoutGrid className="h-4 w-4" />
            Kanban
          </Button>
        </div>
      </Header>
      <div className={viewMode === "table" ? "flex-1 overflow-auto p-8" : "flex-1 overflow-hidden"}>
        {viewMode === "table" ? <ApplicationsTable /> : <KanbanBoard />}
      </div>
    </div>
  );
}

