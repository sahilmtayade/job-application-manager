"use client";

import { useState, useEffect, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useJobSearch } from "@/lib/job-search-context";
import {
  Search,
  Loader2,
  ExternalLink,
  MapPin,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Brain,
  EyeOff,
  Eye,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Sparkles,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Send,
  CheckCheck,
  RotateCcw,
  AlignLeft,
  Copy,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow, parseISO } from "date-fns";

import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { jobSearchApi, bannedCompaniesApi } from "@/lib/api";
import type { JobListing } from "@/lib/types";
import { SCORE_GOOD, SCORE_MODERATE, getScoreColor } from "@/lib/constants/scoring";
import {
  DEFAULT_ENABLED_SOURCES,
  SITE_COLORS,
  formatSiteName,
} from "@/lib/constants/job-sources";
import {
  JobSearchToolbar,
  JobFiltersDropdown,
  DEFAULT_FILTERS,
  type FilterState,
} from "@/components/job-search";
import { Ban, Trash2, AlertOctagon, SlidersHorizontal, Eraser, Download } from "lucide-react";

function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  const formatNum = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}`);
  if (min && max) return `${formatNum(min)} - ${formatNum(max)}`;
  if (min) return `${formatNum(min)}+`;
  if (max) return `Up to ${formatNum(max)}`;
  return null;
}

function getScoreIcon(score: number | null | undefined) {
  if (score === null || score === undefined) return null;
  if (score >= SCORE_GOOD) return <CheckCircle2 className="h-3 w-3" />;
  if (score >= SCORE_MODERATE) return <AlertTriangle className="h-3 w-3" />;
  return <XCircle className="h-3 w-3" />;
}

function formatEta(etaMs: number | undefined): string {
  if (!etaMs || etaMs <= 0) return "";
  const seconds = Math.ceil(etaMs / 1000);
  if (seconds < 60) return `~${seconds}s remaining`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0
      ? `~${minutes}m ${remainingSeconds}s remaining`
      : `~${minutes}m remaining`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `~${hours}h ${remainingMinutes}m remaining`;
}

function exportJobsToCSV(jobs: JobListing[], filename: string = "job-listings.csv") {
  // CSV header
  const headers = [
    "ID", "Title", "Company", "Location", "Source", "Posted", "Score", "Analysis",
    "Matched Skills", "Missing Skills", "Salary Min", "Salary Max", "Applied", "Hidden", "URL"
  ];

  // Convert jobs to CSV rows
  const rows = jobs.map(job => [
    job.id ?? "",
    `"${(job.title || "").replace(/"/g, '""')}"`,
    `"${(job.company || "").replace(/"/g, '""')}"`,
    `"${(job.location || "").replace(/"/g, '""')}"`,
    job.site_source || "",
    job.date_posted || "",
    job.llm_score ?? "",
    `"${(job.llm_analysis || "").replace(/"/g, '""')}"`,
    `"${(job.matched_skills || []).join(", ")}"`,
    `"${(job.missing_skills || []).join(", ")}"`,
    job.salary_min ?? "",
    job.salary_max ?? "",
    job.is_applied ? "Yes" : "No",
    job.is_hidden ? "Yes" : "No",
    job.job_url || "",
  ]);

  const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type SortField = "title" | "company" | "location" | "date_posted" | "site_source" | "salary" | "llm_score" | "last_seen_at";
type SortDirection = "asc" | "desc";

const ITEMS_PER_PAGE = 20;
const FILTERS_STORAGE_KEY = "job-search-filters";

