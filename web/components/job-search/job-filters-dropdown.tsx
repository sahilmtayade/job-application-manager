"use client";

import { SlidersHorizontal, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { SCORE_GOOD, SCORE_MODERATE } from "@/lib/constants/scoring";

/**
 * Filter state interface for multi-category aggregation
 */
export interface FilterState {
  analysisStatus: { analyzed: boolean; unanalyzed: boolean };
  applicationStatus: { applied: boolean; unapplied: boolean };
  appliedCompany: { applied: boolean; notApplied: boolean };
  visibility: { visible: boolean; hidden: boolean };
  matchQuality: { good: boolean; moderate: boolean; poor: boolean; mismatch: boolean };
  description: { hasDescription: boolean; noDescription: boolean };
}

/**
 * Default filter configuration
 */
export const DEFAULT_FILTERS: FilterState = {
  analysisStatus: { analyzed: true, unanalyzed: true },
  applicationStatus: { applied: false, unapplied: true },
  appliedCompany: { applied: true, notApplied: true },
  visibility: { visible: true, hidden: false },
  matchQuality: { good: true, moderate: true, poor: true, mismatch: true },
  description: { hasDescription: true, noDescription: true },
};

export interface JobFiltersDropdownProps {
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(
    category: K,
    option: keyof FilterState[K],
    value: boolean
  ) => void;
  onSelectAll: () => void;
}

/**
 * Check if all filters are selected
 */
export function isAllFiltersSelected(filters: FilterState): boolean {
  return (
    Object.values(filters.analysisStatus).every(Boolean) &&
    Object.values(filters.applicationStatus).every(Boolean) &&
    Object.values(filters.appliedCompany).every(Boolean) &&
    Object.values(filters.visibility).every(Boolean) &&
    Object.values(filters.matchQuality).every(Boolean) &&
    Object.values(filters.description).every(Boolean)
  );
}

/**
 * Count active filters (filters that exclude something)
 */
export function getActiveFilterCount(filters: FilterState): number {
  let count = 0;
  if (!filters.analysisStatus.analyzed || !filters.analysisStatus.unanalyzed) count++;
  if (!filters.applicationStatus.applied || !filters.applicationStatus.unapplied) count++;
  if (!filters.appliedCompany.applied || !filters.appliedCompany.notApplied) count++;
  if (!filters.visibility.visible || !filters.visibility.hidden) count++;
  if (
    !filters.matchQuality.good ||
    !filters.matchQuality.moderate ||
    !filters.matchQuality.poor ||
    !filters.matchQuality.mismatch
  )
    count++;
  if (!filters.description.hasDescription || !filters.description.noDescription) count++;
  return count;
}

export function JobFiltersDropdown({
  filters,
  onFilterChange,
  onSelectAll,
}: JobFiltersDropdownProps) {
  const activeCount = getActiveFilterCount(filters);
  const allSelected = isAllFiltersSelected(filters);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] ml-1">
              {activeCount}
            </Badge>
          )}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {/* Select All */}
        <DropdownMenuCheckboxItem checked={allSelected} onCheckedChange={onSelectAll}>
          <span className="font-medium">Select All</span>
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Analysis Status */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Analysis Status
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={filters.analysisStatus.analyzed}
          onCheckedChange={(checked) => onFilterChange("analysisStatus", "analyzed", checked)}
        >
          Analyzed
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filters.analysisStatus.unanalyzed}
          onCheckedChange={(checked) => onFilterChange("analysisStatus", "unanalyzed", checked)}
        >
          Unanalyzed
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Application Status */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Application Status
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={filters.applicationStatus.applied}
          onCheckedChange={(checked) => onFilterChange("applicationStatus", "applied", checked)}
        >
          Applied
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filters.applicationStatus.unapplied}
          onCheckedChange={(checked) => onFilterChange("applicationStatus", "unapplied", checked)}
        >
          Unapplied
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Applied Company (company-level) */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Company History
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={filters.appliedCompany.applied}
          onCheckedChange={(checked) => onFilterChange("appliedCompany", "applied", checked)}
        >
          Applied to company
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filters.appliedCompany.notApplied}
          onCheckedChange={(checked) => onFilterChange("appliedCompany", "notApplied", checked)}
        >
          New company
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Visibility */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">Visibility</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={filters.visibility.visible}
          onCheckedChange={(checked) => onFilterChange("visibility", "visible", checked)}
        >
          Visible
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filters.visibility.hidden}
          onCheckedChange={(checked) => onFilterChange("visibility", "hidden", checked)}
        >
          Hidden
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Match Quality */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Match Quality
        </DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={filters.matchQuality.good}
          onCheckedChange={(checked) => onFilterChange("matchQuality", "good", checked)}
        >
          Good ({SCORE_GOOD}+)
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filters.matchQuality.moderate}
          onCheckedChange={(checked) => onFilterChange("matchQuality", "moderate", checked)}
        >
          Moderate ({SCORE_MODERATE}-{SCORE_GOOD - 1})
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filters.matchQuality.poor}
          onCheckedChange={(checked) => onFilterChange("matchQuality", "poor", checked)}
        >
          Poor (below {SCORE_MODERATE})
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filters.matchQuality.mismatch}
          onCheckedChange={(checked) => onFilterChange("matchQuality", "mismatch", checked)}
        >
          Mismatch flagged
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />

        {/* Description */}
        <DropdownMenuLabel className="text-xs text-muted-foreground">Description</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={filters.description.hasDescription}
          onCheckedChange={(checked) => onFilterChange("description", "hasDescription", checked)}
        >
          Has description
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={filters.description.noDescription}
          onCheckedChange={(checked) => onFilterChange("description", "noDescription", checked)}
        >
          No description
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

