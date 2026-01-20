"""Company routes"""

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from jam.core.services.company_service import CompanyService

from api.schemas import CompanyResponse, CompanyListResponse, AliasCreate, AliasResponse, MergeCompaniesRequest

router = APIRouter()


@router.get("", response_model=CompanyListResponse)
def list_companies(
    search: Optional[str] = Query(None, description="Search by name"),
    include_deleted: bool = Query(False, alias="all", description="Include soft-deleted apps in counts"),
):
    """List all companies"""
    service = CompanyService()

    if search:
        companies = service.search(search)
    else:
        companies = service.list()

    company_responses = []
    for company in companies:
        count = service.get_application_count(company.id, include_deleted=include_deleted)
        company_responses.append(
            CompanyResponse(
                id=company.id,
                name=company.name,
                application_count=count,
                created_at=company.created_at,
            )
        )

    return CompanyListResponse(
        companies=company_responses,
        total=len(company_responses),
    )


@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(
    company_id: int,
    include_deleted: bool = Query(False, alias="all"),
):
    """Get a single company by ID"""
    service = CompanyService()
    company = service.get(company_id)

    if not company:
        raise HTTPException(status_code=404, detail=f"Company #{company_id} not found")

    count = service.get_application_count(company_id, include_deleted=include_deleted)

    return CompanyResponse(
        id=company.id,
        name=company.name,
        application_count=count,
        created_at=company.created_at,
    )


@router.delete("/{company_id}", status_code=204)
def delete_company(company_id: int):
    """Delete a company (only if no applications exist)"""
    service = CompanyService()

    success, message = service.delete(company_id)
    if not success:
        raise HTTPException(status_code=400, detail=message)


@router.get("/{company_id}/aliases")
def get_company_aliases(company_id: int):
    """Get all aliases for a company"""
    service = CompanyService()

    company = service.get(company_id)
    if not company:
        raise HTTPException(status_code=404, detail=f"Company #{company_id} not found")

    aliases = service.get_aliases(company_id)

    return {
        "company_id": company_id,
        "aliases": [{"id": a.id, "alias": a.alias, "created_at": a.created_at} for a in aliases],
    }


@router.post("/{company_id}/aliases", response_model=AliasResponse, status_code=201)
def add_alias(company_id: int, data: AliasCreate):
    """Add an alias for a company"""
    service = CompanyService()

    company = service.get(company_id)
    if not company:
        raise HTTPException(status_code=404, detail=f"Company #{company_id} not found")

    if not data.alias.strip():
        raise HTTPException(status_code=400, detail="Alias cannot be empty")

    alias = service.add_alias(company_id, data.alias.strip())
    if not alias:
        raise HTTPException(status_code=400, detail="Failed to add alias")

    return AliasResponse(
        id=alias.id,
        company_id=alias.company_id,
        alias=alias.alias,
        created_at=alias.created_at,
    )


@router.delete("/{company_id}/aliases/{alias_id}", status_code=204)
def delete_alias(company_id: int, alias_id: int):
    """Remove an alias from a company"""
    service = CompanyService()

    company = service.get(company_id)
    if not company:
        raise HTTPException(status_code=404, detail=f"Company #{company_id} not found")

    aliases = service.get_aliases(company_id)
    alias = next((a for a in aliases if a.id == alias_id), None)
    if not alias:
        raise HTTPException(status_code=404, detail=f"Alias #{alias_id} not found")

    # Delete alias using table directly
    from jam.db.tables.company_table import CompanyTable
    table = CompanyTable()
    table.delete_alias(alias_id)


@router.post("/merge", response_model=CompanyResponse)
def merge_companies(data: MergeCompaniesRequest):
    """Merge two companies (move all apps from from_id to to_id)"""
    service = CompanyService()

    from_company = service.get(data.from_id)
    to_company = service.get(data.to_id)

    if not from_company:
        raise HTTPException(status_code=404, detail=f"Source company #{data.from_id} not found")
    if not to_company:
        raise HTTPException(status_code=404, detail=f"Target company #{data.to_id} not found")
    if data.from_id == data.to_id:
        raise HTTPException(status_code=400, detail="Cannot merge a company with itself")

    success = service.merge(data.from_id, data.to_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to merge companies")

    # Return updated target company
    count = service.get_application_count(data.to_id)
    return CompanyResponse(
        id=to_company.id,
        name=to_company.name,
        application_count=count,
        created_at=to_company.created_at,
    )
