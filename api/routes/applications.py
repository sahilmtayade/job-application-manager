"""Application routes"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from jam.core.enums import ApplicationStatus, WorkLocation
from jam.core.models import ApplicationCreate as AppCreate, ApplicationUpdate as AppUpdate
from jam.core.services.application_service import ApplicationService
from jam.core.services.file_service import FileService
from jam.core.utils.text_utils import normalize_text

from api.schemas import (
    ApplicationCreate,
    ApplicationUpdate,
    ApplicationResponse,
    ApplicationListResponse,
    ApplicationSignature,
    ApplicationSignaturesResponse,
    AppliedCompaniesResponse,
    StatusChangeRequest,
    EventUpdateRequest,
    ApplicationEventResponse,
    ApplicationEventsResponse,
    ValidStatusesResponse,
)

router = APIRouter()


def app_to_response(app, file_count: int = 0) -> ApplicationResponse:
    """Convert Application model to API response"""
    return ApplicationResponse(
        id=app.id,
        company_id=app.company_id,
        company_name=app.company_name,
        company_name_raw=app.company_name_raw,
        position=app.position,
        current_status=app.current_status,
        status_updated_at=app.status_updated_at,
        applied_at=app.applied_at,
        source=app.source,
        url=app.url,
        notes=app.notes,
        work_location=app.work_location,
        location_address=app.location_address,
        is_deleted=app.is_deleted,
        deleted_at=app.deleted_at,
        created_at=app.created_at,
        updated_at=app.updated_at,
        file_count=file_count,
    )


def event_to_response(event) -> ApplicationEventResponse:
    """Convert ApplicationEvent model to API response"""
    return ApplicationEventResponse(
        id=event.id,
        application_id=event.application_id,
        from_status=event.from_status,
        to_status=event.to_status,
        timestamp=event.timestamp,
        notes=event.notes,
    )


@router.get("", response_model=ApplicationListResponse)
def list_applications(
    include_deleted: bool = Query(False, alias="all"),
    status: Optional[str] = Query(None, description="Comma-separated statuses"),
    company_id: Optional[int] = None,
    since: Optional[date] = None,
    limit: Optional[int] = None,
):
    """List applications with optional filters"""
    service = ApplicationService()
    file_service = FileService()

    status_filter = None
    if status:
        try:
            status_filter = [ApplicationStatus(s.strip().lower()) for s in status.split(",")]
        except ValueError as e:
            raise HTTPException(status_code=400, detail=f"Invalid status: {e}")

    apps = service.list(
        include_deleted=include_deleted,
        status=status_filter,
        company_id=company_id,
        since=since,
        limit=limit,
    )

    # Get file counts for all applications in batch
    app_ids = [app.id for app in apps]
    file_counts = file_service.get_file_counts_batch(app_ids) if app_ids else {}

    return ApplicationListResponse(
        applications=[app_to_response(app, file_counts.get(app.id, 0)) for app in apps],
        total=len(apps),
    )


@router.get("/signatures", response_model=ApplicationSignaturesResponse)
def get_application_signatures():
    """Return company+position pairs for matching against job search results.

    This lightweight endpoint returns just the data needed for fuzzy matching
    job search results against existing applications.
    """
    service = ApplicationService()
    apps = service.list(include_deleted=False)

    signatures = [
        ApplicationSignature(
            company=app.company_name or app.company_name_raw,
            position=app.position,
        )
        for app in apps
    ]

    return ApplicationSignaturesResponse(
        signatures=signatures,
        total=len(signatures),
    )


@router.get("/companies/applied", response_model=AppliedCompaniesResponse)
def get_applied_companies():
    """Return unique normalized company names from all applications.

    Used to indicate on job listings if user has previously applied to a company.
    Company names are normalized (lowercase, common suffixes removed) for matching.
    """
    service = ApplicationService()
    apps = service.list(include_deleted=False)

    # Get unique normalized company names
    companies = set()
    for app in apps:
        company_name = app.company_name or app.company_name_raw
        normalized = normalize_text(company_name)
        if normalized:
            companies.add(normalized)

    return AppliedCompaniesResponse(
        companies=sorted(companies),
        total=len(companies),
    )


@router.post("", response_model=ApplicationResponse, status_code=201)
def create_application(data: ApplicationCreate):
    """Create a new application"""
    from jam.core.services.note_service import NoteService

    service = ApplicationService()
    note_service = NoteService()

    # Extract initial notes before creating application
    initial_notes = data.notes

    app_data = AppCreate(
        company_name=data.company_name,
        position=data.position,
        applied_at=data.applied_at,
        source=data.source,
        url=data.url,
        notes=None,  # Don't save to notes field, use notes table instead
        work_location=data.work_location,
        location_address=data.location_address,
        initial_status=data.initial_status,
    )

    try:
        app = service.create(app_data, selected_company_id=data.company_id)

        # If initial notes were provided, create a note entry
        if initial_notes and initial_notes.strip():
            note_service.add(app.id, initial_notes.strip())

        return app_to_response(app)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{app_id}", response_model=ApplicationResponse)
def get_application(
    app_id: int,
    include_deleted: bool = Query(False, alias="all"),
):
    """Get a single application by ID"""
    service = ApplicationService()
    file_service = FileService()
    app = service.get(app_id, include_deleted=include_deleted)

    if not app:
        raise HTTPException(status_code=404, detail=f"Application #{app_id} not found")

    file_count = file_service.get_file_count(app_id)
    return app_to_response(app, file_count)


@router.put("/{app_id}", response_model=ApplicationResponse)
def update_application(app_id: int, data: ApplicationUpdate):
    """Update an application"""
    service = ApplicationService()

    # Verify exists
    existing = service.get(app_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Application #{app_id} not found")

    update_data = AppUpdate(
        company_name=data.company_name,
        position=data.position,
        source=data.source,
        url=data.url,
        notes=None,  # Notes are now managed separately via the notes API
        work_location=data.work_location,
        location_address=data.location_address,
    )

    updated = service.update(app_id, update_data)
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update application")

    return app_to_response(updated)


@router.delete("/{app_id}", status_code=204)
def delete_application(
    app_id: int,
    hard: bool = Query(False, description="Permanently delete"),
):
    """Delete an application (soft delete by default)"""
    service = ApplicationService()

    existing = service.get(app_id, include_deleted=True)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Application #{app_id} not found")

    if not hard and existing.is_deleted:
        raise HTTPException(status_code=400, detail="Application is already deleted")

    success = service.delete(app_id, hard=hard)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete application")


@router.post("/{app_id}/restore", response_model=ApplicationResponse)
def restore_application(app_id: int):
    """Restore a soft-deleted application"""
    service = ApplicationService()

    existing = service.get(app_id, include_deleted=True)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Application #{app_id} not found")

    if not existing.is_deleted:
        raise HTTPException(status_code=400, detail="Application is not deleted")

    success = service.restore(app_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to restore application")

    restored = service.get(app_id)
    return app_to_response(restored)


@router.get("/sources/unique", response_model=dict)
def get_unique_sources(include_deleted: bool = Query(False, alias="all")):
    """Get list of unique sources used in applications"""
    service = ApplicationService()
    sources = service.get_unique_sources(include_deleted=include_deleted)
    return {"sources": sources}


@router.get("/positions/unique", response_model=dict)
def get_unique_positions(include_deleted: bool = Query(False, alias="all")):
    """Get list of unique positions used in applications"""
    service = ApplicationService()
    positions = service.get_unique_positions(include_deleted=include_deleted)
    return {"positions": positions}


@router.get("/{app_id}/events", response_model=ApplicationEventsResponse)
def get_application_events(app_id: int):
    """Get all status change events for an application"""
    service = ApplicationService()

    # Verify application exists
    app = service.get(app_id)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application #{app_id} not found")

    events = service.get_events(app_id)
    return ApplicationEventsResponse(
        events=[event_to_response(e) for e in events],
        total=len(events)
    )


@router.post("/{app_id}/status", response_model=ApplicationResponse)
def change_application_status(app_id: int, data: StatusChangeRequest):
    """Change application status (validates transition)"""
    from jam.core.models import StatusChange as CoreStatusChange

    service = ApplicationService()

    status_change = CoreStatusChange(
        new_status=data.new_status,
        notes=data.notes
    )

    try:
        updated = service.change_status(app_id, status_change)
        return app_to_response(updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{app_id}/status/valid-next", response_model=ValidStatusesResponse)
def get_valid_next_statuses(app_id: int):
    """Get valid next statuses for an application"""
    service = ApplicationService()

    app = service.get(app_id)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application #{app_id} not found")

    valid_statuses = service.get_valid_next_statuses(app_id)
    return ValidStatusesResponse(
        current_status=app.current_status,
        valid_next_statuses=valid_statuses
    )


@router.put("/{app_id}/events/{event_id}", response_model=ApplicationEventResponse)
def update_application_event(app_id: int, event_id: int, data: EventUpdateRequest):
    """Update a status event (for corrections)"""
    service = ApplicationService()

    try:
        updated = service.update_status_event(
            app_id,
            event_id,
            to_status=data.to_status,
            notes=data.notes
        )
        return event_to_response(updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{app_id}/events/{event_id}", status_code=204)
def delete_application_event(app_id: int, event_id: int):
    """Delete a status event (for corrections)"""
    service = ApplicationService()

    try:
        success = service.delete_status_event(app_id, event_id)
        if not success:
            raise HTTPException(status_code=404, detail=f"Event #{event_id} not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

