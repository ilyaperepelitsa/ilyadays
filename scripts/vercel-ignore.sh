#!/usr/bin/env bash
# Vercel's "ignored build step" (vercel.json ignoreCommand): exit 0 skips the deployment, anything else builds.
# Every deployment stores the whole site (~140 MB) and the free plan keeps 10 GB of them (24 Nov 2026: storage full),
# so commits that change nothing the site serves do not deploy: tests and their screenshots, plans, docs, art sources,
# Python (the build runs only Node: see "build" in package.json).
# It compares with the last deployed commit (VERCEL_GIT_PREVIOUS_SHA), so a push of several commits is judged as a whole;
# when that commit is unknown or git cannot compare, it builds.
set -u
base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  git fetch --quiet --depth=50 origin "${VERCEL_GIT_COMMIT_REF:-main}" 2>/dev/null || true
fi
if [ -z "$base" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  echo "no previous deployment to compare with: build"; exit 1
fi
changed=$(git diff --name-only "$base" HEAD -- . ':(exclude)tests' ':(exclude)plan' ':(exclude)plans' ':(exclude)docs' ':(exclude)art' ':(exclude,glob)**/*.py') || { echo "git diff failed: build"; exit 1; }
if [ -z "$changed" ]; then
  echo "only tests, plans, docs or art changed since $base: skip"; exit 0
fi
echo "site files changed since $base: build"; exit 1
