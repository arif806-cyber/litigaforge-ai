#!/usr/bin/env bash
# Triggers the LitigaForge blog content pipeline via GitHub Actions workflow_dispatch.
#
# Intended to be run by a Replit Scheduled Deployment every 2 hours. Replit's
# scheduler is reliable, unlike GitHub's built-in cron (which silently drops most
# scheduled runs on free public repos). The blog pipeline itself is unchanged —
# this just pokes it on a dependable timer.
#
# Run command for the Scheduled Deployment:  bash scripts/trigger-blog.sh
# Requires the Replit secret: GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE (scope: repo + workflow)
set -euo pipefail

REPO="arif806-cyber/litigaforge-blog"
WORKFLOW="pipeline.yml"
TOKEN="${GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE:-}"

if [ -z "$TOKEN" ]; then
  echo "ERROR: GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE is not set in the environment." >&2
  exit 1
fi

echo "[$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Triggering blog pipeline ($REPO / $WORKFLOW)..."

http_code=$(curl -sS -o /tmp/dispatch_resp.txt -w "%{http_code}" \
  -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "User-Agent: litigaforge-replit-scheduler" \
  "https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches" \
  -d '{"ref":"main","inputs":{"max_articles":"3"}}')

if [ "$http_code" = "204" ]; then
  echo "Blog pipeline triggered successfully (HTTP 204)."
  exit 0
fi

echo "Trigger FAILED (HTTP $http_code):" >&2
cat /tmp/dispatch_resp.txt >&2
exit 1
