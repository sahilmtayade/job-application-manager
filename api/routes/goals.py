"""Goals routes"""

from typing import Optional

from fastapi import APIRouter, HTTPException

from jam.core.enums import GoalType
from jam.core.services.goal_service import GoalService

from api.schemas import (
    GoalCreate,
    GoalResponse,
    GoalProgress,
    GoalListResponse,
    CurrentGoalsResponse,
)

router = APIRouter()


def goal_to_response(goal) -> GoalResponse:
    """Convert Goal model to API response"""
    return GoalResponse(
        id=goal.id,
        goal_type=goal.goal_type.value,
        target_count=goal.target_count,
        period_start=goal.period_start,
        period_end=goal.period_end,
        created_at=goal.created_at,
    )


@router.get("", response_model=GoalListResponse)
def list_goals(goal_type: Optional[str] = None):
    """List all goals"""
    service = GoalService()

    type_filter = None
    if goal_type:
        try:
            type_filter = GoalType(goal_type.lower())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid goal type: {goal_type}")

    goals = service.get_all_goals(type_filter)

    return GoalListResponse(
        goals=[goal_to_response(g) for g in goals],
        total=len(goals),
    )


@router.get("/current", response_model=CurrentGoalsResponse)
def get_current_goals():
    """Get current daily and weekly goals with progress"""
    service = GoalService()

    daily_progress = service.get_progress(GoalType.DAILY)
    weekly_progress = service.get_progress(GoalType.WEEKLY)

    def to_progress(data: dict, goal_type: str) -> GoalProgress:
        goal = data.get("goal")
        return GoalProgress(
            goal=goal_to_response(goal) if goal else None,
            current=data.get("current", 0),
            target=data.get("target", 0),
            percentage=data.get("percentage", 0),
            remaining=data.get("remaining", 0),
            goal_type=goal_type,
        )

    return CurrentGoalsResponse(
        daily=to_progress(daily_progress, "daily") if daily_progress else None,
        weekly=to_progress(weekly_progress, "weekly") if weekly_progress else None,
    )


@router.post("", response_model=GoalResponse, status_code=201)
def create_goal(data: GoalCreate):
    """Create a new goal"""
    service = GoalService()

    try:
        goal_type = GoalType(data.goal_type.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid goal type: {data.goal_type}")

    if data.target_count <= 0:
        raise HTTPException(status_code=400, detail="Target count must be positive")

    goal = service.set_goal(goal_type, data.target_count)
    return goal_to_response(goal)


@router.get("/{goal_id}", response_model=GoalResponse)
def get_goal(goal_id: int):
    """Get a specific goal"""
    service = GoalService()
    goals = service.get_all_goals()

    for goal in goals:
        if goal.id == goal_id:
            return goal_to_response(goal)

    raise HTTPException(status_code=404, detail=f"Goal #{goal_id} not found")

