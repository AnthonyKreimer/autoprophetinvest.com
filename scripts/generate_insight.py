"""
AutoProphet Invest — Daily Insight Generator
=============================================
File: scripts/generate_insight.py

Generates daily financial intelligence JSON for The Daily Prophet feed.
Writes two files:
  - data/latest_insight.json   (Prophet feed)
  - data/economic_data.json    (Economic indicators sidebar)

USAGE
-----
Local (no API key needed — uses rotating fallback content):
  python scripts/generate_insight.py

With OpenAI (live AI-generated insights):
  1. pip install openai   (or: pip install -r scripts/requirements.txt)
  2. Uncomment the OpenAI block in generate_with_ai()
  3. Set OPENAI_API_KEY environment variable or GitHub Actions secret
  4. The GitHub Action handles everything automatically

AUTOMATION
----------
.github/workflows/daily_prophet.yml runs this at 08:00 UTC daily.
On success, it commits the updated JSON files and pushes to main.
Cloudflare Pages redeploys automatically on every push.
"""

import json
import datetime
import os
import random


# ── CONFIG ────────────────────────────────────────────────────────────────────

INSIGHT_PATH = "data/latest_insight.json"
ECON_PATH    = "data/economic_data.json"

MARKET_STATUSES = ["CRITICAL", "UNSTABLE", "STABLE", "OPTIMIZED"]

# Weighted: UNSTABLE and STABLE are most common in normal markets
STATUS_WEIGHTS  = [0.15, 0.40, 0.35, 0.10]

FALLBACK_HEADLINES = [
    "Structural Inflation Exceeds Baseline Yields — Purchasing Power Erosion Accelerates",
    "Federal Reserve Constraint Deepens — Real Yield Compression Favors Asset Holders",
    "Purchasing Power Compression Signals Defensive Positioning Window",
    "Debt-to-GDP Approaches Systemic Threshold — Capital Structure Decisions Become Critical",
    "Shadow Inflation Data Diverges From Official CPI — Real Loss Systematically Underreported",
    "Wage Stagnation Persists Against Real Inflation — Structural Income Gap Widens",
    "Dollar Purchasing Power Erosion Compounds — Cash Holdings Lose Real Value Annually",
    "Small Business Pressure Factors Mount — Fixed Cost Structures Under Macro Stress",
]

FALLBACK_ANALYSES = [
    "The divergence between official CPI and real consumer price pressure continues to widen. Households in median income brackets experience compounding purchasing power loss that headline metrics fail to capture. Defensive asset positioning and income velocity optimization represent the structural responses with the highest probability of effectiveness at this stage of the cycle.",
    "Federal Reserve policy remains structurally constrained by debt-to-GDP dynamics that make sustained high rates politically and economically untenable. This creates a prolonged environment of negative real yields for cash holders and fixed-income instruments. Real asset exposure and inflation-protected structures remain the asymmetric positioning play for patient capital.",
    "Wage data shows nominal gains that trail real inflation on an after-tax basis for the median worker. The compounding nature of this gap — year over year — represents a structural erosion of household net worth that does not appear in standard income or savings reporting. The visibility gap is the primary barrier to effective response.",
    "Capital efficiency at the household level has become the critical variable. The difference between those building real wealth and those maintaining the appearance of it lies in the gap between nominal income and real retained value. The tools to measure this gap exist — most people simply haven't used them.",
    "Second-order inflation effects are now manifesting across insurance, healthcare, and food sectors at rates that materially exceed the headline CPI composite. These non-discretionary cost categories represent fixed-obligation expansion that functions identically to a tax increase — without the political visibility.",
]

FALLBACK_ACTIONS = [
    "Calculate your obligation-to-income ratio. If fixed costs exceed 35% of gross income, identify one restructuring opportunity within the next 30 days.",
    "Prioritize income velocity increase over expense reduction alone. Inflation cannot be neutralized by frugality — it requires asymmetric asset positioning that appreciates faster than the real inflation rate.",
    "Audit your tax drag. A single 401(k) or HSA contribution this month reclaims more purchasing power than a month of expense cutting.",
    "Identify the highest-interest debt in your structure. Calculate the annualized return-equivalent of eliminating it. For most households, this represents the highest risk-adjusted financial move available.",
    "Run the Reality Engine diagnostic on your current income structure. If your real hourly value is below 65% of your stated rate, systemic costs are consuming your financial leverage.",
    "Review one income source that could be increased without proportional time cost. The leverage between income growth and inflation protection is asymmetric — even a 10% income increase compounds dramatically at 8%+ inflation.",
]

