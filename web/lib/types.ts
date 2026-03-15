/**
 * TypeScript types for JAM API
 */

export type ApplicationStatus =
  | "applied"
  | "screening"
  | "interviewing"
  | "offer"
  | "accepted"
  | "rejected"
  | "withdrawn"
  | "ghosted"
  | "scam";

export type WorkLocation = "remote" | "onsite" | "hybrid";

export interface Application {
  id: number;
  company_id: number;
  company_name: string | null;
  company_name_raw: string;
  position: string;
  current_status: ApplicationStatus | null;
  status_updated_at: string | null;
  applied_at: string;
  source: string | null;
  url: string | null;
  notes: string | null;
  work_location: WorkLocation | null;
  location_address: string | null;  // City/address for hybrid/onsite jobs
  is_deleted: boolean;
  deleted_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  file_count: number;  // Number of attached files
}

export interface ApplicationCreate {
  company_name: string;
  position: string;
  applied_at: string;
  source?: string | null;
  url?: string | null;
  notes?: string | null;
  work_location?: WorkLocation | null;
  location_address?: string | null;  // City/address for hybrid/onsite jobs
  initial_status?: ApplicationStatus;
  company_id?: number | null;
}

export interface ApplicationUpdate {
  company_name?: string | null;  // Changing company will cleanup orphaned companies
  position?: string | null;
  source?: string | null;
  url?: string | null;
  notes?: string | null;
  work_location?: WorkLocation | null;
  location_address?: string | null;  // City/address for hybrid/onsite jobs
}

export interface ApplicationListResponse {
  applications: Application[];
  total: number;
}

export interface Company {
  id: number;
  name: string;
  application_count: number;
  created_at: string | null;
}

export interface CompanyListResponse {
  companies: Company[];
  total: number;
}

export interface StatsSummary {
  total: number;
  active: number;
  companies: number;
  by_status: Record<string, number>;
  recent_activity: number;
  today: number;
  this_week: number;
  last_week: number;
  this_month: number;
  current_streak: number;
  longest_streak: number;
  streak_at_risk: boolean;
}

export interface TrendDataPoint {
  date: string;
  count: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  threshold: number;
  progress: number;
  unlocked: boolean;
  reset_period?: string | null;  // "daily", "weekly", "monthly" for recurring achievements
}

export interface AchievementsList {
  achievements: Achievement[];
  total_unlocked: number;
  total: number;
}

export interface WeeklyComparison {
  this_week_apps: number;
  last_week_apps: number;
  apps_change_pct: number;
  this_week_interviews: number;
  last_week_interviews: number;
  interviews_change_pct: number;
  this_week_responses: number;
  last_week_responses: number;
  responses_change_pct: number;
  current_streak: number;
  streak_at_risk: boolean;
}

export interface StatsTrends {
  data: TrendDataPoint[];
  period: string;
}

export interface FunnelStage {
  count: number;
  rate: number;
}

export interface StatsFunnel {
  stages: Record<string, FunnelStage>;
}

export interface SourceStats {
  source: string;
  total: number;
  success_count: number;
  success_rate: number;
}

export interface StatsSources {
  sources: SourceStats[];
}

export interface CumulativeStats {
  total_applications: number;
  total_companies: number;
  days_since_start: number;
  total_days_active: number;
  avg_per_day: number;
  avg_per_week: number;
  most_active_day: string | null;
  busiest_month: string | null;
  total_responses: number;
  response_rate: number;
}

export interface Config {
  key: string;
  value: string | null;
}

export interface ConfigList {
  config: Record<string, string | null>;
}

// Status color mapping
export const statusColors: Record<ApplicationStatus, string> = {
  applied: "bg-blue-500",
  screening: "bg-cyan-500",
  interviewing: "bg-yellow-500",
  offer: "bg-green-500",
  accepted: "bg-emerald-600",
  rejected: "bg-red-500",
  withdrawn: "bg-gray-500",
  ghosted: "bg-gray-400",
  scam: "bg-orange-600",
};

