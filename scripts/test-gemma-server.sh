#!/usr/bin/env bash
set -euo pipefail

RUNTIME_DIR="${1:?Pass the llama.cpp runtime directory}"
MODEL_PATH="${2:?Pass the Gemma GGUF model path}"
PORT="18889"
LOG_FILE="/tmp/gemma-greetings-e2e.log"
RESPONSE_FILE="/tmp/gemma-greetings-e2e-response.json"
REQUEST_FILE="/tmp/gemma-greetings-e2e-request.json"

cd "$RUNTIME_DIR"
./llama-server --model "$MODEL_PATH" --host 127.0.0.1 --port "$PORT" --ctx-size 4096 --parallel 1 --no-webui --no-warmup > "$LOG_FILE" 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}
trap cleanup EXIT

for _ in $(seq 1 100); do
  if curl --fail --silent --show-error "http://127.0.0.1:${PORT}/v1/models" > /dev/null; then
    break
  fi
  sleep 1
done

curl --fail --silent --show-error "http://127.0.0.1:${PORT}/v1/models" > /dev/null
cat > "$REQUEST_FILE" <<'JSON'
{"prompt":"<start_of_turn>user\nYou write concise, sincere greeting-card messages. Use only supplied information. Never mention LinkedIn. Return exactly JSON with recipientName, headline, company, occasion, message, signature, accent, imagePrompt. Message is 35 to 75 words.\nName: Avery Patel\nHeadline: Design leader focused on accessible technology\nCompany: Northstar Studio\nProfile notes: Recently completed a major accessibility initiative and mentors early-career designers.\nOccasion: work anniversary\nRelationship: former colleague\nTone: warm\nTheme: garden\nSender: Alex<end_of_turn>\n<start_of_turn>model\n","n_predict":500,"temperature":0.7,"stop":["<end_of_turn>"]}
JSON
curl --fail --silent --show-error "http://127.0.0.1:${PORT}/completion" -H 'Content-Type: application/json' --data-binary "@${REQUEST_FILE}" > "$RESPONSE_FILE"

grep -q '"content"' "$RESPONSE_FILE"
grep -q 'Avery' "$RESPONSE_FILE"
printf 'LOCAL_GEMMA_SERVER_TEST_PASSED\n'
