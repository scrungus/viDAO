# Multi-stage: compile contracts + Stylus wasm once, ship a runtime image
# with node, rust, cargo-stylus, and python3 so per-chain deploy is fast.

# -------- Stage 1: contract pre-compile --------
FROM node:22-bookworm AS contracts-build

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential curl ca-certificates pkg-config libssl-dev git \
    && rm -rf /var/lib/apt/lists/*

# rust + cargo-stylus + wasm target
ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal \
    && rustup target add wasm32-unknown-unknown \
    && cargo install --locked cargo-stylus

WORKDIR /build/contracts
COPY contracts/package.json contracts/package-lock.json ./
RUN npm ci

COPY contracts/ ./
RUN npx hardhat compile \
    && (cd contracts/stylus/payout-pool && cargo stylus check || true)

# -------- Stage 2: runtime --------
FROM node:22-bookworm AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 python3-pip python3-venv \
      build-essential curl ca-certificates pkg-config libssl-dev git \
    && rm -rf /var/lib/apt/lists/*

ENV RUSTUP_HOME=/usr/local/rustup CARGO_HOME=/usr/local/cargo PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal \
    && rustup target add wasm32-unknown-unknown \
    && cargo install --locked cargo-stylus

WORKDIR /app

COPY --from=contracts-build /build/contracts /app/artifacts/contracts
COPY --from=contracts-build /build/contracts/contracts/stylus/payout-pool/target /app/artifacts/contracts/contracts/stylus/payout-pool/target

COPY services/chainpool/pyproject.toml /app/services/chainpool/pyproject.toml
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir \
         "fastapi>=0.115" "uvicorn[standard]>=0.32" "kubernetes>=31.0" \
         "httpx>=0.27" "web3>=7.6" "eth-account>=0.13" \
         "pydantic>=2.9" "pydantic-settings>=2.5"
ENV PATH=/opt/venv/bin:$PATH

COPY services/chainpool/app /app/services/chainpool/app

WORKDIR /app/services/chainpool
ENV PYTHONPATH=/app/services/chainpool CHAINPOOL_ARTIFACTS_DIR=/app/artifacts

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
