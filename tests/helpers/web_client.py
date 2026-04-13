"""Thin httpx wrapper that injects the test-auth bypass headers."""

from __future__ import annotations

import os
from dataclasses import dataclass

import httpx


@dataclass(slots=True)
class WebClient:
    base_url: str
    test_auth_secret: str
    user_id: str | None = None
    _client: httpx.Client | None = None

    def __post_init__(self) -> None:
        self._client = httpx.Client(base_url=self.base_url, timeout=30.0)

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    def __enter__(self) -> "WebClient":
        return self

    def __exit__(self, *exc) -> None:
        self.close()

    def _headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        h: dict[str, str] = {
            "x-test-auth-secret": self.test_auth_secret,
        }
        if self.user_id is not None:
            h["x-test-auth-user-id"] = self.user_id
        if extra:
            h.update(extra)
        return h

    def get(self, path: str, **kwargs) -> httpx.Response:
        assert self._client is not None
        return self._client.get(path, headers=self._headers(kwargs.pop("headers", None)), **kwargs)

    def post(self, path: str, *, json=None, **kwargs) -> httpx.Response:
        assert self._client is not None
        return self._client.post(
            path,
            json=json,
            headers=self._headers(kwargs.pop("headers", None)),
            **kwargs,
        )

    def as_user(self, user_id: str) -> "WebClient":
        new = WebClient(
            base_url=self.base_url,
            test_auth_secret=self.test_auth_secret,
            user_id=user_id,
        )
        return new


def from_env() -> WebClient:
    return WebClient(
        base_url=os.environ["VIDAO_WEB_URL"],
        test_auth_secret=os.environ["TEST_AUTH_SECRET"],
    )