export const statusLabels: Record<ApplicationStatus, string> = {
  applied: "Applied",
  screening: "Screening",
  interviewing: "Interviewing",
  offer: "Offer",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  ghosted: "Ghosted",
  scam: "Scam",
};

export const workLocationLabels: Record<WorkLocation, string> = {
  remote: "Remote",
  onsite: "On-site",
  hybrid: "Hybrid",
};

// Goal types
export type GoalType = "daily" | "weekly";

export interface Goal {
  id: number;
  goal_type: GoalType;
  target_count: number;
  period_start: string;
  period_end: string;
  created_at: string | null;
}

export interface GoalProgress {
  goal: Goal | null;
  current: number;
  target: number;
  percentage: number;
  remaining: number;
  goal_type: GoalType;
}

export interface CurrentGoals {
  daily: GoalProgress | null;
  weekly: GoalProgress | null;
}

export interface GoalListResponse {
  goals: Goal[];
  total: number;
}

export interface GoalCreate {
  goal_type: GoalType;
  target_count: number;
}

// Note types
export interface Note {
  id: number;
  application_id: number;
  content: string;
  created_at: string | null;
}

export interface NoteListResponse {
  notes: Note[];
  total: number;
}

export interface NoteCreate {
  content: string;
}

// Alias types
export interface Alias {
  id: number;
  company_id: number;
  alias: string;
  created_at: string | null;
}

export interface AliasListResponse {
  company_id: number;
  aliases: Alias[];
}

// Backup types
export interface Backup {
  name: string;
  size: number;
  created: string;
}

export interface BackupListResponse {
  backups: Backup[];
  total: number;
}

// Status change and event types
export interface StatusChangeRequest {
  new_status: ApplicationStatus;
  notes?: string | null;
}

export interface ApplicationEvent {
  id: number;
  application_id: number;
  from_status: ApplicationStatus | null;
  to_status: ApplicationStatus;
  timestamp: string;
  notes: string | null;
}

export interface ApplicationEventsResponse {
  events: ApplicationEvent[];
  total: number;
}

export interface ValidStatusesResponse {
  current_status: ApplicationStatus | null;
  valid_next_statuses: ApplicationStatus[];
}

// Banned company types
export interface BannedCompany {
  id: number;
  name: string;
  reason: string | null;
  created_at: string | null;
}

export interface BannedCompanyCreate {
  name: string;
  reason?: string | null;
}

export interface BannedCompanyListResponse {
  banned_companies: BannedCompany[];
  total: number;
}

export interface BannedCheckResponse {
  name: string;
  is_banned: boolean;
  banned: BannedCompany | null;
}

// Banned source types
export interface BannedSource {
  id: number;
  name: string;
  reason: string | null;
  created_at: string | null;
}

export interface BannedSourceCreate {
  name: string;
  reason?: string | null;
}

export interface BannedSourceListResponse {
  banned_sources: BannedSource[];
  total: number;
}

export interface BannedSourceCheckResponse {
  name: string;
  is_banned: boolean;
  banned: BannedSource | null;
}

// File types
export interface ApplicationFile {
  id: number;
  application_id: number;
  filename: string;
  mime_type: string;
  file_size: number;
  created_at: string | null;
}

export interface FileListResponse {
  files: ApplicationFile[];
  total: number;
}

// LLM types
export interface ExtractedJobData {
  company_name?: string | null;
  position?: string | null;
  source?: string | null;
  url?: string | null;
  work_location?: WorkLocation | null;
  location_address?: string | null;
  notes?: string | null;
}

export interface LLMStatus {
  available: boolean;
  url: string;
  model: string;
  model_ready: boolean;
  text_model?: string;
  text_model_ready: boolean;
  available_models: string[];
}

