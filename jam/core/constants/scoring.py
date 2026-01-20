"""Scoring thresholds and quality assessment constants"""

from enum import Enum
from typing import Optional


# Score thresholds for job match quality
SCORE_GOOD = 70        # Good match (70-100)
SCORE_MODERATE = 40    # Moderate match (40-69)
SCORE_POOR_MAX = 39    # Poor match (0-39)

# Collected thresholds for easy import
SCORE_THRESHOLDS = {
    "good": SCORE_GOOD,
    "moderate": SCORE_MODERATE,
    "poor_max": SCORE_POOR_MAX,
}


class ScoreQuality(Enum):
    """Quality categories for job match scores"""
    GOOD = "good"
    MODERATE = "moderate"
    POOR = "poor"
    UNSCORED = "unscored"


def get_score_quality(score: Optional[int]) -> ScoreQuality:
    """
    Determine the quality category for a given score.

    Args:
        score: The job match score (0-100) or None if unscored

    Returns:
        ScoreQuality enum value
    """
    if score is None:
        return ScoreQuality.UNSCORED
    if score >= SCORE_GOOD:
        return ScoreQuality.GOOD
    if score >= SCORE_MODERATE:
        return ScoreQuality.MODERATE
    return ScoreQuality.POOR

