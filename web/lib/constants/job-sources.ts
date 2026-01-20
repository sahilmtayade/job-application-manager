/**
 * Job source/platform configuration constants
 */

export interface JobSource {
  id: string;
  name: string;
  color: string;
}

/**
 * Available job sources/platforms for searching
 */
export const JOB_SOURCES: readonly JobSource[] = [
  { id: "linkedin", name: "LinkedIn", color: "bg-blue-600 text-white" },
  { id: "indeed", name: "Indeed", color: "bg-purple-600 text-white" },
  { id: "glassdoor", name: "Glassdoor", color: "bg-green-600 text-white" },
  { id: "zip_recruiter", name: "ZipRecruiter", color: "bg-emerald-600 text-white" },
  { id: "google", name: "Google", color: "bg-red-500 text-white" },
  { id: "bayt", name: "Bayt", color: "bg-orange-600 text-white" },
  { id: "bdjobs", name: "BDJobs", color: "bg-cyan-600 text-white" },
  { id: "naukri", name: "Naukri", color: "bg-pink-600 text-white" },
] as const;

/**
 * Default enabled sources - all sources enabled by default
 */
export const DEFAULT_ENABLED_SOURCES = new Set(JOB_SOURCES.map(s => s.id));

/**
 * Source ID to color mapping for badges
 */
export const SITE_COLORS: Record<string, string> = {
  linkedin: "bg-blue-600 text-white",
  indeed: "bg-purple-600 text-white",
  glassdoor: "bg-green-600 text-white",
  zip_recruiter: "bg-emerald-600 text-white",
  google: "bg-red-500 text-white",
  bayt: "bg-orange-600 text-white",
  bdjobs: "bg-cyan-600 text-white",
  naukri: "bg-pink-600 text-white",
};

/**
 * Source ID to display name mapping
 */
export const SITE_NAMES: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  zip_recruiter: "ZipRecruiter",
  google: "Google",
  bayt: "Bayt",
  bdjobs: "BDJobs",
  naukri: "Naukri",
};

/**
 * Format a site source ID to its display name
 */
export function formatSiteName(site: string): string {
  return SITE_NAMES[site] || site;
}

/**
 * Get the color class for a site source
 */
export function getSiteColor(site: string): string {
  return SITE_COLORS[site] || "bg-gray-500 text-white";
}

