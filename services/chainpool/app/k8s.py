"""Kubernetes client wrapper for provisioning per-chain Pods + Services.

Uses the in-cluster config when running inside k8s, falls back to kubeconfig
(useful when running locally for dev). Each chain gets a Pod and a ClusterIP
Service with the same name; the RPC URL is
`http://<name>.<ns>.svc:8547`.

Pod spec comes from a ConfigMap (`vidao-chain-pod-template`) so operators
can tune image/args without rebuilding the chainpool image.
"""

from __future__ import annotations

import asyncio
import json
import logging
import socket
import uuid
from dataclasses import dataclass

from kubernetes import client, config
from kubernetes.client.rest import ApiException

from .settings import settings

log = logging.getLogger(__name__)


@dataclass
class ChainPodInfo:
    name: str
    rpc_url: str
    ws_url: str


def _load_config() -> None:
    try:
        config.load_incluster_config()
    except config.ConfigException:
        config.load_kube_config()


_load_config()

_core = client.CoreV1Api()


def _pod_template() -> dict:
    cm = _core.read_namespaced_config_map(
        name=settings.pod_template_cm, namespace=settings.namespace
    )
    return json.loads(cm.data[settings.pod_template_key])


def _chain_name() -> str:
    return f"vidao-chain-{uuid.uuid4().hex[:8]}"


def create_chain_pod() -> ChainPodInfo:
    """Create a Pod + Service for a new devnode chain. Does NOT wait for
    readiness — caller awaits `wait_ready`."""
    name = _chain_name()
    template = _pod_template()
    template["metadata"]["name"] = name
    template["metadata"].setdefault("labels", {}).update(
        {
            "app": "vidao-chain",
            "chainpool/state": "starting",
            "chainpool/name": name,
        }
    )

    svc = {
        "apiVersion": "v1",
        "kind": "Service",
        "metadata": {
            "name": name,
            "labels": {"app": "vidao-chain", "chainpool/name": name},
        },
        "spec": {
            "selector": {"app": "vidao-chain", "chainpool/name": name},
            "ports": [
                {"name": "rpc", "port": 8547, "targetPort": 8547},
                {"name": "ws", "port": 8548, "targetPort": 8548},
            ],
            "type": "ClusterIP",
        },
    }

    _core.create_namespaced_pod(namespace=settings.namespace, body=template)
    _core.create_namespaced_service(namespace=settings.namespace, body=svc)

    return ChainPodInfo(
        name=name,
        rpc_url=f"http://{name}.{settings.namespace}.svc:8547",
        ws_url=f"ws://{name}.{settings.namespace}.svc:8548",
    )


def set_pod_state_label(name: str, state: str) -> None:
    try:
        _core.patch_namespaced_pod(
            name=name,
            namespace=settings.namespace,
            body={"metadata": {"labels": {"chainpool/state": state}}},
        )
    except ApiException as exc:
        log.warning("patch_namespaced_pod(%s) failed: %s", name, exc)


def delete_chain(name: str) -> None:
    for fn, label in (
        (_core.delete_namespaced_pod, "pod"),
        (_core.delete_namespaced_service, "svc"),
    ):
        try:
            fn(name=name, namespace=settings.namespace)
        except ApiException as exc:
            if exc.status != 404:
                log.warning("delete %s %s failed: %s", label, name, exc)


def list_chains() -> list[dict]:
    """Return raw metadata for all chain Pods for reconciler state sync."""
    pods = _core.list_namespaced_pod(
        namespace=settings.namespace, label_selector="app=vidao-chain"
    )
    return [p.to_dict() for p in pods.items]


async def wait_ready(name: str, timeout: int) -> bool:
    """Poll the pod's IP until the RPC port accepts TCP. Uses
    `<svc>.<ns>.svc` DNS from inside the pod network. Safe to call from an
    event loop — yields on sleeps."""
    deadline = asyncio.get_event_loop().time() + timeout
    host = f"{name}.{settings.namespace}.svc"
    loop = asyncio.get_event_loop()
    while loop.time() < deadline:
        try:
            reader, writer = await asyncio.wait_for(
                loop.run_in_executor(
                    None, lambda: _tcp_probe(host, 8547)
                ),
                timeout=5,
            )
            return reader
        except Exception:
            await asyncio.sleep(2)
    return False


def _tcp_probe(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(2)
        try:
            s.connect((host, port))
            return True
        except OSError:
            return False
