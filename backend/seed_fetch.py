"""backend/seed_fetch.py
Optional enrichment: when ENRICH_DATA=1, attempts to fetch a public
company/industry list via httpx. On success, merges real company names
into the generator. On failure, silently uses the bundled curated list.
Never blocks startup.
"""
import os

ENRICH_ENABLED = os.getenv("ENRICH_DATA", "0") == "1"


def try_fetch_companies() -> dict:
    """Attempt to fetch public company data. Returns {industry: [names]} or empty dict."""
    if not ENRICH_ENABLED:
        return {}

    try:
        import httpx
        # Attempt to fetch a public dataset of companies
        urls = [
            "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.json",
        ]
        for url in urls:
            try:
                resp = httpx.get(url, timeout=5.0)
                if resp.status_code == 200:
                    data = resp.json()
                    # Map S&P 500 companies into our industries by sector
                    result = {}
                    for entry in data[:80]:
                        name = entry.get("Name", "")
                        sector = entry.get("Sector", "Technology")
                        if name and sector:
                            result.setdefault(sector, []).append(name)
                    if result:
                        print(f"  Enrichment: fetched {sum(len(v) for v in result.values())} companies from {url}")
                        return result
            except Exception:
                continue
    except ImportError:
        pass
    except Exception:
        pass

    return {}


def get_enriched_companies(fallback: dict) -> dict:
    """Get companies — try enrichment first, fall back to bundled list."""
    enriched = try_fetch_companies()
    if enriched:
        merged = {}
        for industry, names in fallback.items():
            merged[industry] = names + enriched.get(industry, [])
        return merged
    return fallback
