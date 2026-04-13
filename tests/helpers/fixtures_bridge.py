"""Run Prisma scenario scripts from Python.

Shells out to `npx tsx apps/web/prisma/fixtures/scenarios/<name>.ts` with the
test namespace's DATABASE_URL. Each scenario script prints a one-line JSON
blob describing the IDs it created — we parse that into a dict so tests can
use the ids without round-tripping to the DB.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any


REPO_ROOT = Path(__file__).resolve().parents[2]
WEB_DIR = REPO_ROOT / "apps" / "web"

VALID_SCENARIOS = {
    "empty",
    "baseline",
    "heartbeat-ready",
    "payout-ready",
    "near-monthly-cap",
}


def run_scenario(name: str) -> dict[str, Any]:
    if name not in VALID_SCENARIOS:
        raise ValueError(
            f"unknown scenario {name!r}; known: {sorted(VALID_SCENARIOS)}"
        )
    script = WEB_DIR / "prisma" / "fixtures" / "scenarios" / f"{name}.ts"
    env = os.environ.copy()
    env["DATABASE_URL"] = os.environ["VIDAO_DB_URL"] + "?schema=public"
    proc = subprocess.run(
        ["npx", "tsx", str(script)],
        cwd=WEB_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(
            f"scenario {name} failed (rc={proc.returncode}):\n"
            f"stdout:\n{proc.stdout}\nstderr:\n{proc.stderr}"
        )
    last_line = ""
    for line in reversed(proc.stdout.splitlines()):
        if line.strip().startswith("{"):
            last_line = line.strip()
            break
    if not last_line:
        return {}
    try:
        return json.loads(last_line)
    except json.JSONDecodeError:
        return {}
