"""Service layer for LLM/Ollama operations"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Optional

import httpx

from jam.core.llm_config import get_llm_config
from jam.core.services.config_service import ConfigService

logger = logging.getLogger(__name__)


@dataclass
class ExtractedJobData:
    """Data extracted from a job posting image"""

    company_name: Optional[str] = None
    position: Optional[str] = None
    source: Optional[str] = None
    url: Optional[str] = None
    work_location: Optional[str] = None  # "remote", "onsite", "hybrid"
    location_address: Optional[str] = None
    notes: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary, excluding None values"""
        return {k: v for k, v in self.__dict__.items() if v is not None}


@dataclass
class SkillsMatch:
    """Skills matching breakdown"""

    matched: list[str]
    missing: list[str]
    bonus: list[str]

    def to_dict(self) -> dict:
        return {
            "matched": self.matched,
            "missing": self.missing,
            "bonus": self.bonus,
        }


@dataclass
class ExperienceMatch:
    """Experience level matching"""

    required_level: str
    assessment: str
    compatible: bool

    def to_dict(self) -> dict:
        return {
            "required_level": self.required_level,
            "assessment": self.assessment,
            "compatible": self.compatible,
        }


@dataclass
class ScamAnalysis:
    """Scam and red flag analysis"""

    risk_level: str  # "low", "medium", "high"
    warnings: list[str]
    legitimate_signals: list[str]

    def to_dict(self) -> dict:
        return {
            "risk_level": self.risk_level,
            "warnings": self.warnings,
            "legitimate_signals": self.legitimate_signals,
        }


@dataclass
class FitAnalysis:
    """Complete job fit analysis result"""

    score: int  # 0-100
    summary: str
    compatible: bool
    skills_match: SkillsMatch
    experience_match: ExperienceMatch
    red_flags: list[str]
    scam_analysis: ScamAnalysis
    recommendations: list[str]

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "summary": self.summary,
            "compatible": self.compatible,
            "skills_match": self.skills_match.to_dict(),
            "experience_match": self.experience_match.to_dict(),
            "red_flags": self.red_flags,
            "scam_analysis": self.scam_analysis.to_dict(),
            "recommendations": self.recommendations,
        }


