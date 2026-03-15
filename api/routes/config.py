"""Config routes"""

import base64
from datetime import datetime

from fastapi import APIRouter, HTTPException, UploadFile, File

from jam.core.services.config_service import ConfigService

from api.schemas import ConfigResponse, ConfigUpdateRequest, ConfigListResponse, ResumeInfoResponse, ResumeDataResponse

router = APIRouter()


@router.get("", response_model=ConfigListResponse)
def list_config():
    """Get all configuration values"""
    service = ConfigService()
    config = service.get_all()

    # Include defaults for keys not set
    all_config = {}
    for key in service.DEFAULTS:
        all_config[key] = config.get(key) or service.DEFAULTS.get(key)

    # Add any user-set keys not in defaults
    for key, value in config.items():
        all_config[key] = value

    # Ensure all values are strings (some may be stored as other types)
    all_config = {k: str(v) if v is not None else None for k, v in all_config.items()}

    return ConfigListResponse(config=all_config)


@router.post("/reset", status_code=204)
def reset_config():
    """Reset all configuration to defaults"""
    service = ConfigService()
    service.reset()


# Resume storage endpoints - MUST be before /{key} routes to avoid conflicts
@router.get("/resume/info", response_model=ResumeInfoResponse)
def get_resume_info():
    """Get information about stored resume (without the data)"""
    service = ConfigService()
    filename = service.get("resume_filename")
    mime_type = service.get("resume_mime_type")
    uploaded_at = service.get("resume_uploaded_at")

    return ResumeInfoResponse(
        has_resume=filename is not None,
        filename=filename,
        mime_type=mime_type,
        uploaded_at=uploaded_at,
    )


@router.get("/resume/data", response_model=ResumeDataResponse)
def get_resume_data():
    """Get stored resume with data"""
    service = ConfigService()
    filename = service.get("resume_filename")
    mime_type = service.get("resume_mime_type")
    uploaded_at = service.get("resume_uploaded_at")
    data = service.get("resume_data")

    return ResumeDataResponse(
        has_resume=filename is not None,
        filename=filename,
        mime_type=mime_type,
        uploaded_at=uploaded_at,
        data=data,
    )


@router.post("/resume", response_model=ResumeInfoResponse)
async def upload_resume(file: UploadFile = File(...)):
    """Upload and store a resume (image or PDF)."""
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Supported formats: PDF, JPEG, PNG, WebP."
        )

    # Read and encode file
    content = await file.read()
    data_base64 = base64.b64encode(content).decode("utf-8")

    # Store in config
    service = ConfigService()
    service.set("resume_filename", file.filename)
    service.set("resume_mime_type", file.content_type)
    service.set("resume_uploaded_at", datetime.now().isoformat())
    service.set("resume_data", data_base64)

    return ResumeInfoResponse(
        has_resume=True,
        filename=file.filename,
        mime_type=file.content_type,
        uploaded_at=service.get("resume_uploaded_at"),
    )


@router.delete("/resume", status_code=204)
def delete_resume():
    """Delete stored resume"""
    service = ConfigService()
    service.delete("resume_filename")
    service.delete("resume_mime_type")
    service.delete("resume_uploaded_at")
    service.delete("resume_data")


# Generic key routes - MUST be after specific routes like /resume/*
@router.get("/{key}", response_model=ConfigResponse)
def get_config(key: str):
    """Get a single configuration value"""
    service = ConfigService()
    value = service.get(key)

    return ConfigResponse(key=key, value=str(value) if value is not None else None)


@router.put("/{key}", response_model=ConfigResponse)
def set_config(key: str, data: ConfigUpdateRequest):
    """Set a configuration value"""
    service = ConfigService()
    config = service.set(key, data.value)

    return ConfigResponse(key=config.key, value=config.value)


@router.delete("/{key}", status_code=204)
def delete_config(key: str):
    """Delete a configuration value"""
    service = ConfigService()

    if not service.exists(key):
        raise HTTPException(status_code=404, detail=f"Configuration key '{key}' not found")

    service.delete(key)
