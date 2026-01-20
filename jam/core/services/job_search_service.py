"""Job Search Service using JobSpy for aggregating job listings"""

import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Generator
import pandas as pd
import queue
import threading

from jobspy import scrape_jobs


@dataclass
class JobListing:
    """Standardized job listing from any source"""
    title: str
    company: str
    location: str
    date_posted: Optional[str]
    job_url: str
    site_source: str
    description: Optional[str] = None
    salary_min: Optional[float] = None
    salary_max: Optional[float] = None
    job_type: Optional[str] = None
    search_offset: int = 0

    def to_dict(self) -> dict:
        return {
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
            "search_offset": self.search_offset,
        }


class JobSearchService:
    """Service for searching jobs across multiple platforms using JobSpy"""

    # All supported sites by JobSpy
    SUPPORTED_SITES = ["linkedin", "indeed", "glassdoor", "zip_recruiter", "google", "bayt", "bdjobs", "naukri"]

    # DMV Area locations
    DMV_LOCATIONS = ["Washington, DC", "Maryland", "Virginia"]

    # Entry-level keywords (jobs with these are likely entry-level)
    ENTRY_LEVEL_KEYWORDS = [
        "entry", "junior", "associate", "jr", "jr.",
        "graduate", "new grad", "early career",
        "level i", "level 1", "i ", " i,", " 1 ", " 1,",
    ]

    # Senior-level keywords (jobs with these should be excluded)
    SENIOR_KEYWORDS = [
        "senior", "sr", "sr.", "lead", "principal", "staff",
        "manager", "director", "head", "vp", "vice president",
        "architect", "distinguished", "fellow", "expert",
        "level ii", "level iii", "level iv", "level 2", "level 3", "level 4",
        "ii", "iii", "iv", " 2 ", " 3 ", " 4 ", " 5 ",
    ]

    # Experience patterns to detect >3 years requirements
    EXPERIENCE_PATTERNS = [
        # Original patterns
        r"(\d+)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience|exp)",
        r"(?:experience|exp)[:\s]+(\d+)\+?\s*(?:years?|yrs?)",
        r"(\d+)\+?\s*(?:years?|yrs?)\s+(?:minimum|min)",
        r"(?:minimum|min|at least)\s+(\d+)\+?\s*(?:years?|yrs?)",
        # Range patterns: "3-5 years", "3 to 5 years"
        r"(\d+)\s*[-–]\s*\d+\s*(?:years?|yrs?)",
        r"(\d+)\s+to\s+\d+\s*(?:years?|yrs?)",
        # "minimum of X years", "at least X years"
        r"minimum\s+of\s+(\d+)\s*(?:years?|yrs?)",
        r"at\s+least\s+(\d+)\s*(?:years?|yrs?)",
        # "X+ years professional/work/relevant experience"
        r"(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional|work|relevant|hands-on|direct)",
        # "requires X years", "X years required"
        r"requires?\s+(\d+)\+?\s*(?:years?|yrs?)",
        r"(\d+)\+?\s*(?:years?|yrs?)\s+required",
    ]

    # Keywords indicating ACTIVE clearance is REQUIRED (filter these out)
    CLEARANCE_REQUIRED_KEYWORDS = [
        "active clearance required",
        "active clearance",
        "current clearance",
        "ts/sci required",
        "ts/sci clearance required",
        "secret clearance required",
        "top secret required",
        "must have clearance",
        "must possess clearance",
        "clearance required",
        "active ts",
        "active secret",
        "active top secret",
        "current ts/sci",
        "existing clearance",
        "hold a clearance",
        "holds a clearance",
        "possess a clearance",
        "possesses a clearance",
    ]

    # Keywords indicating clearance ELIGIBILITY is OK (don't filter these)
    CLEARANCE_ELIGIBLE_OK = [
        "able to obtain",
        "ability to obtain",
        "eligible for clearance",
        "eligibility for clearance",
        "clearance eligibility",
        "eligible to obtain",
        "can obtain",
        "clearable",
        "obtain a clearance",
        "willingness to obtain",
        "willing to obtain",
        "must be able to obtain",
        "must be eligible",
        "us citizen",  # Often paired with "able to obtain"
    ]

    def __init__(self):
        pass

    def _build_google_search_term(self, keyword: str, location: str) -> str:
        """Build Google Jobs search term from keyword and location."""
        return f"{keyword} jobs near {location} since yesterday"

    def search_jobs(
        self,
        keywords: list[str],
        locations: Optional[list[str]] = None,
        hours_old: int = 24,
        results_wanted: int = 5000,
        country: str = "USA",
        filter_entry_level: bool = True,
        max_experience_years: int = 3,
        offset: int = 0,
    ) -> list[JobListing]:
        """
        Search for jobs across all supported sites in DMV area.

        Args:
            keywords: List of search terms (job titles, skills)
            locations: List of locations to search (defaults to DMV area)
            hours_old: Only return jobs posted within this many hours
            results_wanted: Maximum number of results per keyword per location
            country: Country code for job search
            filter_entry_level: Whether to filter for entry-level roles only
            max_experience_years: Maximum years of experience to allow (0 to disable)
            offset: Starting offset for pagination (e.g., 25 starts from 25th result)

        Returns:
            List of JobListing objects, deduplicated and filtered
        """
        all_jobs: list[JobListing] = []
        seen_urls: set[str] = set()

        # Default to DMV locations
        search_locations = locations or self.DMV_LOCATIONS

        for keyword in keywords:
            for location in search_locations:
                try:
                    print(f"Searching for '{keyword}' in '{location}'...")
                    jobs_df = scrape_jobs(
                        site_name=self.SUPPORTED_SITES,
                        search_term=keyword,
                        google_search_term=self._build_google_search_term(keyword, location),
                        location=location,
                        results_wanted=results_wanted,
                        hours_old=hours_old,
                        country_indeed=country,
                        offset=offset,
                        timeout=30,
                        linkedin_fetch_description=True,
                    )

                    if jobs_df is not None and not jobs_df.empty:
                        listings = self._dataframe_to_listings(jobs_df, offset)
                        for listing in listings:
                            if listing.job_url not in seen_urls:
                                seen_urls.add(listing.job_url)
                                all_jobs.append(listing)

                except Exception as e:
                    print(f"Error searching for '{keyword}' in '{location}': {e}")
                    continue

        # Apply entry-level filtering if enabled
        if filter_entry_level:
            all_jobs = self._filter_entry_level(all_jobs)

        # Apply experience years filtering if enabled
        if max_experience_years > 0:
            all_jobs = self._filter_by_experience(all_jobs, max_experience_years)

        # Filter out jobs requiring active clearance (candidate has none)
        all_jobs = self._filter_by_clearance(all_jobs)

        # Sort by date posted (most recent first)
        all_jobs.sort(
            key=lambda x: x.date_posted or "",
            reverse=True
        )

        return all_jobs

    def search_jobs_stream(
        self,
        keywords: list[str],
        locations: Optional[list[str]] = None,
        sites: Optional[list[str]] = None,
        hours_old: int = 24,
        results_wanted: int = 200,
        country: str = "USA",
        filter_entry_level: bool = True,
        max_experience_years: int = 3,
        offset: int = 0,
    ) -> Generator[dict, None, None]:
        """
        Stream job search results, yielding batches after each keyword/location search.
        This allows incremental saving to DB and UI updates.

        Args:
            sites: List of sites to search (defaults to all SUPPORTED_SITES)
            offset: Starting offset for pagination (e.g., 25 starts from 25th result)

        Yields:
            dict with type 'searching', 'found', or 'error'
        """
        seen_urls: set[str] = set()
        search_locations = locations or self.DMV_LOCATIONS
        search_sites = sites if sites else self.SUPPORTED_SITES

        total_searches = len(keywords) * len(search_locations)
        current_search = 0

        for keyword in keywords:
            for location in search_locations:
                current_search += 1

                # Signal that we're starting this search
                yield {
                    "type": "searching",
                    "keyword": keyword,
                    "location": location,
                    "progress": current_search,
                    "total_searches": total_searches,
                }

                try:
                    jobs_df = scrape_jobs(
                        site_name=search_sites,
                        search_term=keyword,
                        google_search_term=self._build_google_search_term(keyword, location),
                        location=location,
                        results_wanted=results_wanted,
                        hours_old=hours_old,
                        country_indeed=country,
                        offset=offset,
                        timeout=30,
                        linkedin_fetch_description=True,
                    )

                    batch_jobs: list[JobListing] = []

                    if jobs_df is not None and not jobs_df.empty:
                        listings = self._dataframe_to_listings(jobs_df, offset)
                        for listing in listings:
                            if listing.job_url not in seen_urls:
                                seen_urls.add(listing.job_url)
                                batch_jobs.append(listing)

                    # Apply filters to this batch
                    if filter_entry_level:
                        batch_jobs = self._filter_entry_level(batch_jobs)

                    if max_experience_years > 0:
                        batch_jobs = self._filter_by_experience(batch_jobs, max_experience_years)

                    batch_jobs = self._filter_by_clearance(batch_jobs)

                    # Yield the batch results
                    yield {
                        "type": "found",
                        "keyword": keyword,
                        "location": location,
                        "jobs": batch_jobs,
                        "count": len(batch_jobs),
                        "progress": current_search,
                        "total_searches": total_searches,
                    }

                except Exception as e:
                    yield {
                        "type": "error",
                        "keyword": keyword,
                        "location": location,
                        "message": str(e),
                        "progress": current_search,
                        "total_searches": total_searches,
                    }
                    continue

    def search_jobs_stream_parallel(
        self,
        keywords: list[str],
        locations: Optional[list[str]] = None,
        sites: Optional[list[str]] = None,
        hours_old: int = 24,
        results_wanted: int = 200,
        country: str = "USA",
        filter_entry_level: bool = True,
        max_experience_years: int = 3,
        max_workers: int = 5,
        offset: int = 0,
    ) -> Generator[dict, None, None]:
        """
        Stream job search results with parallel source searching.

        Parallelism is PER SOURCE - each source runs in its own thread,
        but keyword/location combinations within a source are sequential
        to avoid rate limiting.

        Args:
            max_workers: Maximum number of concurrent source searches (default 5 = all sources)
            offset: Starting offset for pagination (e.g., 25 starts from 25th result)

        Yields:
            dict with type 'searching', 'found', or 'error'
        """
        seen_urls: set[str] = set()
        seen_lock = threading.Lock()
        results_queue: queue.Queue = queue.Queue()

        search_locations = locations or self.DMV_LOCATIONS
        search_sites = sites if sites else self.SUPPORTED_SITES

        # Total searches = sites * keywords * locations
        total_searches = len(search_sites) * len(keywords) * len(search_locations)
        completed_count = [0]  # Use list for mutable reference in threads
        count_lock = threading.Lock()

        def search_single_source(site: str):
            """
            Search all keyword/location combinations for a single source.
            Runs sequentially within the source to avoid rate limits.
            """
            source_results = []

            for keyword in keywords:
                for location in search_locations:
                    try:
                        # Put searching event in queue
                        results_queue.put({
                            "type": "searching",
                            "keyword": keyword,
                            "location": location,
                            "site": site,
                        })

                        jobs_df = scrape_jobs(
                            site_name=[site],  # Single source
                            search_term=keyword,
                            google_search_term=self._build_google_search_term(keyword, location),
                            location=location,
                            results_wanted=results_wanted,
                            hours_old=hours_old,
                            country_indeed=country,
                            offset=offset,
                            timeout=30,
                            linkedin_fetch_description=(site == "linkedin"),
                        )

                        batch_jobs: list[JobListing] = []

                        if jobs_df is not None and not jobs_df.empty:
                            listings = self._dataframe_to_listings(jobs_df, offset)
                            with seen_lock:
                                for listing in listings:
                                    if listing.job_url not in seen_urls:
                                        seen_urls.add(listing.job_url)
                                        batch_jobs.append(listing)

                        # Apply filters
                        if filter_entry_level:
                            batch_jobs = self._filter_entry_level(batch_jobs)
                        if max_experience_years > 0:
                            batch_jobs = self._filter_by_experience(batch_jobs, max_experience_years)
                        batch_jobs = self._filter_by_clearance(batch_jobs)

                        with count_lock:
                            completed_count[0] += 1
                            progress = completed_count[0]

                        results_queue.put({
                            "type": "found",
                            "keyword": keyword,
                            "location": location,
                            "site": site,
                            "jobs": batch_jobs,
                            "count": len(batch_jobs),
                            "progress": progress,
                            "total_searches": total_searches,
                        })
                        source_results.extend(batch_jobs)

                    except Exception as e:
                        with count_lock:
                            completed_count[0] += 1
                            progress = completed_count[0]

                        results_queue.put({
                            "type": "error",
                            "keyword": keyword,
                            "location": location,
                            "site": site,
                            "message": str(e),
                            "progress": progress,
                            "total_searches": total_searches,
                        })

            return source_results

        # Start all source threads
        with ThreadPoolExecutor(max_workers=min(max_workers, len(search_sites))) as executor:
            futures = {executor.submit(search_single_source, site): site for site in search_sites}

            # Yield results as they come in from the queue
            while True:
                # Check if all futures are done
                all_done = all(f.done() for f in futures)

                # Process any items in the queue
                try:
                    while True:
                        item = results_queue.get_nowait()
                        yield item
                except queue.Empty:
                    pass

                if all_done:
                    # Drain any remaining items
                    try:
                        while True:
                            item = results_queue.get_nowait()
                            yield item
                    except queue.Empty:
                        pass
                    break

                # Small sleep to prevent busy waiting
                import time
                time.sleep(0.05)

    def _filter_entry_level(self, jobs: list[JobListing]) -> list[JobListing]:
        """Filter jobs to only include entry-level positions"""
        filtered = []

        for job in jobs:
            title_lower = job.title.lower()

            # Check if title contains senior keywords - exclude these
            has_senior = any(kw in title_lower for kw in self.SENIOR_KEYWORDS)
            if has_senior:
                continue

            # Include if it has entry-level keywords OR doesn't have senior keywords
            # (some entry-level jobs don't explicitly say "junior" etc.)
            filtered.append(job)

        return filtered

    def _filter_by_experience(self, jobs: list[JobListing], max_years: int) -> list[JobListing]:
        """Filter jobs to exclude those requiring more than max_years experience"""
        filtered = []

        for job in jobs:
            # Check both title and description for experience requirements
            text_to_check = f"{job.title} {job.description or ''}".lower()

            required_years = self._extract_experience_years(text_to_check)

            # Include job if we couldn't determine years OR if years <= max
            if required_years is None or required_years <= max_years:
                filtered.append(job)

        return filtered

    def _extract_experience_years(self, text: str) -> Optional[int]:
        """Extract the minimum years of experience required from text"""
        for pattern in self.EXPERIENCE_PATTERNS:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                # Return the first (usually minimum) years found
                try:
                    years = int(matches[0])
                    return years
                except (ValueError, IndexError):
                    continue
        return None

    def _filter_by_clearance(self, jobs: list[JobListing]) -> list[JobListing]:
        """
        Filter out jobs that REQUIRE an active security clearance.
        Jobs that accept clearance eligibility are kept.
        """
        filtered = []

        for job in jobs:
            text_to_check = f"{job.title} {job.description or ''}".lower()

            # Check if job accepts clearance eligibility (this overrides required keywords)
            accepts_eligibility = any(
                kw in text_to_check for kw in self.CLEARANCE_ELIGIBLE_OK
            )

            # Check if job requires active clearance
            requires_active = any(
                kw in text_to_check for kw in self.CLEARANCE_REQUIRED_KEYWORDS
            )

            # Include job if:
            # 1. It accepts eligibility (even if it also mentions clearance required)
            # 2. It doesn't require active clearance at all
            if accepts_eligibility or not requires_active:
                filtered.append(job)

        return filtered

    def _dataframe_to_listings(self, df: pd.DataFrame, offset: int = 0) -> list[JobListing]:
        """Convert JobSpy DataFrame to list of JobListing objects"""
        listings = []

        for _, row in df.iterrows():
            try:
                # Handle date_posted - could be datetime, date, or string
                date_posted = None
                if pd.notna(row.get("date_posted")):
                    date_val = row["date_posted"]
                    if isinstance(date_val, (datetime,)):
                        date_posted = date_val.strftime("%Y-%m-%d")
                    elif hasattr(date_val, "strftime"):
                        date_posted = date_val.strftime("%Y-%m-%d")
                    else:
                        date_posted = str(date_val)

                # Handle salary
                salary_min = None
                salary_max = None
                if pd.notna(row.get("min_amount")):
                    salary_min = float(row["min_amount"])
                if pd.notna(row.get("max_amount")):
                    salary_max = float(row["max_amount"])

                # Clean and normalize description (remove extra whitespace/newlines)
                description = None
                if pd.notna(row.get("description")):
                    raw_desc = str(row.get("description", ""))
                    # Normalize whitespace: collapse multiple spaces/newlines into single space
                    description = re.sub(r'\s+', ' ', raw_desc).strip()

                listing = JobListing(
                    title=str(row.get("title", "Unknown Title")),
                    company=str(row.get("company", "Unknown Company")),
                    location=str(row.get("location", "Unknown Location")),
                    date_posted=date_posted,
                    job_url=str(row.get("job_url", "")),
                    site_source=str(row.get("site", "unknown")),
                    description=description,
                    salary_min=salary_min,
                    salary_max=salary_max,
                    job_type=str(row.get("job_type", "")) if pd.notna(row.get("job_type")) else None,
                    search_offset=offset,
                )

                # Only add if we have a valid URL
                if listing.job_url:
                    listings.append(listing)

            except Exception as e:
                print(f"Error parsing job row: {e}")
                continue

        return listings
