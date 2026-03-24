"""LLM/Ollama routes for job posting analysis"""

import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from api.schemas import (
    AnalyzeFitFromUrlRequest,
    AnalyzeFitRequest,
    ExperienceMatchResponse,
    ExtractedJobDataResponse,
    FetchJobUrlRequest,
    FetchJobUrlResponse,
    FitAnalysisResponse,
    LLMConfigResponse,
    LLMConfigUpdateRequest,
    LLMModelsResponse,
    LLMStatusResponse,
    PreviewJobRequirementsFromUrlRequest,
    PreviewJobRequirementsRequest,
    PreviewJobRequirementsResponse,
    ScamAnalysisResponse,
    ScanJobPostingRequest,
    SkillsMatchResponse,
)
from jam.core.llm_config import get_llm_config, reload_config
from jam.core.services.config_service import ConfigService
from jam.core.services.llm_service import LLMService

router = APIRouter()


@router.get("/status", response_model=LLMStatusResponse)
async def get_llm_status():
    """Get Ollama/LLM status and configuration"""
    service = LLMService()
    status = await service.get_status()
    return LLMStatusResponse(**status)


@router.get("/models", response_model=LLMModelsResponse)
async def get_llm_models():
    """Get available models (with size metadata when available) and system RAM"""
    service = LLMService()
    models_data = await service.get_models_metadata()
    return LLMModelsResponse(**models_data)


@router.get("/config", response_model=LLMConfigResponse)
async def get_llm_config_endpoint():
    """Get current LLM configuration"""
    config_service = ConfigService()
    llm_config = get_llm_config()

    # Get values from database overrides or fall back to YAML config
    url = config_service.get("ollama_url") or llm_config.url
    vision_model = config_service.get("ollama_model") or llm_config.vision_model
    text_model = config_service.get("ollama_text_model") or llm_config.text_model
    api_mode = config_service.get("llm_api_mode") or llm_config.api_mode
    temperature = float(config_service.get("llm_temperature") or 0)
    max_tokens = int(config_service.get("llm_max_tokens") or 1024)
    concurrency = int(config_service.get("llm_concurrency") or llm_config.analysis.concurrency)

    return LLMConfigResponse(
        url=url,
        api_mode=api_mode,
        vision_model=vision_model,
        text_model=text_model,
        temperature=temperature,
        max_tokens=max_tokens,
        concurrency=concurrency,
    )


@router.put("/config", response_model=LLMConfigResponse)
async def update_llm_config_endpoint(request: LLMConfigUpdateRequest):
    """Update LLM configuration (stored in database, overrides YAML)"""
    config_service = ConfigService()

    # Update only provided fields
    if request.url is not None:
        config_service.set("ollama_url", request.url)
    if request.api_mode is not None:
        if request.api_mode not in ("openai", "ollama"):
            raise HTTPException(status_code=400, detail="api_mode must be 'openai' or 'ollama'")
        config_service.set("llm_api_mode", request.api_mode)
    if request.vision_model is not None:
        config_service.set("ollama_model", request.vision_model)
    if request.text_model is not None:
        config_service.set("ollama_text_model", request.text_model)
    if request.temperature is not None:
        if not 0 <= request.temperature <= 2:
            raise HTTPException(status_code=400, detail="temperature must be between 0 and 2")
        config_service.set("llm_temperature", str(request.temperature))
    if request.max_tokens is not None:
        if not 64 <= request.max_tokens <= 8192:
            raise HTTPException(status_code=400, detail="max_tokens must be between 64 and 8192")
        config_service.set("llm_max_tokens", str(request.max_tokens))
    if request.concurrency is not None:
        if not 1 <= request.concurrency <= 10:
            raise HTTPException(status_code=400, detail="concurrency must be between 1 and 10")
        config_service.set("llm_concurrency", str(request.concurrency))

    # Return updated config
    return await get_llm_config_endpoint()


