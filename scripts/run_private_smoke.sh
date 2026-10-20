#!/bin/sh
# A disposable production-mode container, using only deliberately fake settings.
set -eu
image="$1"
container="$2"
docker run -d --name "$container" --memory=512m -p 127.0.0.1:18080:8080 \
  -e STUDIO_EMAIL_DOMAIN=team.example \
  -e STUDIO_OWNER_EMAIL=owner@team.example \
  -e STUDIO_PUBLIC_URL=https://studio.example.org \
  -e GOOGLE_CLIENT_ID=not-a-real-google-client \
  -e GOOGLE_CLIENT_SECRET=not-a-real-google-secret \
  -e STUDIO_STORAGE_KEY=test-only-storage-key-do-not-use-in-production \
  "$image"
