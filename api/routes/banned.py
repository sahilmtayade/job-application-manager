"""Banned companies routes"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from jam.core.services.banned_company_service import BannedCompanyService

from api.schemas import (
    BannedCompanyCreate,
    BannedCompanyResponse,
    BannedCompanyListResponse,
    BannedCheckResponse,
)

router = APIRouter()


@router.get("", response_model=BannedCompanyListResponse)
def list_banned_companies():
    """List all banned companies"""
    service = BannedCompanyService()
    banned = service.list()

    return BannedCompanyListResponse(
        banned_companies=[
            BannedCompanyResponse(
                id=b.id,
                name=b.name,
                reason=b.reason,
                created_at=b.created_at,
            )
            for b in banned
        ],
        total=len(banned),
    )


@router.post("", response_model=BannedCompanyResponse, status_code=201)
def ban_company(data: BannedCompanyCreate):
    """Add a company to the banned list"""
    service = BannedCompanyService()

    if not data.name.strip():
        raise HTTPException(status_code=400, detail="Company name cannot be empty")

    success, message, banned = service.add(data.name, data.reason)
    if not success:
        raise HTTPException(status_code=400, detail=message)

    return BannedCompanyResponse(
        id=banned.id,
        name=banned.name,
        reason=banned.reason,
        created_at=banned.created_at,
    )


@router.delete("/{banned_id}", status_code=204)
def unban_company(banned_id: int):
    """Remove a company from the banned list"""
    service = BannedCompanyService()

    success, message = service.remove(banned_id)
    if not success:
        raise HTTPException(status_code=404, detail=message)


@router.get("/check", response_model=BannedCheckResponse)
def check_if_banned(name: str = Query(..., description="Company name to check")):
    """Check if a company name is banned"""
    service = BannedCompanyService()

    is_banned = service.is_banned(name)

    return BannedCheckResponse(
        name=name,
        is_banned=is_banned,
    )


@router.post("/check-batch")
def check_batch_banned(names: list[str]):
    """Check which company names from a list are banned"""
    service = BannedCompanyService()

    banned_names = service.check_names(names)

    return {
        "banned_names": banned_names,
        "total_checked": len(names),
        "total_banned": len(banned_names),
    }

