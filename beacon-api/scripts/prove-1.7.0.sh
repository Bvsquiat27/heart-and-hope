#!/usr/bin/env bash
# Local proof for Heart Ember API Express mirror.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PROOF_PORT:-$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1]);s.close()')}"
DATA="$(mktemp -d /tmp/heart-prove-XXXXXX)"
LOG="$DATA/server.log"
PASS=0
FAIL=0
RESULTS=()

cleanup() {
  if [[ -n "${PID:-}" ]] && kill -0 "$PID" 2>/dev/null; then
    kill "$PID" 2>/dev/null || true
    wait "$PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

assert_eq() {
  local name="$1" got="$2" want="$3"
  if [[ "$got" == "$want" ]]; then
    PASS=$((PASS + 1))
    RESULTS+=("PASS: $name (got=$got)")
  else
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL: $name (got=$got want=$want)")
  fi
}

assert_true() {
  local name="$1"
  shift
  if "$@"; then
    PASS=$((PASS + 1))
    RESULTS+=("PASS: $name")
  else
    FAIL=$((FAIL + 1))
    RESULTS+=("FAIL: $name")
  fi
}

echo "Starting Express 1.7.8 on port $PORT (RATE_TEST=1, data=$DATA)"
cd "$ROOT"
RATE_TEST=1 PORT="$PORT" DATA_DIR="$DATA" DATA_FILE="$DATA/beacons.json" \
  HOPE_FILE="$DATA/hope.json" USERS_FILE="$DATA/users.json" TOKENS_FILE="$DATA/tokens.json" \
  node server.js >"$LOG" 2>&1 &
PID=$!

BASE="http://127.0.0.1:$PORT"
for i in $(seq 1 40); do
  if curl -sf "$BASE/health" >/dev/null 2>&1; then break; fi
  sleep 0.1
done

# --- health quiet + version ---
HEALTH=$(curl -sf "$BASE/health")
assert_eq "health.version" "$(echo "$HEALTH" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("version",""))')" "1.7.8"
assert_eq "health.ok" "$(echo "$HEALTH" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("ok"))')" "True"
HAS_ACCOUNTS=$(echo "$HEALTH" | python3 -c 'import sys,json;print("accounts" in json.load(sys.stdin))')
assert_eq "health.no_accounts" "$HAS_ACCOUNTS" "False"

ROOT_JSON=$(curl -sf "$BASE/")
assert_eq "root.version" "$(echo "$ROOT_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("version",""))')" "1.7.8"
ROOT_HAS_ACCOUNTS=$(echo "$ROOT_JSON" | python3 -c 'import sys,json;print("accounts" in json.load(sys.stdin))')
assert_eq "root.no_accounts" "$ROOT_HAS_ACCOUNTS" "False"

# --- CORS allowlist reflect ---
CORS_OK=$(curl -sI -H "Origin: https://bvsquiat27.github.io" "$BASE/health" | tr -d '\r' | grep -i '^access-control-allow-origin:' | awk '{print $2}')
assert_eq "cors.allow_github_pages" "$CORS_OK" "https://bvsquiat27.github.io"
CORS_BAD=$(curl -sI -H "Origin: https://evil.example" "$BASE/health" | tr -d '\r' | grep -i '^access-control-allow-origin:' || true)
assert_eq "cors.deny_evil" "$CORS_BAD" ""

# --- POST beacon → ownerSecret ---
CREATE=$(curl -sf -X POST "$BASE/beacons" -H "Content-Type: application/json" \
  -d '{"lat":40.7,"lng":-74.0,"state":"NY","expiresAt":'"$(($(date +%s) * 1000 + 3600000))"'}')
