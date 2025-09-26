#!/bin/bash
set -e
REPO_URL="https://github.com/orcwg/cra-hub.git"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TMP_DIR="$SCRIPT_DIR/_tmp/git"
CACHE_DIR="$SCRIPT_DIR/_cache"

# Clone or update the git repository
if [ -d "$TMP_DIR/.git" ]; then
  echo "🔄 Updating cache..."
  cd "$TMP_DIR" && git pull --rebase && cd "$SCRIPT_DIR"
else
  echo "📥 Cloning repo..."
  git clone $REPO_URL "$TMP_DIR"
fi

echo "📂 Copying FAQ files..."
# Clear existing cache
rm -rf "$CACHE_DIR"/*


# Copy FAQ files to _cache (preserve structure)
cp -r "$TMP_DIR/faq" "$CACHE_DIR/"

# Move pending-guidance to _cache root as 'guidance'
echo "📂 Organizing content structure..."
if [ -d "$CACHE_DIR/faq/pending-guidance" ]; then
  echo "🛑 Moving pending guidance to root..."
  # Remove any existing guidance dir to avoid merge issues
  rm -rf "$CACHE_DIR/guidance"
  mkdir -p "$CACHE_DIR/guidance"
  mv "$CACHE_DIR/faq/pending-guidance"/* "$CACHE_DIR/guidance"
  # Remove the now-empty pending-guidance directory from faq if it still exists
  if [ -d "$CACHE_DIR/faq/pending-guidance" ]; then
    rmdir "$CACHE_DIR/faq/pending-guidance"
  fi
fi

# Copy curated lists to _cache
cp -r "$SCRIPT_DIR/src/_lists" "$CACHE_DIR/lists"

echo "✅ Cache updated"
