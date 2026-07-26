import os
from functools import lru_cache
from typing import Optional


@lru_cache(maxsize=128)
def get_secret(name: str, default: Optional[str] = None) -> Optional[str]:
    env_value = os.getenv(name)
    if env_value:
        return env_value

    project_id = os.getenv("GCP_PROJECT") or os.getenv("GOOGLE_CLOUD_PROJECT")
    if project_id:
        try:
            from google.cloud import secretmanager

            client = secretmanager.SecretManagerServiceClient()
            resource = f"projects/{project_id}/secrets/{name}/versions/latest"
            response = client.access_secret_version(request={"name": resource})
            return response.payload.data.decode("UTF-8")
        except Exception:
            return default

    return default
