"""Job Search routes for aggregating jobs from multiple platforms with LLM analysis"""

import json
import time
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from jam.core.services.application_service import ApplicationService
from jam.core.services.banned_company_service import BannedCompanyService
from jam.core.services.config_service import ConfigService
from jam.core.services.job_filter_service import JobFilterService
from jam.core.services.job_llm_analyzer_service import JobLLMAnalyzerService
from jam.core.services.job_search_results_service import JobSearchResultsService
from jam.core.services.job_search_service import JobSearchService

router = APIRouter()


# ============== Request/Response Models ==============


class JobSearchRequest(BaseModel):
    """Request model for job search"""

    keywords: list[str] | None = None
    locations: list[str] | None = None
    sites: list[str] | None = None  # Sites to search (e.g., ["linkedin", "indeed"])
    hours_old: int = 24
    results_wanted: int = 100
    filter_entry_level: bool = True
    max_experience_years: int = 3
    parallel: bool = True  # Enable parallel scraping across keyword/location combinations
    max_workers: int = 3  # Max concurrent searches when parallel=True
    offset: int = 0  # Starting offset for pagination (e.g., 25 starts from 25th result)


class JobListingResponse(BaseModel):
    """Response model for a single job listing"""

    id: int | None = None
    title: str
    company: str
    location: str | None = None
    date_posted: str | None = None
    job_url: str
    site_source: str
    description: str | None = None
    salary_min: float | None = None
    salary_max: float | None = None
    job_type: str | None = None
    first_seen_at: str | None = None
    last_seen_at: str | None = None
    llm_score: int | None = None
    llm_analysis: str | None = None
    llm_notes: str | None = None
    llm_analyzed_at: str | None = None
    is_mismatch: bool = False
    is_hidden: bool = False
    is_applied: bool = False
    applied_at: str | None = None
    applied_company: bool = False  # True if user has applied to this company before
    matched_skills: list[str] | None = None
    missing_skills: list[str] | None = None
    search_offset: int = 0  # Offset used when this job was found


class JobSearchResponse(BaseModel):
    """Response model for job search results"""

    jobs: list[JobListingResponse]
    total: int
    new_jobs: int
    updated_jobs: int
    keywords_used: list[str]
    locations_searched: list[str]


class SavedResultsResponse(BaseModel):
    """Response model for saved job search results"""

    jobs: list[JobListingResponse]
    total: int
    analyzed_count: int
    unanalyzed_count: int
    keywords: str | None = None
    last_seen_at: str | None = None


class FilterRequest(BaseModel):
    """Request model for adding a filter"""

    keyword: str
    filter_type: str  # "positive" or "negative"
    weight: float = 1.0


class FilterResponse(BaseModel):
    """Response model for a filter"""

    id: int
    keyword: str
    filter_type: str
    weight: float
    source: str | None = None
    match_count: int
    created_at: str
    updated_at: str


# ============== Search Endpoints ==============