BID=$(echo "$CREATE" | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
SECRET=$(echo "$CREATE" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("ownerSecret",""))')
assert_true "post.beacon.has_id" test -n "$BID"
assert_true "post.beacon.has_ownerSecret" test -n "$SECRET"
HAS_HASH_IN_RESP=$(echo "$CREATE" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("ownerHash" in d or "ownerHash" in (d.get("beacon") or {}))')
assert_eq "post.beacon.no_ownerHash_in_body" "$HAS_HASH_IN_RESP" "False"

# --- public list strips secrets ---
LIST=$(curl -sf "$BASE/beacons")
PUB_KEYS=$(echo "$LIST" | python3 -c 'import sys,json;d=json.load(sys.stdin);b=d.get("'"$BID"'",{});print(",".join(sorted(b.keys())))')
assert_eq "public.beacon.keys" "$PUB_KEYS" "createdAt,expiresAt,lat,lng,state"
HAS_NOTES=$(echo "$LIST" | python3 -c 'import sys,json;d=json.load(sys.stdin);print("notes" in d.get("'"$BID"'",{}))')
assert_eq "public.no_notes" "$HAS_NOTES" "False"
HAS_PASS=$(echo "$LIST" | python3 -c 'import sys,json;print("password" in json.dumps(json.load(sys.stdin)))')
assert_eq "public.no_password" "$HAS_PASS" "False"

# --- auth without secret → 401 ---
CODE_PUT=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/beacons/$BID" \
  -H "Content-Type: application/json" -d '{"lat":40.7,"lng":-74.0,"state":"NY"}')
assert_eq "put.no_secret.401" "$CODE_PUT" "401"
CODE_DEL=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/beacons/$BID")
assert_eq "delete.no_secret.401" "$CODE_DEL" "401"
CODE_NOTES=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/beacons/$BID/notes")
assert_eq "get_notes.no_secret.401" "$CODE_NOTES" "401"

# --- with secret → OK ---
CODE_PUT_OK=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/beacons/$BID" \
  -H "Content-Type: application/json" -H "X-Hearth-Beacon: $SECRET" \
  -d '{"lat":40.71,"lng":-74.01,"state":"NY","expiresAt":'"$(($(date +%s) * 1000 + 7200000))"'}')
assert_eq "put.with_secret.200" "$CODE_PUT_OK" "200"
CODE_NOTES_OK=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/beacons/$BID/notes" \
  -H "X-Hearth-Beacon: $SECRET")
assert_eq "get_notes.with_secret.200" "$CODE_NOTES_OK" "200"

# public note post (no secret) still works
CODE_NOTE_POST=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/beacons/$BID/notes" \
  -H "Content-Type: application/json" -d '{"text":"You are not alone, mama."}')
assert_eq "post_notes.public.201" "$CODE_NOTE_POST" "201"

# --- oversized body → 413 ---
# Content-Length larger than body — express rejects on header check
CODE_413=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/beacons" \
  -H "Content-Type: application/json" -H "Content-Length: 70000" \
  --data-binary @<(python3 -c 'print("{\"lat\":1,\"lng\":1}" + " ")') || true)
# Some curl/http stacks may fail differently; also try real oversized payload
if [[ "$CODE_413" != "413" ]]; then
  BIG=$(python3 -c 'print("{\"lat\":40,\"lng\":-74,\"pad\":\"" + ("x"*70000) + "\"}")')
  CODE_413=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/beacons" \
    -H "Content-Type: application/json" --data-binary "$BIG" || true)
fi
assert_eq "oversized.body.413" "$CODE_413" "413"

# --- rate limit on rapid POST /beacons (RATE_TEST max=3) ---
# Already used 1 create above; fire until 429
GOT_429=0
for i in 1 2 3 4 5 6 7 8; do
  C=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/beacons" \
    -H "Content-Type: application/json" \
    -d '{"lat":41.0,"lng":-73.0,"state":"CT","expiresAt":'"$(($(date +%s) * 1000 + 3600000))"'}' || true)
  if [[ "$C" == "429" ]]; then GOT_429=1; break; fi
done
assert_eq "rate.limit.429" "$GOT_429" "1"

# --- delete with secret ---
CODE_DEL_OK=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/beacons/$BID" \
  -H "X-Hearth-Beacon: $SECRET")
assert_eq "delete.with_secret.200" "$CODE_DEL_OK" "200"

# --- nosniff header ---
NOSNIFF=$(curl -sI "$BASE/health" | tr -d '\r' | grep -i '^x-content-type-options:' | awk '{print $2}')
assert_eq "header.nosniff" "$NOSNIFF" "nosniff"

echo ""
echo "======== RESULTS ========"
for line in "${RESULTS[@]}"; do echo "$line"; done
echo "-------------------------"
echo "PASS=$PASS FAIL=$FAIL"
echo "Log: $LOG"
if [[ "$FAIL" -gt 0 ]]; then
  echo "Server log tail:"
  tail -40 "$LOG" || true
  exit 1
fi
exit 0
