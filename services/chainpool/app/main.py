"""FastAPI app factory + reconciler lifespan."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .api import router
from .reconciler import Reconciler
from .store import Store

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = Store()
    reconciler = Reconciler(store)
    app.state.store = store
    app.state.reconciler = reconciler
    reconciler.start()
    try:
        yield
    finally:
        await reconciler.stop()


def create_app() -> FastAPI:
    app = FastAPI(title="vidao-chainpool", lifespan=lifespan)
    app.include_router(router)
    return app


app = create_app()