@router.post("/scan-job-posting", response_model=ExtractedJobDataResponse)
async def scan_job_posting(request: ScanJobPostingRequest):
    """
    Scan a job posting image and extract relevant fields.

    The image should be base64-encoded. Data URL prefix (e.g., "data:image/png;base64,")
    is optional and will be stripped if present.
    """
    service = LLMService()

    # Check if Ollama is available
    status = await service.get_status()
    if not status["available"]:
        raise HTTPException(
            status_code=503, detail="Ollama is not available. Please ensure Ollama is running."
        )

    if not status["model_ready"]:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{status['model']}' is not available. Please pull the model with: ollama pull {status['model']}",
        )

    try:
        extracted = await service.analyze_job_posting(request.image_base64)
        return ExtractedJobDataResponse(**extracted.to_dict())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze image: {str(e)}")


@router.post("/preview-job-requirements", response_model=PreviewJobRequirementsResponse)
async def preview_job_requirements(request: PreviewJobRequirementsRequest):
    """Preview the full parsed job requirements object from a posting screenshot."""
    service = LLMService()

    status = await service.get_status()
    if not status["available"]:
        raise HTTPException(
            status_code=503, detail="Ollama is not available. Please ensure Ollama is running."
        )

    if not status["model_ready"]:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{status['model']}' is not available. Please pull the model with: ollama pull {status['model']}",
        )

    try:
        data = await service.preview_job_requirements_from_image(request.image_base64)
        return PreviewJobRequirementsResponse(data=data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to preview job requirements: {str(e)}")


@router.post("/preview-job-requirements-from-url", response_model=PreviewJobRequirementsResponse)
async def preview_job_requirements_from_url(request: PreviewJobRequirementsFromUrlRequest):
    """Preview the full parsed job requirements object from a job posting URL."""
    service = LLMService()

    status = await service.get_status()
    if not status["available"]:
        raise HTTPException(
            status_code=503, detail="Ollama is not available. Please ensure Ollama is running."
        )

    if not status["model_ready"]:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{status['model']}' is not available. Please pull the model with: ollama pull {status['model']}",
        )

    success, error, job_text, _, _ = await service.fetch_job_posting_url(request.job_posting_url)
    if not success:
        raise HTTPException(status_code=422, detail=error)

    try:
        data = await service.preview_job_requirements_from_text(job_text)
        return PreviewJobRequirementsResponse(data=data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to preview job requirements from URL: {str(e)}"
        )


@router.post("/analyze-fit", response_model=FitAnalysisResponse)
async def analyze_job_fit(request: AnalyzeFitRequest):
    """
    Analyze job fit by comparing a job posting against a resume.

    Both images should be base64-encoded. Data URL prefix is optional.
    Returns a fit analysis with score, skills match, red flags, and scam detection.
    """
    service = LLMService()

    # Check if Ollama is available
    status = await service.get_status()
    if not status["available"]:
        raise HTTPException(
            status_code=503, detail="Ollama is not available. Please ensure Ollama is running."
        )

    if not status["model_ready"]:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{status['model']}' is not available. Please pull the model with: ollama pull {status['model']}",
        )

    try:
        print(f"Job posting base64 length: {len(request.job_posting_base64)}")
        print(f"Resume base64 length: {len(request.resume_base64)}")
        print(f"Job posting starts with: {request.job_posting_base64[:50]}")
        print(f"Resume starts with: {request.resume_base64[:50]}")

        analysis = await service.analyze_job_fit(
            job_posting_base64=request.job_posting_base64,
            resume_base64=request.resume_base64,
        )
        return FitAnalysisResponse(
            score=analysis.score,
            summary=analysis.summary,
            compatible=analysis.compatible,
            skills_match=SkillsMatchResponse(**analysis.skills_match.to_dict()),
            experience_match=ExperienceMatchResponse(**analysis.experience_match.to_dict()),
            red_flags=analysis.red_flags,
            scam_analysis=ScamAnalysisResponse(**analysis.scam_analysis.to_dict()),
            recommendations=analysis.recommendations,
        )
    except ValueError as e:
        print(f"ValueError in analyze_job_fit: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"Exception in analyze_job_fit: {type(e).__name__}: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to analyze job fit: {str(e)}")


@router.post("/analyze-fit-stream")
async def analyze_job_fit_stream(request: AnalyzeFitRequest):
    """
    Analyze job fit with Server-Sent Events for progress updates.

    Returns SSE stream with progress updates and final result.
    """
    service = LLMService()

    # Check if Ollama is available
    status = await service.get_status()
    if not status["available"]:
        raise HTTPException(
            status_code=503, detail="Ollama is not available. Please ensure Ollama is running."
        )

    if not status["model_ready"]:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{status['model']}' is not available. Please pull the model with: ollama pull {status['model']}",
        )

    async def event_generator():
        try:
            async for progress in service.analyze_job_fit_stream(
                job_posting_base64=request.job_posting_base64,
                resume_base64=request.resume_base64,
            ):
                if progress.get("type") == "complete":
                    # Convert result to response format
                    result = progress["result"]
                    response_data = {
                        "type": "complete",
                        "result": {
                            "score": result.score,
                            "summary": result.summary,
                            "compatible": result.compatible,
                            "skills_match": result.skills_match.to_dict(),
                            "experience_match": result.experience_match.to_dict(),
                            "red_flags": result.red_flags,
                            "scam_analysis": result.scam_analysis.to_dict(),
                            "recommendations": result.recommendations,
                        },
                    }
                    yield f"data: {json.dumps(response_data)}\n\n"
                else:
                    yield f"data: {json.dumps(progress)}\n\n"
        except Exception as e:
            error_data = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/fetch-job-url", response_model=FetchJobUrlResponse)
