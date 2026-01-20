"""Notes routes"""

from fastapi import APIRouter, HTTPException

from jam.core.services.note_service import NoteService
from jam.core.services.application_service import ApplicationService

from api.schemas import (
    NoteCreate,
    NoteResponse,
    NoteListResponse,
)

router = APIRouter()


def note_to_response(note) -> NoteResponse:
    """Convert Note model to API response"""
    return NoteResponse(
        id=note.id,
        application_id=note.application_id,
        content=note.content,
        created_at=note.created_at,
    )


@router.get("/applications/{app_id}/notes", response_model=NoteListResponse)
def list_notes(app_id: int):
    """List all notes for an application"""
    app_service = ApplicationService()
    note_service = NoteService()

    # Verify application exists
    app = app_service.get(app_id, include_deleted=True)
    if not app:
        raise HTTPException(status_code=404, detail=f"Application #{app_id} not found")

    notes = note_service.list_for_application(app_id)

    return NoteListResponse(
        notes=[note_to_response(n) for n in notes],
        total=len(notes),
    )


@router.post("/applications/{app_id}/notes", response_model=NoteResponse, status_code=201)
def create_note(app_id: int, data: NoteCreate):
    """Add a note to an application"""
    note_service = NoteService()

    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Note content cannot be empty")

    note = note_service.add(app_id, data.content)
    if not note:
        raise HTTPException(status_code=404, detail=f"Application #{app_id} not found")

    return note_to_response(note)


@router.put("/notes/{note_id}", response_model=NoteResponse)
def update_note(note_id: int, data: NoteCreate):
    """Update a note's content"""
    note_service = NoteService()

    note = note_service.get(note_id)
    if not note:
        raise HTTPException(status_code=404, detail=f"Note #{note_id} not found")

    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Note content cannot be empty")

    updated = note_service.update(note_id, data.content.strip())
    if not updated:
        raise HTTPException(status_code=500, detail="Failed to update note")

    return note_to_response(updated)


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: int):
    """Delete a note"""
    note_service = NoteService()

    note = note_service.get(note_id)
    if not note:
        raise HTTPException(status_code=404, detail=f"Note #{note_id} not found")

    success = note_service.delete(note_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete note")

