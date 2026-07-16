#!/usr/bin/env bash
set -euo pipefail

npm test
npm run check
npm run build
npm run smoke
test -s /tmp/skill-evidence-trail-smoke.md

echo "validate: skill-evidence-trail passed"