async def fetch_job_url(request: FetchJobUrlRequest):
    """
    Fetch a job posting URL and check it can be read.
    Returns success/failure and a short text preview.
    """
    service = LLMService()
    success, error, text, preview_image_url, raw_html = await service.fetch_job_posting_url(request.url)
    if not success:
        return FetchJobUrlResponse(success=False, error=error)
    preview = text[:300].strip() if text else ""
    return FetchJobUrlResponse(
        success=True,
        text_preview=preview,
        preview_image_url=preview_image_url,
        raw_html=raw_html,
    )


@router.post("/analyze-fit-from-url-stream")
async def analyze_job_fit_from_url_stream(request: AnalyzeFitFromUrlRequest):
    """
    Fetch a job posting URL and analyze fit against a resume using SSE streaming.
    """
    service = LLMService()

    # Check if Ollama is available
    status = await service.get_status()
    if not status["available"]:
        raise HTTPException(
            status_code=503, detail="Ollama is not available. Please ensure Ollama is running."
        )
    if not status["model_ready"]:
        raise HTTPException(
            status_code=503,
            detail=f"Model '{status['model']}' is not available. Please pull the model with: ollama pull {status['model']}",
        )

    # Fetch the URL up-front so we can return an error immediately if it fails
    success, error, job_text, _, _ = await service.fetch_job_posting_url(request.job_posting_url)
    if not success:
        raise HTTPException(status_code=422, detail=error)

    async def event_generator():
        try:
            async for progress in service.analyze_job_fit_stream_from_text(
                job_text=job_text,
                resume_base64=request.resume_base64,
            ):
                if progress.get("type") == "complete":
                    result = progress["result"]
                    response_data = {
                        "type": "complete",
                        "result": {
                            "score": result.score,
                            "summary": result.summary,
                            "compatible": result.compatible,
                            "skills_match": result.skills_match.to_dict(),
                            "experience_match": result.experience_match.to_dict(),
                            "red_flags": result.red_flags,
                            "scam_analysis": result.scam_analysis.to_dict(),
                            "recommendations": result.recommendations,
                        },
                    }
                    yield f"data: {json.dumps(response_data)}\n\n"
                else:
                    yield f"data: {json.dumps(progress)}\n\n"
        except Exception as e:
            error_data = {"type": "error", "message": str(e)}
            yield f"data: {json.dumps(error_data)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
