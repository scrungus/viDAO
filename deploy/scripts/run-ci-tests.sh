#!/usr/bin/env bash
# run-ci-tests.sh — GitHub CI entrypoint. Brings up the vidao stack in an
# ephemeral test namespace on a fresh cluster (k3d/Kind) and runs the pytest
# API layer. No chainpool, no devnode, no contract tests — keep it ~3 min.
#
# Requires: kubectl, helm, python3.12+, an already-created cluster, and a
# web image already built and pushed into the cluster's registry.
#
# Required env:
#   WEB_IMAGE_REPO   image repo for vidao-web (e.g. k3d-registry/vidao-web)
#   WEB_IMAGE_TAG    image tag (e.g. ci)
#
# Optional env:
#   NAMESPACE        default vidao-test-ci-<GITHUB_RUN_ATTEMPT>
#   RELEASE          default vidao-ci
#   PYBIN            default python3
#   KEEP_NS=1        skip teardown (debug)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHART_DIR="${REPO_ROOT}/deploy/helm"

: "${WEB_IMAGE_REPO:?set WEB_IMAGE_REPO to the pushed vidao-web image repo}"
: "${WEB_IMAGE_TAG:?set WEB_IMAGE_TAG to the pushed vidao-web image tag}"

NAMESPACE="${NAMESPACE:-vidao-test-ci-${GITHUB_RUN_ATTEMPT:-local}}"
RELEASE="${RELEASE:-vidao-ci}"
TEST_AUTH_SECRET="${TEST_AUTH_SECRET:-$(openssl rand -hex 32)}"
PYBIN="${PYBIN:-python3}"
WEB_LOCAL_PORT="${WEB_LOCAL_PORT:-37000}"
DB_LOCAL_PORT="${DB_LOCAL_PORT:-35432}"

say()  { printf '\033[1;36m[ci-tests]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[ci-tests]\033[0m %s\n' "$*" >&2; }

PF_PIDS=()
cleanup() {
  local rc=$?
  for pid in "${PF_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  if [[ "${KEEP_NS:-0}" != "1" ]]; then
    say "tearing down ${RELEASE} in ${NAMESPACE}"
    helm -n "$NAMESPACE" uninstall "$RELEASE" --wait --timeout 5m 2>/dev/null || true
    kubectl delete ns "$NAMESPACE" --ignore-not-found --wait=false 2>/dev/null || true
  else
    warn "KEEP_NS=1 — leaving ${NAMESPACE} in place"
  fi
  exit "$rc"
}
trap cleanup EXIT INT TERM

say "namespace=${NAMESPACE} release=${RELEASE} image=${WEB_IMAGE_REPO}:${WEB_IMAGE_TAG}"

say "installing pytest deps"
"$PYBIN" -m pip install --quiet \
  "pytest>=8.3" "httpx>=0.27" "web3>=7.6" "eth-account>=0.13" \
  "psycopg2-binary>=2.9" "kubernetes>=31.0" "pydantic>=2.9"

say "helm install"
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
helm upgrade --install "$RELEASE" "$CHART_DIR" \
  --namespace "$NAMESPACE" \
  -f "${CHART_DIR}/values.yaml" \
  -f "${CHART_DIR}/values-test.yaml" \
  --set "namespace.create=false" \
  --set "namespace.name=${NAMESPACE}" \
  --set "test.authSecret=${TEST_AUTH_SECRET}" \
  --set "web.image.repository=${WEB_IMAGE_REPO}" \
  --set "web.image.tag=${WEB_IMAGE_TAG}" \
  --wait --timeout 10m

say "waiting for vidao-web rollout"
kubectl -n "$NAMESPACE" rollout status deploy/vidao-web --timeout=5m

say "port-forwarding web + postgres"
kubectl -n "$NAMESPACE" port-forward svc/web "${WEB_LOCAL_PORT}:3000" >/tmp/ci-pf-web.log 2>&1 &
PF_PIDS+=($!)
kubectl -n "$NAMESPACE" port-forward svc/postgres "${DB_LOCAL_PORT}:5432" >/tmp/ci-pf-db.log 2>&1 &
PF_PIDS+=($!)

for _ in $(seq 1 30); do
  if (echo >/dev/tcp/127.0.0.1/"$WEB_LOCAL_PORT") >/dev/null 2>&1 \
  && (echo >/dev/tcp/127.0.0.1/"$DB_LOCAL_PORT") >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

say "applying migrations + empty scenario"
cd "${REPO_ROOT}/apps/web"
DATABASE_URL="postgresql://vidao:vidao@127.0.0.1:${DB_LOCAL_PORT}/vidao?schema=public" \
  npx prisma migrate deploy >/dev/null
DATABASE_URL="postgresql://vidao:vidao@127.0.0.1:${DB_LOCAL_PORT}/vidao?schema=public" \
  npx tsx prisma/fixtures/scenarios/empty.ts >/dev/null
cd "$REPO_ROOT"

export VIDAO_TEST_NAMESPACE="$NAMESPACE"
export VIDAO_WEB_URL="http://127.0.0.1:${WEB_LOCAL_PORT}"
export VIDAO_DB_URL="postgresql://vidao:vidao@127.0.0.1:${DB_LOCAL_PORT}/vidao"
export TEST_AUTH_SECRET

say "pytest -m api"
"$PYBIN" -m pytest tests/ -m api -v
