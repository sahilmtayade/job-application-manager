"""Service for LLM-based job analysis and scoring against resume"""

import asyncio
import json
import logging
import os
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, AsyncGenerator

import httpx

from jam.core.llm_config import get_llm_config
from jam.core.services.config_service import ConfigService
from jam.core.services.job_search_results_service import JobSearchResultsService, SavedJobResult

logger = logging.getLogger(__name__)


# Path to the default resume file
_CONFIG_DIR = Path(__file__).parent.parent.parent.parent / "config"
_DEFAULT_RESUME_PATH = _CONFIG_DIR / "resume.txt"


def _load_resume_from_file() -> str:
    """Load resume text from config/resume.txt file"""
    if _DEFAULT_RESUME_PATH.exists():
        try:
            return _DEFAULT_RESUME_PATH.read_text(encoding="utf-8").strip()
        except Exception as e:
            logger.warning(f"Failed to load resume from file: {e}")
    return ""


@dataclass
class JobAnalysisResult:
    """Result of LLM analysis for a single job"""
    job_id: int
    score: int  # 0-100
    analysis: str
    notes: str  # Detailed reasoning notes
    is_mismatch: bool
    matched_skills: list[str] = None
    missing_skills: list[str] = None

    def to_dict(self) -> dict:
        return {
            "job_id": self.job_id,
            "score": self.score,
            "analysis": self.analysis,
            "notes": self.notes,
            "is_mismatch": self.is_mismatch,
            "matched_skills": self.matched_skills or [],
            "missing_skills": self.missing_skills or [],
        }


