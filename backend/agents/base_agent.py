import time
import logging
from abc import ABC
from typing import Tuple, Dict, Any, Optional
from services.gemini import GeminiService
from utils.agent_logger import AgentLogger


class BaseAgent(ABC):
    """
    BaseAgent abstract class for all 7 VaidyaAI agents.
    Provides:
      - Common Gemini client access (Flash/Pro)
      - Timed execution helpers for latency metrics
      - Structured dual-write logger (Cloud Logging + Firestore agent_logs)
    """

    def __init__(self, agent_name: str):
        self.agent_name = agent_name
        self.gemini = GeminiService()
        self.logger = AgentLogger(agent_name)
        self.log = logging.getLogger(f"vaidyaai.agents.{agent_name}")

    async def _timed_gemini_call(
        self,
        task: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: str = "gemini-1.5-flash"
    ) -> Tuple[str, int]:
        """Call Gemini text generation and return (response_text, latency_ms)."""
        start = time.monotonic()
        result = await self.gemini.generate(
            prompt=prompt,
            system_prompt=system_prompt,
            model=model
        )
        latency_ms = int((time.monotonic() - start) * 1000)
        self.log.info(f"{task} | latency={latency_ms}ms | model={model}")
        return result, latency_ms

    async def _timed_gemini_json_call(
        self,
        task: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        model: str = "gemini-1.5-flash"
    ) -> Tuple[Dict[str, Any], int]:
        """Call Gemini JSON generation and return (response_dict, latency_ms)."""
        start = time.monotonic()
        result = await self.gemini.generate_json(
            prompt=prompt,
            system_prompt=system_prompt,
            model=model
        )
        latency_ms = int((time.monotonic() - start) * 1000)
        self.log.info(f"{task} (JSON) | latency={latency_ms}ms | model={model}")
        return result, latency_ms
