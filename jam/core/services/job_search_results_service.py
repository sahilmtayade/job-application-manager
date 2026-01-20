"""Service for managing saved job search results with LLM analysis"""

import json
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional

from jam.db.connection import get_cursor


@dataclass
class SavedJobResult:
    """A saved job search result from the database"""
    id: int
    title: str
    company: str
    location: Optional[str]
    date_posted: Optional[str]
    job_url: str
    site_source: str
    description: Optional[str]
    salary_min: Optional[float]
    salary_max: Optional[float]
    job_type: Optional[str]
    search_keywords: Optional[str]
    first_seen_at: str
    last_seen_at: str
    llm_score: Optional[int]
    llm_analysis: Optional[str]
    llm_notes: Optional[str]
    llm_analyzed_at: Optional[str]
    is_mismatch: bool
    is_hidden: bool
    is_applied: bool
    applied_at: Optional[str]
    matched_skills: Optional[list[str]] = None
    missing_skills: Optional[list[str]] = None
    search_offset: int = 0

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "company": self.company,
            "location": self.location,
            "date_posted": self.date_posted,
            "job_url": self.job_url,
            "site_source": self.site_source,
            "description": self.description,
            "salary_min": self.salary_min,
            "salary_max": self.salary_max,
            "job_type": self.job_type,
            "search_keywords": self.search_keywords,
            "first_seen_at": self.first_seen_at,
            "last_seen_at": self.last_seen_at,
            "llm_score": self.llm_score,
            "llm_analysis": self.llm_analysis,
            "llm_notes": self.llm_notes,
            "llm_analyzed_at": self.llm_analyzed_at,
            "is_mismatch": self.is_mismatch,
            "is_hidden": self.is_hidden,
            "is_applied": self.is_applied,
            "applied_at": self.applied_at,
            "matched_skills": self.matched_skills,
            "missing_skills": self.missing_skills,
            "search_offset": self.search_offset,
        }