@router.post("")
async def search_jobs_stream(request: JobSearchRequest):
    """
    Search for jobs across LinkedIn, Indeed, Glassdoor, ZipRecruiter, and Google.
    Returns Server-Sent Events with progress updates as results come in.
    Results are saved to database incrementally for real-time UI updates.

    SSE Message Types:
    - searching: Starting a new keyword/location search
    - found: Batch of results found and saved
    - error: Error during a specific search
    - complete: All searches finished
    """
    config_service = ConfigService()

    keywords = request.keywords
    if not keywords:
        stored_keywords = config_service.get("job_search_keywords")

        if stored_keywords:
            keywords = [k.strip() for k in stored_keywords.split(",") if k.strip()]

        if not keywords:
            raise HTTPException(
                status_code=400,
                detail="No keywords provided. Set keywords in Settings or provide them in the request.",
            )

    locations = request.locations
    if not locations:
        stored_loc = config_service.get("candidate_location")
        if stored_loc:
            locations = [loc.strip() for loc in stored_loc.split(",") if loc.strip()]

    hours_old = request.hours_old
    if hours_old == 24:
        stored_hours = config_service.get("job_search_hours_old")
        if stored_hours and str(stored_hours).isdigit():
            hours_old = int(stored_hours)
    max_exp = request.max_experience_years
    if max_exp == 3:
        stored_exp = config_service.get("candidate_experience_years")
        if stored_exp and str(stored_exp).isdigit():
            max_exp = int(stored_exp)

    def event_generator():
        try:
            # Auto-purge old results before searching
            results_service = JobSearchResultsService()
            purged_count = results_service.purge_old_results(hours=48)
            if purged_count > 0:
                print(f"Auto-purged {purged_count} old job results")

            service = JobSearchService()
            banned_service = BannedCompanyService()
            final_locations = locations or service.DMV_LOCATIONS

            total_new = 0
            total_updated = 0
            total_found = 0

            # Timing tracking
            start_time = time.time()
            search_times: list[float] = []

            # Choose search method based on parallel setting
            if request.parallel:
                search_generator = service.search_jobs_stream_parallel(
                    keywords=keywords,
                    locations=final_locations,
                    sites=request.sites,
                    hours_old=hours_old,
                    results_wanted=request.results_wanted,
                    filter_entry_level=request.filter_entry_level,
                    max_experience_years=max_exp,
                    max_workers=request.max_workers,
                    offset=request.offset,
                )
            else:
                search_generator = service.search_jobs_stream(
                    keywords=keywords,
                    locations=final_locations,
                    sites=request.sites,
                    hours_old=hours_old,
                    results_wanted=request.results_wanted,
                    filter_entry_level=request.filter_entry_level,
                    max_experience_years=max_exp,
                    offset=request.offset,
                )

            # Stream search results
            for batch in search_generator:
                if batch["type"] == "searching":
                    # Signal that we're searching
                    elapsed_ms = int((time.time() - start_time) * 1000)
                    batch["elapsed_ms"] = elapsed_ms
                    yield f"data: {json.dumps(batch)}\n\n"

                elif batch["type"] == "found":
                    search_end = time.time()
                    search_times.append(
                        search_end - start_time if not search_times else search_end - start_time
                    )

                    # Filter banned companies from this batch
                    jobs = batch["jobs"]
                    jobs = [j for j in jobs if not banned_service.is_banned(j.company)]

                    # Save batch to DB immediately
                    if jobs:
                        job_dicts = [job.to_dict() for job in jobs]
                        new_count, updated_count = results_service.save_results(job_dicts, keywords)
                        total_new += new_count
                        total_updated += updated_count
                        total_found += len(jobs)

                    # Calculate timing info
                    elapsed_ms = int((time.time() - start_time) * 1000)
                    progress = batch.get("progress", 0)
                    total = batch.get("total_searches", 1)
                    remaining = total - progress

                    # Calculate ETA based on average time per search
                    avg_per_search_ms = elapsed_ms / progress if progress > 0 else 0
                    eta_ms = int(avg_per_search_ms * remaining)

                    # Send progress update with timing
                    progress_update = json.dumps(
                        {
                            "type": "found",
                            "keyword": batch["keyword"],
                            "location": batch["location"],
                            "site": batch.get("site"),
                            "count": len(jobs),
                            "saved_new": new_count if jobs else 0,
                            "saved_updated": updated_count if jobs else 0,
                            "progress": progress,
                            "total_searches": total,
                            "elapsed_ms": elapsed_ms,
                            "eta_ms": eta_ms,
                            "avg_per_search_ms": int(avg_per_search_ms),
                        }
                    )

                    yield f"data: {progress_update}\n\n"

                elif batch["type"] == "error":
                    batch["elapsed_ms"] = int((time.time() - start_time) * 1000)
                    yield f"data: {json.dumps(batch)}\n\n"

            # Send completion message with total time
            total_time_ms = int((time.time() - start_time) * 1000)
            completion_message = json.dumps(
                {
                    "type": "complete",
                    "total": total_found,
                    "new_jobs": total_new,
                    "updated_jobs": total_updated,
                    "keywords_used": keywords,
                    "locations_searched": final_locations,
                    "total_time_ms": total_time_ms,
                }
            )

            yield f"data: {completion_message}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ============== Results Endpoints ==============


