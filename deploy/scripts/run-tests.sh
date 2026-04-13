#!/usr/bin/env bash
# run-tests.sh — install the chart into an isolated vidao-test-<suffix>
# namespace, seed baseline fixtures, run pytest, and tear down.
#
# Usage:
#   bash deploy/scripts/run-tests.sh                     # api + contracts
#   bash deploy/scripts/run-tests.sh -m api              # api only
#   bash deploy/scripts/run-tests.sh -m "api or contracts"
#   NAMESPACE=vidao-test-mysuffix bash deploy/scripts/run-tests.sh
#   KEEP_NS=1 bash deploy/scripts/run-tests.sh           # skip cleanup
#
# Requires: kubectl, helm, python3 with pytest, chainpool running in
# vidao-chainpool ns (only when -m "*contracts*").

set -euo pipefail

PYTEST_MARKER="api"
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--mark) PYTEST_MARKER="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CHART_DIR="${REPO_ROOT}/deploy/helm"
SUFFIX="${SUFFIX:-$(openssl rand -hex 3)}"
NAMESPACE="${NAMESPACE:-vidao-test-${SUFFIX}}"
RELEASE="${RELEASE:-vidao-${SUFFIX}}"
TEST_AUTH_SECRET="${TEST_AUTH_SECRET:-$(openssl rand -hex 32)}"
CHAINPOOL_NS="${CHAINPOOL_NS:-vidao-chainpool}"
CHAINPOOL_SVC="${CHAINPOOL_SVC:-vidao-chainpool}"
CHAINPOOL_LOCAL_PORT="${CHAINPOOL_LOCAL_PORT:-7070}"
WEB_LOCAL_PORT="${WEB_LOCAL_PORT:-37000}"
DB_LOCAL_PORT="${DB_LOCAL_PORT:-35432}"

say() { printf '\033[1;36m[run-tests]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[run-tests]\033[0m %s\n' "$*" >&2; }

PF_PIDS=()
cleanup() {
  local rc=$?
  for pid in "${PF_PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  if [[ "${KEEP_NS:-0}" != "1" ]]; then
    say "tearing down release=${RELEASE} ns=${NAMESPACE}"
    helm -n "$NAMESPACE" uninstall "$RELEASE" --wait --timeout 5m 2>/dev/null || true
    kubectl delete ns "$NAMESPACE" --ignore-not-found --wait=false 2>/dev/null || true
  else
    warn "KEEP_NS=1 — leaving ${NAMESPACE} in place"
  fi
  exit "$rc"
}
trap cleanup EXIT INT TERM

say "namespace=${NAMESPACE} release=${RELEASE} marker=${PYTEST_MARKER}"

# Resolve the latest Tilt-built web image if not explicitly provided.
# Homelab Tilt pushes to registry.lab/vidao-web:tilt-build-<ts>; CI builds its
# own and passes WEB_IMAGE_REPO/WEB_IMAGE_TAG explicitly.
if [[ -z "${WEB_IMAGE_REPO:-}" ]]; then
  pod=$(kubectl -n vidao-dev get pod -l app=vidao-web -o jsonpath='{.items[0].spec.containers[0].image}' 2>/dev/null || true)
  if [[ -n "$pod" ]]; then
    WEB_IMAGE_REPO="${pod%:*}"
    WEB_IMAGE_TAG="${pod##*:}"
  else
    WEB_IMAGE_REPO="vidao-web"
    WEB_IMAGE_TAG="dev"
  fi
fi
say "using web image ${WEB_IMAGE_REPO}:${WEB_IMAGE_TAG}"

say "helm install"
# Create the namespace out-of-band so helm can install into it, and disable
# the chart's own Namespace template to avoid double-creation.
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

# Mirror Tilt's live_update: sync current apps/web/src + prisma into the pod
# so the test namespace always runs against working-tree code, independent of
# what got baked into the Tilt-built image. Next dev HMR picks up the sync.
if [[ "${SYNC_WEB_SRC:-1}" == "1" ]]; then
  say "syncing apps/web/src into test pod (live_update parity)"
  POD=$(kubectl -n "$NAMESPACE" get pod -l app=vidao-web -o name | head -1 | cut -d/ -f2)
  # kubectl cp treats the destination as the parent when the source is a dir,
  # so we clean the target and cp into the parent to avoid nested src/src.
  kubectl -n "$NAMESPACE" exec "$POD" -c web -- sh -c 'rm -rf /app/apps/web/src /app/apps/web/prisma'
  kubectl -n "$NAMESPACE" cp "${REPO_ROOT}/apps/web/src" "${POD}:/app/apps/web/" -c web
  kubectl -n "$NAMESPACE" cp "${REPO_ROOT}/apps/web/prisma" "${POD}:/app/apps/web/" -c web
fi

say "port-forwarding web + postgres"
kubectl -n "$NAMESPACE" port-forward svc/web "${WEB_LOCAL_PORT}:3000" >/tmp/run-tests-web-pf.log 2>&1 &
PF_PIDS+=($!)
kubectl -n "$NAMESPACE" port-forward svc/postgres "${DB_LOCAL_PORT}:5432" >/tmp/run-tests-db-pf.log 2>&1 &
PF_PIDS+=($!)

# Wait for port-forwards to be ready.
for _ in $(seq 1 30); do
  nc -z 127.0.0.1 "$WEB_LOCAL_PORT" 2>/dev/null && nc -z 127.0.0.1 "$DB_LOCAL_PORT" 2>/dev/null && break
  sleep 0.5
done

say "seeding baseline fixtures"
cd "${REPO_ROOT}/apps/web"
DATABASE_URL="postgresql://vidao:vidao@127.0.0.1:${DB_LOCAL_PORT}/vidao?schema=public" \
  npx prisma migrate deploy >/dev/null
DATABASE_URL="postgresql://vidao:vidao@127.0.0.1:${DB_LOCAL_PORT}/vidao?schema=public" \
  npx tsx prisma/fixtures/scenarios/empty.ts >/dev/null
cd "$REPO_ROOT"

if [[ "$PYTEST_MARKER" == *contracts* ]]; then
  say "port-forwarding chainpool svc/${CHAINPOOL_SVC} ns/${CHAINPOOL_NS}"
  kubectl -n "$CHAINPOOL_NS" port-forward "svc/${CHAINPOOL_SVC}" "${CHAINPOOL_LOCAL_PORT}:80" >/tmp/run-tests-cp-pf.log 2>&1 &
  PF_PIDS+=($!)
  for _ in $(seq 1 30); do
    nc -z 127.0.0.1 "$CHAINPOOL_LOCAL_PORT" 2>/dev/null && break
    sleep 0.5
  done
  export VIDAO_CHAINPOOL_URL="http://127.0.0.1:${CHAINPOOL_LOCAL_PORT}"
fi

export VIDAO_TEST_NAMESPACE="$NAMESPACE"
export VIDAO_WEB_URL="http://127.0.0.1:${WEB_LOCAL_PORT}"
export VIDAO_DB_URL="postgresql://vidao:vidao@127.0.0.1:${DB_LOCAL_PORT}/vidao"
export TEST_AUTH_SECRET
export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"

say "pytest -m '${PYTEST_MARKER}'"
cd "$REPO_ROOT"
PYBIN="${PYBIN:-python3}"
"$PYBIN" -m pytest tests/ -m "$PYTEST_MARKER" -v
