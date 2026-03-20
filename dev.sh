#!/usr/bin/env bash
set -e

# Build Scala.js
echo "Building Scala.js..."
sbt rootJS/fastLinkJS

# Start Vite dev server
echo "Starting frontend..."
cd frontend
npm run dev
