#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.prod"

echo "🚀 Savewise MCP Server Deployment Script"
echo "========================================="

# Check if .env.prod exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env.prod not found"
    echo "   Copy .env.prod.example to .env.prod and fill in production values"
    exit 1
fi

# Load environment variables
echo "📋 Loading environment from .env.prod..."
export $(grep -v '^#' "$ENV_FILE" | xargs)

# Validate required variables
if [ -z "$READWISE_TOKEN" ]; then
    echo "❌ Error: READWISE_TOKEN is not set in .env.prod"
    exit 1
fi

if [ -z "$MCP_BEARER_TOKEN" ]; then
    echo "❌ Error: MCP_BEARER_TOKEN is not set in .env.prod"
    exit 1
fi

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Error: fly CLI is not installed"
    echo "   Install with: curl -L https://fly.io/install.sh | sh"
    exit 1
fi

# Check if logged in to Fly.io
if ! fly auth whoami &> /dev/null; then
    echo "🔐 Not logged in to Fly.io. Running fly auth login..."
    fly auth login
fi

cd "$PROJECT_DIR"

# Build check
echo "🔨 Building project..."
pnpm run build

# Run tests
echo "🧪 Running tests..."
pnpm run test:run

# Set secrets on Fly.io
echo "🔒 Setting Fly.io secrets..."
fly secrets set READWISE_TOKEN="$READWISE_TOKEN" MCP_BEARER_TOKEN="$MCP_BEARER_TOKEN" --stage

# Deploy
echo "🚀 Deploying to Fly.io..."
fly deploy

# Get app URL
APP_URL=$(fly status --json | grep -o '"Hostname":"[^"]*"' | head -1 | cut -d'"' -f4)

echo ""
echo "✅ Deployment complete!"
echo "========================================="
echo "🌐 App URL: https://$APP_URL"
echo "🔗 MCP Endpoint: https://$APP_URL/mcp"
echo "❤️  Health Check: https://$APP_URL/healthz"
echo ""
echo "📝 To register with Claude Code:"
echo "   claude mcp add --transport http readwise https://$APP_URL/mcp \\"
echo "     --header \"Authorization: Bearer \$MCP_BEARER_TOKEN\""
