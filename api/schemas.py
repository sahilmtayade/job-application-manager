"""Pydantic schemas for API request/response models"""

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel

from jam.core.enums import ApplicationStatus, WorkLocation


# Application schemas
class ApplicationBase(BaseModel):
    company_name: str
    position: str
    applied_at: date
    source: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    work_location: Optional[WorkLocation] = None
    location_address: Optional[str] = None  # City/address for hybrid/onsite jobs
    initial_status: ApplicationStatus = ApplicationStatus.APPLIED


class ApplicationCreate(ApplicationBase):
    """Request model for creating an application"""
    company_id: Optional[int] = None  # If provided, use existing company


class ApplicationUpdate(BaseModel):
    """Request model for updating an application (metadata only, not status)"""
    company_name: Optional[str] = None  # Changing company will cleanup orphaned companies
    position: Optional[str] = None
    source: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    work_location: Optional[WorkLocation] = None
    location_address: Optional[str] = None  # City/address for hybrid/onsite jobs


class ApplicationResponse(BaseModel):
    """Response model for an application"""
    id: int
    company_id: int
    company_name: Optional[str] = None
    company_name_raw: str
    position: str
    current_status: Optional[ApplicationStatus] = None
    status_updated_at: Optional[datetime] = None
    applied_at: date
    source: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    work_location: Optional[WorkLocation] = None
    location_address: Optional[str] = None  # City/address for hybrid/onsite jobs
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    file_count: int = 0  # Number of attached files

    class Config:
        from_attributes = True


class ApplicationListResponse(BaseModel):
    """Response model for application list"""
    applications: list[ApplicationResponse]
    total: int


class ApplicationSignature(BaseModel):
    """Lightweight representation for matching against job search results"""
    company: str
    position: str


class ApplicationSignaturesResponse(BaseModel):
    """Response model for application signatures list"""
    signatures: list[ApplicationSignature]
    total: int


class AppliedCompaniesResponse(BaseModel):
    """Response model for applied company names (normalized for matching)"""
    companies: list[str]
    total: int


# Company schemas
class CompanyResponse(BaseModel):
    """Response model for a company"""
    id: int
    name: str
    application_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CompanyListResponse(BaseModel):
    """Response model for company list"""
    companies: list[CompanyResponse]
    total: int


# Stats schemas
class StatsSummaryResponse(BaseModel):
    """Response model for stats summary"""
    total: int
    active: int
    companies: int
    by_status: dict[str, int]
    recent_activity: int
    today: int
    this_week: int
    last_week: int
    this_month: int
    current_streak: int
    longest_streak: int
    streak_at_risk: bool


class AchievementResponse(BaseModel):
    """Response model for a single achievement"""
    id: str
    name: str
    description: str
    icon: str
    category: str
    threshold: int
    progress: int
    unlocked: bool
    reset_period: Optional[str] = None  # "daily", "weekly", "monthly" for recurring achievements


class AchievementsListResponse(BaseModel):
    """Response model for achievements list"""
    achievements: list[AchievementResponse]
    total_unlocked: int
    total: int


class WeeklyComparisonResponse(BaseModel):
    """Response model for weekly comparison stats"""
    this_week_apps: int
    last_week_apps: int
    apps_change_pct: float
    this_week_interviews: int
    last_week_interviews: int
    interviews_change_pct: float
    this_week_responses: int
    last_week_responses: int
    responses_change_pct: float
    current_streak: int
    streak_at_risk: bool


class TrendDataPoint(BaseModel):
    """Single data point in trend"""
    date: str
    count: int


class StatsTrendsResponse(BaseModel):
    """Response model for trends"""
    data: list[TrendDataPoint]
    period: str


class FunnelStage(BaseModel):
    """Single funnel stage"""
    count: int
    rate: float


class StatsFunnelResponse(BaseModel):
    """Response model for funnel"""
    stages: dict[str, FunnelStage]


class SourceStats(BaseModel):
    """Stats for a single source"""
    source: str
    total: int
    success_count: int
    success_rate: float


class StatsSourcesResponse(BaseModel):
    """Response model for sources stats"""
    sources: list[SourceStats]


class CumulativeStatsResponse(BaseModel):
    """Response model for cumulative/lifetime statistics"""
    total_applications: int
    total_companies: int
    days_since_start: int
    total_days_active: int
    avg_per_day: float
    avg_per_week: float
    most_active_day: Optional[str] = None
    busiest_month: Optional[str] = None
    total_responses: int
    response_rate: float


# Config schemas
class ConfigResponse(BaseModel):
    """Response model for config"""
    key: str
    value: Optional[str] = None


class ConfigUpdateRequest(BaseModel):
    """Request model for updating config"""
    value: str


class ConfigListResponse(BaseModel):
    """Response model for config list"""
    config: dict[str, Optional[str]]


# Goal schemas
class GoalCreate(BaseModel):
    """Request model for creating a goal"""
    goal_type: str  # "daily" or "weekly"
    target_count: int


class GoalResponse(BaseModel):
    """Response model for a goal"""
    id: int
    goal_type: str
    target_count: int
    period_start: date
    period_end: date
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class GoalProgress(BaseModel):
    """Response model for goal with progress"""
    goal: Optional[GoalResponse] = None
    current: int
    target: int
    percentage: float
    remaining: int
    goal_type: str


class GoalListResponse(BaseModel):
    """Response model for goal list"""
    goals: list[GoalResponse]
    total: int


class CurrentGoalsResponse(BaseModel):
    """Response model for current goals with progress"""
    daily: Optional[GoalProgress] = None
    weekly: Optional[GoalProgress] = None


