#!/usr/bin/env python3
"""
Filmio Headless Multi-Viewport UI Verifier (Playwright)
Checks iPhone (390x844), iPad Landscape (1180x820), and Smart TV (1920x1080)
against a running local dev server (default: http://localhost:8769/tv).
Read-only: never mutates user profiles, favorites, or watch history.
"""

import argparse
import sys
from playwright.sync_api import sync_playwright

VIEWPORTS = [
    {
        "name": "iPhone (390x844)",
        "width": 390,
        "height": 844,
        "is_mobile": True,
        "has_touch": True,
        "ua": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        ),
    },
    {
        "name": "iPad Landscape (1180x820)",
        "width": 1180,
        "height": 820,
        "is_mobile": False,
        "has_touch": True,
        "ua": (
            "Mozilla/5.0 (iPad; CPU OS 18_7 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        ),
    },
    {
        "name": "Smart TV (1920x1080)",
        "width": 1920,
        "height": 1080,
        "is_mobile": False,
        "has_touch": False,
        "ua": (
            "Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 WebAppManager"
        ),
    },
]


def run_check(base_url: str, timeout_ms: int) -> int:
    failures = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            for vp in VIEWPORTS:
                page_errors = []
                context = browser.new_context(
                    viewport={"width": vp["width"], "height": vp["height"]},
                    user_agent=vp["ua"],
                    is_mobile=vp["is_mobile"],
                    has_touch=vp["has_touch"],
                )
                page = context.new_page()
                page.on("pageerror", lambda err: page_errors.append(str(err)))
                try:
                    page.goto(base_url, wait_until="domcontentloaded", timeout=timeout_ms)
                    page.wait_for_selector('[data-lampa-root="true"]', timeout=timeout_ms)
                    page.wait_for_timeout(1200)

                    metrics = page.evaluate(
                        """() => {
                            const doc = document.documentElement;
                            const header = document.querySelector('[data-lampa-root="true"] > header');
                            const hRect = header ? header.getBoundingClientRect() : null;
                            const main = document.querySelector('[data-lampa-root="true"] main');
                            const mRect = main ? main.getBoundingClientRect() : null;
                            const inputs = Array.from(document.querySelectorAll('input')).map(el => {
                                const cs = getComputedStyle(el);
                                return {
                                    fontSize: parseFloat(cs.fontSize || '0'),
                                    visible: el.offsetParent !== null,
                                };
                            }).filter(x => x.visible);
                            return {
                                scrollWidth: doc.scrollWidth,
                                clientWidth: doc.clientWidth,
                                headerTop: hRect ? Math.round(hRect.top) : null,
                                headerHeight: hRect ? Math.round(hRect.height) : null,
                                mainHeight: mRect ? Math.round(mRect.height) : null,
                                minInputFont: inputs.length ? Math.min(...inputs.map(x => x.fontSize)) : null,
                                cardsCount: document.querySelectorAll('[data-vod-card="true"], [data-watched-poster-btn="true"]').length,
                            };
                        }"""
                    )

                    overflow_px = metrics["scrollWidth"] - metrics["clientWidth"]
                    ok = (
                        len(page_errors) == 0
                        and overflow_px <= 2
                        and (metrics["headerHeight"] or 0) > 0
                        and (metrics["mainHeight"] or 0) > 100
                    )
                    status = "PASS" if ok else "FAIL"
                    if not ok:
                        failures += 1
                    print(
                        f"[{status}] {vp['name']}: "
                        f"overflow={overflow_px}px header={metrics['headerTop']}..+{metrics['headerHeight']}px "
                        f"mainH={metrics['mainHeight']}px cards={metrics['cardsCount']} "
                        f"errors={len(page_errors)}"
                    )
                    for e in page_errors:
                        print(f"   pageerror: {e}")
                except Exception as exc:
                    failures += 1
                    print(f"[FAIL] {vp['name']}: {exc}")
                finally:
                    context.close()
        finally:
            browser.close()
    return 1 if failures else 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify Filmio UI across iPhone, iPad, and Smart TV viewports.")
    parser.add_argument("--url", default="http://localhost:8769/tv", help="Target Filmio URL")
    parser.add_argument("--timeout", type=int, default=20000, help="Navigation timeout in ms")
    args = parser.parse_args()
    return run_check(args.url, args.timeout)


if __name__ == "__main__":
    sys.exit(main())