@router.get("/results", response_model=SavedResultsResponse)
async def get_saved_results(hours: int = 24, include_hidden: bool = False):
    """Get saved job search results from the last N hours, excluding banned companies"""
    try:
        results_service = JobSearchResultsService()
        banned_service = BannedCompanyService()
        app_service = ApplicationService()

        results = results_service.get_recent_results(hours=hours, include_hidden=include_hidden)
        info = results_service.get_latest_search_info()
        unanalyzed = results_service.get_unanalyzed_count()

        # Filter out jobs from banned companies
        results = [r for r in results if not banned_service.is_banned(r.company)]

        # Get applied company names (normalized) for matching
        applications = app_service.list(include_deleted=False)
        applied_companies = set()
        for app in applications:
            company_name = app.company_name or app.company_name_raw
            normalized = _normalize_text(company_name)
            if normalized:
                applied_companies.add(normalized)

        def has_applied_to_company(job_company: str) -> bool:
            """Check if user has applied to this company before"""
            normalized_job = _normalize_text(job_company)
            if not normalized_job:
                return False
            # Check exact match first
            if normalized_job in applied_companies:
                return True
            # Check fuzzy match (substring containment)
            for app_company in applied_companies:
                if normalized_job in app_company or app_company in normalized_job:
                    return True
            return False

        return SavedResultsResponse(
            jobs=[
                JobListingResponse(
                    id=r.id,
                    title=r.title,
                    company=r.company,
                    location=r.location,
                    date_posted=r.date_posted,
                    job_url=r.job_url,
                    site_source=r.site_source,
                    description=r.description,
                    salary_min=r.salary_min,
                    salary_max=r.salary_max,
                    job_type=r.job_type,
                    first_seen_at=r.first_seen_at,
                    last_seen_at=r.last_seen_at,
                    llm_score=r.llm_score,
                    llm_analysis=r.llm_analysis,
                    llm_notes=r.llm_notes,
                    llm_analyzed_at=r.llm_analyzed_at,
                    is_mismatch=r.is_mismatch,
                    is_hidden=r.is_hidden,
                    is_applied=r.is_applied,
                    applied_at=r.applied_at,
                    applied_company=has_applied_to_company(r.company),
                    matched_skills=r.matched_skills,
                    missing_skills=r.missing_skills,
                    search_offset=r.search_offset,
                )
                for r in results
            ],
            total=len(results),
            analyzed_count=info["analyzed_count"] if info else 0,
            unanalyzed_count=unanalyzed,
            keywords=info["keywords"] if info else None,
            last_seen_at=info["last_seen_at"] if info else None,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get saved results: {str(e)}")


@router.get("/results/info")
async def get_results_info():
    """Get info about saved results without fetching all data"""
    try:
        results_service = JobSearchResultsService()
        info = results_service.get_latest_search_info()
        unanalyzed = results_service.get_unanalyzed_count()
        recent_count = results_service.get_result_count(hours=24)

        return {
            "has_results": info is not None and info.get("total", 0) > 0,
            "total": info["total"] if info else 0,
            "recent_24h": recent_count,
            "analyzed_count": info["analyzed_count"] if info else 0,
            "unanalyzed_count": unanalyzed,
            "keywords": info["keywords"] if info else None,
            "last_seen_at": info["last_seen_at"] if info else None,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get results info: {str(e)}")


@router.get("/offsets")
async def get_used_offsets(results_wanted: int = 100):
    """
    Get distinct offsets used in saved results.

    Returns:
        offsets: List of distinct offset values used (sorted)
        suggested_next: Suggested next offset (max offset + results_wanted)
    """
    try:
        results_service = JobSearchResultsService()
        return results_service.get_used_offsets(results_wanted=results_wanted)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get offsets: {str(e)}")


@router.post("/results/{result_id}/hide")
async def hide_result(result_id: int):
    """Hide a job result"""
    try:
        results_service = JobSearchResultsService()
        if results_service.hide_job(result_id):
            return {"message": "Job hidden"}
        raise HTTPException(status_code=404, detail="Job not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/results/{result_id}/unhide")
async def unhide_result(result_id: int):
    """Unhide a job result"""
    try:
        results_service = JobSearchResultsService()
        if results_service.unhide_job(result_id):
            return {"message": "Job unhidden"}
        raise HTTPException(status_code=404, detail="Job not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/results/{result_id}/apply")
async def mark_applied(result_id: int):
    """Mark a job as applied"""
    try:
        results_service = JobSearchResultsService()
        if results_service.mark_applied(result_id):
            return {"message": "Job marked as applied"}
        raise HTTPException(status_code=404, detail="Job not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/results/{result_id}/unapply")
async def unmark_applied(result_id: int):
    """Unmark a job as applied"""
    try:
        results_service = JobSearchResultsService()
        if results_service.unmark_applied(result_id):
            return {"message": "Job unmarked as applied"}
        raise HTTPException(status_code=404, detail="Job not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Import shared text utilities
from jam.core.utils.text_utils import fuzzy_match as _fuzzy_match
from jam.core.utils.text_utils import normalize_text as _normalize_text


@router.post("/results/sync-applied")
async def sync_applied_status():
    """
    Match job search results against existing applications and update is_applied field.
    Uses fuzzy matching on company name + job title.

    Returns:
        Number of jobs matched and marked as applied
    """
    try:
        results_service = JobSearchResultsService()
        app_service = ApplicationService()

        # Get all applications (company + position)
        applications = app_service.list(include_deleted=False)
        if not applications:
            return {"matched": 0, "message": "No applications to match against"}

        # Build application signatures for matching
        app_signatures = [
            {
                "company": _normalize_text(app.company_name or app.company_name_raw),
                "position": _normalize_text(app.position),
            }
            for app in applications
        ]

        # Get all job search results
        all_results = results_service.get_all_results(include_hidden=True)

        matched_count = 0
        for job in all_results:
            if job.is_applied:
                continue  # Already marked

            job_company = _normalize_text(job.company)
            job_title = _normalize_text(job.title)

            # Check against all applications
            for sig in app_signatures:
                company_match = _fuzzy_match(job_company, sig["company"])
                title_match = _fuzzy_match(job_title, sig["position"])

                if company_match and title_match:
                    results_service.mark_applied(job.id)
                    matched_count += 1
                    break  # Don't double-match

        return {
            "matched": matched_count,
            "message": f"Matched {matched_count} jobs from your applications",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/results/{result_id}")
async def delete_result(result_id: int):
    """Delete a specific saved result"""
    try:
        results_service = JobSearchResultsService()
        if results_service.delete_result(result_id):
            return {"message": "Result deleted"}
        raise HTTPException(status_code=404, detail="Result not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/results")
async def clear_results():
    """Clear all saved job search results"""
    try:
        results_service = JobSearchResultsService()
        count = results_service.clear_results()
        return {"message": f"Cleared {count} saved results"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/results/purge")
async def purge_old_results(hours: int = 48):
    """
    Purge job results older than specified hours.
    Jobs marked as 'applied' are preserved.
    """
    try:
        results_service = JobSearchResultsService()
        count = results_service.purge_old_results(hours=hours)
        return {
            "message": f"Purged {count} old results",
            "purged_count": count,
            "hours_threshold": hours,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== Bulk Action Endpoints ==============


class BulkActionRequest(BaseModel):
    """Request model for bulk actions"""

    job_ids: list[int]


@router.post("/results/bulk/hide")
async def bulk_hide_results(request: BulkActionRequest):
    """Hide multiple job results"""
    try:
        results_service = JobSearchResultsService()
        count = results_service.hide_jobs_bulk(request.job_ids)
        return {"message": f"Hidden {count} jobs", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/results/bulk/unhide")
async def bulk_unhide_results(request: BulkActionRequest):
    """Unhide multiple job results"""
    try:
        results_service = JobSearchResultsService()
        count = results_service.unhide_jobs_bulk(request.job_ids)
        return {"message": f"Unhidden {count} jobs", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/results/bulk/apply")
async def bulk_mark_applied(request: BulkActionRequest):
    """Mark multiple jobs as applied"""
    try:
        results_service = JobSearchResultsService()
        count = results_service.mark_applied_bulk(request.job_ids)
        return {"message": f"Marked {count} jobs as applied", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/results/bulk/unapply")
async def bulk_unmark_applied(request: BulkActionRequest):
    """Unmark multiple jobs as applied"""
    try:
        results_service = JobSearchResultsService()
        count = results_service.unmark_applied_bulk(request.job_ids)
        return {"message": f"Unmarked {count} jobs", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/results/bulk/delete")
async def bulk_delete_results(request: BulkActionRequest):
    """Delete multiple job results"""
    try:
        results_service = JobSearchResultsService()
        count = results_service.delete_jobs_bulk(request.job_ids)
        return {"message": f"Deleted {count} jobs", "count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== LLM Analysis Endpoints ==============


@router.get("/analyze/status")
async def get_analysis_status():
    """Get LLM analysis status and availability"""
    try:
        analyzer = JobLLMAnalyzerService()
        status = await analyzer.get_status()

        results_service = JobSearchResultsService()
        unanalyzed = results_service.get_unanalyzed_count()

        return {
            **status,
            "unanalyzed_count": unanalyzed,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AnalyzeRequest(BaseModel):
    """Request model for analyze endpoint"""

    limit: int = 20
    job_ids: list[int] | None = None  # Specific jobs to analyze (force re-analysis)


class ClearAnalysisRequest(BaseModel):
    """Request model for clearing analysis"""

    job_ids: list[int] | None = None  # Specific jobs to clear (if omitted, clears all)


@router.post("/analyze")
async def analyze_jobs_stream(request: AnalyzeRequest):
    """
    Trigger LLM analysis on jobs.

    - If job_ids provided: Analyze those specific jobs (even if already analyzed)
    - Otherwise: Analyze up to 'limit' unanalyzed jobs

    Returns Server-Sent Events with progress updates including:
    - start: Initial queue with all job IDs to be analyzed
    - analyzing: Currently processing job
    - analyzed: Job completed with score
    - complete: All done
    """
    analyzer = JobLLMAnalyzerService()

    async def event_generator():
        try:
            async for progress in analyzer.analyze_jobs_stream(
                limit=request.limit,
                job_ids=request.job_ids,
            ):
                yield f"data: {json.dumps(progress)}\n\n"
        except Exception as e:
            error_data = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/analyze/clear")
async def clear_analysis(request: ClearAnalysisRequest):
    """
    Clear LLM analysis from jobs.

    - If job_ids provided: Clear analysis from those specific jobs
    - Otherwise: Clear analysis from ALL analyzed jobs

    Returns:
        message: Description of what was cleared
        cleared_count: Number of jobs that had their analysis cleared
    """
    try:
        results_service = JobSearchResultsService()

        if request.job_ids:
            # Clear specific jobs
            count = results_service.clear_analysis_bulk(request.job_ids)
        else:
            # Clear all analyzed jobs
            count = results_service.clear_analysis_all()

        return {
            "message": f"Cleared analysis from {count} jobs",
            "cleared_count": count,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== Filters Endpoints ==============


@router.get("/filters")
async def get_filters():
    """Get all learned filters"""
    try:
        filter_service = JobFilterService()
        filters = filter_service.get_all_filters()
        stats = filter_service.get_filter_stats()

        return {
            "filters": [f.to_dict() for f in filters],
            "total": len(filters),
            "stats": stats,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/filters", response_model=FilterResponse)
async def add_filter(request: FilterRequest):
    """Add a new filter manually"""
    try:
        filter_service = JobFilterService()
        result = filter_service.add_filter(
            keyword=request.keyword,
            filter_type=request.filter_type,
            weight=request.weight,
            source="user",
        )

        if result:
            return FilterResponse(**result.to_dict())
        raise HTTPException(status_code=400, detail="Failed to add filter")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/filters/{filter_id}")
async def delete_filter(filter_id: int):
    """Delete a filter"""
    try:
        filter_service = JobFilterService()
        if filter_service.delete_filter(filter_id):
            return {"message": "Filter deleted"}
        raise HTTPException(status_code=404, detail="Filter not found")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============== Keywords Endpoint ==============


@router.get("/keywords")
async def get_search_keywords():
    """Get the stored job search keywords"""
    config_service = ConfigService()
    stored_keywords = config_service.get("job_search_keywords")

    keywords = []
    if stored_keywords:
        keywords = [k.strip() for k in stored_keywords.split(",") if k.strip()]

    return {
        "keywords": keywords,
        "raw": stored_keywords or "",
    }
