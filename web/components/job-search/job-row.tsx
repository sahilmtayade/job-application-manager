"use client";

import { formatDistanceToNow, parseISO } from "date-fns";
import Image from "next/image";
import {
  AlertTriangle,
  AlignLeft,
  Ban,
  Brain,
  Building2,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  MapPin,
  RotateCcw,
  Send,
  XCircle,
} from "lucide-react";
import { Fragment } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { formatSiteName, SITE_COLORS } from "@/lib/constants/job-sources";
import {
  getScoreColor,
  SCORE_GOOD,
  SCORE_MODERATE,
} from "@/lib/constants/scoring";
import type { JobListing } from "@/lib/types";
import { API_URL } from "@/lib/api";
import { getCleanLogoUrl } from "@/lib/utils";

// Helper function to get score icon
function getScoreIcon(score: number | null | undefined) {
  if (score === null || score === undefined) return null;
  if (score >= SCORE_GOOD) return <CheckCircle2 className="h-3 w-3" />;
  if (score >= SCORE_MODERATE) return <AlertTriangle className="h-3 w-3" />;
  return <XCircle className="h-3 w-3" />;
}

// Helper to format salary
function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  const formatNum = (n: number) =>
    n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`;
  if (min && max) return `${formatNum(min)} - ${formatNum(max)}`;
  if (min) return `${formatNum(min)}+`;
  if (max) return `Up to ${formatNum(max)}`;
  return null;
}

// Minimum description length for valid analysis
const MIN_DESCRIPTION_LENGTH = 50;

/**
 * Check if a job has a valid description for analysis
 */
export function hasValidDescription(job: JobListing): boolean {
  if (!job.description) return false;
  const cleaned = job.description
    .replace(/\s+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
  return cleaned.length >= MIN_DESCRIPTION_LENGTH;
}

export interface JobRowProps {
  job: JobListing;
  isSelected: boolean;
  isExpanded: boolean;
  isAnalyzing: boolean;
  isQueued: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onToggleApplied: () => void;
  onToggleHide: () => void;
  onAnalyze: () => void;
  onViewNotes: () => void;
  onViewDescription: () => void;
  onBanCompany: () => void;
  isBanningCompany: boolean;
}

export function JobRow({
  job,
  isSelected,
  isExpanded,
  isAnalyzing,
  isQueued,
  onToggleSelect,
  onToggleExpand,
  onToggleApplied,
  onToggleHide,
  onAnalyze,
  onViewNotes,
  onViewDescription,
  onBanCompany,
  isBanningCompany,
}: JobRowProps) {
  const canAnalyze = hasValidDescription(job) && !isQueued && !isAnalyzing;

  return (
    <Fragment>
      <TableRow
        className={`${job.is_mismatch ? "bg-red-50 dark:bg-red-950/20" : ""} ${
          job.is_hidden ? "opacity-60 bg-gray-50 dark:bg-gray-900/20" : ""
        } ${job.llm_notes ? "cursor-pointer hover:bg-muted/50" : ""} ${
          isSelected ? "bg-violet-50 dark:bg-violet-950/20" : ""
        }`}
        onClick={() => job.llm_notes && onToggleExpand()}
      >
        {/* Checkbox */}
        <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
          {job.id && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggleSelect}
              className="h-4 w-4 rounded border-gray-300 cursor-pointer"
            />
          )}
        </TableCell>

        {/* Expand/Collapse */}
        <TableCell className="w-8">
          {job.llm_notes && (
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </TableCell>

        {/* ID */}
        <TableCell className="w-16 text-muted-foreground text-xs font-mono">
          {job.id || "-"}
        </TableCell>

        {/* Score */}
        <TableCell>
          {isAnalyzing ? (
            <Badge className="bg-violet-500 text-white animate-pulse gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing
            </Badge>
          ) : isQueued ? (
            <Badge className="bg-amber-500 text-white gap-1">
              <Loader2 className="h-3 w-3" />
              Queued
            </Badge>
          ) : job.llm_score !== null && job.llm_score !== undefined ? (
            <Tooltip>
              <TooltipTrigger>
                <Badge className={`${getScoreColor(job.llm_score)} gap-1`}>
                  {getScoreIcon(job.llm_score)}
                  {job.llm_score}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-sm">
                  {job.llm_analysis || "No analysis available"}
                </p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              —
            </Badge>
          )}
        </TableCell>

        {/* Title with badges */}
        <TableCell className="font-medium max-w-xs">
          <div className="flex items-center gap-2">
            <span className="truncate" title={job.title}>
              {job.title}
            </span>
            {job.is_hidden && (
              <Badge
                variant="outline"
                className="text-xs text-gray-500 border-gray-400"
              >
                Hidden
              </Badge>
            )}
            {job.is_applied && (
              <Tooltip>
                <TooltipTrigger>
                  <Badge
                    variant="outline"
                    className="text-xs text-green-600 border-green-600"
                  >
                    Applied
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  Applied{" "}
                  {job.applied_at
                    ? formatDistanceToNow(parseISO(job.applied_at), {
                        addSuffix: true,
                      })
                    : ""}
                </TooltipContent>
              </Tooltip>
            )}
            {job.is_mismatch && (
              <Tooltip>
                <TooltipTrigger>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </TooltipTrigger>
                <TooltipContent>Flagged as field mismatch</TooltipContent>
              </Tooltip>
            )}
            {job.llm_notes && (
              <Tooltip>
                <TooltipTrigger>
                  <FileText className="h-4 w-4 text-violet-500" />
                </TooltipTrigger>
                <TooltipContent>Has detailed analysis notes</TooltipContent>
              </Tooltip>
            )}
            {job.description && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 p-0 hover:bg-transparent"
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewDescription();
                    }}
                  >
                    <AlignLeft className="h-4 w-4 text-sky-500 hover:text-sky-600" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View job description</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TableCell>

        {/* Company */}
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 cursor-pointer hover:text-violet-600 dark:hover:text-violet-400 hover:underline decoration-dashed underline-offset-4 text-left max-w-[140px] truncate focus:outline-none transition-colors">
                  {getCleanLogoUrl(job.company_logo) ? (
                    <div className="relative flex-shrink-0 flex items-center justify-center w-4 h-4 mr-1">
                      <Image
                        src={getCleanLogoUrl(job.company_logo)!}
                        alt=""
                        width={16}
                        height={16}
                      className="object-contain max-h-full max-w-full rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        const sibling = (e.target as HTMLImageElement)
                          .nextElementSibling as HTMLElement;
                        if (sibling) sibling.classList.remove("hidden");
                      }}
                    />
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground hidden" />
                    {job.applied_company && (
                      <CheckCircle2 className="h-2 w-2 text-blue-500 absolute -bottom-0.5 -right-0.5" />
                    )}
                  </div>
                ) : job.applied_company ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="relative flex-shrink-0 mr-1">
                        <Building2 className="h-3.5 w-3.5 text-blue-500" />
                        <CheckCircle2 className="h-2 w-2 text-blue-500 absolute -bottom-0.5 -right-0.5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      Previously applied to this company
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground flex-shrink-0" />
                )}
                <span className="truncate font-medium" title={job.company}>
                  {job.company}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel className="truncate max-w-[200px]">
                {job.company}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onBanCompany();
                }}
                disabled={isBanningCompany}
              >
                <Ban className="h-4 w-4 mr-2" />
                Ban Company
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>

        {/* Location */}
        <TableCell className="text-muted-foreground">
          <div className="flex items-center gap-1">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate max-w-28" title={job.location || ""}>
              {job.location || "-"}
            </span>
          </div>
        </TableCell>

        {/* Date Posted */}
        <TableCell className="text-muted-foreground">
          {job.date_posted || "-"}
        </TableCell>

        {/* Source */}
        <TableCell>
          <Badge
            variant="secondary"
            className={`text-xs ${SITE_COLORS[job.site_source] || "bg-gray-500 text-white"}`}
          >
            {formatSiteName(job.site_source)}
          </Badge>
        </TableCell>

        {/* Salary */}
        <TableCell className="text-muted-foreground">
          {formatSalary(job.salary_min, job.salary_max) ? (
            <span className="text-green-600 dark:text-green-400">
              {formatSalary(job.salary_min, job.salary_max)}
            </span>
          ) : (
            "-"
          )}
        </TableCell>

        {/* Updated */}
        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
          {job.last_seen_at
            ? formatDistanceToNow(parseISO(job.last_seen_at), {
                addSuffix: true,
              })
            : "-"}
        </TableCell>

        {/* Actions */}
        <TableCell onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            {/* Open URL */}
            <Tooltip>
              <TooltipTrigger asChild>
                <a href={job.job_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </a>
              </TooltipTrigger>
              <TooltipContent>Open job posting</TooltipContent>
            </Tooltip>

            {/* Mark Applied */}
            {job.id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${
                      job.is_applied
                        ? "text-green-600"
                        : "text-muted-foreground"
                    }`}
                    onClick={onToggleApplied}
                  >
                    {job.is_applied ? (
                      <CheckCheck className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {job.is_applied ? "Unmark as applied" : "Mark as applied"}
                </TooltipContent>
              </Tooltip>
            )}

            {/* View Notes */}
            {job.llm_notes && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onViewNotes}
                  >
                    <FileText className="h-4 w-4 text-violet-500" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View analysis notes</TooltipContent>
              </Tooltip>
            )}

            {/* Analyze */}
            {job.id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-8 w-8 ${
                      !hasValidDescription(job)
                        ? "text-muted-foreground/30 cursor-not-allowed"
                        : isQueued
                          ? "text-muted-foreground/50 cursor-not-allowed"
                          : job.llm_score !== null
                            ? "text-muted-foreground hover:text-violet-600"
                            : "text-violet-500 hover:text-violet-600"
                    }`}
                    onClick={onAnalyze}
                    disabled={!canAnalyze}
                  >
                    {job.llm_score !== null ? (
                      <RotateCcw className="h-4 w-4" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {!hasValidDescription(job)
                    ? "Cannot analyze - job has no description"
                    : isQueued
                      ? "Job is in analysis queue"
                      : job.llm_score !== null
                        ? "Re-analyze with AI"
                        : "Analyze with AI"}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Hide/Unhide */}
            {job.id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={onToggleHide}
                  >
                    {job.is_hidden ? (
                      <Eye className="h-4 w-4 text-amber-500" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {job.is_hidden ? "Unhide job" : "Hide job"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Expanded Notes Row */}
      {isExpanded && job.llm_notes && (
        <TableRow className="bg-violet-50 dark:bg-violet-950/20">
          <TableCell colSpan={13} className="py-4">
            <div className="px-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <Brain className="h-5 w-5 text-violet-500 mt-0.5 flex-shrink-0" />
                  <div className="space-y-2">
                    <p className="font-medium text-sm text-violet-700 dark:text-violet-300">
                      AI Analysis Notes
                    </p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {job.llm_notes}
                    </p>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 text-red-600 border-red-300 hover:bg-red-50 hover:border-red-400"
                        onClick={(e) => {
                          e.stopPropagation();
                          onBanCompany();
                        }}
                        disabled={isBanningCompany}
                      >
                        {isBanningCompany ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Ban className="h-4 w-4" />
                        )}
                        Ban Company
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Ban &quot;{job.company}&quot; - hides all their jobs and
                      excludes from future searches
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
