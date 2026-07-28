#!/usr/bin/env bash
# Launch the reversal-learning task locally for testing.
# Serves this folder over HTTP and opens it in your browser.
#
#   ./run.sh          # serve on port 8000
#   ./run.sh 8080     # serve on a different port
#
# Stop the server with Ctrl-C. A 404 for jatos.js in the console is normal
# (that file only exists inside JATOS); when you finish, the task downloads
# reversal_mousetracking_data.json so you can inspect the data.

set -e
PORT="${1:-8000}"
URL="http://localhost:${PORT}"
cd "$(dirname "$0")"

echo "Serving the task at ${URL}  (Ctrl-C to stop)"

# Try to open a browser (best-effort; ignore if it fails).
( sleep 1
  if command -v open >/dev/null 2>&1; then open "$URL"            # macOS
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"  # Linux
  fi ) >/dev/null 2>&1 &

# Serve with whatever is available.
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT"
elif command -v python >/dev/null 2>&1; then
  exec python -m http.server "$PORT"
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -l "$PORT"
else
  echo "Need python3, python, or npx (Node) to serve the folder." >&2
  exit 1
fi
