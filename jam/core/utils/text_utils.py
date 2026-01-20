"""Text normalization and fuzzy matching utilities"""

from difflib import SequenceMatcher

# Common company suffixes to remove during normalization
COMPANY_SUFFIXES = [
    ", inc.", ", inc", " inc.", " inc",
    ", llc", " llc", ", l.l.c.", " l.l.c.",
    ", corp.", " corp.", " corp",
    ", ltd.", " ltd.", " ltd",
    ", co.", " co.",
    " company",
]


def normalize_text(text: str) -> str:
    """
    Normalize text for fuzzy matching.

    Performs:
    - Lowercase conversion
    - Whitespace trimming
    - Common character substitutions (& -> and, - -> space)
    - Removal of common company suffixes

    Args:
        text: The text to normalize

    Returns:
        Normalized text string, or empty string if input is falsy
    """
    if not text:
        return ""

    # Lowercase and strip
    text = text.lower().strip()

    # Normalize common variations
    text = text.replace("&", "and")
    text = text.replace("-", " ")
    text = text.replace("  ", " ")  # Collapse double spaces

    # Remove common company suffixes
    for suffix in COMPANY_SUFFIXES:
        if text.endswith(suffix):
            text = text[:-len(suffix)]

    return text.strip()


def fuzzy_match(s1: str, s2: str, threshold: float = 0.85) -> bool:
    """
    Check if two strings match using fuzzy logic.

    Matching criteria (in order):
    1. Exact match after normalization
    2. One string contains the other (substring match)
    3. Sequence similarity ratio meets threshold

    Args:
        s1: First string to compare
        s2: Second string to compare
        threshold: Minimum similarity ratio (0.0 to 1.0) for fuzzy match

    Returns:
        True if strings match according to any criteria, False otherwise
    """
    s1_norm = normalize_text(s1)
    s2_norm = normalize_text(s2)

    if not s1_norm or not s2_norm:
        return False

    # Exact match after normalization
    if s1_norm == s2_norm:
        return True

    # Check if one contains the other (for partial matches)
    if s1_norm in s2_norm or s2_norm in s1_norm:
        return True

    # Similarity check using sequence matcher
    ratio = SequenceMatcher(None, s1_norm, s2_norm).ratio()
    return ratio >= threshold

