#!/bin/sh
set -eu

: "${ARB_RPC_URL:=http://devnode:8547}"
: "${ADDRESSES_OUT:=/out/addresses.json}"
: "${TARGET_NAMESPACE:=vidao-dev}"
: "${CONFIGMAP_NAME:=vidao-contracts}"
: "${WEB_DEPLOYMENT:=vidao-web}"

echo "[deployer] RPC=$ARB_RPC_URL  ns=$TARGET_NAMESPACE  cm=$CONFIGMAP_NAME"

cd /app/contracts

# Compile Stylus contracts against the live in-cluster devnode (the plugin
# always needs an RPC to validate with cargo stylus check; --network skips
# the ephemeral-node Docker path).
ARB_RPC_URL="$ARB_RPC_URL" \
  npx hardhat arb:compile --host --network localStylus

# Run the deploy script. Writes $ADDRESSES_OUT.
ARB_RPC_URL="$ARB_RPC_URL" \
ADDRESSES_OUT="$ADDRESSES_OUT" \
  npx tsx scripts/deploy-and-publish.ts

if [ ! -f "$ADDRESSES_OUT" ]; then
  echo "[deployer] expected $ADDRESSES_OUT but it was not written" >&2
  exit 1
fi

PAYOUT_POOL_ADDRESS=$(jq -r .payoutPool "$ADDRESSES_OUT")
USDC_TOKEN_ADDRESS=$(jq -r .usdc "$ADDRESSES_OUT")

echo "[deployer] patching configmap $CONFIGMAP_NAME in $TARGET_NAMESPACE"
kubectl -n "$TARGET_NAMESPACE" create configmap "$CONFIGMAP_NAME" \
  --from-literal=PAYOUT_POOL_ADDRESS="$PAYOUT_POOL_ADDRESS" \
  --from-literal=USDC_TOKEN_ADDRESS="$USDC_TOKEN_ADDRESS" \
  --from-literal=ARBITRUM_SEPOLIA_RPC="$ARB_RPC_URL" \
  --dry-run=client -o yaml \
  | kubectl apply -f -

echo "[deployer] rolling web deployment $WEB_DEPLOYMENT"
kubectl -n "$TARGET_NAMESPACE" rollout restart deployment/"$WEB_DEPLOYMENT" || true

echo "[deployer] done"
