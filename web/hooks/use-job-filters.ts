"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { FilterState, DEFAULT_FILTERS, isAllFiltersSelected, getActiveFilterCount } from "@/components/job-search/job-filters-dropdown";
import { SCORE_GOOD, SCORE_MODERATE } from "@/lib/constants/scoring";
import type { JobListing } from "@/lib/types";

const FILTERS_STORAGE_KEY = "job-search-filters";

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

export interface UseJobFiltersOptions {
  storageKey?: string;
  defaultFilters?: FilterState;
  onFiltersChange?: () => void;
}

export interface UseJobFiltersReturn {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  updateFilter: <K extends keyof FilterState>(
    category: K,
    option: keyof FilterState[K],
    value: boolean
  ) => void;
  selectAllFilters: () => void;
  resetFilters: () => void;
  activeFilterCount: number;
  isAllSelected: boolean;
  filterJobs: (jobs: JobListing[]) => JobListing[];
}

/**
 * Custom hook for managing job search filter state with localStorage persistence
 */
export function useJobFilters(options: UseJobFiltersOptions = {}): UseJobFiltersReturn {
  const {
    storageKey = FILTERS_STORAGE_KEY,
    defaultFilters = DEFAULT_FILTERS,
    onFiltersChange,
  } = options;

  // Initialize from localStorage or defaults
  const [filters, setFilters] = useState<FilterState>(() => {
    if (typeof window === "undefined") return defaultFilters;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle any missing fields
        return {
          ...defaultFilters,
          ...parsed,
          analysisStatus: { ...defaultFilters.analysisStatus, ...parsed.analysisStatus },
          applicationStatus: { ...defaultFilters.applicationStatus, ...parsed.applicationStatus },
          appliedCompany: { ...defaultFilters.appliedCompany, ...parsed.appliedCompany },
          visibility: { ...defaultFilters.visibility, ...parsed.visibility },
          matchQuality: { ...defaultFilters.matchQuality, ...parsed.matchQuality },
          description: { ...defaultFilters.description, ...parsed.description },
        };
      }
    } catch {
      // Ignore parse errors
    }
    return defaultFilters;
  });

  // Persist to localStorage when filters change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    }
  }, [filters, storageKey]);

  // Update a single filter option
  const updateFilter = useCallback(
    <K extends keyof FilterState>(
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
      onFiltersChange?.();
    },
    [onFiltersChange]
  );

  // Select all filters
  const selectAllFilters = useCallback(() => {
    setFilters({
      analysisStatus: { analyzed: true, unanalyzed: true },
      applicationStatus: { applied: true, unapplied: true },
      appliedCompany: { applied: true, notApplied: true },
      visibility: { visible: true, hidden: true },
      matchQuality: { good: true, moderate: true, poor: true, mismatch: true },
      description: { hasDescription: true, noDescription: true },
    });
    onFiltersChange?.();
  }, [onFiltersChange]);

  // Reset to defaults
  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
    onFiltersChange?.();
  }, [defaultFilters, onFiltersChange]);

  // Active filter count
  const activeFilterCount = useMemo(() => getActiveFilterCount(filters), [filters]);

  // All selected check
  const isAllSelected = useMemo(() => isAllFiltersSelected(filters), [filters]);

  // Filter jobs based on current filter state
  const filterJobs = useCallback(
    (jobs: JobListing[]): JobListing[] => {
      return jobs.filter((job) => {
        const isAnalyzed = job.llm_score !== null && job.llm_score !== undefined;

        // Analysis Status
        const matchesAnalysis =
          (isAnalyzed && filters.analysisStatus.analyzed) ||
          (!isAnalyzed && filters.analysisStatus.unanalyzed);
        if (!matchesAnalysis) return false;

        // Application Status
        const matchesApplication =
          (job.is_applied && filters.applicationStatus.applied) ||
          (!job.is_applied && filters.applicationStatus.unapplied);
        if (!matchesApplication) return false;

        // Applied Company (company-level)
        const matchesAppliedCompany =
          (job.applied_company && filters.appliedCompany.applied) ||
          (!job.applied_company && filters.appliedCompany.notApplied);
        if (!matchesAppliedCompany) return false;

        // Visibility
        const matchesVisibility =
          (!job.is_hidden && filters.visibility.visible) ||
          (job.is_hidden && filters.visibility.hidden);
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

        // Description
        const hasDesc = hasValidDescription(job);
        const matchesDescription =
          (hasDesc && filters.description.hasDescription) ||
          (!hasDesc && filters.description.noDescription);
        if (!matchesDescription) return false;

        return true;
      });
    },
    [filters]
  );

  return {
    filters,
    setFilters,
    updateFilter,
    selectAllFilters,
    resetFilters,
    activeFilterCount,
    isAllSelected,
    filterJobs,
  };
}

