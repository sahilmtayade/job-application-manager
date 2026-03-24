/**
 * API client for JAM backend
 */

import type {
    AchievementsList,
    Alias,
    AliasListResponse,
    Application,
    ApplicationCreate,
    ApplicationEvent,
    ApplicationEventsResponse,
    ApplicationFile,
    ApplicationListResponse,
    ApplicationUpdate,
    BackupListResponse,
    BannedCheckResponse,
    BannedCompany,
    BannedCompanyCreate,
    BannedCompanyListResponse,
    BannedSource,
    BannedSourceCheckResponse,
    BannedSourceCreate,
    BannedSourceListResponse,
    Company,
    CompanyListResponse,
    ConfigList,
    CumulativeStats,
    CurrentGoals,
    ExtractedJobData,
    FileListResponse,
    FitAnalysis,
    Goal,
    GoalCreate,
    JobFilter,
    JobFiltersResponse,
    JobSearchKeywords,
    JobSearchResultsInfo,
    LLMAnalysisStatus,
    LLMConfig,
    LLMConfigUpdate,
    LLMModelsResponse,
    LLMStatus,
    Note,
    ResumeData,
    ResumeInfo,
    SavedJobSearchResponse,
    StatsFunnel,
    StatsSources,
    StatsSummary,
    StatsTrends,
    StatusChangeRequest,
    ValidStatusesResponse,
    WeeklyComparison
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new ApiError(response.status, error.detail || "Request failed");
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Applications API
export const applicationsApi = {
  list: async (params?: {
    all?: boolean;
    status?: string;
    company_id?: number;
    since?: string;
    limit?: number;
  }): Promise<ApplicationListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.all) searchParams.set("all", "true");
    if (params?.status) searchParams.set("status", params.status);
    if (params?.company_id) searchParams.set("company_id", params.company_id.toString());
    if (params?.since) searchParams.set("since", params.since);
    if (params?.limit) searchParams.set("limit", params.limit.toString());

    const query = searchParams.toString();
    return fetchApi<ApplicationListResponse>(`/api/applications${query ? `?${query}` : ""}`);
  },

  get: async (id: number, all?: boolean): Promise<Application> => {
    const query = all ? "?all=true" : "";
    return fetchApi<Application>(`/api/applications/${id}${query}`);
  },

  create: async (data: ApplicationCreate): Promise<Application> => {
    return fetchApi<Application>("/api/applications", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  update: async (id: number, data: ApplicationUpdate): Promise<Application> => {
    return fetchApi<Application>(`/api/applications/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number, hard?: boolean): Promise<void> => {
    const query = hard ? "?hard=true" : "";
    return fetchApi<void>(`/api/applications/${id}${query}`, {
      method: "DELETE",
    });
  },

  restore: async (id: number): Promise<Application> => {
    return fetchApi<Application>(`/api/applications/${id}/restore`, {
      method: "POST",
    });
  },

  getUniqueSources: async (): Promise<string[]> => {
    const response = await fetchApi<{ sources: string[] }>("/api/applications/sources/unique");
    return response.sources;
  },

  getUniquePositions: async (): Promise<string[]> => {
    const response = await fetchApi<{ positions: string[] }>("/api/applications/positions/unique");
    return response.positions;
  },

  // Event management
  getEvents: async (id: number): Promise<ApplicationEventsResponse> => {
    return fetchApi<ApplicationEventsResponse>(`/api/applications/${id}/events`);
  },

  changeStatus: async (id: number, data: StatusChangeRequest): Promise<Application> => {
    return fetchApi<Application>(`/api/applications/${id}/status`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getValidNextStatuses: async (id: number): Promise<ValidStatusesResponse> => {
    return fetchApi<ValidStatusesResponse>(`/api/applications/${id}/status/valid-next`);
  },

  deleteEvent: async (id: number, eventId: number): Promise<void> => {
    return fetchApi<void>(`/api/applications/${id}/events/${eventId}`, {
      method: "DELETE",
    });
  },

  updateEvent: async (
    id: number,
    eventId: number,
    data: { to_status?: string; notes?: string }
  ): Promise<ApplicationEvent> => {
    return fetchApi<ApplicationEvent>(`/api/applications/${id}/events/${eventId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

// Stats API
export const statsApi = {
  summary: async (params?: { since?: string; all?: boolean }): Promise<StatsSummary> => {
    const searchParams = new URLSearchParams();
    if (params?.since) searchParams.set("since", params.since);
    if (params?.all) searchParams.set("all", "true");

    const query = searchParams.toString();
    return fetchApi<StatsSummary>(`/api/stats/summary${query ? `?${query}` : ""}`);
  },

  trends: async (params?: {
    since?: string;
    group_by?: string;
    all?: boolean;
  }): Promise<StatsTrends> => {
    const searchParams = new URLSearchParams();
    if (params?.since) searchParams.set("since", params.since);
    if (params?.group_by) searchParams.set("group_by", params.group_by);
    if (params?.all) searchParams.set("all", "true");

    const query = searchParams.toString();
    return fetchApi<StatsTrends>(`/api/stats/trends${query ? `?${query}` : ""}`);
  },

  funnel: async (params?: { since?: string; all?: boolean }): Promise<StatsFunnel> => {
    const searchParams = new URLSearchParams();
    if (params?.since) searchParams.set("since", params.since);
    if (params?.all) searchParams.set("all", "true");

    const query = searchParams.toString();
    return fetchApi<StatsFunnel>(`/api/stats/funnel${query ? `?${query}` : ""}`);
  },

  sources: async (params?: { since?: string; all?: boolean }): Promise<StatsSources> => {
    const searchParams = new URLSearchParams();
    if (params?.since) searchParams.set("since", params.since);
    if (params?.all) searchParams.set("all", "true");

    const query = searchParams.toString();
    return fetchApi<StatsSources>(`/api/stats/sources${query ? `?${query}` : ""}`);
  },

  achievements: async (): Promise<AchievementsList> => {
    return fetchApi<AchievementsList>("/api/stats/achievements");
  },

  weeklyComparison: async (params?: { all?: boolean }): Promise<WeeklyComparison> => {
    const searchParams = new URLSearchParams();
    if (params?.all) searchParams.set("all", "true");

    const query = searchParams.toString();
    return fetchApi<WeeklyComparison>(`/api/stats/weekly-comparison${query ? `?${query}` : ""}`);
  },

  cumulative: async (params?: { all?: boolean }): Promise<CumulativeStats> => {
    const searchParams = new URLSearchParams();
    if (params?.all) searchParams.set("all", "true");

    const query = searchParams.toString();
    return fetchApi<CumulativeStats>(`/api/stats/cumulative${query ? `?${query}` : ""}`);
  },
};

// Companies API
export const companiesApi = {
  list: async (params?: { search?: string; all?: boolean }): Promise<CompanyListResponse> => {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.all) searchParams.set("all", "true");

    const query = searchParams.toString();
    return fetchApi<CompanyListResponse>(`/api/companies${query ? `?${query}` : ""}`);
  },

  get: async (id: number, all?: boolean): Promise<Company> => {
    const query = all ? "?all=true" : "";
    return fetchApi<Company>(`/api/companies/${id}${query}`);
  },

  delete: async (id: number): Promise<void> => {
    return fetchApi(`/api/companies/${id}`, { method: "DELETE" });
  },

  getAliases: async (id: number): Promise<AliasListResponse> => {
    return fetchApi(`/api/companies/${id}/aliases`);
  },

  addAlias: async (id: number, alias: string): Promise<Alias> => {
    return fetchApi(`/api/companies/${id}/aliases`, {
      method: "POST",
      body: JSON.stringify({ alias }),
    });
  },

  deleteAlias: async (companyId: number, aliasId: number): Promise<void> => {
    return fetchApi(`/api/companies/${companyId}/aliases/${aliasId}`, {
      method: "DELETE",
    });
  },

  merge: async (fromId: number, toId: number): Promise<Company> => {
    return fetchApi("/api/companies/merge", {
      method: "POST",
      body: JSON.stringify({ from_id: fromId, to_id: toId }),
    });
  },
};

// Config API
export const configApi = {
  list: async (): Promise<ConfigList> => {
    return fetchApi<ConfigList>("/api/config");
  },

  get: async (key: string): Promise<{ key: string; value: string | null }> => {
    return fetchApi(`/api/config/${key}`);
  },

  set: async (key: string, value: string): Promise<{ key: string; value: string }> => {
    return fetchApi(`/api/config/${key}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
  },

  reset: async (): Promise<void> => {
    return fetchApi("/api/config/reset", {
      method: "POST",
    });
  },
};

// Health check
export const healthCheck = async (): Promise<{ status: string; service: string }> => {
  return fetchApi("/api/health");
};

// Goals API
export const goalsApi = {
  list: async (goalType?: string): Promise<{ goals: Goal[]; total: number }> => {
    const query = goalType ? `?goal_type=${goalType}` : "";
    return fetchApi(`/api/goals${query}`);
  },

  current: async (): Promise<CurrentGoals> => {
    return fetchApi("/api/goals/current");
  },

  create: async (data: GoalCreate): Promise<Goal> => {
    return fetchApi("/api/goals", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// Notes API
export const notesApi = {
  list: async (appId: number): Promise<{ notes: Note[]; total: number }> => {
    return fetchApi(`/api/applications/${appId}/notes`);
  },

  create: async (appId: number, content: string): Promise<Note> => {
    return fetchApi(`/api/applications/${appId}/notes`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  },

  update: async (noteId: number, content: string): Promise<Note> => {
    return fetchApi(`/api/notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  },

  delete: async (noteId: number): Promise<void> => {
    return fetchApi(`/api/notes/${noteId}`, {
      method: "DELETE",
    });
  },
};

// Backup API
export const backupApi = {
  list: async (): Promise<BackupListResponse> => {
    return fetchApi("/api/backups");
  },

  create: async (name?: string): Promise<{ name: string; message: string }> => {
    return fetchApi("/api/backups", {
      method: "POST",
      body: JSON.stringify({ name: name || null }),
    });
  },

  download: (name: string): string => {
    return `${API_URL}/api/backups/${encodeURIComponent(name)}/download`;
  },

  delete: async (name: string): Promise<void> => {
    return fetchApi(`/api/backups/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  },
};

// Banned Companies API
export const bannedCompaniesApi = {
  list: async (): Promise<BannedCompanyListResponse> => {
    return fetchApi("/api/banned");
  },

  create: async (data: BannedCompanyCreate): Promise<BannedCompany> => {
    return fetchApi("/api/banned", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<void> => {
    return fetchApi(`/api/banned/${id}`, {
      method: "DELETE",
    });
  },

  check: async (name: string): Promise<BannedCheckResponse> => {
    return fetchApi(`/api/banned/check?name=${encodeURIComponent(name)}`);
  },

  checkBatch: async (names: string[]): Promise<{ banned_names: string[]; total_checked: number; total_banned: number }> => {
    return fetchApi("/api/banned/check-batch", {
      method: "POST",
      body: JSON.stringify(names),
    });
  },
};

// Banned Sources API
export const bannedSourcesApi = {
  list: async (): Promise<BannedSourceListResponse> => {
    return fetchApi("/api/banned-sources");
  },

  create: async (data: BannedSourceCreate): Promise<BannedSource> => {
    return fetchApi("/api/banned-sources", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  delete: async (id: number): Promise<void> => {
    return fetchApi(`/api/banned-sources/${id}`, {
      method: "DELETE",
    });
  },

  check: async (name: string): Promise<BannedSourceCheckResponse> => {
    return fetchApi(`/api/banned-sources/check?name=${encodeURIComponent(name)}`);
  },

  checkBatch: async (names: string[]): Promise<{ banned_names: string[]; total_checked: number; total_banned: number }> => {
    return fetchApi("/api/banned-sources/check-batch", {
      method: "POST",
      body: JSON.stringify(names),
    });
  },
};

// Files API
export const filesApi = {
  list: async (applicationId: number): Promise<FileListResponse> => {
    return fetchApi(`/api/applications/${applicationId}/files`);
  },

  upload: async (applicationId: number, file: File): Promise<ApplicationFile> => {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${API_URL}/api/applications/${applicationId}/files`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new ApiError(response.status, error.detail || "Upload failed");
    }

    return response.json();
  },

  getUrl: (fileId: number): string => {
    return `${API_URL}/api/applications/files/${fileId}`;
  },

  delete: async (fileId: number): Promise<void> => {
    return fetchApi(`/api/applications/files/${fileId}`, {
      method: "DELETE",
    });
  },
};

// LLM API
export const llmApi = {
  status: async (): Promise<LLMStatus> => {
    return fetchApi("/api/llm/status");
  },

  getConfig: async (): Promise<LLMConfig> => {
    return fetchApi("/api/llm/config");
  },

  getModels: async (): Promise<LLMModelsResponse> => {
    return fetchApi("/api/llm/models");
  },

  updateConfig: async (config: LLMConfigUpdate): Promise<LLMConfig> => {
    return fetchApi("/api/llm/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  },

  scanJobPosting: async (imageBase64: string): Promise<ExtractedJobData> => {
    return fetchApi("/api/llm/scan-job-posting", {
      method: "POST",
      body: JSON.stringify({ image_base64: imageBase64 }),
    });
  },

  previewJobRequirements: async (imageBase64: string): Promise<Record<string, unknown>> => {
    const response = await fetchApi<{ data: Record<string, unknown> }>("/api/llm/preview-job-requirements", {
      method: "POST",
      body: JSON.stringify({ image_base64: imageBase64 }),
    });
    return response.data;
  },

  previewJobRequirementsFromUrl: async (jobPostingUrl: string): Promise<Record<string, unknown>> => {
    const response = await fetchApi<{ data: Record<string, unknown> }>("/api/llm/preview-job-requirements-from-url", {
      method: "POST",
      body: JSON.stringify({ job_posting_url: jobPostingUrl }),
    });
    return response.data;
  },

  fetchJobUrl: async (url: string): Promise<{ success: boolean; error?: string; text_preview?: string; preview_image_url?: string; raw_html?: string }> => {
    return fetchApi("/api/llm/fetch-job-url", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
  },

  analyzeFitFromUrlStream: async (
    jobPostingUrl: string,
    resumeBase64: string,
    onProgress: (progress: { phase: number; totalPhases: number; message: string }) => void,
  ): Promise<FitAnalysis> => {
    const url = `${API_URL}/api/llm/analyze-fit-from-url-stream`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_posting_url: jobPostingUrl,
        resume_base64: resumeBase64,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new ApiError(response.status, error.detail || "Request failed");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let result: FitAnalysis | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "progress") {
              onProgress({
                phase: data.phase,
                totalPhases: data.total_phases,
                message: data.message,
              });
            } else if (data.type === "complete") {
              result = data.result;
            } else if (data.type === "error") {
              throw new Error(data.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue;
            throw e;
          }
        }
      }
    }

    if (!result) throw new Error("Analysis did not complete");
    return result;
  },

  analyzeFit: async (jobPostingBase64: string, resumeBase64: string): Promise<FitAnalysis> => {
    return fetchApi("/api/llm/analyze-fit", {
      method: "POST",
      body: JSON.stringify({
        job_posting_base64: jobPostingBase64,
        resume_base64: resumeBase64,
      }),
    });
  },

  analyzeFitStream: async (
    jobPostingBase64: string,
    resumeBase64: string,
    onProgress: (progress: { phase: number; totalPhases: number; message: string }) => void,
  ): Promise<FitAnalysis> => {
    const url = `${API_URL}/api/llm/analyze-fit-stream`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_posting_base64: jobPostingBase64,
        resume_base64: resumeBase64,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new ApiError(response.status, error.detail || "Request failed");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let result: FitAnalysis | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "progress") {
              onProgress({
                phase: data.phase,
                totalPhases: data.total_phases,
                message: data.message,
              });
            } else if (data.type === "complete") {
              result = data.result;
            } else if (data.type === "error") {
              throw new Error(data.message);
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue; // Ignore JSON parse errors for partial data
            throw e;
          }
        }
      }
    }

    if (!result) throw new Error("Analysis did not complete");
    return result;
  },
};

// Resume API
export const resumeApi = {
  getInfo: async (): Promise<ResumeInfo> => {
    return fetchApi("/api/config/resume/info");
  },

  getData: async (): Promise<ResumeData> => {
    return fetchApi("/api/config/resume/data");
  },

  upload: async (file: File): Promise<ResumeInfo> => {
    const formData = new FormData();
    formData.append("file", file);

    const url = `${API_URL}/api/config/resume`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new ApiError(response.status, error.detail || "Upload failed");
    }

    return response.json();
  },

  delete: async (): Promise<void> => {
    return fetchApi("/api/config/resume", {
      method: "DELETE",
    });
  },
};

