"use client";

import { useState, useCallback, useMemo } from "react";

export interface UseJobSelectionOptions<T extends { id?: number | null }> {
  /**
   * Items currently visible/filterable (subset of all items)
   * Used for "select all on page" functionality
   */
  pageItems?: T[];
}

export interface UseJobSelectionReturn {
  selectedIds: Set<number>;
  isSelected: (id: number | null | undefined) => boolean;
  toggleSelection: (id: number) => void;
  selectAll: (ids: number[]) => void;
  deselectAll: (ids?: number[]) => void;
  clearSelection: () => void;
  toggleSelectAllOnPage: () => void;
  selectedCount: number;
  /** True if all items on the current page are selected */
  allOnPageSelected: boolean;
  /** True if some (but not all) items on page are selected */
  someOnPageSelected: boolean;
}

/**
 * Custom hook for managing job selection state (checkbox selection)
 *
 * @example
 * ```tsx
 * const { selectedIds, toggleSelection, clearSelection, allOnPageSelected } = useJobSelection({
 *   pageItems: paginatedJobs,
 * });
 * ```
 */
export function useJobSelection<T extends { id?: number | null }>(
  options: UseJobSelectionOptions<T> = {}
): UseJobSelectionReturn {
  const { pageItems = [] } = options;

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Get valid IDs from page items
  const pageItemIds = useMemo(() => {
    return pageItems
      .map((item) => item.id)
      .filter((id): id is number => id !== null && id !== undefined);
  }, [pageItems]);

  // Check if a specific ID is selected
  const isSelected = useCallback(
    (id: number | null | undefined): boolean => {
      if (id === null || id === undefined) return false;
      return selectedIds.has(id);
    },
    [selectedIds]
  );

  // Toggle selection for a single item
  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Select multiple items
  const selectAll = useCallback((ids: number[]) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  // Deselect specific items or all
  const deselectAll = useCallback((ids?: number[]) => {
    if (ids) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(new Set());
    }
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Check selection state for current page
  const allOnPageSelected = useMemo(() => {
    if (pageItemIds.length === 0) return false;
    return pageItemIds.every((id) => selectedIds.has(id));
  }, [pageItemIds, selectedIds]);

  const someOnPageSelected = useMemo(() => {
    if (pageItemIds.length === 0) return false;
    return pageItemIds.some((id) => selectedIds.has(id));
  }, [pageItemIds, selectedIds]);

  // Toggle select all on current page
  const toggleSelectAllOnPage = useCallback(() => {
    if (allOnPageSelected) {
      // Deselect all on page
      deselectAll(pageItemIds);
    } else {
      // Select all on page
      selectAll(pageItemIds);
    }
  }, [allOnPageSelected, pageItemIds, selectAll, deselectAll]);

  return {
    selectedIds,
    isSelected,
    toggleSelection,
    selectAll,
    deselectAll,
    clearSelection,
    toggleSelectAllOnPage,
    selectedCount: selectedIds.size,
    allOnPageSelected,
    someOnPageSelected,
  };
}

