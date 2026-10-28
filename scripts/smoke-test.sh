#!/usr/bin/env bash
# End-to-end smoke test against the running docker-compose stack:
#   login on the auth service -> use the JWT on the repairs service.
#
# Usage: AUTH_URL=http://localhost:3001 REPAIRS_URL=http://localhost:8000 \
#        ADMIN_EMAIL=... ADMIN_PASSWORD=... ./scripts/smoke-test.sh
set -euo pipefail

AUTH_URL="${AUTH_URL:-http://localhost:3001}"
REPAIRS_URL="${REPAIRS_URL:-http://localhost:8000}"
ADMIN_EMAIL="${ADMIN_EMAIL:?ADMIN_EMAIL is required}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:?ADMIN_PASSWORD is required}"
RUN_ID="$(date +%s)"

json_field() { grep -o "\"$1\":\"[^\"]*\"" | head -1 | cut -d'"' -f4; }

expect_status() {
  local expected="$1" actual="$2" step="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $step (expected HTTP $expected, got $actual)"
    exit 1
  fi
  echo "ok   $step"
}

wait_for() {
  local url="$1"
  for _ in $(seq 1 60); do
    curl -fsS "$url" >/dev/null 2>&1 && return 0
    sleep 2
  done
  echo "FAIL: $url did not become healthy"
  exit 1
}

wait_for "$AUTH_URL/health"
wait_for "$REPAIRS_URL/health"
echo "ok   both services are healthy"

# 1. Login on the auth service
login=$(curl -sS -X POST "$AUTH_URL/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
token=$(echo "$login" | json_field accessToken)
[[ -n "$token" ]] || { echo "FAIL: login did not return a token: $login"; exit 1; }
echo "ok   login on auth-service"
auth=(-H "Authorization: Bearer $token" -H 'Content-Type: application/json')

# 2. The repairs service rejects requests without a token and accepts the JWT
status=$(curl -s -o /dev/null -w '%{http_code}' "$REPAIRS_URL/api/v1/orders")
expect_status 401 "$status" "repairs-service rejects requests without token"

status=$(curl -s -o /dev/null -w '%{http_code}' "$REPAIRS_URL/api/v1/auth/me" -H "Authorization: Bearer ${token}x")
expect_status 401 "$status" "repairs-service rejects a tampered token"

status=$(curl -s -o /dev/null -w '%{http_code}' "$REPAIRS_URL/api/v1/auth/me" "${auth[@]}")
expect_status 200 "$status" "repairs-service accepts the auth-service JWT"

# 3. Business flow: client -> engine -> order -> status change
client=$(curl -sS -X POST "$REPAIRS_URL/api/v1/clients" "${auth[@]}" \
  -d "{\"name\":\"Smoke Mining $RUN_ID\",\"identification_type\":\"NIT\",\"identification_number\":\"SMK-$RUN_ID\",\"email\":\"smoke@example.com\"}")
client_id=$(echo "$client" | json_field id)
[[ -n "$client_id" ]] || { echo "FAIL: create client: $client"; exit 1; }
echo "ok   create client"

engine=$(curl -sS -X POST "$REPAIRS_URL/api/v1/engines" "${auth[@]}" \
  -d "{\"serial_number\":\"SMK-ENG-$RUN_ID\",\"manufacturer\":\"Caterpillar\",\"model\":\"3516\",\"engine_type\":\"Diesel\",\"power\":\"2000 HP\",\"client_id\":\"$client_id\"}")
engine_id=$(echo "$engine" | json_field id)
[[ -n "$engine_id" ]] || { echo "FAIL: create engine: $engine"; exit 1; }
echo "ok   create engine"

order=$(curl -sS -X POST "$REPAIRS_URL/api/v1/orders" "${auth[@]}" \
  -d "{\"engine_id\":\"$engine_id\",\"reported_problem\":\"Smoke test\",\"technician\":\"CI Bot\",\"estimated_delivery_date\":\"2099-12-31\"}")
order_id=$(echo "$order" | json_field id)
order_number=$(echo "$order" | json_field order_number)
[[ -n "$order_id" ]] || { echo "FAIL: create order: $order"; exit 1; }
echo "ok   create order $order_number"

status=$(curl -s -o /dev/null -w '%{http_code}' -X PATCH "$REPAIRS_URL/api/v1/orders/$order_id/status" \
  "${auth[@]}" -d '{"status":"IN_DIAGNOSIS","note":"smoke"}')
expect_status 200 "$status" "change order status"

echo "Smoke test passed"
