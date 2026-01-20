"use client";

import {
  Loader2,
  RefreshCw,
  Brain,
  Sparkles,
  Filter,
  ChevronDown,
  RotateCcw,
  Link2,
  Eraser,
  Trash2,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { JOB_SOURCES } from "@/lib/constants/job-sources";
import type { LLMAnalysisStatus } from "@/lib/types";

export interface JobSearchToolbarProps {
  // Search state
  isSearching: boolean;
  hasKeywords: boolean;
  enabledSources: Set<string>;
  onSourceToggle: (sourceId: string, enabled: boolean) => void;
  onSearch: () => void;
  onSearchAndAnalyze: () => void;

  // Offset state
  offset: number;
  onOffsetChange: (offset: number) => void;
  usedOffsets: number[];
  suggestedNextOffset: number;

  // Analysis state
  isAnalyzing: boolean;
  analysisStatus: LLMAnalysisStatus | undefined;
  analyzeCount: number;
  analyzeAll: boolean;
  unanalyzedCount: number;
  analyzedCount: number;
  onAnalyzeCountChange: (count: number) => void;
  onAnalyzeAllChange: (all: boolean) => void;
  onAnalyze: () => void;
  onReanalyzeAll: () => void;

  // Selection state
  selectedCount: number;
  onAnalyzeSelected: () => void;
  onClearAnalysisSelected: () => void;
  onClearSelection: () => void;
  isClearingAnalysis: boolean;

  // Utility actions
  onSyncApplied: () => void;
  isSyncing: boolean;
  onOpenClearAnalysisDialog: () => void;
  onOpenClearResultsDialog: () => void;
  isClearingResults: boolean;
  lastSeenAt: string | null | undefined;
}

export function JobSearchToolbar({
  isSearching,
  hasKeywords,
  enabledSources,
  onSourceToggle,
  onSearch,
  onSearchAndAnalyze,
  offset,
  onOffsetChange,
  usedOffsets,
  suggestedNextOffset,
  isAnalyzing,
  analysisStatus,
  analyzeCount,
  analyzeAll,
  unanalyzedCount,
  analyzedCount,
  onAnalyzeCountChange,
  onAnalyzeAllChange,
  onAnalyze,
  onReanalyzeAll,
  selectedCount,
  onAnalyzeSelected,
  onClearAnalysisSelected,
  onClearSelection,
  isClearingAnalysis,
  onSyncApplied,
  isSyncing,
  onOpenClearAnalysisDialog,
  onOpenClearResultsDialog,
  isClearingResults,
  lastSeenAt,
}: JobSearchToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg border bg-card">
      {/* Search Group */}
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onSearch}
              disabled={isSearching || !hasKeywords}
              size="sm"
              className="gap-1.5"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Search
            </Button>
          </TooltipTrigger>
          <TooltipContent>Search for jobs using selected sources</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onSearchAndAnalyze}
              disabled={
                isSearching || isAnalyzing || !hasKeywords || !analysisStatus?.model_ready
              }
              size="sm"
              className="gap-1.5 bg-violet-600 hover:bg-violet-700"
            >
              {isSearching || isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Search + AI
            </Button>
          </TooltipTrigger>
          <TooltipContent>Search and automatically analyze all results with AI</TooltipContent>
        </Tooltip>
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Sources Group */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Sources ({enabledSources.size})
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {JOB_SOURCES.map((source) => (
            <DropdownMenuCheckboxItem
              key={source.id}
              checked={enabledSources.has(source.id)}
              onCheckedChange={(checked) => onSourceToggle(source.id, checked)}
            >
              <Badge className={`${source.color} mr-2`}>{source.name}</Badge>
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Offset Group */}
      <div className="flex items-center gap-1.5 bg-muted/50 rounded-md px-2 py-1">
        <span className="text-xs text-muted-foreground">Offset:</span>
        <Input
          type="number"
          min={0}
          step={25}
          value={offset}
          onChange={(e) => onOffsetChange(Math.max(0, parseInt(e.target.value) || 0))}
          disabled={isSearching}
          className="w-20 h-7 text-center text-sm"
        />
        {suggestedNextOffset > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOffsetChange(suggestedNextOffset)}
                disabled={isSearching}
                className="h-7 px-2 text-xs"
              >
                → {suggestedNextOffset}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Use suggested next offset</TooltipContent>
          </Tooltip>
        )}
        {usedOffsets.length > 0 && (
          <span className="text-[10px] text-muted-foreground">
            Used: {usedOffsets.join(", ")}
          </span>
        )}
      </div>

      <div className="h-6 w-px bg-border" />

      {/* Analyze Group */}
      <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-1.5">
        <Brain className="h-4 w-4 text-violet-500" />
        <Input
          type="number"
          min={1}
          max={unanalyzedCount || 100}
          value={analyzeCount}
          onChange={(e) => onAnalyzeCountChange(Math.max(1, parseInt(e.target.value) || 1))}
          disabled={analyzeAll || isAnalyzing}
          className="w-20 h-8 text-center text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={analyzeAll}
            onChange={(e) => onAnalyzeAllChange(e.target.checked)}
            disabled={isAnalyzing}
            className="h-4 w-4"
          />
          All
        </label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              onClick={onAnalyze}
              disabled={isAnalyzing || !analysisStatus?.model_ready || unanalyzedCount === 0}
              className="h-8 px-3 gap-1.5 bg-violet-600 hover:bg-violet-700 text-sm"
            >
              {isAnalyzing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Analyze ({unanalyzedCount})
            </Button>
          </TooltipTrigger>
          <TooltipContent>Analyze unscored jobs with AI</TooltipContent>
        </Tooltip>
      </div>

      {/* Re-analyze */}
      {analyzedCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReanalyzeAll}
              disabled={isAnalyzing || !analysisStatus?.model_ready}
              className="h-7 px-2 gap-1 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Re-analyze ({analyzedCount})
            </Button>
          </TooltipTrigger>
          <TooltipContent>Re-run AI analysis on all {analyzedCount} scored jobs</TooltipContent>
        </Tooltip>
      )}

      {/* Selected Actions */}
      {selectedCount > 0 && (
        <>
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-1.5 bg-violet-100 dark:bg-violet-950/40 rounded-md px-2 py-1">
            <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
              {selectedCount} selected
            </span>
            <Button
              variant="default"
              size="sm"
              onClick={onAnalyzeSelected}
              disabled={isAnalyzing || !analysisStatus?.model_ready}
              className="h-6 px-2 text-xs bg-violet-600 hover:bg-violet-700"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              Analyze
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClearAnalysisSelected}
                  disabled={isClearingAnalysis || isAnalyzing}
                  className="h-6 px-2 text-xs border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/30"
                >
                  {isClearingAnalysis ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Eraser className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear analysis from selected jobs</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="h-6 px-1.5 text-violet-600 hover:text-violet-700"
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}

      <div className="flex-1" />

      {/* Right-side utilities */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSyncApplied}
            disabled={isSyncing}
            className="h-7 px-2"
          >
            {isSyncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Sync applied status from your applications</TooltipContent>
      </Tooltip>

      {/* Clear All Analysis Button */}
      {analyzedCount > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenClearAnalysisDialog}
              disabled={isClearingAnalysis || isSearching || isAnalyzing}
              className="h-7 px-2 text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
            >
              <Eraser className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="bg-orange-600 text-white">
            Clear ALL analysis from jobs ({analyzedCount})
          </TooltipContent>
        </Tooltip>
      )}

      {/* Nuclear Clear Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenClearResultsDialog}
            disabled={isClearingResults || isSearching || isAnalyzing}
            className="h-7 px-2 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="bg-red-600 text-white">
          Clear ALL job listings from database
        </TooltipContent>
      </Tooltip>

      {lastSeenAt && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
          {formatDistanceToNow(parseISO(lastSeenAt), { addSuffix: true })}
        </span>
      )}
    </div>
  );
}

