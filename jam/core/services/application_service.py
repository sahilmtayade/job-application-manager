"""Service layer for application operations"""

from __future__ import annotations

from datetime import date
from typing import Optional

from jam.core.enums import ApplicationStatus
from jam.core.models import Application, ApplicationCreate, ApplicationEvent, ApplicationUpdate, StatusChange
from jam.db.tables.application_table import ApplicationTable
from jam.db.tables.company_table import CompanyTable
from jam.db.tables.event_table import EventTable


class ApplicationService:
    """Business logic for application operations"""

    def __init__(self):
        self.app_table = ApplicationTable()
        self.company_table = CompanyTable()
        self.event_table = EventTable()

    def create(self, data: ApplicationCreate, selected_company_id: Optional[int] = None) -> Application:
        """
        Create a new application.

        If selected_company_id is provided, links to that company.
        Otherwise, finds or creates a company with the given name.
        """
        if selected_company_id:
            company = self.company_table.get_by_id(selected_company_id)
            if not company:
                raise ValueError(f"Company with ID {selected_company_id} not found")
            company_id = selected_company_id
        else:
            # Find existing company or create new one
            company = self.company_table.get_by_name(data.company_name)
            if not company:
                company = self.company_table.create(data.company_name)
            company_id = company.id

        return self.app_table.create(
            company_id=company_id,
            company_name_raw=data.company_name,
            position=data.position,
            applied_at=data.applied_at,
            initial_status=data.initial_status,
            source=data.source,
            url=data.url,
            notes=data.notes,
            work_location=data.work_location,
            location_address=data.location_address,
        )

    def get(self, app_id: int, include_deleted: bool = False) -> Optional[Application]:
        """Get an application by ID"""
        return self.app_table.get_by_id(app_id, include_deleted=include_deleted)

    def list(
        self,
        include_deleted: bool = False,
        status: Optional[list[ApplicationStatus]] = None,
        company_id: Optional[int] = None,
        since: Optional[date] = None,
        limit: Optional[int] = None,
    ) -> list[Application]:
        """List applications with optional filters"""
        return self.app_table.get_all(
            include_deleted=include_deleted,
            status=status,
            company_id=company_id,
            since=since,
            limit=limit,
        )

    def update(self, app_id: int, data: ApplicationUpdate) -> Optional[Application]:
        """
        Update an application's metadata (not status).

        If company_name is provided, will find or create the company
        and cleanup orphaned companies (companies with no applications).
        """
        company_id = None
        company_name_raw = None
        old_company_id = None

        # Handle company change
        if data.company_name is not None:
            app = self.app_table.get_by_id(app_id)
            if app:
                old_company_id = app.company_id

                # Find existing company or create new one
                company = self.company_table.get_by_name(data.company_name)
                if not company:
                    company = self.company_table.create(data.company_name)
                company_id = company.id
                company_name_raw = data.company_name

        result = self.app_table.update(
            app_id=app_id,
            company_id=company_id,
            company_name_raw=company_name_raw,
            position=data.position,
            source=data.source,
            url=data.url,
            notes=data.notes,
            work_location=data.work_location,
            location_address=data.location_address,
        )

        # Cleanup orphaned company if company was changed
        if old_company_id is not None and company_id is not None and old_company_id != company_id:
            self._cleanup_orphaned_company(old_company_id)

        return result

    def _cleanup_orphaned_company(self, company_id: int) -> bool:
        """Delete a company if it has no applications referencing it"""
        app_count = self.company_table.get_application_count(company_id, include_deleted=True)
        if app_count == 0:
            return self.company_table.delete(company_id)
        return False

    def delete(self, app_id: int, hard: bool = False) -> bool:
        """
        Delete an application.

        By default, soft deletes (marks as deleted).
        If hard=True, permanently removes from database.
        """
        if hard:
            return self.app_table.hard_delete(app_id)
        return self.app_table.soft_delete(app_id)

    def restore(self, app_id: int) -> bool:
        """Restore a soft-deleted application"""
        return self.app_table.restore(app_id)

    def get_events(self, app_id: int) -> list[ApplicationEvent]:
        """Get status change history for an application"""
        return self.event_table.get_all_for_application(app_id)

    def find_similar_companies(self, company_name: str) -> list[dict]:
        """
        Find companies with similar names for matching on add.
        Returns company info with application count.
        """
        companies = self.company_table.find_similar(company_name)
        results = []
        for company in companies:
            count = self.company_table.get_application_count(company.id)
            results.append({
                "company": company,
                "application_count": count,
            })
        return results

    def find_previous_applications(
        self,
        company_id: int,
        position: Optional[str] = None,
    ) -> list[Application]:
        """Find previous applications to a company for reapplication check"""
        return self.app_table.find_similar(company_id, position)

    def get_unique_sources(self, include_deleted: bool = False) -> list[str]:
        """Get list of unique sources used in applications"""
        return self.app_table.get_unique_sources(include_deleted=include_deleted)

    def get_unique_positions(self, include_deleted: bool = False) -> list[str]:
        """Get list of unique positions used in applications"""
        return self.app_table.get_unique_positions(include_deleted=include_deleted)

    def change_status(self, app_id: int, status_change: StatusChange) -> Application:
        """
        Change application status with validation.

        Validates that the transition is allowed based on current status.
        Raises ValueError if transition is invalid or application not found.
        """
        app = self.get(app_id)
        if not app:
            raise ValueError(f"Application #{app_id} not found")

        current_status = app.current_status
        if not current_status:
            raise ValueError(f"Application #{app_id} has no current status")

        new_status = status_change.new_status

        # Validate transition
        valid_transitions = ApplicationStatus.get_valid_transitions(current_status)
        if new_status not in valid_transitions:
            raise ValueError(
                f"Invalid status transition from {current_status.value} to {new_status.value}. "
                f"Valid transitions: {[s.value for s in valid_transitions]}"
            )

        # Check if status already exists (unique constraint)
        if self.event_table.status_exists_for_application(app_id, new_status):
            raise ValueError(f"Status {new_status.value} already exists for this application")

        # Create new status event
        self.event_table.create(
            application_id=app_id,
            from_status=current_status,
            to_status=new_status,
            notes=status_change.notes
        )

        # Return updated application
        updated = self.get(app_id)
        if not updated:
            raise ValueError(f"Failed to retrieve updated application #{app_id}")
        return updated

    def get_valid_next_statuses(self, app_id: int) -> list[ApplicationStatus]:
        """Get list of valid next statuses for an application"""
        app = self.get(app_id)
        if not app or not app.current_status:
            return []
        return ApplicationStatus.get_valid_transitions(app.current_status)

    def delete_status_event(self, app_id: int, event_id: int) -> bool:
        """
        Delete a status event (for corrections).

        Validates that the event belongs to the application.
        Returns True if successful, False if event not found.
        """
        # Verify the event exists and belongs to this application
        event = self.event_table.get_by_id(event_id)
        if not event:
            raise ValueError(f"Event #{event_id} not found")

        if event.application_id != app_id:
            raise ValueError(f"Event #{event_id} does not belong to application #{app_id}")

        # Don't allow deleting the only event
        event_count = self.event_table.count_for_application(app_id)
        if event_count <= 1:
            raise ValueError("Cannot delete the only status event for an application")

        return self.event_table.delete(event_id)

    def update_status_event(
        self,
        app_id: int,
        event_id: int,
        to_status: Optional[ApplicationStatus] = None,
        notes: Optional[str] = None,
    ) -> ApplicationEvent:
        """
        Update a status event (for corrections).

        Can update the to_status and/or notes fields.
        Validates that the event belongs to the application.
        """
        # Verify the event exists and belongs to this application
        event = self.event_table.get_by_id(event_id)
        if not event:
            raise ValueError(f"Event #{event_id} not found")

        if event.application_id != app_id:
            raise ValueError(f"Event #{event_id} does not belong to application #{app_id}")

        # If changing status, validate it doesn't already exist (except for current event)
        if to_status is not None and to_status != event.to_status:
            if self.event_table.status_exists_for_application(app_id, to_status):
                raise ValueError(f"Status {to_status.value} already exists for this application")

        updated = self.event_table.update(event_id, to_status=to_status, notes=notes)
        if not updated:
            raise ValueError(f"Failed to update event #{event_id}")

        return updated

