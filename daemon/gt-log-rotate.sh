#!/usr/bin/env bash
# Rotate GT logs - keeps last 7 days, truncates files > 10MB
LOGDIR="/root/projects/gtOps/logs"
MAX_SIZE=$((10 * 1024 * 1024))  # 10MB

cd "$LOGDIR" || exit 1

for log in *.log; do
  [ -f "$log" ] || continue
  size=$(stat -c%s "$log" 2>/dev/null || echo 0)
  if [ "$size" -gt "$MAX_SIZE" ]; then
    mv "$log" "$log.$(date +%Y%m%d-%H%M%S)"
    touch "$log"
    echo "Rotated $log (was ${size} bytes)"
  fi
done

# Delete rotated logs older than 7 days
find "$LOGDIR" -name "*.log.*" -mtime +7 -delete
