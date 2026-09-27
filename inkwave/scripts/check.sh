#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

count=0
while IFS= read -r -d '' file; do
    node --input-type=module --check < "$file"
    count=$((count + 1))
done < <(find src vendor -type f -name '*.js' -print0)
bash -n start.sh scripts/check.sh
python3 scripts/check-assets.py
printf 'JavaScript syntax passed: %s files. Shell syntax passed.\n' "$count"
