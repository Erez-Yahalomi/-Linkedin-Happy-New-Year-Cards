#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="${1:?Pass the llama.cpp Linux runtime directory}"
MODEL_PATH="${2:?Pass the Gemma GGUF model path}"
PORT="18890"
LOG_FILE="/tmp/gemma-eyal-new-year.log"
RESPONSE_FILE="/tmp/gemma-eyal-new-year.json"

cd "$RUNTIME_DIR"
./llama-server --model "$MODEL_PATH" --host 127.0.0.1 --port "$PORT" --ctx-size 4096 --parallel 1 --no-webui --no-warmup > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 100); do
  curl --fail --silent "http://127.0.0.1:${PORT}/v1/models" >/dev/null && break || true
  sleep 1
done

cat >/tmp/gemma-eyal-new-year-request.json <<'JSON'
{"prompt":"<start_of_turn>user\nWrite a warm, heartfelt Happy New Year greeting card to Shaked Eyal. This is a personal card, not a CV or career summary. Return only JSON with recipientName, message, usedFacts. Start exactly: Dear Shaked, Happy New Year! Use 48-78 words. Address Shaked with you/your, wish him joy, warmth, inspiration, or meaningful possibilities in the year ahead, and naturally celebrate one or two verified facts. Do not use I, me, my, we, our, us, or résumé language. Do not merely list or copy a fact.\nVerified facts:\n1. Developing microservices using Java, C++, Kotlin and reactive programming\n2. Developing automation tools in JAVA\n3. Engineering Manager at Vi\n4. Backend team lead at Tufin<end_of_turn>\n<start_of_turn>model\n","n_predict":350,"temperature":0.2,"stop":["<end_of_turn>"]}
JSON
curl --fail --silent "http://127.0.0.1:${PORT}/completion" -H 'Content-Type: application/json' --data-binary @/tmp/gemma-eyal-new-year-request.json > "$RESPONSE_FILE"
npx --yes tsx "$APP_ROOT/scripts/test-new-year-pipeline.ts" "$RESPONSE_FILE"
