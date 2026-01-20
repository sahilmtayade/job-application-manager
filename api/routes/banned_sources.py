"""Banned sources routes"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from jam.core.services.banned_source_service import BannedSourceService

from api.schemas import (
    BannedSourceCreate,
    BannedSourceResponse,
    BannedSourceListResponse,
    BannedSourceCheckResponse,
)

router = APIRouter()


@router.get("", response_model=BannedSourceListResponse)
def list_banned_sources():
    """List all banned sources"""
    service = BannedSourceService()
    banned = service.list()

    return BannedSourceListResponse(
        banned_sources=[
            BannedSourceResponse(
                id=b.id,
                name=b.name,
                reason=b.reason,
                created_at=b.created_at,
            )
            for b in banned
        ],
        total=len(banned),
    )


@router.post("", response_model=BannedSourceResponse, status_code=201)
def ban_source(data: BannedSourceCreate):
    """Add a source to the banned list"""
    service = BannedSourceService()
    success, message, banned = service.add(data.name, data.reason)

    if not success:
        raise HTTPException(status_code=400, detail=message)

    return BannedSourceResponse(
        id=banned.id,
        name=banned.name,
        reason=banned.reason,
        created_at=banned.created_at,
    )


@router.delete("/{banned_id}")
def unban_source(banned_id: int):
    """Remove a source from the banned list"""
    service = BannedSourceService()
    success, message = service.remove(banned_id)

    if not success:
        raise HTTPException(status_code=404, detail=message)

    return {"message": message}


@router.get("/check", response_model=BannedSourceCheckResponse)
def check_if_source_banned(name: str = Query(..., description="Source name to check")):
    """Check if a source is banned"""
    service = BannedSourceService()
    is_banned = service.is_banned(name)

    return BannedSourceCheckResponse(
        name=name,
        is_banned=is_banned,
        banned=service.table.get_by_name(name) if is_banned else None,
    )


@router.post("/check-batch")
def check_batch_banned_sources(names: list[str]):
    """Check multiple source names"""
    service = BannedSourceService()
    banned_names = service.check_names(names)

    return {
        "banned_names": banned_names,
        "total_checked": len(names),
        "total_banned": len(banned_names),
    }

