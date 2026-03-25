import logging
from pathlib import Path
import httpx
from fastapi import APIRouter, HTTPException, Response
from fastapi.responses import FileResponse
from jam.core.services.config_service import ConfigService

router = APIRouter()
logger = logging.getLogger(__name__)

# Ensure logos directory exists
LOGOS_DIR = Path("data/logos")
LOGOS_DIR.mkdir(parents=True, exist_ok=True)

@router.get("/{domain}")
async def get_logo(domain: str):
    domain = domain.lower().strip()
    safe_domain = "".join(c for c in domain if c.isalnum() or c in ".-_")
    if not safe_domain:
        raise HTTPException(status_code=400, detail="Invalid domain")

    file_path = LOGOS_DIR / f"{safe_domain}.img"
    
    # Check if we already have it cached
    if file_path.exists():
        if file_path.stat().st_size == 0:
            # We already tried and it failed (negative cache)
            raise HTTPException(status_code=404, detail="Logo not found")
        return FileResponse(file_path, media_type="image/png")

    # Need to fetch it
    config_service = ConfigService()
    logo_dev_key = await config_service.get_config("logo_dev_publishable_key")
    
    if not logo_dev_key:
        raise HTTPException(status_code=404, detail="Logo setting not configured")

    url = f"https://img.logo.dev/{domain}?token={logo_dev_key}&format=png"
    
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, follow_redirects=True, timeout=10.0)
            if resp.status_code == 200:
                # Save it
                with open(file_path, "wb") as f:
                    f.write(resp.content)
                return Response(content=resp.content, media_type="image/png")
            else:
                # Cache the miss (empty file) to avoid repeated requests to logo.dev
                with open(file_path, "wb") as f:
                    pass
                raise HTTPException(status_code=404, detail="Logo not found from provider")
        except Exception as e:
            logger.error(f"Error fetching logo for {domain}: {e}")
            raise HTTPException(status_code=404, detail="Error fetching logo")
