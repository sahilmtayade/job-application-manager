import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseISO, format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a date string (YYYY-MM-DD) as a local date, not UTC.
 * This prevents timezone issues where "2024-12-30" shows as "12/29" in US timezones.
 */
export function parseLocalDate(dateString: string): Date {
  return parseISO(dateString);
}

/**
 * Format a date string for display
 */
export function formatDate(dateString: string, formatStr: string = "MMM d, yyyy"): string {
  const date = parseLocalDate(dateString);
  return format(date, formatStr);
}
