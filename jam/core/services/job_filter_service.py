"""Service for managing learned job search filters"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Literal

from jam.db.connection import get_cursor


FilterType = Literal["positive", "negative"]
FilterSource = Literal["llm", "user", "auto"]


@dataclass
class JobFilter:
    """A learned filter keyword"""
    id: int
    keyword: str
    filter_type: FilterType
    weight: float
    source: Optional[str]
    match_count: int
    created_at: str
    updated_at: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "keyword": self.keyword,
            "filter_type": self.filter_type,
            "weight": self.weight,
            "source": self.source,
            "match_count": self.match_count,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


class JobFilterService:
    """Service for managing learned positive/negative job filters"""

    def get_all_filters(self) -> list[JobFilter]:
        """Get all filters"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT * FROM job_search_filters
                ORDER BY weight DESC, match_count DESC
            """)
            rows = cursor.fetchall()
            return [self._row_to_filter(row) for row in rows]

    def get_positive_filters(self) -> list[JobFilter]:
        """Get all positive (favorable) filters"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT * FROM job_search_filters
                WHERE filter_type = 'positive'
                ORDER BY weight DESC, match_count DESC
            """)
            rows = cursor.fetchall()
            return [self._row_to_filter(row) for row in rows]

    def get_negative_filters(self) -> list[JobFilter]:
        """Get all negative (unfavorable) filters"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT * FROM job_search_filters
                WHERE filter_type = 'negative'
                ORDER BY weight DESC, match_count DESC
            """)
            rows = cursor.fetchall()
            return [self._row_to_filter(row) for row in rows]

    def add_filter(
        self,
        keyword: str,
        filter_type: FilterType,
        weight: float = 1.0,
        source: FilterSource = "user"
    ) -> Optional[JobFilter]:
        """Add a new filter keyword"""
        now = datetime.now().isoformat()
        keyword = keyword.strip().lower()

        if not keyword:
            return None

        with get_cursor() as (conn, cursor):
            # Check if filter already exists
            cursor.execute("""
                SELECT id FROM job_search_filters
                WHERE keyword = ? AND filter_type = ?
            """, (keyword, filter_type))

            existing = cursor.fetchone()
            if existing:
                # Update weight if exists
                cursor.execute("""
                    UPDATE job_search_filters
                    SET weight = weight + ?, updated_at = ?
                    WHERE id = ?
                """, (weight * 0.1, now, existing["id"]))

                cursor.execute("SELECT * FROM job_search_filters WHERE id = ?", (existing["id"],))
                row = cursor.fetchone()
                return self._row_to_filter(row) if row else None

            # Insert new filter
            cursor.execute("""
                INSERT INTO job_search_filters
                (keyword, filter_type, weight, source, match_count, created_at, updated_at)
                VALUES (?, ?, ?, ?, 0, ?, ?)
            """, (keyword, filter_type, weight, source, now, now))

            filter_id = cursor.lastrowid
            cursor.execute("SELECT * FROM job_search_filters WHERE id = ?", (filter_id,))
            row = cursor.fetchone()
            return self._row_to_filter(row) if row else None

    def add_filters_batch(
        self,
        filters: list[dict]
    ) -> int:
        """
        Add multiple filters at once.
        Each filter dict should have: keyword, filter_type, weight (optional), source (optional)
        Returns number of filters added/updated.
        """
        count = 0
        for f in filters:
            result = self.add_filter(
                keyword=f.get("keyword", ""),
                filter_type=f.get("filter_type", "positive"),
                weight=f.get("weight", 1.0),
                source=f.get("source", "llm"),
            )
            if result:
                count += 1
        return count

    def update_filter_weight(self, filter_id: int, weight: float) -> bool:
        """Update the weight of a filter"""
        now = datetime.now().isoformat()

        with get_cursor() as (conn, cursor):
            cursor.execute("""
                UPDATE job_search_filters
                SET weight = ?, updated_at = ?
                WHERE id = ?
            """, (weight, now, filter_id))
            return cursor.rowcount > 0

    def increment_match_count(self, filter_id: int) -> bool:
        """Increment the match count for a filter"""
        now = datetime.now().isoformat()

        with get_cursor() as (conn, cursor):
            cursor.execute("""
                UPDATE job_search_filters
                SET match_count = match_count + 1, updated_at = ?
                WHERE id = ?
            """, (now, filter_id))
            return cursor.rowcount > 0

    def delete_filter(self, filter_id: int) -> bool:
        """Delete a filter"""
        with get_cursor() as (conn, cursor):
            cursor.execute("DELETE FROM job_search_filters WHERE id = ?", (filter_id,))
            return cursor.rowcount > 0

    def apply_filters_to_jobs(self, jobs: list[dict]) -> list[dict]:
        """
        Apply learned filters to job list.
        Adds 'filter_score' field based on matching positive/negative keywords.
        """
        positive_filters = self.get_positive_filters()
        negative_filters = self.get_negative_filters()

        for job in jobs:
            # Combine title and description for matching
            text = f"{job.get('title', '')} {job.get('description', '')} {job.get('company', '')}".lower()

            filter_score = 0.0
            matched_positive = []
            matched_negative = []

            # Check positive filters
            for f in positive_filters:
                if f.keyword in text:
                    filter_score += f.weight
                    matched_positive.append(f.keyword)
                    self.increment_match_count(f.id)

            # Check negative filters
            for f in negative_filters:
                if f.keyword in text:
                    filter_score -= f.weight
                    matched_negative.append(f.keyword)
                    self.increment_match_count(f.id)

            job["filter_score"] = filter_score
            job["matched_positive_filters"] = matched_positive
            job["matched_negative_filters"] = matched_negative

        return jobs

    def get_filter_stats(self) -> dict:
        """Get statistics about filters"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT
                    filter_type,
                    COUNT(*) as count,
                    SUM(match_count) as total_matches,
                    AVG(weight) as avg_weight
                FROM job_search_filters
                GROUP BY filter_type
            """)
            rows = cursor.fetchall()

            stats = {
                "positive": {"count": 0, "total_matches": 0, "avg_weight": 0},
                "negative": {"count": 0, "total_matches": 0, "avg_weight": 0},
            }

            for row in rows:
                stats[row["filter_type"]] = {
                    "count": row["count"],
                    "total_matches": row["total_matches"] or 0,
                    "avg_weight": round(row["avg_weight"] or 0, 2),
                }

            return stats

    def _row_to_filter(self, row) -> JobFilter:
        """Convert database row to JobFilter"""
        return JobFilter(
            id=row["id"],
            keyword=row["keyword"],
            filter_type=row["filter_type"],
            weight=row["weight"],
            source=row["source"],
            match_count=row["match_count"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

