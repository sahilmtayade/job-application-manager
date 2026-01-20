"""Backup routes"""

from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from jam.core.services.backup_service import BackupService

router = APIRouter()


class BackupResponse(BaseModel):
    """Response model for a backup"""
    name: str
    size: int
    created: str  # ISO format datetime string


class BackupListResponse(BaseModel):
    """Response model for backup list"""
    backups: list[BackupResponse]
    total: int


class CreateBackupRequest(BaseModel):
    """Request model for creating a backup"""
    name: Optional[str] = None


class CreateBackupResponse(BaseModel):
    """Response model for created backup"""
    name: str
    message: str


@router.get("", response_model=BackupListResponse)
def list_backups():
    """List all available backups"""
    service = BackupService()
    backups = service.list_backups()

    return BackupListResponse(
        backups=[
            BackupResponse(
                name=b["name"],
                size=b["size"],
                created=b["created"],
            )
            for b in backups
        ],
        total=len(backups),
    )


@router.post("", response_model=CreateBackupResponse, status_code=201)
def create_backup(data: CreateBackupRequest = CreateBackupRequest()):
    """Create a new database backup"""
    service = BackupService()

    try:
        backup_path = service.create_backup(custom_name=data.name)
        return CreateBackupResponse(
            name=backup_path.name,
            message=f"Backup created: {backup_path.name}",
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")


@router.get("/{backup_name}/download")
def download_backup(backup_name: str):
    """Download a backup file"""
    service = BackupService()
    backup_path = service.get_backup_by_name(backup_name)

    if not backup_path:
        raise HTTPException(status_code=404, detail=f"Backup not found: {backup_name}")

    return FileResponse(
        path=backup_path,
        filename=backup_path.name,
        media_type="application/octet-stream",
    )


@router.delete("/{backup_name}", status_code=204)
def delete_backup(backup_name: str):
    """Delete a backup file"""
    service = BackupService()
    backup_path = service.get_backup_by_name(backup_name)

    if not backup_path:
        raise HTTPException(status_code=404, detail=f"Backup not found: {backup_name}")

    success = service.delete_backup(backup_path)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete backup")

