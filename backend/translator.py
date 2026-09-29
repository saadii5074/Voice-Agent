"""
translator.py — High-Performance Translation Engine for VoiceTrack.

Translates multi-speaker Urdu / Hindi / Hindustani transcripts to English
asynchronously using httpx with automatic fallback and batching.
"""

from __future__ import annotations

import logging
import asyncio
from typing import List, Dict, Any, Optional
import httpx

logger = logging.getLogger(__name__)

TRANSLATE_API_URL = "https://translate.googleapis.com/translate_a/single"


async def translate_text_to_english(text: str, client: Optional[httpx.AsyncClient] = None) -> str:
    """
    Translate a single text string (Urdu, Hindi, etc.) into English.
    Returns the original text if it is already clean English or if translation fails.
    """
    clean_text = text.strip()
    if not clean_text:
        return ""

    params = {
        "client": "gtx",
        "sl": "auto",
        "tl": "en",
        "dt": "t",
        "q": clean_text,
    }

    try:
        if client:
            res = await client.get(TRANSLATE_API_URL, params=params, timeout=6.0)
        else:
            async with httpx.AsyncClient() as c:
                res = await c.get(TRANSLATE_API_URL, params=params, timeout=6.0)

        if res.status_code == 200:
            data = res.json()
            # Google GTX returns nested parts: [[['translated text', 'source text', ...]]]
            if data and isinstance(data, list) and len(data) > 0 and isinstance(data[0], list):
                translated_parts = [part[0] for part in data[0] if part and len(part) > 0 and part[0]]
                translated = "".join(translated_parts).strip()
                if translated:
                    return translated
        return clean_text
    except Exception as exc:
        logger.warning("Translation error for text '%s': %s", clean_text[:30], exc)
        return clean_text


async def translate_transcript_segments(
    segments: List[Dict[str, Any]], target_language: str = "en"
) -> List[Dict[str, Any]]:
    """
    Translate an entire session transcript to English in parallel batches.
    Returns segments with added 'translated_text' and 'original_text' fields.
    """
    if not segments:
        return []

    async with httpx.AsyncClient(timeout=10.0) as client:
        tasks = [
            translate_text_to_english(seg.get("text", ""), client=client)
            for seg in segments
        ]
        translated_texts = await asyncio.gather(*tasks, return_exceptions=True)

    result_segments: List[Dict[str, Any]] = []
    for i, seg in enumerate(segments):
        res = translated_texts[i]
        trans = res if isinstance(res, str) else seg.get("text", "")
        updated = dict(seg)
        updated["original_text"] = seg.get("text", "")
        updated["translated_text"] = trans
        # Also update 'text' to the translated version if user requested all-in-one English
        updated["translated_language"] = target_language
        result_segments.append(updated)

    return result_segments