// Job Search API
export const jobSearchApi = {
  search: async (
    params: {
      keywords?: string[];
      locations?: string[];
      sites?: string[];
      hours_old?: number;
      results_wanted?: number;
      filter_entry_level?: boolean;
      max_experience_years?: number;
      parallel?: boolean;
      max_workers?: number;
      offset?: number;
    } | undefined,
    onProgress: (data: {
      type: string;
      keyword?: string;
      location?: string;
      site?: string;
      count?: number;
      saved_new?: number;
      saved_updated?: number;
      progress?: number;
      total_searches?: number;
      total?: number;
      new_jobs?: number;
      updated_jobs?: number;
      message?: string;
      // Timing fields
      elapsed_ms?: number;
      eta_ms?: number;
      avg_per_search_ms?: number;
      total_time_ms?: number;
    }) => void,
  ): Promise<void> => {
    const url = `${API_URL}/api/job-search`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keywords: params?.keywords,
        locations: params?.locations,
        sites: params?.sites,
        hours_old: params?.hours_old || 24,
        results_wanted: params?.results_wanted || 100,
        filter_entry_level: params?.filter_entry_level ?? true,
        max_experience_years: params?.max_experience_years ?? 3,
        parallel: params?.parallel ?? true,  // Enable parallel by default
        max_workers: params?.max_workers ?? 3,
        offset: params?.offset ?? 0,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new ApiError(response.status, error.detail || "Search failed");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            onProgress(data);
          } catch {
            continue;
          }
        }
      }
    }
  },

  getSavedResults: async (hours: number = 24, includeHidden: boolean = false): Promise<SavedJobSearchResponse> => {
    const params = new URLSearchParams();
    params.set("hours", hours.toString());
    if (includeHidden) params.set("include_hidden", "true");
    return fetchApi(`/api/job-search/results?${params.toString()}`);
  },

  getResultsInfo: async (): Promise<JobSearchResultsInfo> => {
    return fetchApi("/api/job-search/results/info");
  },

  getUsedOffsets: async (resultsWanted: number = 100): Promise<{ offsets: number[]; suggested_next: number }> => {
    return fetchApi(`/api/job-search/offsets?results_wanted=${resultsWanted}`);
  },

  hideResult: async (id: number): Promise<{ message: string }> => {
    return fetchApi(`/api/job-search/results/${id}/hide`, { method: "POST" });
  },

  unhideResult: async (id: number): Promise<{ message: string }> => {
    return fetchApi(`/api/job-search/results/${id}/unhide`, { method: "POST" });
  },

  markApplied: async (id: number): Promise<{ message: string }> => {
    return fetchApi(`/api/job-search/results/${id}/apply`, { method: "POST" });
  },

  unmarkApplied: async (id: number): Promise<{ message: string }> => {
    return fetchApi(`/api/job-search/results/${id}/unapply`, { method: "POST" });
  },

  syncAppliedStatus: async (): Promise<{ matched: number; message: string }> => {
    return fetchApi("/api/job-search/results/sync-applied", { method: "POST" });
  },

  deleteResult: async (id: number): Promise<{ message: string }> => {
    return fetchApi(`/api/job-search/results/${id}`, { method: "DELETE" });
  },

  clearResults: async (): Promise<{ message: string }> => {
    return fetchApi("/api/job-search/results", { method: "DELETE" });
  },

  getKeywords: async (): Promise<JobSearchKeywords> => {
    return fetchApi("/api/job-search/keywords");
  },

  // LLM Analysis
  getAnalysisStatus: async (): Promise<LLMAnalysisStatus> => {
    return fetchApi("/api/job-search/analyze/status");
  },

  analyzeJobs: async (
    options: { limit?: number; jobIds?: number[] },
    onProgress: (data: {
      type: string;
      current?: number;
      total?: number;
      job_id?: number;
      job_title?: string;
      score?: number;
      queued_ids?: number[];
      analyzed?: number;
      skipped?: number;
      message?: string;
      completed?: number;
      elapsed_ms?: number;
      eta_ms?: number;
      total_time_ms?: number;
    }) => void,
  ): Promise<void> => {
    const url = `${API_URL}/api/job-search/analyze`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        limit: options.limit ?? 20,
        job_ids: options.jobIds ?? null,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Unknown error" }));
      throw new ApiError(response.status, error.detail || "Analysis failed");
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            onProgress(data);
          } catch {
            continue;
          }
        }
      }
    }
  },

  clearAnalysis: async (jobIds?: number[]): Promise<{ message: string; cleared_count: number }> => {
    return fetchApi("/api/job-search/analyze/clear", {
      method: "POST",
      body: JSON.stringify({ job_ids: jobIds ?? null }),
    });
  },

  // Filters
  getFilters: async (): Promise<JobFiltersResponse> => {
    return fetchApi("/api/job-search/filters");
  },

  addFilter: async (keyword: string, filterType: "positive" | "negative", weight: number = 1.0): Promise<JobFilter> => {
    return fetchApi("/api/job-search/filters", {
      method: "POST",
      body: JSON.stringify({ keyword, filter_type: filterType, weight }),
    });
  },

  deleteFilter: async (id: number): Promise<{ message: string }> => {
    return fetchApi(`/api/job-search/filters/${id}`, { method: "DELETE" });
  },

  // Bulk Actions
  bulkHide: async (jobIds: number[]): Promise<{ message: string; count: number }> => {
    return fetchApi("/api/job-search/results/bulk/hide", {
      method: "POST",
      body: JSON.stringify({ job_ids: jobIds }),
    });
  },

  bulkUnhide: async (jobIds: number[]): Promise<{ message: string; count: number }> => {
    return fetchApi("/api/job-search/results/bulk/unhide", {
      method: "POST",
      body: JSON.stringify({ job_ids: jobIds }),
    });
  },

  bulkMarkApplied: async (jobIds: number[]): Promise<{ message: string; count: number }> => {
    return fetchApi("/api/job-search/results/bulk/apply", {
      method: "POST",
      body: JSON.stringify({ job_ids: jobIds }),
    });
  },

  bulkUnmarkApplied: async (jobIds: number[]): Promise<{ message: string; count: number }> => {
    return fetchApi("/api/job-search/results/bulk/unapply", {
      method: "POST",
      body: JSON.stringify({ job_ids: jobIds }),
    });
  },

  bulkDelete: async (jobIds: number[]): Promise<{ message: string; count: number }> => {
    return fetchApi("/api/job-search/results/bulk/delete", {
      method: "POST",
      body: JSON.stringify({ job_ids: jobIds }),
    });
  },
};
