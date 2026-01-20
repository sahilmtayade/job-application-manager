"""Service for managing suggested company bans from LLM analysis"""

from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Literal

from jam.db.connection import get_cursor
from jam.core.services.banned_company_service import BannedCompanyService


SuggestionStatus = Literal["pending", "approved", "rejected"]


@dataclass
class SuggestedBan:
    """A suggested company ban from LLM analysis"""
    id: int
    company_name: str
    reason: Optional[str]
    job_url: Optional[str]
    llm_confidence: Optional[float]
    status: SuggestionStatus
    created_at: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "company_name": self.company_name,
            "reason": self.reason,
            "job_url": self.job_url,
            "llm_confidence": self.llm_confidence,
            "status": self.status,
            "created_at": self.created_at,
        }


class SuggestedBanService:
    """Service for managing the suggested bans queue"""

    def add_suggestion(
        self,
        company_name: str,
        reason: str,
        job_url: Optional[str] = None,
        llm_confidence: Optional[float] = None,
    ) -> Optional[SuggestedBan]:
        """
        Add a new ban suggestion.
        Checks if company is already banned or already suggested.
        """
        company_name = company_name.strip()
        if not company_name:
            return None

        # Check if already banned
        banned_service = BannedCompanyService()
        if banned_service.is_banned(company_name):
            return None

        with get_cursor() as (conn, cursor):
            # Check if already suggested (pending)
            cursor.execute("""
                SELECT id FROM suggested_bans
                WHERE company_name = ? AND status = 'pending'
            """, (company_name,))

            if cursor.fetchone():
                return None  # Already pending

            now = datetime.now().isoformat()

            cursor.execute("""
                INSERT INTO suggested_bans
                (company_name, reason, job_url, llm_confidence, status, created_at)
                VALUES (?, ?, ?, ?, 'pending', ?)
            """, (company_name, reason, job_url, llm_confidence, now))

            ban_id = cursor.lastrowid
            cursor.execute("SELECT * FROM suggested_bans WHERE id = ?", (ban_id,))
            row = cursor.fetchone()
            return self._row_to_suggestion(row) if row else None

    def get_pending_suggestions(self) -> list[SuggestedBan]:
        """Get all pending ban suggestions"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT * FROM suggested_bans
                WHERE status = 'pending'
                ORDER BY llm_confidence DESC NULLS LAST, created_at DESC
            """)
            rows = cursor.fetchall()
            return [self._row_to_suggestion(row) for row in rows]

    def get_all_suggestions(self) -> list[SuggestedBan]:
        """Get all suggestions regardless of status"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT * FROM suggested_bans
                ORDER BY created_at DESC
            """)
            rows = cursor.fetchall()
            return [self._row_to_suggestion(row) for row in rows]

    def get_suggestion_by_id(self, suggestion_id: int) -> Optional[SuggestedBan]:
        """Get a specific suggestion by ID"""
        with get_cursor() as (conn, cursor):
            cursor.execute("SELECT * FROM suggested_bans WHERE id = ?", (suggestion_id,))
            row = cursor.fetchone()
            return self._row_to_suggestion(row) if row else None

    def approve_suggestion(self, suggestion_id: int) -> bool:
        """
        Approve a suggestion - adds company to banned list.
        Returns True if successfully approved and banned.
        """
        suggestion = self.get_suggestion_by_id(suggestion_id)
        if not suggestion or suggestion.status != "pending":
            return False

        # Add to banned companies
        banned_service = BannedCompanyService()
        reason = suggestion.reason or "Flagged by AI analysis as mismatched/unsuitable"
        banned_service.add(suggestion.company_name, reason)

        # Update suggestion status
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                UPDATE suggested_bans SET status = 'approved' WHERE id = ?
            """, (suggestion_id,))
            return cursor.rowcount > 0

    def reject_suggestion(self, suggestion_id: int) -> bool:
        """Reject a suggestion - marks as rejected"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                UPDATE suggested_bans
                SET status = 'rejected'
                WHERE id = ? AND status = 'pending'
            """, (suggestion_id,))
            return cursor.rowcount > 0

    def get_pending_count(self) -> int:
        """Get count of pending suggestions"""
        with get_cursor() as (conn, cursor):
            cursor.execute("""
                SELECT COUNT(*) as count FROM suggested_bans WHERE status = 'pending'
            """)
            row = cursor.fetchone()
            return row["count"] if row else 0

    def delete_suggestion(self, suggestion_id: int) -> bool:
        """Delete a suggestion entirely"""
        with get_cursor() as (conn, cursor):
            cursor.execute("DELETE FROM suggested_bans WHERE id = ?", (suggestion_id,))
            return cursor.rowcount > 0

    def _row_to_suggestion(self, row) -> SuggestedBan:
        """Convert database row to SuggestedBan"""
        return SuggestedBan(
            id=row["id"],
            company_name=row["company_name"],
            reason=row["reason"],
            job_url=row["job_url"],
            llm_confidence=row["llm_confidence"],
            status=row["status"],
            created_at=row["created_at"],
        )