class JobSearchResultsService:
    """Service for CRUD operations on saved job search results"""

    def save_results(self, jobs: list[dict], keywords: list[str]) -> tuple[int, int]:
        """
        Save job search results to the database with upsert logic.
        New jobs are inserted, existing jobs have last_seen_at updated.

        Args:
            jobs: List of job dictionaries with keys matching JobListing fields
            keywords: List of keywords used for this search

        Returns:
            Tuple of (new_jobs_count, updated_jobs_count)
        """
        keywords_str = ", ".join(keywords)
        now = datetime.now().isoformat()

        new_count = 0
        updated_count = 0

        with get_cursor() as (conn, cursor):
            for job in jobs:
                job_url = job.get("job_url", "")
                if not job_url:
                    continue

                # Check if job already exists
                cursor.execute("SELECT id FROM job_search_results WHERE job_url = ?", (job_url,))
                existing = cursor.fetchone()

                if existing:
                    # Check existing description to see if we should update it
                    cursor.execute("SELECT description FROM job_search_results WHERE job_url = ?", (job_url,))
                    existing_row = cursor.fetchone()
                    existing_desc = existing_row["description"] if existing_row else None

                    # Update description if new data has one and existing doesn't
                    new_desc = job.get("description")
                    if new_desc and len(str(new_desc)) > 50 and (not existing_desc or len(str(existing_desc)) < 50):
                        cursor.execute("""
                            UPDATE job_search_results
                            SET last_seen_at = ?, search_keywords = ?, description = ?
                            WHERE job_url = ?
                        """, (now, keywords_str, new_desc, job_url))
                    else:
                        cursor.execute("""
                            UPDATE job_search_results
                            SET last_seen_at = ?, search_keywords = ?
                            WHERE job_url = ?
                        """, (now, keywords_str, job_url))
                    updated_count += 1
                else:
                    # Insert new job
                    try:
                        cursor.execute("""
                            INSERT INTO job_search_results
                            (title, company, location, date_posted, job_url, site_source,
                             description, salary_min, salary_max, job_type, search_keywords,
                             first_seen_at, last_seen_at, search_offset)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            job.get("title", "Unknown"),
                            job.get("company", "Unknown"),
                            job.get("location"),
                            job.get("date_posted"),
                            job_url,
                            job.get("site_source", "unknown"),
                            job.get("description"),
                            job.get("salary_min"),
                            job.get("salary_max"),
                            job.get("job_type"),
                            keywords_str,
                            now,
                            now,
                            job.get("search_offset", 0),
                        ))
                        new_count += 1
                    except Exception as e:
                        print(f"Error saving job: {e}")
                        continue

        return new_count, updated_count

    def get_recent_results(self, hours: int = 24, include_hidden: bool = False) -> list[SavedJobResult]:
        """Get job search results from the last N hours"""
        cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()

        with get_cursor() as (conn, cursor):
            if include_hidden:
                cursor.execute("""
                    SELECT * FROM job_search_results
                    WHERE last_seen_at >= ?
                    ORDER BY llm_score DESC NULLS LAST, last_seen_at DESC
                """, (cutoff,))
            else:
                cursor.execute("""
                    SELECT * FROM job_search_results
                    WHERE last_seen_at >= ? AND is_hidden = 0
                    ORDER BY llm_score DESC NULLS LAST, last_seen_at DESC
                """, (cutoff,))

            rows = cursor.fetchall()
            return [self._row_to_result(row) for row in rows]

    def get_all_results(self, include_hidden: bool = False) -> list[SavedJobResult]:
        """Get all saved job search results"""
        with get_cursor() as (conn, cursor):
            if include_hidden:
                cursor.execute("""
                    SELECT * FROM job_search_results
                    ORDER BY llm_score DESC NULLS LAST, last_seen_at DESC
                """)
            else:
                cursor.execute("""
                    SELECT * FROM job_search_results
                    WHERE is_hidden = 0
                    ORDER BY llm_score DESC NULLS LAST, last_seen_at DESC
                """)

            rows = cursor.fetchall()
            return [self._row_to_result(row) for row in rows]

    def get_unanalyzed_jobs(self, limit: int = 50) -> list[SavedJobResult]:
        """Get jobs that haven't been analyzed by LLM yet (excludes jobs without valid descriptions)"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT * FROM job_search_results
                WHERE llm_score IS NULL AND is_hidden = 0
                  AND description IS NOT NULL
                  AND LENGTH(description) >= 50
                  AND LOWER(TRIM(description)) NOT IN ('no description available', 'no description', 'n/a', 'none')
                ORDER BY last_seen_at DESC
                LIMIT ?
            """, (limit,))

            rows = cursor.fetchall()
            return [self._row_to_result(row) for row in rows]

    def get_unanalyzed_count(self) -> int:
        """Get count of jobs without LLM analysis (excludes jobs without valid descriptions)"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT COUNT(*) as count FROM job_search_results
                WHERE llm_score IS NULL AND is_hidden = 0
                  AND description IS NOT NULL
                  AND LENGTH(description) >= 50
                  AND LOWER(TRIM(description)) NOT IN ('no description available', 'no description', 'n/a', 'none')
            """)
            row = cursor.fetchone()
            return row["count"] if row else 0

    def update_llm_analysis(
        self,
        job_id: int,
        score: int,
        analysis: str,
        notes: str = "",
        is_mismatch: bool = False,
        matched_skills: Optional[list[str]] = None,
        missing_skills: Optional[list[str]] = None,
    ) -> bool:
        """Update a job with LLM analysis results"""
        now = datetime.now().isoformat()

        # Serialize skills lists to JSON
        matched_json = json.dumps(matched_skills) if matched_skills else None
        missing_json = json.dumps(missing_skills) if missing_skills else None

        with get_cursor() as (conn, cursor):
            cursor.execute("""
                UPDATE job_search_results
                SET llm_score = ?, llm_analysis = ?, llm_notes = ?, llm_analyzed_at = ?,
                    is_mismatch = ?, matched_skills = ?, missing_skills = ?
                WHERE id = ?
            """, (score, analysis, notes, now, 1 if is_mismatch else 0,
                  matched_json, missing_json, job_id))

            return cursor.rowcount > 0

    def reset_llm_analysis(self, job_id: int) -> bool:
        """
        Reset LLM analysis for a job, allowing it to be re-analyzed.
        Clears llm_score, llm_analysis, llm_notes, llm_analyzed_at, is_mismatch, and skills.
        """
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                UPDATE job_search_results
                SET llm_score = NULL, llm_analysis = NULL, llm_notes = NULL,
                    llm_analyzed_at = NULL, is_mismatch = 0,
                    matched_skills = NULL, missing_skills = NULL
                WHERE id = ?
            """, (job_id,))
            return cursor.rowcount > 0

    def clear_analysis_all(self) -> int:
        """
        Clear LLM analysis from all analyzed jobs.
        Resets llm_score, llm_analysis, llm_notes, llm_analyzed_at, is_mismatch, and skills.

        Returns:
            Number of jobs that had their analysis cleared
        """
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                UPDATE job_search_results
                SET llm_score = NULL, llm_analysis = NULL, llm_notes = NULL,
                    llm_analyzed_at = NULL, is_mismatch = 0,
                    matched_skills = NULL, missing_skills = NULL
                WHERE llm_score IS NOT NULL
            """)
            return cursor.rowcount

    def clear_analysis_bulk(self, job_ids: list[int]) -> int:
        """
        Clear LLM analysis from specific jobs by their IDs.
        Resets llm_score, llm_analysis, llm_notes, llm_analyzed_at, is_mismatch, and skills.

        Args:
            job_ids: List of job IDs to clear analysis from

        Returns:
            Number of jobs that had their analysis cleared
        """
        if not job_ids:
            return 0

        with get_cursor() as (conn, cursor):
            placeholders = ",".join("?" * len(job_ids))
            cursor.execute(f"""
                UPDATE job_search_results
                SET llm_score = NULL, llm_analysis = NULL, llm_notes = NULL,
                    llm_analyzed_at = NULL, is_mismatch = 0,
                    matched_skills = NULL, missing_skills = NULL
                WHERE id IN ({placeholders})
            """, job_ids)
            return cursor.rowcount

    def hide_job(self, job_id: int) -> bool:
        """Hide a job from results"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                UPDATE job_search_results SET is_hidden = 1 WHERE id = ?
            """, (job_id,))
            return cursor.rowcount > 0

    def unhide_job(self, job_id: int) -> bool:
        """Unhide a job"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                UPDATE job_search_results SET is_hidden = 0 WHERE id = ?
            """, (job_id,))
            return cursor.rowcount > 0

    def mark_applied(self, job_id: int) -> bool:
        """Mark a job as applied"""
        now = datetime.now().isoformat()
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                UPDATE job_search_results SET is_applied = 1, applied_at = ? WHERE id = ?
            """, (now, job_id))
            return cursor.rowcount > 0

    def unmark_applied(self, job_id: int) -> bool:
        """Unmark a job as applied"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                UPDATE job_search_results SET is_applied = 0, applied_at = NULL WHERE id = ?
            """, (job_id,))
            return cursor.rowcount > 0

    # Bulk operations
    def hide_jobs_bulk(self, job_ids: list[int]) -> int:
        """Hide multiple jobs. Returns count of jobs hidden."""
        if not job_ids:
            return 0
        with get_cursor() as (conn, cursor):
            placeholders = ",".join("?" * len(job_ids))
            cursor.execute(f"""
                UPDATE job_search_results SET is_hidden = 1 WHERE id IN ({placeholders})
            """, job_ids)
            return cursor.rowcount

    def unhide_jobs_bulk(self, job_ids: list[int]) -> int:
        """Unhide multiple jobs. Returns count of jobs unhidden."""
        if not job_ids:
            return 0
        with get_cursor() as (conn, cursor):
            placeholders = ",".join("?" * len(job_ids))
            cursor.execute(f"""
                UPDATE job_search_results SET is_hidden = 0 WHERE id IN ({placeholders})
            """, job_ids)
            return cursor.rowcount

    def mark_applied_bulk(self, job_ids: list[int]) -> int:
        """Mark multiple jobs as applied. Returns count of jobs marked."""
        if not job_ids:
            return 0
        now = datetime.now().isoformat()
        with get_cursor() as (conn, cursor):
            placeholders = ",".join("?" * len(job_ids))
            cursor.execute(f"""
                UPDATE job_search_results SET is_applied = 1, applied_at = ?
                WHERE id IN ({placeholders})
            """, [now] + job_ids)
            return cursor.rowcount

    def unmark_applied_bulk(self, job_ids: list[int]) -> int:
        """Unmark multiple jobs as applied. Returns count of jobs unmarked."""
        if not job_ids:
            return 0
        with get_cursor() as (conn, cursor):
            placeholders = ",".join("?" * len(job_ids))
            cursor.execute(f"""
                UPDATE job_search_results SET is_applied = 0, applied_at = NULL
                WHERE id IN ({placeholders})
            """, job_ids)
            return cursor.rowcount

    def delete_jobs_bulk(self, job_ids: list[int]) -> int:
        """Delete multiple jobs. Returns count of jobs deleted."""
        if not job_ids:
            return 0
        with get_cursor() as (conn, cursor):
            placeholders = ",".join("?" * len(job_ids))
            cursor.execute(f"""
                DELETE FROM job_search_results WHERE id IN ({placeholders})
            """, job_ids)
            return cursor.rowcount

    def get_applied_jobs(self) -> list[SavedJobResult]:
        """Get all jobs marked as applied"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT * FROM job_search_results
                WHERE is_applied = 1
                ORDER BY applied_at DESC
            """)
            rows = cursor.fetchall()
            return [self._row_to_result(row) for row in rows]

    def get_result_by_id(self, job_id: int) -> Optional[SavedJobResult]:
        """Get a specific job result by ID"""
        with get_cursor() as (conn, cursor):
            cursor.execute("SELECT * FROM job_search_results WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            return self._row_to_result(row) if row else None

    def get_latest_search_info(self) -> Optional[dict]:
        """Get info about the most recent search"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT
                    MAX(last_seen_at) as last_seen_at,
                    COUNT(*) as total,
                    SUM(CASE WHEN llm_score IS NOT NULL THEN 1 ELSE 0 END) as analyzed_count
                FROM job_search_results
                WHERE is_hidden = 0
            """)
            row = cursor.fetchone()

            if row and row["total"] > 0:
                # Get keywords from most recent job
                cursor.execute("""
                    SELECT search_keywords FROM job_search_results
                    ORDER BY last_seen_at DESC LIMIT 1
                """)
                kw_row = cursor.fetchone()

                return {
                    "last_seen_at": row["last_seen_at"],
                    "total": row["total"],
                    "analyzed_count": row["analyzed_count"],
                    "keywords": kw_row["search_keywords"] if kw_row else None,
                }
            return None

    def get_result_count(self, hours: Optional[int] = None) -> int:
        """Get the total number of results, optionally filtered by time"""
        with get_cursor() as (conn, cursor):
            if hours:
                cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()
                cursor.execute("""
                    SELECT COUNT(*) as count FROM job_search_results
                    WHERE last_seen_at >= ? AND is_hidden = 0
                """, (cutoff,))
            else:
                cursor.execute("""
                    SELECT COUNT(*) as count FROM job_search_results
                    WHERE is_hidden = 0
                """)
            row = cursor.fetchone()
            return row["count"] if row else 0

    def clear_results(self) -> int:
        """Clear all saved results"""
        with get_cursor() as (conn, cursor):
            cursor.execute("SELECT COUNT(*) as count FROM job_search_results")
            count = cursor.fetchone()["count"]
            cursor.execute("DELETE FROM job_search_results")
            return count

    def purge_old_results(self, hours: int = 48) -> int:
        """
        Delete job results older than specified hours (based on last_seen_at).
        Jobs marked as 'applied' are preserved and not deleted.

        Args:
            hours: Delete jobs older than this many hours (default 48)

        Returns:
            Number of jobs deleted
        """
        cutoff = (datetime.now() - timedelta(hours=hours)).isoformat()

        with get_cursor() as (conn, cursor):
            # Count how many will be deleted
            cursor.execute("""
                SELECT COUNT(*) as count FROM job_search_results
                WHERE last_seen_at < ? AND is_applied = 0
            """, (cutoff,))
            count = cursor.fetchone()["count"]

            # Delete old jobs (preserve applied ones)
            cursor.execute("""
                DELETE FROM job_search_results
                WHERE last_seen_at < ? AND is_applied = 0
            """, (cutoff,))

            return count

    def delete_result(self, result_id: int) -> bool:
        """Delete a specific result by ID"""
        with get_cursor() as (conn, cursor):
            cursor.execute("DELETE FROM job_search_results WHERE id = ?", (result_id,))
            return cursor.rowcount > 0

    def get_used_offsets(self, results_wanted: int = 100) -> dict:
        """
        Get distinct search_offset values from saved results.

        Args:
            results_wanted: Used to calculate suggested_next offset

        Returns:
            Dict with 'offsets' (sorted list) and 'suggested_next' (max offset + results_wanted)
        """
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT DISTINCT search_offset FROM job_search_results
                ORDER BY search_offset ASC
            """)
            rows = cursor.fetchall()
            offsets = [row["search_offset"] for row in rows]

            max_offset = max(offsets) if offsets else 0
            suggested_next = max_offset + results_wanted

            return {
                "offsets": offsets,
                "suggested_next": suggested_next,
            }

    def _row_to_result(self, row) -> SavedJobResult:
        """Convert a database row to SavedJobResult"""
        # Parse skills JSON if present
        matched_skills = None
        missing_skills = None
        if "matched_skills" in row.keys() and row["matched_skills"]:
            try:
                matched_skills = json.loads(row["matched_skills"])
            except (json.JSONDecodeError, TypeError):
                pass
        if "missing_skills" in row.keys() and row["missing_skills"]:
            try:
                missing_skills = json.loads(row["missing_skills"])
            except (json.JSONDecodeError, TypeError):
                pass

        return SavedJobResult(
            id=row["id"],
            title=row["title"],
            company=row["company"],
            location=row["location"],
            date_posted=row["date_posted"],
            job_url=row["job_url"],
            site_source=row["site_source"],
            description=row["description"],
            salary_min=row["salary_min"],
            salary_max=row["salary_max"],
            job_type=row["job_type"],
            search_keywords=row["search_keywords"],
            first_seen_at=row["first_seen_at"] or row.get("searched_at", ""),
            last_seen_at=row["last_seen_at"] or row.get("searched_at", ""),
            llm_score=row["llm_score"],
            llm_analysis=row["llm_analysis"],
            llm_notes=row["llm_notes"] if "llm_notes" in row.keys() else None,
            llm_analyzed_at=row["llm_analyzed_at"],
            is_mismatch=bool(row["is_mismatch"]),
            is_hidden=bool(row["is_hidden"]),
            is_applied=bool(row["is_applied"]) if "is_applied" in row.keys() else False,
            applied_at=row["applied_at"] if "applied_at" in row.keys() else None,
            matched_skills=matched_skills,
            missing_skills=missing_skills,
            search_offset=row["search_offset"] if "search_offset" in row.keys() else 0,
        )