class LLMClient:
    """Client for communicating with LLM APIs (supports Ollama and OpenAI-compatible APIs)"""

    def __init__(self, base_url: str = "http://localhost:11434", api_mode: str = "ollama"):
        self.base_url = base_url.rstrip("/")
        self.api_mode = api_mode
        self.timeout = httpx.Timeout(120.0, connect=10.0)

    def _get_models_endpoint(self) -> str:
        """Get the models list endpoint based on API mode"""
        if self.api_mode == "openai":
            return f"{self.base_url}/v1/models"
        return f"{self.base_url}/api/tags"

    def _get_generate_endpoint(self) -> str:
        """Get the generation endpoint based on API mode"""
        if self.api_mode == "openai":
            return f"{self.base_url}/v1/chat/completions"
        return f"{self.base_url}/api/generate"

    async def is_available(self) -> bool:
        """Check if LLM server is available"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(self._get_models_endpoint())
                return response.status_code == 200
        except Exception as e:
            logger.warning(f"LLM server not available: {e}")
            return False

    async def list_models(self) -> list[str]:
        """List available models"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(self._get_models_endpoint())
                if response.status_code == 200:
                    data = response.json()
                    if self.api_mode == "openai":
                        # OpenAI format: {"data": [{"id": "model-name", ...}]}
                        return [m["id"] for m in data.get("data", [])]
                    else:
                        # Ollama format: {"models": [{"name": "model-name", ...}]}
                        return [m["name"] for m in data.get("models", [])]
        except Exception as e:
            logger.error(f"Failed to list models: {e}")
        return []

    async def has_model(self, model_name: str) -> bool:
        """Check if a specific model is available"""
        models = await self.list_models()
        # Check both exact match and base name match (e.g., "llava" matches "llava:latest")
        return any(
            m == model_name or m.startswith(f"{model_name}:") or model_name in m
            for m in models
        )

    def _build_openai_payload(self, model: str, prompt: str, images_base64: list[str] = None) -> dict:
        """Build OpenAI-compatible payload"""
        content = []

        # Add images if provided
        if images_base64:
            for img in images_base64:
                content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/jpeg;base64,{img}"}
                })

        # Add text prompt
        content.append({"type": "text", "text": prompt})

        return {
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "stream": True,
        }

    def _build_ollama_payload(self, model: str, prompt: str, images_base64: list[str] = None) -> dict:
        """Build Ollama-native payload"""
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": True,
        }
        if images_base64:
            payload["images"] = images_base64
        return payload

    async def _parse_openai_stream(self, response) -> str:
        """Parse OpenAI-compatible SSE stream"""
        full_response = ""
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                data = line[6:]  # Remove "data: " prefix
                if data == "[DONE]":
                    break
                try:
                    chunk = json.loads(data)
                    delta = chunk.get("choices", [{}])[0].get("delta", {})
                    if "content" in delta:
                        full_response += delta["content"]
                except json.JSONDecodeError:
                    continue
        return full_response

    async def _parse_ollama_stream(self, response) -> str:
        """Parse Ollama newline-delimited JSON stream"""
        full_response = ""
        async for line in response.aiter_lines():
            if line:
                try:
                    chunk = json.loads(line)
                    if "response" in chunk:
                        full_response += chunk["response"]
                    if chunk.get("done", False):
                        break
                except json.JSONDecodeError:
                    continue
        return full_response

    async def generate_with_image(
        self, model: str, prompt: str, image_base64: str
    ) -> Optional[str]:
        """Generate response using a vision model with an image"""
        return await self.generate_with_images(model, prompt, [image_base64])

    async def generate_with_images(
        self, model: str, prompt: str, images_base64: list[str]
    ) -> Optional[str]:
        """Generate response using a vision model with multiple images"""
        if self.api_mode == "openai":
            payload = self._build_openai_payload(model, prompt, images_base64)
        else:
            payload = self._build_ollama_payload(model, prompt, images_base64)

        stream_timeout = httpx.Timeout(None, connect=60.0)

        try:
            print(f"Sending {len(images_base64)} image(s) to {model} via {self.api_mode} API (streaming)...")
            async with httpx.AsyncClient(timeout=stream_timeout) as client:
                async with client.stream(
                    "POST",
                    self._get_generate_endpoint(),
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        error_msg = f"LLM generate failed: {response.status_code} - {error_text.decode()}"
                        print(error_msg)
                        logger.error(error_msg)
                        raise ValueError(error_msg)

                    if self.api_mode == "openai":
                        full_response = await self._parse_openai_stream(response)
                    else:
                        full_response = await self._parse_ollama_stream(response)

                    print(f"LLM streaming complete, response length: {len(full_response)}")
                    return full_response if full_response else None
        except httpx.ConnectError as e:
            error_msg = f"Failed to connect to LLM server: {e}"
            print(error_msg)
            logger.error(error_msg)
            raise ValueError(error_msg)
        except Exception as e:
            print(f"Failed to generate with images: {type(e).__name__}: {e}")
            logger.error(f"Failed to generate with images: {e}")
            raise

    async def generate_text(
        self, model: str, prompt: str
    ) -> Optional[str]:
        """Generate response using text-only prompt (no images)"""
        if self.api_mode == "openai":
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": True,
            }
        else:
            payload = self._build_ollama_payload(model, prompt)

        stream_timeout = httpx.Timeout(None, connect=60.0)

        try:
            print(f"Sending text prompt to {model} via {self.api_mode} API (streaming)...")
            async with httpx.AsyncClient(timeout=stream_timeout) as client:
                async with client.stream(
                    "POST",
                    self._get_generate_endpoint(),
                    json=payload,
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        error_msg = f"LLM generate failed: {response.status_code} - {error_text.decode()}"
                        print(error_msg)
                        logger.error(error_msg)
                        raise ValueError(error_msg)

                    if self.api_mode == "openai":
                        full_response = await self._parse_openai_stream(response)
                    else:
                        full_response = await self._parse_ollama_stream(response)

                    print(f"LLM text generation complete, response length: {len(full_response)}")
                    return full_response if full_response else None
        except httpx.ConnectError as e:
            error_msg = f"Failed to connect to LLM server: {e}"
            print(error_msg)
            logger.error(error_msg)
            raise ValueError(error_msg)
        except Exception as e:
            print(f"Failed to generate text: {type(e).__name__}: {e}")
            logger.error(f"Failed to generate text: {e}")
            raise


# Alias for backward compatibility
OllamaClient = LLMClient


class LLMService:
    """Business logic for LLM operations"""

    # Prompt for extracting job posting data
    JOB_EXTRACTION_PROMPT = """Analyze this job posting screenshot and extract the following information.
Return ONLY a valid JSON object with these fields (use null for missing information):

{
  "company_name": "The company name",
  "position": "The job title/position",
  "source": "The platform (LinkedIn, Indeed, Glassdoor, etc.) if visible",
  "url": "The job URL if visible in the browser or content",
  "work_location": "remote" or "onsite" or "hybrid" (based on job description)",
  "location_address": "City, State or location if mentioned",
  "notes": "Brief summary: salary range, key requirements, benefits if mentioned"
}

Important:
- Return ONLY the JSON object, no other text
- Use null for any field you cannot determine
- For work_location, only use: "remote", "onsite", or "hybrid"
- Keep notes concise (max 200 characters)"""

    # Prompt for extracting resume content (Pass 1)
    RESUME_EXTRACTION_PROMPT = """Extract the candidate's complete qualifications from this resume image.
Return ONLY a valid JSON object:

{
  "name": "Candidate name if visible",
  "contact": "Email or location if visible",
  "summary": "Professional summary or objective if present",
  "skills": {
    "technical": ["programming languages", "frameworks", "tools", "technologies"],
    "soft": ["communication", "leadership", "etc"]
  },
  "experience": [
    {
      "company": "Company name",
      "title": "Job title",
      "duration": "Date range or duration",
      "responsibilities": ["key", "responsibilities", "or", "achievements"]
    }
  ],
  "projects": [
    {
      "name": "Project name",
      "description": "Brief description",
      "technologies": ["tech", "used"]
    }
  ],
  "education": [
    {
      "institution": "School/University name",
      "degree": "Degree type and field",
      "year": "Graduation year if visible"
    }
  ],
  "certifications": ["list", "of", "certifications"],
  "total_experience_years": "estimated total years of professional experience",
  "experience_level": "Entry-level/Junior/Associate/Mid/Senior based on experience"
}

Important:
- Extract ALL work experience entries visible
- Include specific technologies and tools mentioned
- Note any notable achievements or metrics
- Return ONLY valid JSON, no other text"""

# Prompt for extracting job requirements (Pass 2)
    JOB_REQUIREMENTS_PROMPT = """Extract the job requirements and details from this job posting image.
Return ONLY a valid JSON object:

{
  "company_name": "Company name or null if not visible",
  "job_title": "The job title",
  "experience_level": "Entry-level/Junior/Associate/Mid/Senior/Lead/Principal/Director",
  "required_skills": ["list", "of", "required", "skills"],
  "preferred_skills": ["nice", "to", "have", "skills"],
  "years_experience_required": "X years or null",
  "requires_clearance": true/false,
  "clearance_type": "Exact clearance mentioned (Secret/Top Secret/TS/SCI/TS/SCI/Confidential) or null",
  "clearance_requirement_text": "Exact text from posting about clearance or null",
  "salary_range": "Salary if mentioned, else null",
  "location": "Location or Remote",
  "company_email_domain": "Email domain if visible (e.g., gmail.com, company.com)",
  "recruiter_type": "Direct hire / Recruiting agency / Unknown",
  "urgency_language": true/false,
  "job_description_quality": "Specific/Vague/Generic",
  "red_flags_noticed": ["any", "suspicious", "elements"]
}

CRITICAL: For clearance detection, look for ANY of these terms:
- "clearance", "Secret", "Top Secret", "TS/SCI", "TS/SCI", "Confidential"
- "must hold", "ability to obtain", "eligible for", "clearance required"
- "security clearance", "government clearance", "DoD clearance"

If ANY clearance language is found, set requires_clearance=true and capture the exact type and text.

Return ONLY valid JSON, no other text."""

    # Prompt for comparing and generating fit analysis (Pass 3)
    FIT_COMPARISON_PROMPT = """You are comparing a candidate's resume against a job posting to determine fit.

CANDIDATE PREFERENCES (HARD RULES - violations result in score=0 and compatible=false):
1. NO government security clearance - candidate does not have and cannot obtain clearance
2. ONLY Entry-level, Junior, or Associate roles - reject Mid-level, Senior, Lead, Principal, Staff, or Director positions

SCORING INSTRUCTIONS (0-100):
- Score based on how well the JOB MATCHES the RESUME
- 90-100: Excellent match - most required skills present, experience aligns well
- 70-89: Good match - many required skills, some gaps acceptable
- 50-69: Moderate match - missing some key skills or experience misalignment
- 30-49: Weak match - missing many required skills or significant gaps
- 10-29: Poor match - major skill gaps, unlikely to succeed
- 0: HARD RULE VIOLATED (requires clearance OR mid/senior+ level OR high scam risk)

SCAM DETECTION RULES - Flag as high risk if job shows:
- Unrealistic salary for the role/experience level
- Personal email domains (gmail, yahoo, hotmail) for corporate hiring
- Recruiting agency with no specific client/company mentioned
- "Urgent" or "immediate start" pressure language
- Vague job descriptions with no specific responsibilities
- Requirements that don't match the job title
- Requests for payment or financial information
- Too-good-to-be-true promises

RESUME DATA:
{resume_data}

JOB POSTING DATA:
{job_data}

Now analyze and return ONLY a valid JSON object:

{{
  "score": 75,
  "summary": "Brief 1-2 sentence assessment of how well this job matches the candidate's background",
  "compatible": true,
  "skills_match": {{
    "matched": ["skills candidate has that job requires"],
    "missing": ["required skills candidate lacks"],
    "bonus": ["extra skills candidate has beyond requirements"]
  }},
  "experience_match": {{
    "required_level": "What the job requires",
    "assessment": "How candidate's experience compares to job requirements",
    "compatible": true
  }},
  "red_flags": ["any disqualifying factors or concerns"],
  "scam_analysis": {{
    "risk_level": "low/medium/high",
    "warnings": ["specific scam indicators found"],
    "legitimate_signals": ["signs this is a real job posting"]
  }},
  "recommendations": ["actionable tips to improve application or address gaps"]
}}

Critical Rules:
- Score 0-100 based on resume-to-job match quality
- Set score=0 AND compatible=false ONLY if: requires clearance, is mid/senior+ level, OR scam_analysis.risk_level is "high"
- If scam risk is high, score MUST be 0 and compatible MUST be false
- Be thorough in scam detection - protect the candidate
- Return ONLY valid JSON, no other text"""

    def __init__(self):
        self.config_service = ConfigService()
        self._client: Optional[LLMClient] = None
        self._llm_config = get_llm_config()

    @property
    def ollama_url(self) -> str:
        """Get configured LLM URL (from config/llm.yaml or database override)"""
        return self.config_service.get("ollama_url", self._llm_config.url)

    @property
    def ollama_model(self) -> str:
        """Get configured vision model (from config/llm.yaml or database override)"""
        return self.config_service.get("ollama_model", self._llm_config.vision_model)

    @property
    def text_model(self) -> str:
        """Get configured text model (from config/llm.yaml or database override)"""
        return self.config_service.get("ollama_text_model", self._llm_config.text_model)

    @property
    def api_mode(self) -> str:
        """Get configured API mode (ollama or openai, from database or YAML)"""
        return self.config_service.get("llm_api_mode") or self._llm_config.api_mode

    @property
    def client(self) -> LLMClient:
        """Get or create LLM client"""
        if self._client is None or self._client.base_url != self.ollama_url or self._client.api_mode != self.api_mode:
            self._client = LLMClient(self.ollama_url, self.api_mode)
        return self._client

    async def get_status(self) -> dict:
        """Get Ollama status information"""
        available = await self.client.is_available()
        model_ready = False
        text_model_ready = False
        available_models = []

        if available:
            available_models = await self.client.list_models()
            model_ready = await self.client.has_model(self.ollama_model)
            text_model_ready = await self.client.has_model(self.text_model)

        return {
            "available": available,
            "url": self.ollama_url,
            "model": self.ollama_model,
            "model_ready": model_ready,
            "text_model": self.text_model,
            "text_model_ready": text_model_ready,
            "available_models": available_models,
        }

    async def analyze_job_posting(self, image_base64: str) -> ExtractedJobData:
        """
        Analyze a job posting image and extract relevant fields.

        Args:
            image_base64: Base64-encoded image data (without data URL prefix)

        Returns:
            ExtractedJobData with extracted fields
        """
        # Remove data URL prefix if present
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]

        print("PROMPT: ", self.JOB_EXTRACTION_PROMPT)

        # Generate response from vision model
        response = await self.client.generate_with_image(
            model=self.ollama_model,
            prompt=self.JOB_EXTRACTION_PROMPT,
            image_base64=image_base64,
        )

        if not response:
            raise ValueError("No response from Ollama")

        print(response)

        # Parse the JSON response
        return self._parse_extraction_response(response)

    def _parse_extraction_response(self, response: str) -> ExtractedJobData:
        """Parse the LLM response into ExtractedJobData"""
        # Try to extract JSON from response (handle cases where model adds extra text)
        json_match = re.search(r"\{[^{}]*\}", response, re.DOTALL)
        if not json_match:
            logger.warning(f"No JSON found in response: {response[:200]}")
            raise ValueError("Could not parse job data from image")

        try:
            data = json.loads(json_match.group())
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error: {e}, response: {response[:200]}")
            raise ValueError("Could not parse job data from image")

        # Normalize work_location
        work_location = data.get("work_location")
        if work_location:
            work_location = work_location.lower().strip()
            if work_location not in ("remote", "onsite", "hybrid"):
                work_location = None

        return ExtractedJobData(
            company_name=self._clean_string(data.get("company_name")),
            position=self._clean_string(data.get("position")),
            source=self._clean_string(data.get("source")),
            url=self._clean_string(data.get("url")),
            work_location=work_location,
            location_address=self._clean_string(data.get("location_address")),
            notes=self._clean_string(data.get("notes")),
        )

    def _clean_string(self, value: Optional[str]) -> Optional[str]:
        """Clean a string value, returning None for empty/null values"""
        if value is None:
            return None
        if isinstance(value, str):
            cleaned = value.strip()
            if cleaned.lower() in ("null", "none", "n/a", ""):
                return None
            return cleaned
        return None

    def set_ollama_url(self, url: str) -> None:
        """Set Ollama URL configuration"""
        self.config_service.set("ollama_url", url)
        self._client = None  # Reset client

    def set_ollama_model(self, model: str) -> None:
        """Set Ollama model configuration"""
        self.config_service.set("ollama_model", model)

    async def analyze_job_fit(
        self, job_posting_base64: str, resume_base64: str
    ) -> FitAnalysis:
        """
        Analyze job fit by comparing a job posting against a resume.
        Uses a 3-pass approach for better results:
        1. Extract resume content
        2. Extract job requirements
        3. Compare and generate fit analysis

        Args:
            job_posting_base64: Base64-encoded job posting image
            resume_base64: Base64-encoded resume image

        Returns:
            FitAnalysis with score, breakdown, and recommendations
        """
        # Use the streaming version but collect the final result
        result = None
        async for progress in self.analyze_job_fit_stream(job_posting_base64, resume_base64):
            if progress.get("type") == "complete":
                result = progress.get("result")
            elif progress.get("type") == "error":
                raise ValueError(progress.get("message", "Analysis failed"))

        if result is None:
            raise ValueError("Analysis did not complete")
        return result

    async def analyze_job_fit_stream(
        self, job_posting_base64: str, resume_base64: str
    ):
        """
        Analyze job fit with streaming progress updates.
        Yields progress dictionaries with type, phase, and message.
        """
        # Remove data URL prefix if present
        if "," in job_posting_base64:
            job_posting_base64 = job_posting_base64.split(",", 1)[1]
        if "," in resume_base64:
            resume_base64 = resume_base64.split(",", 1)[1]

        try:
            # Pass 1: Extract resume content
            yield {"type": "progress", "phase": 1, "total_phases": 3, "message": "Extracting resume content..."}
            print("Pass 1: Extracting resume content...")
            resume_response = await self.client.generate_with_image(
                model=self.ollama_model,
                prompt=self.RESUME_EXTRACTION_PROMPT,
                image_base64=resume_base64,
            )
            if not resume_response:
                yield {"type": "error", "message": "Failed to extract resume content"}
                return
            print(f"Resume extraction complete: {resume_response[:200]}...")
            yield {"type": "progress", "phase": 1, "total_phases": 3, "message": "Resume content extracted", "done": True}

            # Pass 2: Extract job requirements
            yield {"type": "progress", "phase": 2, "total_phases": 3, "message": "Extracting job requirements..."}
            print("Pass 2: Extracting job requirements...")
            job_response = await self.client.generate_with_image(
                model=self.ollama_model,
                prompt=self.JOB_REQUIREMENTS_PROMPT,
                image_base64=job_posting_base64,
            )
            if not job_response:
                yield {"type": "error", "message": "Failed to extract job requirements"}
                return
            print(f"Job extraction complete: {job_response[:200]}...")
            yield {"type": "progress", "phase": 2, "total_phases": 3, "message": "Job requirements extracted", "done": True}

            # Pass 3: Compare and generate fit analysis
            yield {"type": "progress", "phase": 3, "total_phases": 3, "message": "Generating fit analysis..."}
            print("Pass 3: Generating fit analysis...")
            comparison_prompt = self.FIT_COMPARISON_PROMPT.format(
                resume_data=resume_response,
                job_data=job_response,
            )

            # For the final pass, we use text-only generation with a text model
            print(f"Using text model: {self.text_model}")
            fit_response = await self.client.generate_text(
                model=self.text_model,
                prompt=comparison_prompt,
            )
            if not fit_response:
                yield {"type": "error", "message": "Failed to generate fit analysis"}
                return
            print(f"Fit analysis complete: {fit_response[:200]}...")

            # Parse the JSON response
            result = self._parse_fit_analysis_response(fit_response)
            yield {"type": "progress", "phase": 3, "total_phases": 3, "message": "Analysis complete", "done": True}
            yield {"type": "complete", "result": result}

        except Exception as e:
            print(f"Error in analyze_job_fit_stream: {e}")
            yield {"type": "error", "message": str(e)}

    def _parse_fit_analysis_response(self, response: str) -> FitAnalysis:
        """Parse the LLM response into FitAnalysis"""
        # Try to extract JSON from response
        json_match = re.search(r"\{[\s\S]*\}", response)
        if not json_match:
            logger.warning(f"No JSON found in fit analysis response: {response[:200]}")
            raise ValueError("Could not parse fit analysis from response")

        try:
            data = json.loads(json_match.group())
        except json.JSONDecodeError as e:
            logger.warning(f"JSON parse error: {e}, response: {response[:200]}")
            raise ValueError("Could not parse fit analysis from response")

        # Parse skills match
        skills_data = data.get("skills_match", {})
        skills_match = SkillsMatch(
            matched=skills_data.get("matched", []),
            missing=skills_data.get("missing", []),
            bonus=skills_data.get("bonus", []),
        )

        # Parse experience match
        exp_data = data.get("experience_match", {})
        experience_match = ExperienceMatch(
            required_level=exp_data.get("required_level", "Unknown"),
            assessment=exp_data.get("assessment", ""),
            compatible=exp_data.get("compatible", True),
        )

        # Parse scam analysis
        scam_data = data.get("scam_analysis", {})
        scam_analysis = ScamAnalysis(
            risk_level=scam_data.get("risk_level", "low"),
            warnings=scam_data.get("warnings", []),
            legitimate_signals=scam_data.get("legitimate_signals", []),
        )

        # Build FitAnalysis
        return FitAnalysis(
            score=int(data.get("score", 0)),
            summary=data.get("summary", ""),
            compatible=data.get("compatible", True),
            skills_match=skills_match,
            experience_match=experience_match,
            red_flags=data.get("red_flags", []),
            scam_analysis=scam_analysis,
            recommendations=data.get("recommendations", []),
        )

