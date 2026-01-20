"""Stats routes"""

from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from jam.core.services.stats_service import StatsService
from jam.core.services.achievement_service import AchievementService

from api.schemas import (
    StatsSummaryResponse,
    StatsTrendsResponse,
    TrendDataPoint,
    StatsFunnelResponse,
    FunnelStage,
    StatsSourcesResponse,
    SourceStats,
    AchievementResponse,
    AchievementsListResponse,
    WeeklyComparisonResponse,
    CumulativeStatsResponse,
)

router = APIRouter()


def parse_since(since: Optional[str], service: StatsService) -> Optional[date]:
    """Parse since parameter (date or time window like 30d)"""
    if not since:
        return None

    try:
        return date.fromisoformat(since)
    except ValueError:
        try:
            return service.parse_time_window(since)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))


@router.get("/summary", response_model=StatsSummaryResponse)
def get_summary(
    since: Optional[str] = Query(None, description="Time window (30d, 2w, 3m) or date"),
    include_deleted: bool = Query(False, alias="all"),
):
    """Get summary statistics"""
    service = StatsService()
    since_date = parse_since(since, service)

    summary = service.get_summary(since=since_date, include_deleted=include_deleted)

    return StatsSummaryResponse(
        total=summary["total"],
        active=summary["active"],
        companies=summary["companies"],
        by_status=summary["by_status"],
        recent_activity=summary["recent_activity"],
        today=summary["today"],
        this_week=summary["this_week"],
        last_week=summary["last_week"],
        this_month=summary["this_month"],
        current_streak=summary["current_streak"],
        longest_streak=summary["longest_streak"],
        streak_at_risk=summary["streak_at_risk"],
    )


@router.get("/trends", response_model=StatsTrendsResponse)
def get_trends(
    since: Optional[str] = Query(None, description="Time window (30d, 2w, 3m) or date"),
    group_by: str = Query("day", description="Grouping interval: day, week"),
    include_deleted: bool = Query(False, alias="all"),
):
    """Get application trends over time"""
    service = StatsService()
    since_date = parse_since(since, service)

    trends = service.get_trends(
        since=since_date,
        group_by=group_by,
        include_deleted=include_deleted,
    )

    return StatsTrendsResponse(
        data=[TrendDataPoint(date=item["period"], count=item["count"]) for item in trends],
        period=group_by,
    )


@router.get("/funnel", response_model=StatsFunnelResponse)
def get_funnel(
    since: Optional[str] = Query(None, description="Time window (30d, 2w, 3m) or date"),
    include_deleted: bool = Query(False, alias="all"),
):
    """Get application funnel with conversion rates"""
    service = StatsService()
    since_date = parse_since(since, service)

    funnel = service.get_funnel(since=since_date, include_deleted=include_deleted)

    return StatsFunnelResponse(
        stages={
            stage: FunnelStage(count=data["count"], rate=data["rate"])
            for stage, data in funnel.items()
        }
    )


@router.get("/sources", response_model=StatsSourcesResponse)
def get_sources(
    since: Optional[str] = Query(None, description="Time window (30d, 2w, 3m) or date"),
    include_deleted: bool = Query(False, alias="all"),
):
    """Get success rate by source"""
    service = StatsService()
    since_date = parse_since(since, service)

    sources = service.get_success_rate_by_source(since=since_date, include_deleted=include_deleted)

    return StatsSourcesResponse(
        sources=[
            SourceStats(
                source=s["source"],
                total=s["total"],
                success_count=s["success_count"],
                success_rate=s["success_rate"],
            )
            for s in sources
        ]
    )


@router.get("/achievements", response_model=AchievementsListResponse)
def get_achievements():
    """Get all achievements with unlock status"""
    service = AchievementService()
    achievements = service.get_achievements()

    return AchievementsListResponse(
        achievements=[
            AchievementResponse(
                id=a["id"],
                name=a["name"],
                description=a["description"],
                icon=a["icon"],
                category=a["category"],
                threshold=a["threshold"],
                progress=a["progress"],
                unlocked=a["unlocked"],
                reset_period=a.get("reset_period"),
            )
            for a in achievements
        ],
        total_unlocked=sum(1 for a in achievements if a["unlocked"]),
        total=len(achievements),
    )


@router.get("/weekly-comparison", response_model=WeeklyComparisonResponse)
def get_weekly_comparison(
    include_deleted: bool = Query(False, alias="all"),
):
    """Get this week vs last week comparison"""
    service = StatsService()
    comparison = service.get_weekly_comparison(include_deleted=include_deleted)

    return WeeklyComparisonResponse(
        this_week_apps=comparison["this_week_apps"],
        last_week_apps=comparison["last_week_apps"],
        apps_change_pct=comparison["apps_change_pct"],
        this_week_interviews=comparison["this_week_interviews"],
        last_week_interviews=comparison["last_week_interviews"],
        interviews_change_pct=comparison["interviews_change_pct"],
        this_week_responses=comparison["this_week_responses"],
        last_week_responses=comparison["last_week_responses"],
        responses_change_pct=comparison["responses_change_pct"],
        current_streak=comparison["current_streak"],
        streak_at_risk=comparison["streak_at_risk"],
    )


@router.get("/cumulative", response_model=CumulativeStatsResponse)
def get_cumulative(
    include_deleted: bool = Query(False, alias="all"),
):
    """Get cumulative/lifetime statistics"""
    service = StatsService()
    stats = service.get_cumulative_stats(include_deleted=include_deleted)

    return CumulativeStatsResponse(
        total_applications=stats["total_applications"],
        total_companies=stats["total_companies"],
        days_since_start=stats["days_since_start"],
        total_days_active=stats["total_days_active"],
        avg_per_day=stats["avg_per_day"],
        avg_per_week=stats["avg_per_week"],
        most_active_day=stats["most_active_day"],
        busiest_month=stats["busiest_month"],
        total_responses=stats["total_responses"],
        response_rate=stats["response_rate"],
    )


@router.get("/top-companies")
def get_top_companies(
    limit: int = Query(10, ge=1, le=50),
    since: Optional[str] = Query(None, description="Time window (30d, 2w, 3m) or date"),
    include_deleted: bool = Query(False, alias="all"),
):
    """Get companies with most applications"""
    service = StatsService()
    since_date = parse_since(since, service)

    companies = service.get_top_companies(
        limit=limit,
        since=since_date,
        include_deleted=include_deleted,
    )

    return {"companies": companies}

