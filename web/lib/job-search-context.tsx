"use client";

import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { jobSearchApi } from "@/lib/api";

// Types for progress tracking
interface SearchProgress {
  keyword: string;
  location: string;
  site?: string;
  progress: number;
  total: number;
  found: number;
  elapsedMs?: number;
  etaMs?: number;
}

interface AnalysisProgress {
  current: number;
  total: number;
  jobTitle?: string;
  elapsedMs?: number;
  etaMs?: number;
}

interface JobSearchContextType {
  // Search state
  isSearching: boolean;
  searchProgress: SearchProgress | null;

  // Analysis state
  isAnalyzing: boolean;
  analysisProgress: AnalysisProgress | null;
  queuedJobIds: Set<number>;
  analyzingJobId: number | null;

  // Actions
  handleSearch: (sites?: string[], offset?: number) => Promise<void>;
  runAnalysis: (options: { limit?: number; jobIds?: number[] }) => Promise<void>;
  handleSearchAndAnalyze: (sites?: string[], offset?: number) => Promise<void>;

  // Helpers
  isJobInQueue: (jobId: number | null | undefined) => boolean;
}

const JobSearchContext = createContext<JobSearchContextType | undefined>(undefined);

export function JobSearchProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchProgress, setSearchProgress] = useState<SearchProgress | null>(null);

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<AnalysisProgress | null>(null);
  const [queuedJobIds, setQueuedJobIds] = useState<Set<number>>(new Set());
  const [analyzingJobId, setAnalyzingJobId] = useState<number | null>(null);

  // Search handler with streaming
  const handleSearch = useCallback(async (sites?: string[], offset?: number) => {
    setIsSearching(true);
    setSearchProgress(null);
    let totalFound = 0;

    try {
      await jobSearchApi.search({ sites, offset }, (data) => {
        if (data.type === "searching") {
          setSearchProgress((prev) => ({
            keyword: data.keyword || "",
            location: data.location || "",
            site: data.site,
            progress: data.progress || prev?.progress || 0,
            total: data.total_searches || prev?.total || 0,
            found: totalFound,
            elapsedMs: data.elapsed_ms,
            // Preserve ETA from previous state
            etaMs: prev?.etaMs,
          }));
        } else if (data.type === "found") {
          totalFound += data.count || 0;
          setSearchProgress((prev) => prev ? {
            ...prev,
            found: totalFound,
            site: data.site,
            progress: data.progress || prev.progress,
            total: data.total_searches || prev.total,
            elapsedMs: data.elapsed_ms,
            etaMs: data.eta_ms,
          } : null);
          // Refresh results table after each batch
          queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
        } else if (data.type === "complete") {
          const totalSeconds = data.total_time_ms ? Math.round(data.total_time_ms / 1000) : 0;
          toast.success(`Found ${data.total} jobs (${data.new_jobs} new, ${data.updated_jobs} updated) in ${totalSeconds}s`, {
            duration: Infinity,
            closeButton: true,  // Shows X button to dismiss
          });
          queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
          queryClient.invalidateQueries({ queryKey: ["job-search-analysis-status"] });
        } else if (data.type === "error" && data.message) {
          console.error("Search error:", data.message);
        }
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to search jobs");
    } finally {
      setIsSearching(false);
      setSearchProgress(null);
    }
  }, [queryClient]);

  // Analysis handler with streaming
  const runAnalysis = useCallback(async (options: { limit?: number; jobIds?: number[] }) => {
    setIsAnalyzing(true);
    setAnalysisProgress(null);

    try {
      await jobSearchApi.analyzeJobs(options, (data) => {
        if (data.type === "start" && data.queued_ids) {
          // Set initial queue state
          setQueuedJobIds(new Set(data.queued_ids));
          setAnalyzingJobId(null);
        } else if (data.type === "analyzing") {
          // Update analyzing state - remove from queue, set as currently analyzing
          setAnalyzingJobId(data.job_id || null);
          if (data.job_id) {
            setQueuedJobIds((prev) => {
              const next = new Set(prev);
              next.delete(data.job_id!);
              return next;
            });
          }
          setAnalysisProgress({
            current: data.current || 0,
            total: data.total || 0,
            jobTitle: data.job_title,
          });
        } else if (data.type === "analyzed") {
          // Job completed - clear analyzing state, update timing
          setAnalyzingJobId((prev) => (prev === data.job_id ? null : prev));
          setAnalysisProgress((prev) => prev ? {
            ...prev,
            current: data.completed || prev.current,
            elapsedMs: data.elapsed_ms,
            etaMs: data.eta_ms,
          } : null);
          // Refetch results after each job is analyzed
          queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
        } else if (data.type === "complete") {
          const totalSeconds = data.total_time_ms ? Math.round(data.total_time_ms / 1000) : 0;
          toast.success(`Analyzed ${data.analyzed} jobs in ${totalSeconds}s`);
          queryClient.invalidateQueries({ queryKey: ["job-search-results"] });
          queryClient.invalidateQueries({ queryKey: ["job-search-analysis-status"] });
        } else if (data.type === "error") {
          toast.error(data.message || "Analysis error");
        }
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(null);
      setQueuedJobIds(new Set());
      setAnalyzingJobId(null);
    }
  }, [queryClient]);

  // Combined search and analyze
  const handleSearchAndAnalyze = useCallback(async (sites?: string[], offset?: number) => {
    await handleSearch(sites, offset);
    // After search completes, analyze all unanalyzed jobs
    await runAnalysis({ limit: 0 }); // 0 means all
  }, [handleSearch, runAnalysis]);

  // Helper to check if a job is in queue or being analyzed
  const isJobInQueue = useCallback(
    (jobId: number | null | undefined): boolean => {
      if (!jobId) return false;
      return queuedJobIds.has(jobId) || analyzingJobId === jobId;
    },
    [queuedJobIds, analyzingJobId]
  );

  return (
    <JobSearchContext.Provider
      value={{
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
      }}
    >
      {children}
    </JobSearchContext.Provider>
  );
}

export function useJobSearch() {
  const context = useContext(JobSearchContext);
  if (context === undefined) {
    throw new Error("useJobSearch must be used within a JobSearchProvider");
  }
  return context;
}

