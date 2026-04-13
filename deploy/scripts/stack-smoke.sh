#!/usr/bin/env bash
# stack-smoke.sh — layer 1 bash smoke test. Assumes the chart is already
# installed in $NAMESPACE (run-tests.sh does that for you). Intended to run
# fast (~30s) and catch "pod didn't come up at all" regressions before
# pytest does anything more complex.

set -euo pipefail

NAMESPACE="${NAMESPACE:-${VIDAO_TEST_NAMESPACE:-}}"
if [[ -z "$NAMESPACE" ]]; then
  echo "stack-smoke: NAMESPACE not set; export VIDAO_TEST_NAMESPACE or pass NAMESPACE=" >&2
  exit 2
fi
WEB_URL="${VIDAO_WEB_URL:-http://127.0.0.1:37000}"
TEST_AUTH_SECRET="${TEST_AUTH_SECRET:-}"

say() { printf '\033[1;36m[smoke]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[smoke]\033[0m %s\n' "$*" >&2; exit 1; }

say "namespace=${NAMESPACE} web=${WEB_URL}"

say "web Deployment is Available"
kubectl -n "$NAMESPACE" wait --for=condition=available --timeout=30s deploy/vidao-web

say "postgres StatefulSet is Ready"
kubectl -n "$NAMESPACE" rollout status statefulset/vidao-postgres --timeout=30s

say "web / returns non-5xx"
code="$(curl -s -o /dev/null -w '%{http_code}' "$WEB_URL/")" || fail "curl failed"
[[ "$code" =~ ^[23] ]] || fail "unexpected status $code from /"

if [[ -n "$TEST_AUTH_SECRET" ]]; then
  say "auth-bypass header is accepted"
  # The register route is a cheap protected POST that doesn't mutate unless a
  # user id matches; pinging without a user id should get a 200 (NODE_ENV=test
  # + secret => bypass is wired) OR a 401 (auth rejected => wiring broken).
  code="$(curl -s -o /dev/null -w '%{http_code}' \
    -H "x-test-auth-secret: ${TEST_AUTH_SECRET}" \
    -H "x-test-auth-user-id: nonexistent" \
    "$WEB_URL/api/auth/register" -X POST \
    -H 'content-type: application/json' -d '{}')" || fail "curl failed"
  [[ "$code" != "401" ]] || fail "auth bypass did not take effect (got 401)"
fi

say "ok"
