"""File routes for application attachments"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response

from jam.core.services.file_service import FileService

from api.schemas import FileResponse, FileListResponse

router = APIRouter()


@router.post("/{application_id}/files", response_model=FileResponse)
async def upload_file(application_id: int, file: UploadFile = File(...)):
    """Upload a file for an application"""
    service = FileService()

    # Read file content
    file_data = await file.read()

    success, message, app_file = service.upload(
        application_id=application_id,
        filename=file.filename or "unnamed",
        mime_type=file.content_type or "application/octet-stream",
        file_data=file_data,
    )

    if not success:
        raise HTTPException(status_code=400, detail=message)

    return FileResponse(
        id=app_file.id,
        application_id=app_file.application_id,
        filename=app_file.filename,
        mime_type=app_file.mime_type,
        file_size=app_file.file_size,
        created_at=app_file.created_at,
    )


@router.get("/{application_id}/files", response_model=FileListResponse)
def list_files(application_id: int):
    """List all files for an application"""
    service = FileService()
    files = service.list_for_application(application_id)

    return FileListResponse(
        files=[
            FileResponse(
                id=f.id,
                application_id=f.application_id,
                filename=f.filename,
                mime_type=f.mime_type,
                file_size=f.file_size,
                created_at=f.created_at,
            )
            for f in files
        ],
        total=len(files),
    )


@router.get("/files/{file_id}")
def get_file(file_id: int):
    """Get a file by ID (returns the file content)"""
    service = FileService()
    app_file = service.get(file_id, include_data=True)

    if not app_file:
        raise HTTPException(status_code=404, detail=f"File #{file_id} not found")

    return Response(
        content=app_file.file_data,
        media_type=app_file.mime_type,
        headers={
            "Content-Disposition": f'inline; filename="{app_file.filename}"',
        },
    )


@router.delete("/files/{file_id}")
def delete_file(file_id: int):
    """Delete a file"""
    service = FileService()
    success, message = service.delete(file_id)

    if not success:
        raise HTTPException(status_code=404, detail=message)

    return {"message": message}

