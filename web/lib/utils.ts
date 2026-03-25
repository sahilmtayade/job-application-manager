import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { parseISO, format } from "date-fns"
import { API_URL } from "./api"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCleanLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  // Fallback for deprecated clearbit URLs to use our new API proxy
  if (url.includes("clearbit.com")) {
      const match = url.match(/clearbit\.com\/([^?&/]+)/);
      if (match && match[1]) {
          return `${API_URL}/api/logos/${match[1]}`;
      }
      return null;
  }
  // Properly form relative local proxy URLs
  if (url.startsWith("/")) {
      return `${API_URL}${url}`;
  }
  return url;
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
