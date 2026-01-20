"""Pydantic models for JAM"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from jam.core.enums import ApplicationStatus, GoalType, WorkLocation


class Company(BaseModel):
    """Represents a company"""

    id: Optional[int] = None
    name: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CompanyAlias(BaseModel):
    """Represents an alias for a company"""

    id: Optional[int] = None
    company_id: int
    alias: str


class BannedCompany(BaseModel):
    """Represents a banned/scammy company"""

    id: Optional[int] = None
    name: str
    reason: Optional[str] = None
    created_at: Optional[datetime] = None


class BannedSource(BaseModel):
    """Represents a banned platform/source"""

    id: Optional[int] = None
    name: str
    reason: Optional[str] = None
    created_at: Optional[datetime] = None


class Application(BaseModel):
    """Represents a job application"""

    id: Optional[int] = None
    company_id: int
    company_name_raw: str  # Original user input, preserved as-is
    position: str
    applied_at: date = Field(default_factory=date.today)
    source: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    work_location: Optional[WorkLocation] = None
    location_address: Optional[str] = None  # City/address for hybrid/onsite jobs
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    # Optional joined data from other tables
    company_name: Optional[str] = None  # Canonical company name from join
    current_status: Optional[ApplicationStatus] = None  # Latest status from application_events
    status_updated_at: Optional[datetime] = None  # Timestamp of latest status change


class ApplicationEvent(BaseModel):
    """Tracks status changes for an application"""

    id: Optional[int] = None
    application_id: int
    from_status: Optional[ApplicationStatus] = None
    to_status: ApplicationStatus
    timestamp: datetime = Field(default_factory=datetime.now)
    notes: Optional[str] = None


class Goal(BaseModel):
    """Represents an application goal"""

    id: Optional[int] = None
    goal_type: GoalType
    target_count: int
    period_start: date
    period_end: date
    created_at: Optional[datetime] = None


class ApplicationCreate(BaseModel):
    """Input model for creating an application"""

    company_name: str
    position: str
    applied_at: date = Field(default_factory=date.today)
    source: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    work_location: Optional[WorkLocation] = None
    location_address: Optional[str] = None  # City/address for hybrid/onsite jobs
    initial_status: ApplicationStatus = ApplicationStatus.APPLIED  # Initial status for event


class ApplicationUpdate(BaseModel):
    """Input model for updating an application (metadata only, not status)"""

    company_name: Optional[str] = None  # Changing company will cleanup orphaned companies
    position: Optional[str] = None
    source: Optional[str] = None
    url: Optional[str] = None
    notes: Optional[str] = None
    work_location: Optional[WorkLocation] = None
    location_address: Optional[str] = None  # City/address for hybrid/onsite jobs


class StatusChange(BaseModel):
    """Input model for changing application status"""

    new_status: ApplicationStatus
    notes: Optional[str] = None


class Note(BaseModel):
    """Represents a note attached to an application"""

    id: Optional[int] = None
    application_id: int
    content: str
    created_at: Optional[datetime] = None


class ApplicationFile(BaseModel):
    """Represents a file attached to an application"""

    id: Optional[int] = None
    application_id: int
    filename: str
    mime_type: str
    file_size: int
    file_data: Optional[bytes] = None  # Only populated when fetching single file
    created_at: Optional[datetime] = None

    class Config:
        # Allow bytes field
        arbitrary_types_allowed = True


class Config(BaseModel):
    """Represents a user configuration setting"""

    key: str
    value: str
    updated_at: Optional[datetime] = None

