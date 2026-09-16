import httpx
import json
import asyncio
from typing import List, Dict, Any
from app.config import settings

OPENROUTER_HEADERS = {
    "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:5173",
    "X-Title": "Chart Rabbit Trading Platform",
}

def build_system_context(journal_stats: Dict[str, Any], active_page: str = "aichat") -> str:
    page_focus = {
        "chart": "The user is currently viewing the Live Trading Chart page. Act as an active chart co-pilot: provide immediate ICT technical analysis (Order Blocks, Fair Value Gap levels, Market Structure Shifts), suggest exact Entry / Stop Loss / Take Profit prices, and assist with trade logging.",
        "journal": "The user is currently viewing the Trade Journal page. Act as a trading journal auditor: analyze their logged trades, identify revenge trading or risk rule violations, evaluate win/loss distribution, and suggest discipline improvements.",
        "analytics": "The user is currently viewing the Performance Analytics page. Act as a quantitative portfolio strategist: break down Net PnL, Win Rate %, Profit Factor, R:R ratios, monthly performance curves, and asset class profitability.",
        "aichat": "The user is in the main AI Co-Pilot Chat view. Provide comprehensive, agentic trading assistance across technical chart setups, risk management, and journal history."
    }.get(active_page.lower(), "Provide agentic trading assistance.")

    return (
        "You are Chart Rabbit AI, an autonomous agentic trading co-pilot and ICT strategy analyst.\n\n"
        f"CURRENT ACTIVE PAGE CONTEXT: [{active_page.upper()}]\n"
        f"{page_focus}\n\n"
        f"USER LIVE TRADE JOURNAL METRICS:\n"
        f"- Total Logged Trades: {journal_stats.get('total_trades', 0)}\n"
        f"- Net PnL: ${journal_stats.get('net_pnl', 0.0):,.2f}\n"
        f"- Win Rate: {journal_stats.get('win_rate_pct', 0.0)}% ({journal_stats.get('win_count', 0)} Wins / {journal_stats.get('loss_count', 0)} Losses)\n"
        f"- Profit Factor: {journal_stats.get('profit_factor', 0.0)}\n"
        f"- Risk-to-Reward Ratio: {journal_stats.get('rr_ratio', '1:2.0')}\n\n"
        "Instructions: Be direct, highly analytical, actionable, and agentic. Adapt your response directly to what the user is analyzing on their active page. Do NOT use markdown bold formatting like **text**. Keep responses clean and readable without any double asterisks (**)."
    )

async def generate_ai_response(
    messages: List[Dict[str, str]],
    journal_stats: Dict[str, Any],
    active_page: str = "aichat"
) -> str:
    system_msg = {"role": "system", "content": build_system_context(journal_stats, active_page)}
    full_messages = [system_msg] + messages

    url = f"{settings.OPENROUTER_BASE_URL.rstrip('/')}/chat/completions"
    payload = {
        "model": settings.AI_MODEL,
        "messages": full_messages,
        "stream": True,  # Critical for OpenRouter free models to avoid whitespace keepalive hangs
    }

    max_retries = 3
    backoff_delays = [1.0, 2.0, 4.0]

    for attempt in range(max_retries + 1):
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    url,
                    headers=OPENROUTER_HEADERS,
                    json=payload
                ) as response:
                    if response.status_code == 429:
                        if attempt < max_retries:
                            print(f"[OpenRouter 429 Rate Limit] Retrying attempt {attempt + 1}/{max_retries} in {backoff_delays[attempt]}s...")
                            await asyncio.sleep(backoff_delays[attempt])
                            continue
                        else:
                            raise Exception("AI service temporarily unavailable (429 Rate Limit) — please try again in a few moments.")
                    
                    if response.status_code != 200:
                        error_body = await response.aread()
                        raise Exception(f"OpenRouter API error (Status {response.status_code}): {error_body.decode('utf-8')}")

                    full_text_chunks = []
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        line_str = line.strip()
                        if line_str.startswith("data: "):
                            data_content = line_str[6:].strip()
                            if data_content == "[DONE]":
                                break
                            try:
                                chunk_json = json.loads(data_content)
                                delta = chunk_json.get("choices", [{}])[0].get("delta", {})
                                content_piece = delta.get("content", "")
                                if content_piece:
                                    full_text_chunks.append(content_piece)
                            except Exception:
                                continue

                    accumulated_response = "".join(full_text_chunks).strip().replace("**", "")
                    if accumulated_response:
                        return accumulated_response
                    else:
                        return "Chart Rabbit AI has analyzed your market query and journal history. Maintain strict risk management across all executions."

        except httpx.TimeoutException:
            if attempt < max_retries:
                await asyncio.sleep(backoff_delays[attempt])
                continue
            raise Exception("AI provider request timed out (120s limit reached). Please try again.")
        except Exception as e:
            if "429" in str(e) and attempt < max_retries:
                await asyncio.sleep(backoff_delays[attempt])
                continue
            raise e

    raise Exception("AI service failed to respond after retries.")
