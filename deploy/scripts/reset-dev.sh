#!/usr/bin/env bash
# reset-dev.sh — nuke the Tilt dev environment back to a clean slate.
#
# What this does:
#   1. Wipes /data/videos + /data/thumbnails in the web pod (uploaded media)
#   2. Drops & recreates the postgres `public` schema
#   3. Deletes the vidao-contracts ConfigMap and vidao-deployer Job so the
#      helm post-upgrade hook gets re-run
#   4. Runs `helm upgrade` against the Tilt release to retrigger the deployer
#   5. Waits for the deployer Job to complete
#   6. Restarts the web Deployment (picks up new contract addresses + runs
#      prisma migrate deploy against the fresh schema)
#   7. Triggers `tilt trigger vidao-seed` to repopulate fixture data
#
# What this does NOT do:
#   - Wipe Privy users. Privy identities live at privy.io, we don't persist a
#     DID<->user mapping, and the app id may be shared — we can't safely
#     enumerate "just this environment's" users. Log out of the browser if
#     you want a fresh session.

set -euo pipefail

NAMESPACE="${NAMESPACE:-vidao-dev}"
RELEASE="${RELEASE:-vidao}"
CHART_DIR="${CHART_DIR:-$(cd "$(dirname "$0")/.." && pwd)/helm}"
VALUES_FILES=(
  "${CHART_DIR}/values.yaml"
  "${CHART_DIR}/values-dev.yaml"
)

say() { printf '\033[1;36m[reset]\033[0m %s\n' "$*"; }

say "namespace=${NAMESPACE} release=${RELEASE}"

say "wiping /data/videos + /data/thumbnails in vidao-web"
kubectl -n "$NAMESPACE" exec deploy/vidao-web -c web -- \
  sh -c 'rm -rf /data/videos/* /data/thumbnails/* 2>/dev/null || true; mkdir -p /data/videos /data/thumbnails'

say "dropping postgres public schema"
kubectl -n "$NAMESPACE" exec statefulset/vidao-postgres -- \
  psql -U vidao -d vidao -v ON_ERROR_STOP=1 \
    -c 'DROP SCHEMA IF EXISTS public CASCADE;' \
    -c 'CREATE SCHEMA public AUTHORIZATION vidao;' \
    -c 'GRANT ALL ON SCHEMA public TO public;'

say "deleting vidao-contracts ConfigMap + vidao-deployer Job"
kubectl -n "$NAMESPACE" delete configmap vidao-contracts --ignore-not-found
kubectl -n "$NAMESPACE" delete job vidao-deployer --ignore-not-found --wait=true

say "helm upgrade to retrigger deployer post-upgrade hook"
helm_args=(upgrade "$RELEASE" "$CHART_DIR" --namespace "$NAMESPACE")
for f in "${VALUES_FILES[@]}"; do
  [ -f "$f" ] && helm_args+=(-f "$f")
done
helm "${helm_args[@]}" --wait --timeout 10m

say "waiting for vidao-deployer Job to complete"
kubectl -n "$NAMESPACE" wait --for=condition=complete job/vidao-deployer --timeout=10m

say "rolling web Deployment (new contract addresses + prisma migrate deploy)"
kubectl -n "$NAMESPACE" rollout restart deployment/vidao-web
kubectl -n "$NAMESPACE" rollout status deployment/vidao-web --timeout=5m

if command -v tilt >/dev/null 2>&1; then
  say "triggering tilt seed resource"
  tilt trigger vidao-seed || say "tilt trigger failed — run 'tilt trigger vidao-seed' manually"
else
  say "tilt CLI not found — run 'tilt trigger vidao-seed' yourself"
fi

say "done — Privy users were NOT touched (see script header)"
