"""Enumerations for JAM"""

from __future__ import annotations

from enum import Enum


class ApplicationStatus(str, Enum):
    """Status values for job applications"""

    APPLIED = "applied"
    SCREENING = "screening"
    INTERVIEWING = "interviewing"
    OFFER = "offer"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    GHOSTED = "ghosted"
    SCAM = "scam"  # Phantom/scam job posting

    @classmethod
    def active_statuses(cls) -> list["ApplicationStatus"]:
        """Return statuses that represent active/ongoing applications"""
        return [cls.APPLIED, cls.SCREENING, cls.INTERVIEWING, cls.OFFER]

    @classmethod
    def terminal_statuses(cls) -> list["ApplicationStatus"]:
        """Return statuses that represent completed applications"""
        return [cls.ACCEPTED, cls.REJECTED, cls.WITHDRAWN, cls.GHOSTED, cls.SCAM]

    @classmethod
    def get_valid_transitions(cls, current_status: "ApplicationStatus") -> list["ApplicationStatus"]:
        """
        Get valid state transitions from the current status.
        Enforces a progressive state machine with terminal states.
        """
        transitions = {
            cls.APPLIED: [cls.SCREENING, cls.INTERVIEWING, cls.REJECTED, cls.WITHDRAWN, cls.GHOSTED, cls.SCAM],
            cls.SCREENING: [cls.INTERVIEWING, cls.OFFER, cls.REJECTED, cls.WITHDRAWN, cls.GHOSTED, cls.SCAM],
            cls.INTERVIEWING: [cls.OFFER, cls.REJECTED, cls.WITHDRAWN, cls.GHOSTED, cls.SCAM],
            cls.OFFER: [cls.ACCEPTED, cls.REJECTED, cls.WITHDRAWN, cls.SCAM],
            # Terminal states have no valid transitions
            cls.ACCEPTED: [],
            cls.REJECTED: [],
            cls.WITHDRAWN: [],
            cls.GHOSTED: [],
            cls.SCAM: [],
        }
        return transitions.get(current_status, [])


class GoalType(str, Enum):
    """Types of application goals"""

    DAILY = "daily"
    WEEKLY = "weekly"


class WorkLocation(str, Enum):
    """Work location preferences"""

    REMOTE = "remote"
    ONSITE = "onsite"
    HYBRID = "hybrid"