SECTOR_POOL = [
    {"name": "Real Estate",        "signals": ["BULLISH", "HOLD",    "BEARISH"]},
    {"name": "Commodities",        "signals": ["BULLISH", "HOLD"             ]},
    {"name": "Fixed Income",       "signals": [           "HOLD",    "BEARISH"]},
    {"name": "Cash / Savings",     "signals": [                      "BEARISH"]},
    {"name": "Equities (Growth)",  "signals": ["BULLISH", "HOLD",    "BEARISH"]},
    {"name": "Inflation Hedges",   "signals": ["BULLISH", "HOLD"             ]},
    {"name": "Energy",             "signals": ["BULLISH", "HOLD",    "BEARISH"]},
    {"name": "Tech / AI",          "signals": ["BULLISH", "HOLD",    "BEARISH"]},
    {"name": "Small Cap",          "signals": ["BULLISH", "HOLD",    "BEARISH"]},
    {"name": "International",      "signals": ["BULLISH", "HOLD",    "BEARISH"]},
]

ECON_INDICATORS = [
    {"name": "CPI YoY (Real Est.)", "value": "8.4%",      "trend": "up"  },
    {"name": "Fed Funds Rate",      "value": "4.25%",     "trend": "down"},
    {"name": "10Y Treasury Yield",  "value": "4.51%",     "trend": "down"},
    {"name": "Real Wage Growth",    "value": "−1.2% YoY", "trend": "up"  },
    {"name": "M2 Supply YoY",       "value": "+3.8%",     "trend": "up"  },
    {"name": "Dollar Index (DXY)",  "value": "102.3",     "trend": "down"},
    {"name": "Debt-to-GDP",         "value": "124%",      "trend": "up"  },
    {"name": "Personal Savings",    "value": "3.6%",      "trend": "up"  },
]


# ── AI GENERATION ─────────────────────────────────────────────────────────────

def generate_with_ai(today: str) -> dict:
    """
    Generate live insight using OpenAI GPT-4.
    Uncomment this block and set OPENAI_API_KEY to activate.
    """
    # import openai
    # client = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])
    #
    # prompt = f"""You are a macro financial analyst writing the daily intelligence brief for AutoProphet Invest.
    # Date: {today}
    #
    # Generate a JSON object with EXACTLY these keys:
    # - "date": "{today}"
    # - "headline": one sentence, analytical, direct (not clickbait)
    # - "analysis": 3-4 sentences connecting macro conditions to personal income/wealth impact
    # - "market_status": exactly one of: CRITICAL | UNSTABLE | STABLE | OPTIMIZED
    # - "action_signal": 1-2 sentences of specific, actionable personal finance guidance
    # - "sectors": array of exactly 6 objects, each with "name" (string) and "signal" (BULLISH | HOLD | BEARISH)
    #
    # Choose sectors from: Real Estate, Commodities, Fixed Income, Cash/Savings, Equities (Growth),
    # Inflation Hedges, Energy, Tech/AI, Small Cap, International.
    #
    # Return ONLY valid JSON. No markdown. No explanation. No preamble.
    # """
    #
    # res  = client.chat.completions.create(
    #     model="gpt-4o",
    #     messages=[{"role": "user", "content": prompt}],
    #     temperature=0.72,
    #     response_format={"type": "json_object"}
    # )
    # return json.loads(res.choices[0].message.content)

    raise NotImplementedError("OpenAI not configured — using fallback")


def generate_fallback(today: str) -> dict:
    """Rotating fallback content — no API key required."""
    sectors_selected = random.sample(SECTOR_POOL, 6)
    sectors = [{"name": s["name"], "signal": random.choice(s["signals"])} for s in sectors_selected]
    status  = random.choices(MARKET_STATUSES, weights=STATUS_WEIGHTS, k=1)[0]

    return {
        "date":          today,
        "headline":      random.choice(FALLBACK_HEADLINES),
        "analysis":      random.choice(FALLBACK_ANALYSES),
        "market_status": status,
        "action_signal": random.choice(FALLBACK_ACTIONS),
        "sectors":       sectors,
    }


def generate_economic_data(today: str) -> dict:
    return {
        "last_updated": today,
        "source":       "AutoProphet Economic Model — scripts/generate_insight.py",
        "indicators":   ECON_INDICATORS,
    }


# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    os.makedirs("data", exist_ok=True)

    # Try AI, fall back to static rotation
    try:
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        insight = generate_with_ai(today)
        source  = "AI-generated"
    except Exception as e:
        insight = generate_fallback(today)
        source  = f"fallback ({e})"

    # Write insight JSON
    with open(INSIGHT_PATH, "w") as f:
        json.dump(insight, f, indent=2, ensure_ascii=False)
    print(f"✓ {INSIGHT_PATH} written [{source}] — {today}")

    # Write economic data JSON
    econ = generate_economic_data(today)
    with open(ECON_PATH, "w") as f:
        json.dump(econ, f, indent=2, ensure_ascii=False)
    print(f"✓ {ECON_PATH} written")


if __name__ == "__main__":
    main()
