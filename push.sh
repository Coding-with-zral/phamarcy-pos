#!/bin/bash
# Pharmacy POS GitHub Push Helper
set -e

TOKEN="${1:-$GITHUB_TOKEN}"

if [ -n "$TOKEN" ]; then
  git remote set-url origin "https://x-access-token:${TOKEN}@github.com/Coding-with-zral/phamarcy-pos.git"
fi

echo "Pushing commits to Coding-with-zral/phamarcy-pos (main)..."
git push origin main
echo "Successfully pushed to GitHub!"
