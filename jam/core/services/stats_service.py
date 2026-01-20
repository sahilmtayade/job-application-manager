"""Service layer for statistics and analytics"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Optional

from jam.core.enums import ApplicationStatus
from jam.db.connection import get_cursor


class StatsService:
    """Business logic for application statistics"""

    def parse_time_window(self, window: str) -> date:
        """
        Parse a time window string into a start date.

        Supported formats:
        - 30d (days)
        - 2w (weeks)
        - 3m (months)
        - 1y (years)
        """
        match = re.match(r"^(\d+)([dwmy])$", window.lower())
        if not match:
            raise ValueError(f"Invalid time window format: {window}. Use format like 30d, 2w, 3m, 1y")

        amount = int(match.group(1))
        unit = match.group(2)
        today = date.today()

        if unit == "d":
            return today - timedelta(days=amount)
        elif unit == "w":
            return today - timedelta(weeks=amount)
        elif unit == "m":
            # Approximate months as 30 days
            return today - timedelta(days=amount * 30)
        elif unit == "y":
            # Approximate years as 365 days
            return today - timedelta(days=amount * 365)

        raise ValueError(f"Unknown time unit: {unit}")

    def get_summary(self, since: Optional[date] = None, include_deleted: bool = False) -> dict:
        """
        Get summary statistics.

        Returns dict with:
        - total: Total applications
        - by_status: Count per status
        - response_rate: % that progressed past 'applied'
        - active: Count of active applications
        - companies: Unique companies applied to
        - recent_activity: Applications in last 7 days
        - today: Applications today
        - this_week: Applications this week
        - last_week: Applications last week
        - this_month: Applications this month
        """
        with get_cursor() as (conn, cursor):
            where_clause = "WHERE 1=1" if include_deleted else "WHERE is_deleted = 0"
            params: list = []

            if since:
                where_clause += " AND applied_at >= ?"
                params.append(since)

            # Total count (excluding soft-deleted applications)
            cursor.execute(
                f"SELECT COUNT(*) as count FROM applications {where_clause}",
                params
            )
            total = cursor.fetchone()["count"]

            # Count by status (from events)
            cursor.execute(
                f"""
                SELECT e.to_status as status, COUNT(*) as count
                FROM applications a
                LEFT JOIN application_events e ON e.application_id = a.id
                    AND e.timestamp = (
                        SELECT MAX(timestamp)
                        FROM application_events
                        WHERE application_id = a.id
                    )
                {where_clause.replace('WHERE', 'WHERE a.')}
                GROUP BY e.to_status
                """,
                params
            )
            by_status = {row["status"]: row["count"] for row in cursor.fetchall() if row["status"]}

            # Response rate (any status beyond 'applied')
            cursor.execute(
                f"""
                SELECT COUNT(DISTINCT a.id) as count
                FROM applications a
                LEFT JOIN application_events e ON e.application_id = a.id
                    AND e.timestamp = (
                        SELECT MAX(timestamp)
                        FROM application_events
                        WHERE application_id = a.id
                    )
                {where_clause.replace('WHERE', 'WHERE a.')} AND e.to_status != 'applied'
                """,
                params
            )
            responded = cursor.fetchone()["count"]
            response_rate = (responded / total * 100) if total > 0 else 0

            # Active applications (non-terminal, non-deleted)
            active_statuses = [s.value for s in ApplicationStatus.active_statuses()]
            placeholders = ",".join("?" * len(active_statuses))

            active_params = params.copy()
            active_params.extend(active_statuses)
            cursor.execute(
                f"""
                SELECT COUNT(DISTINCT a.id) as count
                FROM applications a
                LEFT JOIN application_events e ON e.application_id = a.id
                    AND e.timestamp = (
                        SELECT MAX(timestamp)
                        FROM application_events
                        WHERE application_id = a.id
                    )
                {where_clause.replace('WHERE', 'WHERE a.')} AND e.to_status IN ({placeholders})
                """,
                active_params
            )
            active = cursor.fetchone()["count"]

            # Unique companies
            cursor.execute(
                f"""
                SELECT COUNT(DISTINCT company_id) as count
                FROM applications
                {where_clause}
                """,
                params
            )
            companies = cursor.fetchone()["count"]

            # Recent activity (last 7 days)
            recent_date = date.today() - timedelta(days=7)
            recent_params = params.copy() if not since or recent_date > since else []
            recent_where = where_clause
            if not since or recent_date > since:
                # Only filter by recent date if it's more restrictive than 'since'
                if since:
                    # Replace the since condition with recent condition
                    recent_where = where_clause.replace("AND applied_at >= ?", "AND applied_at >= ?")
                    recent_params[-1] = recent_date
                else:
                    recent_where += " AND applied_at >= ?"
                    recent_params.append(recent_date)

            cursor.execute(
                f"SELECT COUNT(*) as count FROM applications {recent_where}",
                recent_params
            )
            recent_activity = cursor.fetchone()["count"]

            # This week (Monday to today)
            today = date.today()
            week_start = today - timedelta(days=today.weekday())
            week_params = params.copy() if not since or week_start > since else []
            week_where = where_clause
            if not since or week_start > since:
                if since:
                    week_where = where_clause.replace("AND applied_at >= ?", "AND applied_at >= ?")
                    week_params[-1] = week_start
                else:
                    week_where += " AND applied_at >= ?"
                    week_params.append(week_start)

            cursor.execute(
                f"SELECT COUNT(*) as count FROM applications {week_where}",
                week_params
            )
            this_week = cursor.fetchone()["count"]

            # Last week (Monday to Sunday of previous week)
            last_week_start = week_start - timedelta(days=7)
            last_week_end = week_start - timedelta(days=1)
            last_week_params = params.copy()
            last_week_where = where_clause

            if not since or last_week_start > since:
                if since:
                    last_week_where = where_clause + " AND applied_at >= ? AND applied_at <= ?"
                    last_week_params.append(last_week_start)
                    last_week_params.append(last_week_end)
                else:
                    last_week_where += " AND applied_at >= ? AND applied_at <= ?"
                    last_week_params.append(last_week_start)
                    last_week_params.append(last_week_end)

            cursor.execute(
                f"SELECT COUNT(*) as count FROM applications {last_week_where}",
                last_week_params
            )
            last_week = cursor.fetchone()["count"]

            # This month (1st of current month to today)
            month_start = today.replace(day=1)
            month_params = params.copy() if not since or month_start > since else []
            month_where = where_clause
            if not since or month_start > since:
                if since:
                    month_where = where_clause.replace("AND applied_at >= ?", "AND applied_at >= ?")
                    month_params[-1] = month_start
                else:
                    month_where += " AND applied_at >= ?"
                    month_params.append(month_start)

            cursor.execute(
                f"SELECT COUNT(*) as count FROM applications {month_where}",
                month_params
            )
            this_month = cursor.fetchone()["count"]

            # Today
            today_params = params.copy() if not since or today > since else []
            today_where = where_clause
            if not since or today >= since:
                if since:
                    today_where = where_clause.replace("AND applied_at >= ?", "AND applied_at = ?")
                    today_params[-1] = today
                else:
                    today_where += " AND applied_at = ?"
                    today_params.append(today)

            cursor.execute(
                f"SELECT COUNT(*) as count FROM applications {today_where}",
                today_params
            )
            today_count = cursor.fetchone()["count"]

            # Get streak data
            streak_data = self._calculate_streaks(cursor)

            return {
                "total": total,
                "by_status": by_status,
                "response_rate": round(response_rate, 1),
                "active": active,
                "companies": companies,
                "recent_activity": recent_activity,
                "today": today_count,
                "this_week": this_week,
                "last_week": last_week,
                "this_month": this_month,
                "current_streak": streak_data["current_streak"],
                "longest_streak": streak_data["longest_streak"],
                "streak_at_risk": streak_data["streak_at_risk"],
            }

    def _calculate_streaks(self, cursor) -> dict:
        """
        Calculate application streaks.

        Returns:
        - current_streak: Consecutive days with at least 1 application (including today if applied)
        - longest_streak: All-time best streak
        - streak_at_risk: True if no application today but had one yesterday (streak will break if no app today)
        """
        today = date.today()

        # Get all unique dates with applications (non-deleted), ordered descending
        cursor.execute(
            """
            SELECT DISTINCT date(applied_at) as app_date
            FROM applications
            WHERE is_deleted = 0
            ORDER BY app_date DESC
            """
        )

        dates_with_apps = [row["app_date"] for row in cursor.fetchall()]

        if not dates_with_apps:
            return {"current_streak": 0, "longest_streak": 0, "streak_at_risk": False}

        # Convert to date objects
        app_dates = set()
        for d in dates_with_apps:
            if isinstance(d, str):
                app_dates.add(date.fromisoformat(d))
            else:
                app_dates.add(d)

        # Calculate current streak
        current_streak = 0
        check_date = today

        # Check if today has an application
        has_today = today in app_dates

        if has_today:
            # Start counting from today
            while check_date in app_dates:
                current_streak += 1
                check_date -= timedelta(days=1)
            streak_at_risk = False
        else:
            # Check if yesterday had an application (streak at risk)
            yesterday = today - timedelta(days=1)
            if yesterday in app_dates:
                # Count streak from yesterday
                check_date = yesterday
                while check_date in app_dates:
                    current_streak += 1
                    check_date -= timedelta(days=1)
                streak_at_risk = True
            else:
                streak_at_risk = False

        # Calculate longest streak
        longest_streak = 0
        if app_dates:
            sorted_dates = sorted(app_dates)
            current_run = 1
            max_run = 1

            for i in range(1, len(sorted_dates)):
                if (sorted_dates[i] - sorted_dates[i-1]).days == 1:
                    current_run += 1
                    max_run = max(max_run, current_run)
                else:
                    current_run = 1

            longest_streak = max_run

        return {
            "current_streak": current_streak,
            "longest_streak": longest_streak,
            "streak_at_risk": streak_at_risk,
        }

    def get_trends(
        self,
        since: Optional[date] = None,
        group_by: str = "day",  # "day" or "week"
        include_deleted: bool = False,
    ) -> list[dict]:
        """
        Get application trends over time.

        Returns list of dicts with:
        - period: Date or week start
        - count: Applications in period
        - by_status: Count per status
        """
        with get_cursor() as (conn, cursor):
            where_clause = "WHERE 1=1" if include_deleted else "WHERE is_deleted = 0"
            params: list = []

            if since:
                where_clause += " AND applied_at >= ?"
                params.append(since)

            if group_by == "week":
                # Group by week (Monday)
                cursor.execute(
                    f"""
                    SELECT
                        date(a.applied_at, 'weekday 0', '-6 days') as period,
                        e.to_status as status,
                        COUNT(*) as count
                    FROM applications a
                    LEFT JOIN application_events e ON e.application_id = a.id
                        AND e.timestamp = (
                            SELECT MAX(timestamp)
                            FROM application_events
                            WHERE application_id = a.id
                        )
                    {where_clause.replace('WHERE', 'WHERE a.')}
                    GROUP BY period, e.to_status
                    ORDER BY period
                    """,
                    params
                )
            else:  # day
                cursor.execute(
                    f"""
                    SELECT
                        date(a.applied_at) as period,
                        e.to_status as status,
                        COUNT(*) as count
                    FROM applications a
                    LEFT JOIN application_events e ON e.application_id = a.id
                        AND e.timestamp = (
                            SELECT MAX(timestamp)
                            FROM application_events
                            WHERE application_id = a.id
                        )
                    {where_clause.replace('WHERE', 'WHERE a.')}
                    GROUP BY period, e.to_status
                    ORDER BY period
                    """,
                    params
                )

            # Aggregate by period
            periods: dict = defaultdict(lambda: {"count": 0, "by_status": defaultdict(int)})
            for row in cursor.fetchall():
                period = row["period"]
                periods[period]["count"] += row["count"]
                periods[period]["by_status"][row["status"]] += row["count"]

            # Convert to list
            return [
                {
                    "period": period,
                    "count": data["count"],
                    "by_status": dict(data["by_status"]),
                }
                for period, data in sorted(periods.items())
            ]

    def get_top_companies(self, limit: int = 10, since: Optional[date] = None, include_deleted: bool = False) -> list[dict]:
        """Get companies with most applications"""
        with get_cursor() as (conn, cursor):
            where_clause = "WHERE 1=1" if include_deleted else "WHERE a.is_deleted = 0"
            params: list = []

            if since:
                where_clause += " AND a.applied_at >= ?"
                params.append(since)

            params.append(limit)
            cursor.execute(
                f"""
                SELECT c.name, COUNT(*) as count
                FROM applications a
                JOIN companies c ON a.company_id = c.id
                {where_clause}
                GROUP BY a.company_id
                ORDER BY count DESC
                LIMIT ?
                """,
                params
            )

            return [{"company": row["name"], "count": row["count"]} for row in cursor.fetchall()]

    def get_status_transitions(self, since: Optional[date] = None, include_deleted: bool = False) -> dict:
        """Get average time between status transitions"""
        with get_cursor() as (conn, cursor):
            where_clause = "WHERE 1=1" if include_deleted else "WHERE a.is_deleted = 0"
            params: list = []

            if since:
                where_clause += " AND e.timestamp >= ?"
                params.append(since)

            cursor.execute(
                f"""
                SELECT
                    e.from_status,
                    e.to_status,
                    AVG(
                        julianday(e.timestamp) - julianday(
                            (SELECT MAX(e2.timestamp)
                             FROM application_events e2
                             WHERE e2.application_id = e.application_id
                               AND e2.timestamp < e.timestamp)
                        )
                    ) as avg_days
                FROM application_events e
                JOIN applications a ON e.application_id = a.id
                {where_clause}
                GROUP BY e.from_status, e.to_status
                HAVING e.from_status IS NOT NULL
                """,
                params
            )

            transitions = {}
            for row in cursor.fetchall():
                key = f"{row['from_status']} -> {row['to_status']}"
                avg_days = row["avg_days"]
                if avg_days is not None:
                    transitions[key] = round(avg_days, 1)

            return transitions

    def get_funnel(self, since: Optional[date] = None, include_deleted: bool = False) -> dict:
        """
        Get application funnel statistics.
        Shows conversion rates through the application process.
        """
        with get_cursor() as (conn, cursor):
            where_clause = "WHERE 1=1" if include_deleted else "WHERE is_deleted = 0"
            params: list = []

            if since:
                where_clause += " AND applied_at >= ?"
                params.append(since)

            # Define funnel stages
            funnel_stages = [
                ApplicationStatus.APPLIED,
                ApplicationStatus.SCREENING,
                ApplicationStatus.INTERVIEWING,
                ApplicationStatus.OFFER,
                ApplicationStatus.ACCEPTED,
            ]

            funnel = {}
            for stage in funnel_stages:
                cursor.execute(
                    f"""
                    SELECT COUNT(DISTINCT a.id) as count
                    FROM applications a
                    LEFT JOIN application_events e ON e.application_id = a.id
                        AND e.timestamp = (
                            SELECT MAX(timestamp)
                            FROM application_events
                            WHERE application_id = a.id
                        )
                    {where_clause.replace('WHERE', 'WHERE a.')} AND e.to_status = ?
                    """,
                    params + [stage.value]
                )
                row = cursor.fetchone()
                funnel[stage.value] = row["count"] if row else 0

            # Calculate conversion rates
            result = {}
            prev_count = funnel[ApplicationStatus.APPLIED.value]
            result["applied"] = {"count": prev_count, "rate": 100.0}

            for stage in funnel_stages[1:]:
                count = funnel[stage.value]
                rate = (count / prev_count * 100) if prev_count > 0 else 0
                result[stage.value] = {"count": count, "rate": round(rate, 1)}
                if stage == ApplicationStatus.INTERVIEWING:
                    prev_count = count  # Reset base for offer conversion

            return result

    def get_success_rate_by_source(self, since: Optional[date] = None, include_deleted: bool = False) -> list[dict]:
        """
        Get success rate (offers + accepted / total) by source.
        """
        with get_cursor() as (conn, cursor):
            where_clause = "WHERE 1=1" if include_deleted else "WHERE is_deleted = 0"
            params: list = []

            if since:
                where_clause += " AND applied_at >= ?"
                params.append(since)

            cursor.execute(
                f"""
                SELECT
                    a.source,
                    COUNT(DISTINCT a.id) as total,
                    SUM(CASE WHEN e.to_status IN ('offer', 'accepted') THEN 1 ELSE 0 END) as success_count
                FROM applications a
                LEFT JOIN application_events e ON e.application_id = a.id
                    AND e.timestamp = (
                        SELECT MAX(timestamp)
                        FROM application_events
                        WHERE application_id = a.id
                    )
                {where_clause.replace('WHERE', 'WHERE a.')} AND a.source IS NOT NULL
                GROUP BY a.source
                ORDER BY success_count DESC, total DESC
                """,
                params
            )

            results = []
            for row in cursor.fetchall():
                total = row["total"]
                success_count = row["success_count"]
                success_rate = (success_count / total * 100) if total > 0 else 0
                results.append({
                    "source": row["source"],
                    "total": total,
                    "success_count": success_count,
                    "success_rate": round(success_rate, 1),
                })

            return results

    def get_source_breakdown(self, since: Optional[date] = None, include_deleted: bool = False) -> dict:
        """Get count and percentage by source"""
        with get_cursor() as (conn, cursor):
            where_clause = "WHERE 1=1" if include_deleted else "WHERE is_deleted = 0"
            params: list = []

            if since:
                where_clause += " AND applied_at >= ?"
                params.append(since)

            cursor.execute(
                f"""
                SELECT COUNT(*) as total
                FROM applications
                {where_clause}
                """,
                params
            )
            total_row = cursor.fetchone()
            total = total_row["total"] if total_row else 0

            cursor.execute(
                f"""
                SELECT
                    COALESCE(source, '(not set)') as source,
                    COUNT(*) as count
                FROM applications
                {where_clause}
                GROUP BY source
                ORDER BY count DESC
                """,
                params
            )

            breakdown = {}
            for row in cursor.fetchall():
                count = row["count"]
                percentage = (count / total * 100) if total > 0 else 0
                breakdown[row["source"]] = {
                    "count": count,
                    "percentage": round(percentage, 1),
                }

            return breakdown

    def get_work_location_breakdown(self, since: Optional[date] = None, include_deleted: bool = False) -> dict:
        """Get count and percentage by work location"""
        with get_cursor() as (conn, cursor):
            where_clause = "WHERE 1=1" if include_deleted else "WHERE is_deleted = 0"
            params: list = []

            if since:
                where_clause += " AND applied_at >= ?"
                params.append(since)

            cursor.execute(
                f"""
                SELECT COUNT(*) as total
                FROM applications
                {where_clause}
                """,
                params
            )
            total_row = cursor.fetchone()
            total = total_row["total"] if total_row else 0

            cursor.execute(
                f"""
                SELECT
                    COALESCE(work_location, '(not set)') as work_location,
                    COUNT(*) as count
                FROM applications
                {where_clause}
                GROUP BY work_location
                ORDER BY count DESC
                """,
                params
            )

            breakdown = {}
            for row in cursor.fetchall():
                count = row["count"]
                percentage = (count / total * 100) if total > 0 else 0
                breakdown[row["work_location"]] = {
                    "count": count,
                    "percentage": round(percentage, 1),
                }

            return breakdown

    def get_weekly_comparison(self, include_deleted: bool = False) -> dict:
        """Get this week vs last week comparison"""
        with get_cursor() as (conn, cursor):
            today = date.today()
            start_of_this_week = today - timedelta(days=today.weekday())
            start_of_last_week = start_of_this_week - timedelta(days=7)

            where_clause = "" if include_deleted else "AND is_deleted = 0"

            # This week applications
            cursor.execute(
                f"""
                SELECT COUNT(*) as count
                FROM applications
                WHERE date(applied_at) >= ? {where_clause}
                """,
                (start_of_this_week.isoformat(),)
            )
            this_week_apps = cursor.fetchone()["count"]

            # Last week applications
            cursor.execute(
                f"""
                SELECT COUNT(*) as count
                FROM applications
                WHERE date(applied_at) >= ? AND date(applied_at) < ? {where_clause}
                """,
                (start_of_last_week.isoformat(), start_of_this_week.isoformat())
            )
            last_week_apps = cursor.fetchone()["count"]

            # This week interviews
            cursor.execute(
                f"""
                SELECT COUNT(DISTINCT a.id) as count
                FROM applications a
                JOIN application_events e ON e.application_id = a.id
                WHERE e.to_status = 'interviewing'
                AND date(e.timestamp) >= ? {where_clause.replace('is_deleted', 'a.is_deleted')}
                """,
                (start_of_this_week.isoformat(),)
            )
            this_week_interviews = cursor.fetchone()["count"]

            # Last week interviews
            cursor.execute(
                f"""
                SELECT COUNT(DISTINCT a.id) as count
                FROM applications a
                JOIN application_events e ON e.application_id = a.id
                WHERE e.to_status = 'interviewing'
                AND date(e.timestamp) >= ? AND date(e.timestamp) < ? {where_clause.replace('is_deleted', 'a.is_deleted')}
                """,
                (start_of_last_week.isoformat(), start_of_this_week.isoformat())
            )
            last_week_interviews = cursor.fetchone()["count"]

            # This week responses (screening/interview/offer)
            cursor.execute(
                f"""
                SELECT COUNT(DISTINCT a.id) as count
                FROM applications a
                JOIN application_events e ON e.application_id = a.id
                WHERE e.to_status IN ('screening', 'interviewing', 'offer')
                AND date(e.timestamp) >= ? {where_clause.replace('is_deleted', 'a.is_deleted')}
                """,
                (start_of_this_week.isoformat(),)
            )
            this_week_responses = cursor.fetchone()["count"]

            # Last week responses
            cursor.execute(
                f"""
                SELECT COUNT(DISTINCT a.id) as count
                FROM applications a
                JOIN application_events e ON e.application_id = a.id
                WHERE e.to_status IN ('screening', 'interviewing', 'offer')
                AND date(e.timestamp) >= ? AND date(e.timestamp) < ? {where_clause.replace('is_deleted', 'a.is_deleted')}
                """,
                (start_of_last_week.isoformat(), start_of_this_week.isoformat())
            )
            last_week_responses = cursor.fetchone()["count"]

            # Calculate percentage changes
            apps_change_pct = ((this_week_apps - last_week_apps) / last_week_apps * 100) if last_week_apps > 0 else 0
            interviews_change_pct = ((this_week_interviews - last_week_interviews) / last_week_interviews * 100) if last_week_interviews > 0 else 0
            responses_change_pct = ((this_week_responses - last_week_responses) / last_week_responses * 100) if last_week_responses > 0 else 0

            # Get streak data
            summary = self.get_summary(include_deleted=include_deleted)

            return {
                "this_week_apps": this_week_apps,
                "last_week_apps": last_week_apps,
                "apps_change_pct": round(apps_change_pct, 1),
                "this_week_interviews": this_week_interviews,
                "last_week_interviews": last_week_interviews,
                "interviews_change_pct": round(interviews_change_pct, 1),
                "this_week_responses": this_week_responses,
                "last_week_responses": last_week_responses,
                "responses_change_pct": round(responses_change_pct, 1),
                "current_streak": summary["current_streak"],
                "streak_at_risk": summary["streak_at_risk"],
            }

    def get_cumulative_stats(self, include_deleted: bool = False) -> dict:
        """
        Get cumulative/lifetime statistics.

        Returns dict with:
        - total_applications: Total number of applications (all-time)
        - total_companies: Unique companies applied to
        - days_since_start: Days since first application
        - total_days_active: Days with at least 1 application
        - avg_per_day: Average applications per active day
        - avg_per_week: Average applications per week (avg_per_day * 7)
        - most_active_day: Most active day of week (e.g., "Monday")
        - busiest_month: Month with most applications (e.g., "January")
        - total_responses: Total responses received (screening + interviewing + offer)
        - response_rate: Overall response rate percentage
        """
        with get_cursor() as (conn, cursor):
            where_clause = "" if include_deleted else "WHERE is_deleted = 0"

            # Total applications
            cursor.execute(
                f"SELECT COUNT(*) as count FROM applications {where_clause}"
            )
            total_apps = cursor.fetchone()["count"]

            # Total unique companies
            cursor.execute(
                f"SELECT COUNT(DISTINCT company_id) as count FROM applications {where_clause}"
            )
            total_companies = cursor.fetchone()["count"]

            # Get first and last application dates
            cursor.execute(
                f"""
                SELECT
                    MIN(date(applied_at)) as first_date,
                    MAX(date(applied_at)) as last_date
                FROM applications {where_clause}
                """
            )
            date_row = cursor.fetchone()
            first_date_str = date_row["first_date"]
            last_date_str = date_row["last_date"]

            if not first_date_str:
                # No applications yet
                return {
                    "total_applications": 0,
                    "total_companies": 0,
                    "days_since_start": 0,
                    "total_days_active": 0,
                    "avg_per_day": 0.0,
                    "avg_per_week": 0.0,
                    "most_active_day": None,
                    "busiest_month": None,
                    "total_responses": 0,
                    "response_rate": 0.0,
                }

            # Convert string dates to date objects
            first_date = date.fromisoformat(first_date_str) if isinstance(first_date_str, str) else first_date_str
            today = date.today()
            days_since_start = (today - first_date).days + 1  # +1 to include the first day

            # Total days active (unique days with applications)
            cursor.execute(
                f"SELECT COUNT(DISTINCT date(applied_at)) as count FROM applications {where_clause}"
            )
            total_days_active = cursor.fetchone()["count"]

            # Calculate averages
            avg_per_day = total_apps / total_days_active if total_days_active > 0 else 0.0
            avg_per_week = avg_per_day * 7

            # Most active day of week (0=Sunday, 1=Monday, ..., 6=Saturday in SQLite)
            cursor.execute(
                f"""
                SELECT
                    CAST(strftime('%w', applied_at) AS INTEGER) as day_of_week,
                    COUNT(*) as count
                FROM applications {where_clause}
                GROUP BY day_of_week
                ORDER BY count DESC
                LIMIT 1
                """
            )
            day_row = cursor.fetchone()
            if day_row:
                day_num = day_row["day_of_week"]
                # Convert SQLite day number to day name (0=Sunday)
                day_names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
                most_active_day = day_names[day_num]
            else:
                most_active_day = None

            # Busiest month
            cursor.execute(
                f"""
                SELECT
                    strftime('%m', applied_at) as month_num,
                    COUNT(*) as count
                FROM applications {where_clause}
                GROUP BY month_num
                ORDER BY count DESC
                LIMIT 1
                """
            )
            month_row = cursor.fetchone()
            if month_row:
                month_num = int(month_row["month_num"])
                month_names = ["", "January", "February", "March", "April", "May", "June",
                             "July", "August", "September", "October", "November", "December"]
                busiest_month = month_names[month_num]
            else:
                busiest_month = None

            # Total responses (screening, interviewing, offer, accepted)
            cursor.execute(
                f"""
                SELECT COUNT(DISTINCT a.id) as count
                FROM applications a
                JOIN application_events e ON e.application_id = a.id
                WHERE e.to_status IN ('screening', 'interviewing', 'offer', 'accepted')
                {('AND a.is_deleted = 0' if not include_deleted else '')}
                """
            )
            total_responses = cursor.fetchone()["count"]

            # Overall response rate
            response_rate = (total_responses / total_apps * 100) if total_apps > 0 else 0.0

            return {
                "total_applications": total_apps,
                "total_companies": total_companies,
                "days_since_start": days_since_start,
                "total_days_active": total_days_active,
                "avg_per_day": round(avg_per_day, 1),
                "avg_per_week": round(avg_per_week, 1),
                "most_active_day": most_active_day,
                "busiest_month": busiest_month,
                "total_responses": total_responses,
                "response_rate": round(response_rate, 1),
            }

