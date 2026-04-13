"""Tiny kubectl helpers for patching + waiting. Used by the contracts fixture."""

from __future__ import annotations

import json
import os
import subprocess


def _run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def patch_configmap(namespace: str, name: str, data: dict[str, str]) -> None:
    patch = json.dumps({"data": data})
    _run(
        [
            "kubectl",
            "-n",
            namespace,
            "patch",
            "configmap",
            name,
            "--type=merge",
            "-p",
            patch,
        ]
    )


def rollout_restart(namespace: str, deploy: str) -> None:
    _run(["kubectl", "-n", namespace, "rollout", "restart", f"deploy/{deploy}"])
    _run(
        [
            "kubectl",
            "-n",
            namespace,
            "rollout",
            "status",
            f"deploy/{deploy}",
            "--timeout=5m",
        ]
    )


def namespace() -> str:
    ns = os.environ.get("VIDAO_TEST_NAMESPACE")
    if not ns:
        raise RuntimeError("VIDAO_TEST_NAMESPACE not set")
    return ns