export default function JobSearchPage() {
  const queryClient = useQueryClient();

  // Get global operation state from context
  const {
    isSearching,
    searchProgress,
    isAnalyzing,
    analysisProgress,
    queuedJobIds,
    analyzingJobId,
    handleSearch,
    runAnalysis,
    handleSearchAndAnalyze,
    isJobInQueue,
  } = useJobSearch();

  // Filter state (persisted to localStorage)
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("llm_score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [enabledSources, setEnabledSources] = useState<Set<string>>(DEFAULT_ENABLED_SOURCES);
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // UI-only state (not persisted)
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [analyzeCount, setAnalyzeCount] = useState(20);
  const [analyzeAll, setAnalyzeAll] = useState(false);
  const [notesDialogJob, setNotesDialogJob] = useState<JobListing | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<number>>(new Set());
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState("");
  const [clearAnalysisDialogOpen, setClearAnalysisDialogOpen] = useState(false);
  const [clearAnalysisConfirmText, setClearAnalysisConfirmText] = useState("");

  // Offset state
  const [searchOffset, setSearchOffset] = useState(0);
  const [offsetFilter, setOffsetFilter] = useState<number | "all">("all");

  // Load filters from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.searchQuery !== undefined) setSearchQuery(parsed.searchQuery);
        if (parsed.sortField !== undefined) setSortField(parsed.sortField);
        if (parsed.sortDirection !== undefined) setSortDirection(parsed.sortDirection);
        if (parsed.filters !== undefined) {
          // Merge with defaults to handle new filter fields added over time
          setFilters({
            ...DEFAULT_FILTERS,
            ...parsed.filters,
            // Deep merge nested objects to preserve new sub-fields
            analysisStatus: { ...DEFAULT_FILTERS.analysisStatus, ...parsed.filters.analysisStatus },
            applicationStatus: { ...DEFAULT_FILTERS.applicationStatus, ...parsed.filters.applicationStatus },
            appliedCompany: { ...DEFAULT_FILTERS.appliedCompany, ...parsed.filters.appliedCompany },
            visibility: { ...DEFAULT_FILTERS.visibility, ...parsed.filters.visibility },
            matchQuality: { ...DEFAULT_FILTERS.matchQuality, ...parsed.filters.matchQuality },
            description: { ...DEFAULT_FILTERS.description, ...parsed.filters.description },
          });
        }
        if (parsed.enabledSources !== undefined) setEnabledSources(new Set(parsed.enabledSources));
      } catch {
        // Ignore parse errors
      }
    }
    setFiltersLoaded(true);
  }, []);

  // Save filters to localStorage when they change
  useEffect(() => {
    if (!filtersLoaded) return; // Don't save until initial load complete
    localStorage.setItem(
      FILTERS_STORAGE_KEY,
      JSON.stringify({
        searchQuery,
        sortField,
        sortDirection,
        filters,
        enabledSources: [...enabledSources],
      })
    );
  }, [filtersLoaded, searchQuery, sortField, sortDirection, filters, enabledSources]);

  // Fetch keywords
  const { data: keywordsData, isLoading: isLoadingKeywords } = useQuery({
    queryKey: ["job-search-keywords"],
    queryFn: jobSearchApi.getKeywords,
  });

  // Fetch saved results (always include hidden, filter client-side)
  const { data: savedResults, isLoading: isLoadingSaved } = useQuery({
    queryKey: ["job-search-results"],
    queryFn: () => jobSearchApi.getSavedResults(24, true), // Always fetch all including hidden
  });

  // Fetch analysis status
  const { data: analysisStatus } = useQuery({
    queryKey: ["job-search-analysis-status"],
    queryFn: jobSearchApi.getAnalysisStatus,
    refetchInterval: isAnalyzing ? 5000 : false,
  });

  // Fetch used offsets
  const { data: offsetsData } = useQuery({
    queryKey: ["job-search-offsets"],
    queryFn: () => jobSearchApi.getUsedOffsets(100),
    staleTime: 30 * 1000, // 30 seconds
  });

  // Auto-sync applied status on load (runs once when results are loaded)
  const { data: syncResult, isFetching: isSyncing } = useQuery({
    queryKey: ["job-search-sync-applied"],
    queryFn: async () => {
      const result = await jobSearchApi.syncAppliedStatus();
      // If any matched, refetch results
      if (result.matched > 0) {
        queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      }
      return result;
    },
    enabled: !!savedResults && savedResults.jobs.length > 0,
    staleTime: 5 * 60 * 1000, // Consider stale after 5 minutes
    refetchOnWindowFocus: false,
  });

  // Manual sync mutation
  const syncAppliedMutation = useMutation({
    mutationFn: () => jobSearchApi.syncAppliedStatus(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      queryClient.invalidateQueries({ queryKey: ["job-search-sync-applied"] });
      if (data.matched > 0) {
        toast.success(`Matched ${data.matched} jobs from your applications`);
      } else {
        toast.info("No new matches found");
      }
    },
    onError: () => {
      toast.error("Failed to sync applied status");
    },
  });

  // Hide mutation
  const hideMutation = useMutation({
    mutationFn: (id: number) => jobSearchApi.hideResult(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      toast.success("Job hidden");
    },
  });

  // Toggle applied mutation
  const toggleAppliedMutation = useMutation({
    mutationFn: ({ id, isApplied }: { id: number; isApplied: boolean }) =>
      isApplied ? jobSearchApi.unmarkApplied(id) : jobSearchApi.markApplied(id),
    onSuccess: (_, { isApplied }) => {
      queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      toast.success(isApplied ? "Unmarked as applied" : "Marked as applied");
    },
  });

  // Unhide mutation
  const unhideMutation = useMutation({
    mutationFn: (id: number) => jobSearchApi.unhideResult(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      toast.success("Job unhidden");
    },
  });

  // Ban company mutation
  const banCompanyMutation = useMutation({
    mutationFn: (companyName: string) => bannedCompaniesApi.create({ name: companyName, reason: "Banned from job search" }),
    onSuccess: (_, companyName) => {
      queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      queryClient.invalidateQueries({ queryKey: ["banned-companies"] });
      toast.success(`"${companyName}" added to ban list. Future searches will exclude this company.`);
      setExpandedJobId(null);
    },
    onError: (error) => {
      toast.error(`Failed to ban company: ${error.message}`);
    },
  });

  // Nuclear clear all results mutation
  const clearResultsMutation = useMutation({
    mutationFn: () => jobSearchApi.clearResults(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      queryClient.invalidateQueries({ queryKey: ["job-search-analysis-status"] });
      toast.success(data.message || "All job listings cleared");
      setClearDialogOpen(false);
      setClearConfirmText("");
      setSelectedJobIds(new Set());
    },
    onError: (error) => {
      toast.error(`Failed to clear results: ${error.message}`);
    },
  });

  // Clear analysis mutation (for all or selected jobs)
  const clearAnalysisMutation = useMutation({
    mutationFn: (jobIds?: number[]) => jobSearchApi.clearAnalysis(jobIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      queryClient.invalidateQueries({ queryKey: ["job-search-analysis-status"] });
      toast.success(data.message || "Analysis cleared");
      setClearAnalysisDialogOpen(false);
      setClearAnalysisConfirmText("");
      setSelectedJobIds(new Set());
    },
    onError: (error) => {
      toast.error(`Failed to clear analysis: ${error.message}`);
    },
  });

  // Bulk action mutations
  const bulkHideMutation = useMutation({
    mutationFn: (jobIds: number[]) => jobSearchApi.bulkHide(jobIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      toast.success(data.message);
      setSelectedJobIds(new Set());
    },
    onError: (error) => {
      toast.error(`Failed to hide jobs: ${error.message}`);
    },
  });

  const bulkUnhideMutation = useMutation({
    mutationFn: (jobIds: number[]) => jobSearchApi.bulkUnhide(jobIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      toast.success(data.message);
      setSelectedJobIds(new Set());
    },
    onError: (error) => {
      toast.error(`Failed to unhide jobs: ${error.message}`);
    },
  });

  const bulkApplyMutation = useMutation({
    mutationFn: (jobIds: number[]) => jobSearchApi.bulkMarkApplied(jobIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      toast.success(data.message);
      setSelectedJobIds(new Set());
    },
    onError: (error) => {
      toast.error(`Failed to mark jobs as applied: ${error.message}`);
    },
  });

  const bulkUnapplyMutation = useMutation({
    mutationFn: (jobIds: number[]) => jobSearchApi.bulkUnmarkApplied(jobIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      toast.success(data.message);
      setSelectedJobIds(new Set());
    },
    onError: (error) => {
      toast.error(`Failed to unmark jobs: ${error.message}`);
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (jobIds: number[]) => jobSearchApi.bulkDelete(jobIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
      queryClient.invalidateQueries({ queryKey: ["job-search-analysis-status"] });
      toast.success(data.message);
      setSelectedJobIds(new Set());
    },
    onError: (error) => {
      toast.error(`Failed to delete jobs: ${error.message}`);
    },
  });

  const hasKeywords = keywordsData?.keywords && keywordsData.keywords.length > 0;
  const jobs = savedResults?.jobs || [];
  const hasResults = (savedResults?.total ?? 0) > 0;  // Use total from API, not filtered count
  const unanalyzedCount = savedResults?.unanalyzed_count || 0;
  const analyzedCount = savedResults?.analyzed_count || 0;

  // Get IDs of all analyzed jobs for re-analysis
  const analyzedJobIds = jobs
    .filter((job) => job.llm_score !== null && job.llm_score !== undefined && job.id)
    .map((job) => job.id!);

  // Handle LLM analysis
  const handleAnalyze = async () => {
    const limit = analyzeAll ? 0 : analyzeCount; // 0 means all
    await runAnalysis({ limit });
  };

  // Analyze a single job (force re-analyze)
  const handleAnalyzeSingle = async (jobId: number) => {
    await runAnalysis({ jobIds: [jobId] });
  };

  // Check if job has valid description for analysis (at least 50 chars)
  const hasValidDescription = (job: JobListing): boolean => {
    if (!job.description) return false;
    const desc = job.description.trim();
    if (desc.length < 50) return false;
    const lower = desc.toLowerCase();
    if (lower === "no description available" || lower === "no description" || lower === "n/a" || lower === "none") return false;
    return true;
  };

  // Re-analyze all already-analyzed jobs
  const handleReanalyzeAll = async () => {
    if (analyzedJobIds.length === 0) {
      toast.error("No analyzed jobs to re-analyze");
      return;
    }
    await runAnalysis({ jobIds: analyzedJobIds });
  };

  // Filter and sort jobs using multi-category aggregation
  const filteredAndSortedJobs = (() => {
    let filtered = jobs;

    // Text search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (job) =>
          job.title.toLowerCase().includes(query) ||
          job.company.toLowerCase().includes(query) ||
          (job.location?.toLowerCase().includes(query) ?? false)
      );
    }

    // Multi-category filtering (job must match at least one option in EACH category)
    filtered = filtered.filter((job) => {
      // Analysis Status: job matches if it's analyzed AND that's checked, OR unanalyzed AND that's checked
      const isAnalyzed = job.llm_score !== null && job.llm_score !== undefined;
      const matchesAnalysis = (isAnalyzed && filters.analysisStatus.analyzed) ||
                              (!isAnalyzed && filters.analysisStatus.unanalyzed);
      if (!matchesAnalysis) return false;

      // Application Status (specific job applied)
      const matchesApplication = (job.is_applied && filters.applicationStatus.applied) ||
                                  (!job.is_applied && filters.applicationStatus.unapplied);
      if (!matchesApplication) return false;

      // Applied Company (any job at this company)
      const matchesAppliedCompany = (job.applied_company && filters.appliedCompany.applied) ||
                                     (!job.applied_company && filters.appliedCompany.notApplied);
      if (!matchesAppliedCompany) return false;

      // Visibility
      const matchesVisibility = (job.is_hidden && filters.visibility.hidden) ||
                                 (!job.is_hidden && filters.visibility.visible);
      if (!matchesVisibility) return false;

      // Match Quality (only applies to analyzed jobs)
      if (isAnalyzed) {
        const score = job.llm_score!;
        const matchesQuality =
          (score >= SCORE_GOOD && filters.matchQuality.good) ||
          (score >= SCORE_MODERATE && score < SCORE_GOOD && filters.matchQuality.moderate) ||
          (score < SCORE_MODERATE && !job.is_mismatch && filters.matchQuality.poor) ||
          (job.is_mismatch && filters.matchQuality.mismatch);
        if (!matchesQuality) return false;
      }
      // Unanalyzed jobs pass through match quality filter (they're shown if unanalyzed is checked)

      // Description
      const hasDesc = hasValidDescription(job);
      const matchesDescription = (hasDesc && filters.description.hasDescription) ||
                                  (!hasDesc && filters.description.noDescription);
      if (!matchesDescription) return false;

      return true;
    });

    // Filter by enabled sources
    filtered = filtered.filter((job) => enabledSources.has(job.site_source));

    // Filter by offset
    if (offsetFilter !== "all") {
      filtered = filtered.filter((job) => job.search_offset === offsetFilter);
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "company":
          comparison = a.company.localeCompare(b.company);
          break;
        case "location":
          comparison = (a.location || "").localeCompare(b.location || "");
          break;
        case "date_posted":
          comparison = (a.date_posted || "").localeCompare(b.date_posted || "");
          break;
        case "site_source":
          comparison = a.site_source.localeCompare(b.site_source);
          break;
        case "salary":
          comparison = (a.salary_min || 0) - (b.salary_min || 0);
          break;
        case "llm_score":
          comparison = (a.llm_score ?? -1) - (b.llm_score ?? -1);
          break;
        case "last_seen_at":
          comparison = (a.last_seen_at || "").localeCompare(b.last_seen_at || "");
          break;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  })();

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedJobs.length / ITEMS_PER_PAGE);
  const paginatedJobs = filteredAndSortedJobs.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Selection helpers
  const toggleJobSelection = (jobId: number) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const pageJobIds = paginatedJobs.filter((job) => job.id).map((job) => job.id!);
  const allOnPageSelected = pageJobIds.length > 0 && pageJobIds.every((id) => selectedJobIds.has(id));
  const someOnPageSelected = pageJobIds.some((id) => selectedJobIds.has(id));

  const toggleSelectAllOnPage = () => {
    if (allOnPageSelected) {
      // Deselect all on page
      setSelectedJobIds((prev) => {
        const next = new Set(prev);
        pageJobIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      // Select all on page
      setSelectedJobIds((prev) => {
        const next = new Set(prev);
        pageJobIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const clearSelection = () => {
    setSelectedJobIds(new Set());
  };

  // Analyze selected jobs
  const handleAnalyzeSelected = async () => {
    if (selectedJobIds.size === 0) {
      toast.error("No jobs selected");
      return;
    }
    await runAnalysis({ jobIds: [...selectedJobIds] });
    setSelectedJobIds(new Set()); // Clear selection after analysis
  };

  // Clear analysis from selected jobs
  const handleClearAnalysisSelected = () => {
    if (selectedJobIds.size === 0) {
      toast.error("No jobs selected");
      return;
    }
    clearAnalysisMutation.mutate([...selectedJobIds]);
  };

  // Update a specific filter option and reset to page 1
  const updateFilter = <K extends keyof FilterState>(
    category: K,
    option: keyof FilterState[K],
    value: boolean
  ) => {
    setFilters((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [option]: value,
      },
    }));
    setCurrentPage(1);
  };

  // Select all filters (used by JobFiltersDropdown callback)
  const selectAllFilters = () => {
    setFilters({
      analysisStatus: { analyzed: true, unanalyzed: true },
      applicationStatus: { applied: true, unapplied: true },
      appliedCompany: { applied: true, notApplied: true },
      visibility: { visible: true, hidden: true },
      matchQuality: { good: true, moderate: true, poor: true, mismatch: true },
      description: { hasDescription: true, noDescription: true },
    });
    setCurrentPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "llm_score" || field === "date_posted" || field === "last_seen_at" ? "desc" : "asc");
    }
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => handleSort(field)}>
      <div className="flex items-center gap-2">
        {children}
        {sortField === field ? (
          sortDirection === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />
        ) : (
          <ArrowUpDown className="h-4 w-4 opacity-50" />
        )}
      </div>
    </TableHead>
  );

  const toggleExpanded = (jobId: number | null | undefined) => {
    if (jobId === null || jobId === undefined) return;
    setExpandedJobId(expandedJobId === jobId ? null : jobId);
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full overflow-hidden">
        <Header title="Job Search" badge="Beta" />
        <div className="flex-1 overflow-auto p-8">
          <div className="space-y-6">
            {/* Toolbar */}
            <JobSearchToolbar
              isSearching={isSearching}
              hasKeywords={!!hasKeywords}
              enabledSources={enabledSources}
              onSourceToggle={(sourceId, enabled) => {
                        setEnabledSources((prev) => {
                          const next = new Set(prev);
                  if (enabled) next.add(sourceId);
                  else next.delete(sourceId);
                          return next;
                        });
                        setCurrentPage(1);
                      }}
              onSearch={() => {
                handleSearch([...enabledSources], searchOffset);
                queryClient.invalidateQueries({ queryKey: ["job-search-offsets"] });
              }}
              onSearchAndAnalyze={() => {
                handleSearchAndAnalyze([...enabledSources], searchOffset);
                queryClient.invalidateQueries({ queryKey: ["job-search-offsets"] });
              }}
              offset={searchOffset}
              onOffsetChange={setSearchOffset}
              usedOffsets={offsetsData?.offsets ?? []}
              suggestedNextOffset={offsetsData?.suggested_next ?? 0}
              isAnalyzing={isAnalyzing}
              analysisStatus={analysisStatus}
              analyzeCount={analyzeCount}
              analyzeAll={analyzeAll}
              unanalyzedCount={unanalyzedCount}
              analyzedCount={analyzedCount}
              onAnalyzeCountChange={setAnalyzeCount}
              onAnalyzeAllChange={setAnalyzeAll}
              onAnalyze={handleAnalyze}
              onReanalyzeAll={handleReanalyzeAll}
              selectedCount={selectedJobIds.size}
              onAnalyzeSelected={handleAnalyzeSelected}
              onClearAnalysisSelected={handleClearAnalysisSelected}
              onClearSelection={clearSelection}
              isClearingAnalysis={clearAnalysisMutation.isPending}
              onSyncApplied={() => syncAppliedMutation.mutate()}
              isSyncing={syncAppliedMutation.isPending || isSyncing}
              onOpenClearAnalysisDialog={() => setClearAnalysisDialogOpen(true)}
              onOpenClearResultsDialog={() => setClearDialogOpen(true)}
              isClearingResults={clearResultsMutation.isPending}
              lastSeenAt={savedResults?.last_seen_at}
            />

            {/* Keywords Row */}
            <div className="flex items-center gap-3 px-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              {hasKeywords ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href="/settings" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      <div className="flex flex-wrap gap-1.5">
                        {keywordsData?.keywords.map((keyword, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Click to edit keywords in settings</TooltipContent>
                </Tooltip>
              ) : (
                <Link href="/settings">
                  <span className="text-sm text-amber-600 hover:text-amber-700">
                    Set up search keywords in settings →
                  </span>
                </Link>
              )}
            </div>

            {/* Analysis Progress */}
            {isAnalyzing && analysisProgress && (
              <Card className="border-violet-500/50 bg-violet-500/5">
                <CardContent className="py-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-4">
                      <Sparkles className="h-4 w-4 animate-pulse text-violet-500" />
                      <div className="flex-1">
                        <Progress value={(analysisProgress.current / analysisProgress.total) * 100} className="h-1.5" />
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {analysisProgress.current}/{analysisProgress.total}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate">
                        {analysisProgress.jobTitle && `Analyzing: ${analysisProgress.jobTitle.slice(0, 40)}...`}
                      </span>
                      {analysisProgress.etaMs && (
                        <span className="text-violet-600 font-medium whitespace-nowrap ml-2">
                          {formatEta(analysisProgress.etaMs)}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Search Loading */}
            {isSearching && (
              <Card className="border-violet-500/50 bg-violet-500/5">
                <CardContent className="py-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <Search className="h-4 w-4 animate-pulse" />
                        Searching DMV area for entry-level positions...
                      </span>
                      {searchProgress && (
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <span>{searchProgress.progress} / {searchProgress.total} searches</span>
                          {searchProgress.etaMs ? (
                            <span className="text-violet-600 font-medium">
                              {formatEta(searchProgress.etaMs)}
                            </span>
                          ) : searchProgress.elapsedMs ? (
                            <span className="text-muted-foreground text-xs">
                              {Math.round(searchProgress.elapsedMs / 1000)}s elapsed
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                    {searchProgress && (
                      <>
                        <Progress
                          value={(searchProgress.progress / searchProgress.total) * 100}
                          className="h-2"
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate">
                            {searchProgress.site && <span className="text-violet-600 font-medium">[{searchProgress.site}]</span>}{" "}
                            Searching: &quot;{searchProgress.keyword}&quot; in {searchProgress.location}
                          </span>
                          <span className="text-green-600 font-medium whitespace-nowrap ml-2">
                            {searchProgress.found} jobs found
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Results Table */}
            {!isSearching && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Input
                      placeholder="Filter results..."
                      value={searchQuery}
                      onChange={handleSearchChange}
                      className="w-64"
                    />
                    {/* Filter Dropdown - Multi-Category Aggregation */}
                    <JobFiltersDropdown
                      filters={filters}
                      onFilterChange={updateFilter}
                      onSelectAll={selectAllFilters}
                    />
                    {/* Offset Filter */}
                    {offsetsData && offsetsData.offsets.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            Offset: {offsetFilter === "all" ? "All" : offsetFilter}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuCheckboxItem
                            checked={offsetFilter === "all"}
                            onCheckedChange={() => setOffsetFilter("all")}
                          >
                            All
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuSeparator />
                          {offsetsData.offsets.map((offset) => (
                            <DropdownMenuCheckboxItem
                              key={offset}
                              checked={offsetFilter === offset}
                              onCheckedChange={() => setOffsetFilter(offset)}
                            >
                              {offset}
                            </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-muted-foreground">
                      {filteredAndSortedJobs.length} of {jobs.length} jobs
                      {savedResults?.analyzed_count !== undefined && (
                        <span className="ml-2">
                          ({savedResults.analyzed_count} scored)
                        </span>
                      )}
                    </div>
                    {filteredAndSortedJobs.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              exportJobsToCSV(filteredAndSortedJobs);
                              toast.success(`Exported ${filteredAndSortedJobs.length} jobs to CSV`);
                            }}
                            className="gap-1.5"
                          >
                            <Download className="h-4 w-4" />
                            Export
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Export filtered results to CSV</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                </div>

                {/* Bulk Actions Bar */}
                {selectedJobIds.size > 0 && (
                  <div className="flex items-center justify-between p-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg border border-violet-200 dark:border-violet-800">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                        {selectedJobIds.size} job{selectedJobIds.size !== 1 ? "s" : ""} selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        className="text-xs h-7"
                      >
                        Clear
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1">
                            <EyeOff className="h-4 w-4" />
                            Visibility
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Change Visibility</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuCheckboxItem
                            onClick={() => bulkHideMutation.mutate([...selectedJobIds])}
                            disabled={bulkHideMutation.isPending}
                          >
                            <EyeOff className="h-4 w-4 mr-2" />
                            Hide Selected
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem
                            onClick={() => bulkUnhideMutation.mutate([...selectedJobIds])}
                            disabled={bulkUnhideMutation.isPending}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Unhide Selected
                          </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Send className="h-4 w-4" />
                            Applied
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuLabel>Change Applied Status</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuCheckboxItem
                            onClick={() => bulkApplyMutation.mutate([...selectedJobIds])}
                            disabled={bulkApplyMutation.isPending}
                          >
                            <CheckCheck className="h-4 w-4 mr-2" />
                            Mark as Applied
                          </DropdownMenuCheckboxItem>
                          <DropdownMenuCheckboxItem
                            onClick={() => bulkUnapplyMutation.mutate([...selectedJobIds])}
                            disabled={bulkUnapplyMutation.isPending}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Unmark as Applied
                          </DropdownMenuCheckboxItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => bulkDeleteMutation.mutate([...selectedJobIds])}
                        disabled={bulkDeleteMutation.isPending}
                      >
                        {bulkDeleteMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </div>
                )}

                {isLoadingSaved ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : !hasResults ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                      <p className="font-medium">No saved results</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Click &quot;Search&quot; to find entry-level jobs in the DMV area.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <input
                              type="checkbox"
                              checked={allOnPageSelected}
                              ref={(el) => {
                                if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
                              }}
                              onChange={toggleSelectAllOnPage}
                              className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                              title="Select all on page"
                            />
                          </TableHead>
                          <TableHead className="w-8"></TableHead>
                          <TableHead className="w-16 text-muted-foreground">ID</TableHead>
                          <SortableHeader field="llm_score">Score</SortableHeader>
                          <TableHead>Skills</TableHead>
                          <SortableHeader field="title">Title</SortableHeader>
                          <SortableHeader field="company">Company</SortableHeader>
                          <SortableHeader field="location">Location</SortableHeader>
                          <SortableHeader field="date_posted">Posted</SortableHeader>
                          <SortableHeader field="site_source">Source</SortableHeader>
                          <SortableHeader field="salary">Salary</SortableHeader>
                          <SortableHeader field="last_seen_at">Updated</SortableHeader>
                          <TableHead className="w-24">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedJobs.map((job) => (
                          <Fragment key={job.id || job.job_url}>
                            <TableRow
                              className={`${job.is_mismatch ? "bg-red-50 dark:bg-red-950/20" : ""} ${
                                job.is_hidden ? "opacity-60 bg-gray-50 dark:bg-gray-900/20" : ""
                              } ${job.llm_notes ? "cursor-pointer hover:bg-muted/50" : ""} ${
                                job.id && selectedJobIds.has(job.id) ? "bg-violet-50 dark:bg-violet-950/20" : ""
                              }`}
                              onClick={() => job.llm_notes && toggleExpanded(job.id)}
                            >
                              <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                                {job.id && (
                                  <input
                                    type="checkbox"
                                    checked={selectedJobIds.has(job.id)}
                                    onChange={() => toggleJobSelection(job.id!)}
                                    className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                                  />
                                )}
                              </TableCell>
                              <TableCell className="w-8">
                                {job.llm_notes && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    {expandedJobId === job.id ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                              <TableCell className="w-16 text-muted-foreground text-xs font-mono">
                                {job.id || "-"}
                              </TableCell>
                              <TableCell>
                                {/* Queue/Analyzing status takes priority */}
                                {analyzingJobId === job.id ? (
                                  <Badge className="bg-violet-500 text-white animate-pulse gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    Analyzing
                                  </Badge>
                                ) : queuedJobIds.has(job.id!) ? (
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
                                      <p className="text-sm">{job.llm_analysis || "No analysis available"}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground">
                                    —
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="max-w-32">
                                {(job.matched_skills?.length || job.missing_skills?.length) ? (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <div className="flex items-center gap-1">
                                        {job.matched_skills && job.matched_skills.length > 0 && (
                                          <span className="text-xs text-green-600 font-medium">
                                            +{job.matched_skills.length}
                                          </span>
                                        )}
                                        {job.missing_skills && job.missing_skills.length > 0 && (
                                          <span className="text-xs text-red-500 font-medium">
                                            -{job.missing_skills.length}
                                          </span>
                                        )}
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-sm">
                                      <div className="space-y-2">
                                        {job.matched_skills && job.matched_skills.length > 0 && (
                                          <div>
                                            <p className="text-xs font-medium text-green-600 mb-1">Matched:</p>
                                            <div className="flex flex-wrap gap-1">
                                              {job.matched_skills.map((skill, i) => (
                                                <Badge key={i} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                                  {skill}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        {job.missing_skills && job.missing_skills.length > 0 && (
                                          <div>
                                            <p className="text-xs font-medium text-red-600 mb-1">Missing:</p>
                                            <div className="flex flex-wrap gap-1">
                                              {job.missing_skills.map((skill, i) => (
                                                <Badge key={i} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300">
                                                  {skill}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="font-medium max-w-xs">
                                <div className="flex items-center gap-2">
                                  <span className="truncate" title={job.title}>
                                    {job.title}
                                  </span>
                                  {job.is_hidden && (
                                    <Badge variant="outline" className="text-xs text-gray-500 border-gray-400">
                                      Hidden
                                    </Badge>
                                  )}
                                  {job.is_applied && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className="text-xs text-green-600 border-green-600">
                                          Applied
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Applied {job.applied_at ? formatDistanceToNow(parseISO(job.applied_at), { addSuffix: true }) : ""}
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
                                      <TooltipTrigger>
                                        <AlignLeft className="h-4 w-4 text-sky-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>Job description available</TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {job.applied_company ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="relative">
                                          <Building2 className="h-3.5 w-3.5 text-blue-500" />
                                          <CheckCircle2 className="h-2 w-2 text-blue-500 absolute -bottom-0.5 -right-0.5" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>Previously applied to this company</TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                  <span className="truncate max-w-28 pl-1" title={job.company}>
                                    {job.company}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" />
                                  <span className="truncate max-w-28" title={job.location || ""}>
                                    {job.location || "-"}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {job.date_posted || "-"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${SITE_COLORS[job.site_source] || "bg-gray-500 text-white"}`}
                                >
                                  {formatSiteName(job.site_source)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatSalary(job.salary_min, job.salary_max) ? (
                                  <span className="text-green-600 dark:text-green-400">
                                    {formatSalary(job.salary_min, job.salary_max)}
                                  </span>
                                ) : (
                                  "-"
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                                {job.last_seen_at
                                  ? formatDistanceToNow(parseISO(job.last_seen_at), { addSuffix: true })
                                  : "-"}
                              </TableCell>
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1">
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
                                  {job.id && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className={`h-8 w-8 ${job.is_applied ? "text-green-600" : "text-muted-foreground"}`}
                                          onClick={() =>
                                            toggleAppliedMutation.mutate({
                                              id: job.id!,
                                              isApplied: job.is_applied || false,
                                            })
                                          }
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
                                  {job.llm_notes && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() => setNotesDialogJob(job)}
                                        >
                                          <FileText className="h-4 w-4 text-violet-500" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>View analysis notes</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {/* Analyze button - disabled for jobs without valid descriptions */}
                                  {job.id && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className={`h-8 w-8 ${
                                            !hasValidDescription(job)
                                              ? "text-muted-foreground/30 cursor-not-allowed"
                                              : isJobInQueue(job.id)
                                              ? "text-muted-foreground/50 cursor-not-allowed"
                                              : job.llm_score !== null
                                              ? "text-muted-foreground hover:text-violet-600"
                                              : "text-violet-500 hover:text-violet-600"
                                          }`}
                                          onClick={() => handleAnalyzeSingle(job.id!)}
                                          disabled={!hasValidDescription(job) || isJobInQueue(job.id) || isAnalyzing}
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
                                          : isJobInQueue(job.id)
                                          ? "Job is in analysis queue"
                                          : job.llm_score !== null
                                          ? "Re-analyze with AI"
                                          : "Analyze with AI"}
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                  {/* Hide/Unhide button */}
                                  {job.id && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-8 w-8"
                                          onClick={() =>
                                            job.is_hidden
                                              ? unhideMutation.mutate(job.id!)
                                              : hideMutation.mutate(job.id!)
                                          }
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
                            {expandedJobId === job.id && job.llm_notes && (
                              <TableRow className="bg-violet-50 dark:bg-violet-950/20">
                                <TableCell colSpan={14} className="py-4">
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
                                                banCompanyMutation.mutate(job.company);
                                              }}
                                              disabled={banCompanyMutation.isPending}
                                            >
                                              {banCompanyMutation.isPending ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                              ) : (
                                                <Ban className="h-4 w-4" />
                                              )}
                                              Ban Company
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Ban "{job.company}" - hides all their jobs and excludes from future searches
                                          </TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to{" "}
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedJobs.length)} of{" "}
                        {filteredAndSortedJobs.length} results
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                        >
                          First
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-1">
                          {/* Page numbers */}
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter(page => {
                              // Show first, last, current, and neighbors
                              return (
                                page === 1 ||
                                page === totalPages ||
                                Math.abs(page - currentPage) <= 1
                              );
                            })
                            .reduce((acc: (number | string)[], page, idx, arr) => {
                              // Add ellipsis where needed
                              if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                                acc.push("...");
                              }
                              acc.push(page);
                              return acc;
                            }, [])
                            .map((item, idx) =>
                              typeof item === "string" ? (
                                <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
                                  {item}
                                </span>
                              ) : (
                                <Button
                                  key={item}
                                  variant={currentPage === item ? "default" : "outline"}
                                  size="sm"
                                  onClick={() => setCurrentPage(item)}
                                  className="min-w-[36px]"
                                >
                                  {item}
                                </Button>
                              )
                            )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                        >
                          Last
                        </Button>
                      </div>
                    </div>
                  )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Notes Dialog */}
        <Dialog open={notesDialogJob !== null} onOpenChange={() => setNotesDialogJob(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-violet-500" />
                AI Analysis: {notesDialogJob?.title}
              </DialogTitle>
              <DialogDescription>
                {notesDialogJob?.company} • Score: {notesDialogJob?.llm_score}/100
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {notesDialogJob?.llm_analysis && (
                <div className="p-4 rounded-lg bg-muted/50">
                  <p className="font-medium text-sm mb-2">Summary</p>
                  <p className="text-sm">{notesDialogJob.llm_analysis}</p>
                </div>
              )}
              {notesDialogJob?.llm_notes && (
                <div className="p-4 rounded-lg border">
                  <p className="font-medium text-sm mb-2">Detailed Analysis</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {notesDialogJob.llm_notes}
                  </p>
                </div>
              )}
              {notesDialogJob?.description && (
                <div className="p-4 rounded-lg border border-dashed">
                  <p className="font-medium text-sm mb-2">Job Description</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap max-h-48 overflow-auto">
                    {notesDialogJob.description}
                  </p>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  const debugInfo = `=== DEBUG INFO ===
Job: ${notesDialogJob?.title || "N/A"}
Company: ${notesDialogJob?.company || "N/A"}
Score: ${notesDialogJob?.llm_score || "N/A"}/100

=== ANALYSIS ===
Summary: ${notesDialogJob?.llm_analysis || "N/A"}

Detailed Notes:
${notesDialogJob?.llm_notes || "N/A"}

=== JOB DESCRIPTION ===
${notesDialogJob?.description || "N/A"}`;
                  navigator.clipboard.writeText(debugInfo);
                  toast.success("Debug info copied to clipboard");
                }}
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy Debug
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setNotesDialogJob(null)}>
                  Close
                </Button>
                <a href={notesDialogJob?.job_url} target="_blank" rel="noopener noreferrer">
                  <Button>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Job
                  </Button>
                </a>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Nuclear Clear Confirmation Dialog */}
        <Dialog open={clearDialogOpen} onOpenChange={(open) => {
          setClearDialogOpen(open);
          if (!open) setClearConfirmText("");
        }}>
          <DialogContent className="border-red-500/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertOctagon className="h-5 w-5" />
                Clear All Job Listings
              </DialogTitle>
              <DialogDescription className="text-red-600/80">
                This action is irreversible. All {jobs.length} job listings will be permanently deleted from the database.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                  ⚠️ Warning: This will delete:
                </p>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
                  <li>All {jobs.length} saved job listings</li>
                  <li>All LLM analysis scores and notes</li>
                  <li>All applied/hidden status flags</li>
                </ul>
                  </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-red-600">DELETE</span> to confirm:
                </label>
                <Input
                  value={clearConfirmText}
                  onChange={(e) => setClearConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="font-mono border-red-300 focus:border-red-500 focus:ring-red-500"
                />
              </div>
            </div>
            <DialogFooter>
                    <Button
                      variant="outline"
                onClick={() => {
                  setClearDialogOpen(false);
                  setClearConfirmText("");
                }}
              >
                Cancel
                    </Button>
                    <Button
                variant="destructive"
                onClick={() => clearResultsMutation.mutate()}
                disabled={clearConfirmText !== "DELETE" || clearResultsMutation.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {clearResultsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Clear All Jobs
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clear Analysis Confirmation Dialog */}
        <Dialog open={clearAnalysisDialogOpen} onOpenChange={(open) => {
          setClearAnalysisDialogOpen(open);
          if (!open) setClearAnalysisConfirmText("");
        }}>
          <DialogContent className="border-orange-500/50">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-600">
                <Eraser className="h-5 w-5" />
                Clear All Analysis
              </DialogTitle>
              <DialogDescription className="text-orange-600/80">
                This will remove LLM analysis from all {analyzedCount} analyzed jobs. The job listings will remain.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                  This will clear:
                </p>
                <ul className="text-sm text-orange-700 dark:text-orange-300 space-y-1 list-disc list-inside">
                  <li>LLM scores from {analyzedCount} jobs</li>
                  <li>Analysis summaries and notes</li>
                  <li>Mismatch flags</li>
                </ul>
                <p className="text-sm text-orange-600 dark:text-orange-400 mt-3">
                  Job listings, applied status, and hidden status will be preserved.
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Type <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-orange-600">CLEAR</span> to confirm:
                </label>
                <Input
                  value={clearAnalysisConfirmText}
                  onChange={(e) => setClearAnalysisConfirmText(e.target.value)}
                  placeholder="Type CLEAR to confirm"
                  className="font-mono border-orange-300 focus:border-orange-500 focus:ring-orange-500"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setClearAnalysisDialogOpen(false);
                  setClearAnalysisConfirmText("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => clearAnalysisMutation.mutate(undefined)}
                disabled={clearAnalysisConfirmText !== "CLEAR" || clearAnalysisMutation.isPending}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {clearAnalysisMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Eraser className="h-4 w-4 mr-2" />
                )}
                Clear All Analysis
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}
