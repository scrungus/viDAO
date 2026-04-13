"""Runtime configuration for the chainpool service.

Loaded from env vars (CHAINPOOL_*) so the Helm chart can inject them via the
Deployment spec. Defaults are the values from values.yaml.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="CHAINPOOL_", env_file=None, extra="ignore"
    )

    # Kubernetes
    namespace: str = "vidao-chainpool"
    pod_template_cm: str = "vidao-chain-pod-template"
    pod_template_key: str = "pod.json"

    # Pool sizing
    min_idle: int = 3
    max_size: int = 8

    # Lease behavior
    lease_ttl_seconds: int = 600
    heartbeat_interval_seconds: int = 120
    lease_ttl_clamp_min: int = 60
    lease_ttl_clamp_max: int = 1800

    # Provisioning
    chain_ready_timeout_seconds: int = 180
    deployer_timeout_seconds: int = 120

    # Contract artifacts
    artifacts_dir: str = "/app/artifacts"

    # Known dev account (funded by Nitro --dev)
    dev_private_key: str = (
        "0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659"
    )

    # Reconciler
    reconciler_interval_seconds: float = 5.0


settings = Settings()