class JobLLMAnalyzerService:
    """Service for analyzing jobs against resume using LLM"""

    # Candidate's core technology stack for matching
    CORE_STACK = [
        "react", "next.js", "nextjs", "typescript", "javascript",
        "python", "flask", "fastapi",
        "postgresql", "postgres", "mongodb", "mongo",
        "maplibre", "mapbox", "deck.gl", "geospatial", "gis",
        "websocket", "websockets", "real-time", "realtime",
        "celery", "dask", "redis",
        "node.js", "nodejs", "express",
        "tailwindcss", "tailwind", "material-ui", "mui",
        "react-flow", "reactflow",
        "docker", "kubernetes", "aws", "gcp",
        "graphql", "rest", "api",
        "pandas", "etl", "data pipeline",
    ]

    # Prompt template for job analysis
    JOB_ANALYSIS_PROMPT = """You are a strict evaluator. Your only task is to rate how suitable a job is for the candidate.
You MUST follow the rules below exactly. Do NOT add extra commentary.
Return VALID JSON ONLY. No markdown. No explanations outside JSON.

====================
CANDIDATE FACTS (IMMUTABLE)
====================
- No security clearance (cannot accept clearance-required jobs)
- Not a veteran
- Not disabled
- 2 years of professional experience
- Location: DMV (DC / Maryland / Virginia)

====================
RESUME
====================
{resume_text}

====================
JOB POSTING
====================
Title: {job_title}
Company: {company}
Location: {location}

Description:
{description}

====================
EVALUATION RULES
====================

STEP 1 — DISQUALIFIER CHECK (MANDATORY, STOP EARLY)

Scan BOTH job title and description.

A) SECURITY CLEARANCE (HARD STOP)
Candidate has NO clearance.

DISQUALIFY if ANY of the following appear:
- polygraph, poly, CI poly
- TS/SCI, Top Secret, Secret clearance
- active clearance, current clearance
- clearance required, must have clearance
- cleared candidates, possess clearance, hold clearance
- DoD, intelligence community roles requiring clearance

EXCEPTION (acceptable, NOT disqualifying):
- "ability to obtain clearance"
- "clearance eligibility"

IMPORTANT:
If the word "polygraph" appears ANYWHERE → DISQUALIFIED, no exceptions.

If disqualified, IMMEDIATELY return:
{{
  "score": 10,
  "is_mismatch": true,
  "analysis": "Disqualified: security clearance or polygraph required",
  "notes": "Candidate has no clearance",
  "matched_skills": [],
  "missing_skills": []
}}

B) VETERAN / DISABILITY TARGETING
If job explicitly targets veterans or disabled candidates → DISQUALIFIED

Return:
score = 10, is_mismatch = true

C) WRONG FIELD
If job is NOT software/tech-related (e.g., nursing, legal, accounting, sales, marketing) → DISQUALIFIED

Return:
score = 5, is_mismatch = true

D) INTERNSHIP / RECENT GRADUATE TARGETING
If job title or description indicates:
- Internship, intern, co-op
- "Recent graduate", "new graduate", "new grad", "recent grad"
- "Entry-level for recent graduates"
- University/college recruiting programs

→ DISQUALIFIED

Return:
score = 10, is_mismatch = true, analysis = "Disqualified: internship or recent graduate position"

If ANY disqualifier triggers, STOP. Do NOT evaluate skills.

====================
STEP 2 — SCORING (ONLY IF QUALIFIED)
====================

Candidate technical stack:
React, Next.js, TypeScript, Python, Flask, FastAPI, PostgreSQL, MongoDB,
MapLibre, WebSockets, Celery, Dask, Node.js, TailwindCSS

1) BASE SKILL MATCH (primary technologies only)
- 90%+ match → score range 70–85
- 70–89% → 50–69
- 50–69% → 35–49
- <50% → 0–34

2) BONUSES (additive)
- React or Next.js → +10
- Python backend (Flask/FastAPI) → +10
- GIS / mapping → +5
- ETL / data pipelines → +5
- WebSockets / real-time → +5
- 3+ strong stack matches → +10

3) PENALTIES
- Requires 3+ years experience → −15
- Requires 4+ years → −25
- Requires 5+ years → −35
- Senior / Lead / Staff / II / III in title → score capped at 40
- Onsite role outside DMV → −10

Clamp final score to 0–100.

====================
OUTPUT FORMAT (JSON ONLY)
====================
{{
  "score": <integer 0-100>,
  "is_mismatch": <true|false>,
  "analysis": "<2–3 sentence summary of fit>",
  "notes": "<brief breakdown of scoring decisions>",
  "matched_skills": [<strings>],
  "missing_skills": [<strings>]
}}"""

    def __init__(self):
        self.config_service = ConfigService()
        self.results_service = JobSearchResultsService()

        # Load LLM config from config/llm.yaml
        llm_config = get_llm_config()

        # Allow database overrides, fall back to YAML config
        self.ollama_url = self.config_service.get("ollama_url") or llm_config.url
        self.text_model = self.config_service.get("ollama_text_model") or llm_config.text_model
        self.api_mode = self.config_service.get("llm_api_mode") or llm_config.api_mode
        self.timeout = httpx.Timeout(
            llm_config.server.read_timeout or 120.0,
            connect=llm_config.server.connect_timeout
        )

        # Inference parameters from database or defaults
        temp_str = self.config_service.get("llm_temperature")
        self.temperature = float(temp_str) if temp_str else 0.0

        max_tok_str = self.config_service.get("llm_max_tokens")
        self.max_tokens = int(max_tok_str) if max_tok_str else 1024

        # Concurrency setting for parallel job analysis
        concurrency_str = self.config_service.get("llm_concurrency")
        self.concurrency = int(concurrency_str) if concurrency_str else llm_config.analysis.concurrency

    def _get_models_endpoint(self) -> str:
        """Get the models list endpoint based on API mode"""
        if self.api_mode == "openai":
            return f"{self.ollama_url}/v1/models"
        return f"{self.ollama_url}/api/tags"

    def _get_generate_endpoint(self) -> str:
        """Get the generation endpoint based on API mode"""
        if self.api_mode == "openai":
            return f"{self.ollama_url}/v1/chat/completions"
        return f"{self.ollama_url}/api/generate"

    async def get_status(self) -> dict:
        """Check if LLM is available for analysis"""
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0)) as client:
                response = await client.get(self._get_models_endpoint())
                if response.status_code == 200:
                    data = response.json()

                    # Parse models based on API mode
                    if self.api_mode == "openai":
                        models = [m["id"] for m in data.get("data", [])]
                    else:
                        models = [m["name"] for m in data.get("models", [])]

                    model_ready = any(
                        m == self.text_model or m.startswith(f"{self.text_model}:") or self.text_model in m
                        for m in models
                    )
                    return {
                        "available": True,
                        "model": self.text_model,
                        "model_ready": model_ready,
                        "available_models": models,
                    }
        except Exception as e:
            logger.warning(f"LLM not available: {e}")

        return {
            "available": False,
            "model": self.text_model,
            "model_ready": False,
            "available_models": [],
        }

    def get_resume_text(self) -> str:
        """
        Get the resume text for analysis.

        Priority:
        1. Database config (allows user override via settings)
        2. File at config/resume.txt (default)

        Returns:
            Resume text string
        """
        # Check for database override first
        db_resume = self.config_service.get("resume_text")
        if db_resume:
            return db_resume

        # Load from file
        return _load_resume_from_file()

    async def analyze_jobs(
        self,
        limit: int = 0,
        on_progress: Optional[callable] = None,
    ) -> list[JobAnalysisResult]:
        """
        Analyze unscored jobs against the resume.
        If limit is 0, analyze all unanalyzed jobs.
        Returns list of analysis results.
        """
        # Check LLM availability
        status = await self.get_status()
        if not status["available"] or not status["model_ready"]:
            raise ValueError(f"LLM not available. Model '{self.text_model}' not ready.")

        # Get resume text
        resume_text = self.get_resume_text()

        # Get unanalyzed jobs (limit=0 means get all)
        fetch_limit = limit if limit > 0 else 9999
        jobs = self.results_service.get_unanalyzed_jobs(limit=fetch_limit)
        if not jobs:
            return []

        results = []
        total = len(jobs)

        for i, job in enumerate(jobs):
            if on_progress:
                on_progress(i + 1, total, f"Analyzing: {job.title[:50]}...")

            try:
                result = await self._analyze_single_job(job, resume_text)
                if result:
                    results.append(result)

                    # Update database with analysis
                    self.results_service.update_llm_analysis(
                        job_id=result.job_id,
                        score=result.score,
                        analysis=result.analysis,
                        notes=result.notes,
                        is_mismatch=result.is_mismatch,
                    )

            except Exception as e:
                logger.error(f"Error analyzing job {job.id}: {e}")
                continue

        return results

    def _has_valid_description(self, job: SavedJobResult) -> bool:
        """Check if job has a valid description for analysis (at least 50 chars)"""
        if not job.description:
            return False
        desc = job.description.strip()
        if len(desc) < 50:
            return False
        # Also check for placeholder text
        lower_desc = desc.lower()
        if lower_desc in ("no description available", "no description", "n/a", "none"):
            return False
        return True

    async def analyze_jobs_stream(
        self,
        limit: int = 0,
        job_ids: Optional[list[int]] = None,
    ) -> AsyncGenerator[dict, None]:
        """
        Analyze jobs with streaming progress updates using concurrent processing.

        Args:
            limit: Max unanalyzed jobs to fetch (0 = all). Ignored if job_ids provided.
            job_ids: Specific job IDs to analyze (regardless of current analysis state).
                    If provided, these jobs are analyzed even if already analyzed.

        Yields progress dicts and final results.
        Jobs without valid descriptions (null, empty, or <50 chars) are skipped.
        Uses concurrent analysis (controlled by config.analysis.concurrency) for throughput.
        """
        # Check LLM availability
        status = await self.get_status()
        if not status["available"] or not status["model_ready"]:
            yield {"type": "error", "message": f"LLM not available. Model '{self.text_model}' not ready."}
            return

        resume_text = self.get_resume_text()

        # Get jobs to analyze
        if job_ids:
            # Analyze specific jobs by ID (force re-analysis)
            jobs = [self.results_service.get_result_by_id(jid) for jid in job_ids]
            jobs = [j for j in jobs if j is not None]  # Filter out not found
        else:
            # Get unanalyzed jobs (limit=0 means get all)
            fetch_limit = limit if limit > 0 else 9999
            jobs = self.results_service.get_unanalyzed_jobs(limit=fetch_limit)

        # Filter out jobs without valid descriptions
        skipped_jobs = [j for j in jobs if not self._has_valid_description(j)]
        jobs = [j for j in jobs if self._has_valid_description(j)]

        total = len(jobs)
        skipped_count = len(skipped_jobs)

        if total == 0:
            yield {"type": "complete", "analyzed": 0, "skipped": skipped_count, "results": []}
            return

        # Timing tracking
        start_time = time.time()

        # Send initial queue state with all job IDs
        queued_ids = [j.id for j in jobs]
        yield {
            "type": "start",
            "total": total,
            "queued_ids": queued_ids,
            "skipped_no_description": skipped_count,
            "concurrency": self.concurrency,
        }

        # Concurrent analysis using semaphore to limit parallel requests
        semaphore = asyncio.Semaphore(self.concurrency)
        results = []
        completed_count = 0

        async def analyze_with_semaphore(job, job_index: int):
            """Analyze a single job with semaphore-controlled concurrency"""
            async with semaphore:
                try:
                    result = await self._analyze_single_job(job, resume_text)
                    return ("success", job, job_index, result)
                except Exception as e:
                    return ("error", job, job_index, str(e))

        # Create tasks for all jobs
        tasks = [
            asyncio.create_task(analyze_with_semaphore(job, i))
            for i, job in enumerate(jobs)
        ]

        # Signal which jobs are starting (first batch up to concurrency limit)
        analyzing_jobs = jobs[:self.concurrency]
        for i, job in enumerate(analyzing_jobs):
            yield {
                "type": "analyzing",
                "job_id": job.id,
                "current": i + 1,
                "total": total,
                "job_title": job.title[:50],
                "company": job.company,
            }

        # Process results as they complete
        for coro in asyncio.as_completed(tasks):
            status_type, job, job_index, result_or_error = await coro
            completed_count += 1

            if status_type == "success" and result_or_error:
                result = result_or_error
                results.append(result)

                # Update database
                self.results_service.update_llm_analysis(
                    job_id=result.job_id,
                    score=result.score,
                    analysis=result.analysis,
                    notes=result.notes,
                    is_mismatch=result.is_mismatch,
                    matched_skills=result.matched_skills,
                    missing_skills=result.missing_skills,
                )

                # Calculate timing info
                elapsed_ms = int((time.time() - start_time) * 1000)
                remaining = total - completed_count
                avg_per_job_ms = elapsed_ms / completed_count if completed_count > 0 else 0
                eta_ms = int(avg_per_job_ms * remaining)

                yield {
                    "type": "analyzed",
                    "job_id": result.job_id,
                    "score": result.score,
                    "is_mismatch": result.is_mismatch,
                    "analysis": result.analysis,
                    "completed": completed_count,
                    "total": total,
                    "elapsed_ms": elapsed_ms,
                    "eta_ms": eta_ms,
                    "avg_per_job_ms": int(avg_per_job_ms),
                }
            elif status_type == "error":
                yield {"type": "job_error", "job_id": job.id, "message": result_or_error}

            # Signal next job starting if there are more in queue
            next_index = self.concurrency + completed_count - 1
            if next_index < total:
                next_job = jobs[next_index]
                yield {
                    "type": "analyzing",
                    "job_id": next_job.id,
                    "current": next_index + 1,
                    "total": total,
                    "job_title": next_job.title[:50],
                    "company": next_job.company,
                }

        total_time_ms = int((time.time() - start_time) * 1000)
        yield {
            "type": "complete",
            "analyzed": len(results),
            "skipped": skipped_count,
            "results": [r.to_dict() for r in results],
            "total_time_ms": total_time_ms,
        }

    async def _analyze_single_job(
        self,
        job: SavedJobResult,
        resume_text: str,
    ) -> Optional[JobAnalysisResult]:
        """Analyze a single job against the resume"""
        prompt = self.JOB_ANALYSIS_PROMPT.format(
            resume_text=resume_text,
            job_title=job.title,
            company=job.company,
            location=job.location or "Not specified",
            description=job.description or "No description available",
        )

        try:
            response = await self._generate_text(prompt)
            if not response:
                return None

            # Parse JSON response
            analysis_data = self._parse_json_response(response)
            if not analysis_data:
                return None

            # Ensure notes is a string (LLM may return nested dict)
            notes_value = analysis_data.get("notes", "")
            if isinstance(notes_value, dict):
                notes_value = json.dumps(notes_value)
            elif not isinstance(notes_value, str):
                notes_value = str(notes_value)

            # Extract skills lists (ensure they are lists of strings)
            matched_skills = analysis_data.get("matched_skills", [])
            if not isinstance(matched_skills, list):
                matched_skills = []
            matched_skills = [str(s) for s in matched_skills if s]

            missing_skills = analysis_data.get("missing_skills", [])
            if not isinstance(missing_skills, list):
                missing_skills = []
            missing_skills = [str(s) for s in missing_skills if s]

            return JobAnalysisResult(
                job_id=job.id,
                score=min(100, max(0, int(analysis_data.get("score", 50)))),
                analysis=str(analysis_data.get("analysis", "Unable to analyze")),
                notes=notes_value,
                is_mismatch=bool(analysis_data.get("is_mismatch", False)),
                matched_skills=matched_skills,
                missing_skills=missing_skills,
            )

        except Exception as e:
            logger.error(f"Error in single job analysis: {e}")
            return None

    async def _generate_text(self, prompt: str) -> Optional[str]:
        """Generate text using configured LLM API"""
        # Build payload based on API mode
        if self.api_mode == "openai":
            payload = {
                "model": self.text_model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": True,
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
            }
        else:
            payload = {
                "model": self.text_model,
                "prompt": prompt,
                "stream": True,
                "options": {
                    "temperature": self.temperature,
                    "num_predict": self.max_tokens,
                },
            }

        stream_timeout = httpx.Timeout(None, connect=60.0)

        try:
            async with httpx.AsyncClient(timeout=stream_timeout) as client:
                async with client.stream(
                    "POST",
                    self._get_generate_endpoint(),
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        logger.error(f"LLM error: {response.status_code} - {error_text.decode()}")
                        return None

                    full_response = ""
                    async for line in response.aiter_lines():
                        if line:
                            # Handle OpenAI SSE format
                            if self.api_mode == "openai":
                                if line.startswith("data: "):
                                    data = line[6:]
                                    if data == "[DONE]":
                                        break
                                    try:
                                        chunk = json.loads(data)
                                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                                        if "content" in delta:
                                            full_response += delta["content"]
                                    except json.JSONDecodeError:
                                        continue
                            else:
                                # Handle Ollama format
                                try:
                                    chunk = json.loads(line)
                                    if "response" in chunk:
                                        full_response += chunk["response"]
                                    if chunk.get("done", False):
                                        break
                                except json.JSONDecodeError:
                                    continue

                    return full_response if full_response else None

        except Exception as e:
            logger.error(f"Error generating text: {e}")
            return None

    def _parse_json_response(self, response: str) -> Optional[dict]:
        """Parse JSON from LLM response, handling thinking tags and markdown code blocks"""
        # Remove thinking tags if present (deepseek-r1 style)
        cleaned = re.sub(r'<think>.*?</think>', '', response, flags=re.DOTALL)

        # Remove markdown code blocks if present (```json or ```python etc.)
        # Handle opening: ```python, ```json, ``` with optional newline
        cleaned = re.sub(r'```\w*\n?', '', cleaned)
        # Handle closing: ``` with optional preceding newline
        cleaned = re.sub(r'\n?```', '', cleaned)

        # Fix invalid JSON escape sequences (LLMs sometimes escape chars that don't need it)
        # Valid JSON escapes: \" \\ \/ \b \f \n \r \t \uXXXX
        # Remove invalid escapes like \- \. \' etc. by replacing \X with X for non-valid escapes
        cleaned = re.sub(r'\\([^"\\/bfnrtu])', r'\1', cleaned)

        cleaned = cleaned.strip()

        try:
            # Try direct parse first
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', cleaned)
        if json_match:
            try:
                return json.loads(json_match.group())
            except json.JSONDecodeError:
                pass

        logger.warning(f"Could not parse JSON from response: {response[:200]}")
        return None
