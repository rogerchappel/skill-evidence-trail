#!/usr/bin/env bash
set -euo pipefail

npm test
npm run check
npm run build
npm run smoke
npm run package:check
test -s /tmp/skill-evidence-trail-smoke.md

echo "validate: skill-evidence-trail passed"
