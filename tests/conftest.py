"""Top-level pytest fixtures shared by api + contracts tests.

Session fixtures read environment variables exported by run-tests.sh:
  VIDAO_TEST_NAMESPACE, VIDAO_WEB_URL, VIDAO_DB_URL, TEST_AUTH_SECRET,
  VIDAO_CHAINPOOL_URL (only for contract tests).
"""

from __future__ import annotations

import os
import time

import httpx
import pytest

from tests.helpers import web_client as web_client_mod
from tests.helpers.fixtures_bridge import run_scenario
from tests.helpers import kubectl as kube


def _require_env(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        pytest.fail(f"missing env var {name}; did you use run-tests.sh?")
    return val


@pytest.fixture(scope="session")
def namespace() -> str:
    return _require_env("VIDAO_TEST_NAMESPACE")


@pytest.fixture(scope="session")
def test_auth_secret() -> str:
    return _require_env("TEST_AUTH_SECRET")


@pytest.fixture(scope="session")
def web_base_url() -> str:
    url = _require_env("VIDAO_WEB_URL")
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        try:
            r = httpx.get(f"{url}/", timeout=5.0)
            if r.status_code < 500:
                return url
        except httpx.HTTPError:
            pass
        time.sleep(1.0)
    pytest.fail(f"web base url {url} never responded")


@pytest.fixture(scope="session")
def db_url() -> str:
    return _require_env("VIDAO_DB_URL")


@pytest.fixture
def web_client(web_base_url: str, test_auth_secret: str):
    with web_client_mod.WebClient(
        base_url=web_base_url, test_auth_secret=test_auth_secret
    ) as c:
        yield c


@pytest.fixture
def db_reset(request):
    """Parametrize via indirect: @pytest.mark.parametrize('db_reset',
    ['heartbeat-ready'], indirect=True). Defaults to 'empty'."""
    scenario = getattr(request, "param", "empty")
    return run_scenario(scenario)


@pytest.fixture(scope="session")
def chainpool_url() -> str:
    url = os.environ.get("VIDAO_CHAINPOOL_URL")
    if not url:
        pytest.skip("VIDAO_CHAINPOOL_URL not set — contracts tests skipped")
    return url


@pytest.fixture(scope="session")
def chain_lease(chainpool_url: str, namespace: str):
    """Lease a devnode from chainpool, point the web pod at it, yield the
    lease dict, tear down on session end."""
    with httpx.Client(base_url=chainpool_url, timeout=120.0) as http:
        resp = http.post("/chains", json={"ttl_seconds": 1800})
        if resp.status_code != 200:
            pytest.fail(f"chainpool lease failed: {resp.status_code} {resp.text}")
        lease = resp.json()

        try:
            kube.patch_configmap(
                namespace,
                "vidao-contracts",
                {
                    "PAYOUT_POOL_ADDRESS": lease["contracts"]["payout_pool"],
                    "USDC_TOKEN_ADDRESS": lease["contracts"]["usdc"],
                    "ARBITRUM_SEPOLIA_RPC": lease["rpc_url"],
                },
            )
            kube.rollout_restart(namespace, "vidao-web")
            yield lease
        finally:
            try:
                http.delete(f"/chains/{lease['lease_id']}")
            except httpx.HTTPError:
                pass