export interface LLMConfig {
  url: string;
  api_mode: "openai" | "ollama";
  vision_model: string;
  text_model: string;
  temperature: number;
  max_tokens: number;
  concurrency: number;
}

export interface LLMConfigUpdate {
  url?: string;
  api_mode?: "openai" | "ollama";
  vision_model?: string;
  text_model?: string;
  temperature?: number;
  max_tokens?: number;
  concurrency?: number;
}

export interface LLMModelInfo {
  name: string;
  size_bytes?: number | null;
}

export interface LLMModelsResponse {
  available: boolean;
  api_mode: "openai" | "ollama";
  system_memory_gb?: number | null;
  models: LLMModelInfo[];
}

// Job Fit Analysis types
export interface SkillsMatch {
  matched: string[];
  missing: string[];
  bonus: string[];
}

export interface ExperienceMatch {
  required_level: string;
  assessment: string;
  compatible: boolean;
}

export interface ScamAnalysis {
  risk_level: "low" | "medium" | "high";
  warnings: string[];
  legitimate_signals: string[];
}

export interface FitAnalysis {
  score: number;
  summary: string;
  compatible: boolean;
  skills_match: SkillsMatch;
  experience_match: ExperienceMatch;
  red_flags: string[];
  scam_analysis: ScamAnalysis;
  recommendations: string[];
}

// Resume storage types
export interface ResumeInfo {
  has_resume: boolean;
  filename?: string | null;
  mime_type?: string | null;
  uploaded_at?: string | null;
}

export interface ResumeData extends ResumeInfo {
  data?: string | null;
}

// Job Search types
export interface JobListing {
  id?: number | null;
  title: string;
  company: string;
  location: string | null;
  date_posted: string | null;
  job_url: string;
  site_source: string;
  description?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  job_type?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  llm_score?: number | null;
  llm_analysis?: string | null;
  llm_notes?: string | null;
  llm_analyzed_at?: string | null;
  is_mismatch?: boolean;
  is_hidden?: boolean;
  is_applied?: boolean;
  applied_at?: string | null;
  applied_company?: boolean;  // True if user has applied to this company before
  matched_skills?: string[] | null;
  missing_skills?: string[] | null;
  search_offset?: number;  // Offset used when this job was found
}

export interface JobSearchResponse {
  jobs: JobListing[];
  total: number;
  new_jobs: number;
  updated_jobs: number;
  keywords_used: string[];
  locations_searched: string[];
}

export interface SavedJobSearchResponse {
  jobs: JobListing[];
  total: number;
  analyzed_count: number;
  unanalyzed_count: number;
  keywords?: string | null;
  last_seen_at?: string | null;
}

export interface JobSearchResultsInfo {
  has_results: boolean;
  total: number;
  recent_24h: number;
  analyzed_count: number;
  unanalyzed_count: number;
  keywords?: string | null;
  last_seen_at?: string | null;
}

export interface JobSearchKeywords {
  keywords: string[];
  raw: string;
}

// Job Search Filters
export interface JobFilter {
  id: number;
  keyword: string;
  filter_type: "positive" | "negative";
  weight: number;
  source?: string | null;
  match_count: number;
  created_at: string;
  updated_at: string;
}

export interface JobFiltersResponse {
  filters: JobFilter[];
  total: number;
  stats: {
    positive: { count: number; total_matches: number; avg_weight: number };
    negative: { count: number; total_matches: number; avg_weight: number };
  };
}

// Suggested Bans
export interface SuggestedBan {
  id: number;
  company_name: string;
  reason?: string | null;
  job_url?: string | null;
  llm_confidence?: number | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface SuggestedBansResponse {
  suggestions: SuggestedBan[];
  total: number;
  pending_count: number;
}

// LLM Analysis Status
export interface LLMAnalysisStatus {
  available: boolean;
  model: string;
  model_ready: boolean;
  available_models: string[];
  unanalyzed_count: number;
}

