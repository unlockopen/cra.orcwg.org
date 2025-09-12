#!/bin/bash
set -e

REPO_URL="https://github.com/orcwg/cra-hub.git"

if [ -d "_cache/.git" ]; then
  echo "🔄 Updating cache..."
  cd _cache && git pull --rebase && cd ..
else
  echo "📥 Cloning repo..."
  git clone $REPO_URL _cache
fi