# Note schemas
class NoteCreate(BaseModel):
    """Request model for creating a note"""
    content: str


class NoteResponse(BaseModel):
    """Response model for a note"""
    id: int
    application_id: int
    content: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NoteListResponse(BaseModel):
    """Response model for note list"""
    notes: list[NoteResponse]
    total: int


# Company alias schemas
class AliasCreate(BaseModel):
    """Request model for creating an alias"""
    alias: str


class AliasResponse(BaseModel):
    """Response model for an alias"""
    id: int
    company_id: int
    alias: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MergeCompaniesRequest(BaseModel):
    """Request model for merging companies"""
    from_id: int
    to_id: int


# Status change schemas
class StatusChangeRequest(BaseModel):
    """Request model for changing application status"""
    new_status: ApplicationStatus
    notes: Optional[str] = None


class EventUpdateRequest(BaseModel):
    """Request model for updating a status event"""
    to_status: Optional[ApplicationStatus] = None
    notes: Optional[str] = None


class ApplicationEventResponse(BaseModel):
    """Response model for an application event"""
    id: int
    application_id: int
    from_status: Optional[ApplicationStatus] = None
    to_status: ApplicationStatus
    timestamp: datetime
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class ApplicationEventsResponse(BaseModel):
    """Response model for application events list"""
    events: list[ApplicationEventResponse]
    total: int


class ValidStatusesResponse(BaseModel):
    """Response model for valid next statuses"""
    current_status: Optional[ApplicationStatus] = None
    valid_next_statuses: list[ApplicationStatus]


# Banned company schemas
class BannedCompanyCreate(BaseModel):
    """Request model for banning a company"""
    name: str
    reason: Optional[str] = None


class BannedCompanyResponse(BaseModel):
    """Response model for a banned company"""
    id: int
    name: str
    reason: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BannedCompanyListResponse(BaseModel):
    """Response model for banned company list"""
    banned_companies: list[BannedCompanyResponse]
    total: int


class BannedCheckResponse(BaseModel):
    """Response model for checking if a company is banned"""
    name: str
    is_banned: bool
    banned: Optional[BannedCompanyResponse] = None


# Banned source schemas
class BannedSourceCreate(BaseModel):
    """Request model for banning a source"""
    name: str
    reason: Optional[str] = None


class BannedSourceResponse(BaseModel):
    """Response model for a banned source"""
    id: int
    name: str
    reason: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BannedSourceListResponse(BaseModel):
    """Response model for banned source list"""
    banned_sources: list[BannedSourceResponse]
    total: int


class BannedSourceCheckResponse(BaseModel):
    """Response model for checking if a source is banned"""
    name: str
    is_banned: bool
    banned: Optional[BannedSourceResponse] = None


# File schemas
class FileResponse(BaseModel):
    """Response model for a file"""
    id: int
    application_id: int
    filename: str
    mime_type: str
    file_size: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FileListResponse(BaseModel):
    """Response model for file list"""
    files: list[FileResponse]
    total: int


# LLM schemas
class ScanJobPostingRequest(BaseModel):
    """Request model for scanning a job posting image"""
    image_base64: str  # Base64-encoded image data


class ExtractedJobDataResponse(BaseModel):
    """Response model for extracted job posting data"""
    company_name: Optional[str] = None
    position: Optional[str] = None
    source: Optional[str] = None
    url: Optional[str] = None
    work_location: Optional[str] = None  # "remote", "onsite", "hybrid"
    location_address: Optional[str] = None
    notes: Optional[str] = None


class LLMStatusResponse(BaseModel):
    """Response model for LLM/Ollama status"""
    available: bool
    url: str
    model: str
    model_ready: bool
    text_model: Optional[str] = None
    text_model_ready: bool = False
    available_models: list[str]


class LLMConfigResponse(BaseModel):
    """Response model for LLM configuration"""
    url: str
    api_mode: str  # "openai" or "ollama"
    vision_model: str
    text_model: str
    temperature: float
    max_tokens: int
    concurrency: int


class LLMConfigUpdateRequest(BaseModel):
    """Request model for updating LLM configuration"""
    url: Optional[str] = None
    api_mode: Optional[str] = None
    vision_model: Optional[str] = None
    text_model: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    concurrency: Optional[int] = None


# Job Fit Analysis schemas
class AnalyzeFitRequest(BaseModel):
    """Request model for analyzing job fit"""
    job_posting_base64: str  # Base64-encoded job posting image
    resume_base64: str  # Base64-encoded resume image


class SkillsMatchResponse(BaseModel):
    """Skills matching breakdown"""
    matched: list[str]
    missing: list[str]
    bonus: list[str]


class ExperienceMatchResponse(BaseModel):
    """Experience level matching"""
    required_level: str
    assessment: str
    compatible: bool


class ScamAnalysisResponse(BaseModel):
    """Scam and red flag analysis"""
    risk_level: str  # "low", "medium", "high"
    warnings: list[str]
    legitimate_signals: list[str]


class FitAnalysisResponse(BaseModel):
    """Complete job fit analysis result"""
    score: int  # 0-100
    summary: str
    compatible: bool
    skills_match: SkillsMatchResponse
    experience_match: ExperienceMatchResponse
    red_flags: list[str]
    scam_analysis: ScamAnalysisResponse
    recommendations: list[str]


# Resume storage schemas
class ResumeInfoResponse(BaseModel):
    """Response model for stored resume info"""
    has_resume: bool
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    uploaded_at: Optional[str] = None


class ResumeDataResponse(BaseModel):
    """Response model for resume with data"""
    has_resume: bool
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    uploaded_at: Optional[str] = None
    data: Optional[str] = None  # Base64-encoded resume data

