/**
 * Scoring thresholds and quality assessment constants
 */

// Score thresholds for job match quality
export const SCORE_GOOD = 70;       // Good match (70-100)
export const SCORE_MODERATE = 40;   // Moderate match (40-69)
export const SCORE_POOR_MAX = 39;   // Poor match (0-39)

// Collected thresholds for easy import
export const SCORE_THRESHOLDS = {
  good: SCORE_GOOD,
  moderate: SCORE_MODERATE,
  poorMax: SCORE_POOR_MAX,
} as const;

// Quality categories for job match scores
export type ScoreQuality = "good" | "moderate" | "poor" | "unscored";

/**
 * Determine the quality category for a given score
 */
export function getScoreQuality(score: number | null | undefined): ScoreQuality {
  if (score === null || score === undefined) return "unscored";
  if (score >= SCORE_GOOD) return "good";
  if (score >= SCORE_MODERATE) return "moderate";
  return "poor";
}

/**
 * Get background color class for a score
 */
export function getScoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "bg-gray-200 text-gray-600";
  if (score >= SCORE_GOOD) return "bg-green-500 text-white";
  if (score >= SCORE_MODERATE) return "bg-yellow-500 text-white";
  return "bg-red-500 text-white";
}

/**
 * Get text color class for a score (for non-badge contexts)
 */
export function getScoreTextColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-gray-500";
  if (score >= SCORE_GOOD) return "text-green-500";
  if (score >= SCORE_MODERATE) return "text-orange-500";
  return "text-red-500";
}

