#!/bin/bash
# LitigaForge Blog Setup Script
# Run this to configure GitHub secrets and Cloudflare Pages domain
# Usage: bash setup-blog.sh

set -e

# ─── COLORS ──────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  LitigaForge Blog Setup Script${NC}"
echo -e "${BLUE}========================================${NC}"

# ─── CHECK REQUIREMENTS ────────────────────────────────────────
echo ""
echo -e "${YELLOW}Step 1: Checking requirements...${NC}"

if ! command -v gh &> /dev/null; then
    echo -e "${RED}GitHub CLI (gh) not found. Install it first:${NC}"
    echo "  https://cli.github.com/"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo -e "${RED}curl not found. Please install curl.${NC}"
    exit 1
fi

# Check if gh is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}GitHub CLI not authenticated. Run:${NC}"
    echo "  gh auth login"
    exit 1
fi

echo -e "${GREEN}✓ GitHub CLI is authenticated${NC}"

# ─── CONFIG ───────────────────────────────────────────────────
REPO="arif806-cyber/litigaforge-blog"
INDEXNOW_KEY="5a4662dfa9b58713797b87f6d724876f"
BLOG_DOMAIN="blog.litigaforge.com"

echo ""
echo -e "${YELLOW}Step 2: Configuring GitHub Secrets...${NC}"

# ─── SET SECRETS ────────────────────────────────────────────────
# BLOG_DOMAIN
gh secret set BLOG_DOMAIN -b "$BLOG_DOMAIN" -R "$REPO" 2>/dev/null && echo -e "${GREEN}✓ BLOG_DOMAIN${NC}" || echo -e "${RED}✗ BLOG_DOMAIN (failed)${NC}"

# INDEXNOW_KEY
gh secret set INDEXNOW_KEY -b "$INDEXNOW_KEY" -R "$REPO" 2>/dev/null && echo -e "${GREEN}✓ INDEXNOW_KEY${NC}" || echo -e "${RED}✗ INDEXNOW_KEY (failed)${NC}"

# GEMINI_API_KEY - prompt if not available
if [ -z "$GEMINI_API_KEY" ]; then
    echo ""
    echo -e "${YELLOW}Get GEMINI_API_KEY from https://aistudio.google.com${NC}"
    read -sp "Enter GEMINI_API_KEY: " GEMINI_API_KEY
    echo ""
fi
if [ -n "$GEMINI_API_KEY" ]; then
    gh secret set GEMINI_API_KEY -b "$GEMINI_API_KEY" -R "$REPO" 2>/dev/null && echo -e "${GREEN}✓ GEMINI_API_KEY${NC}" || echo -e "${RED}✗ GEMINI_API_KEY (failed)${NC}"
fi

# GROQ_API_KEY - prompt if not available
if [ -z "$GROQ_API_KEY" ]; then
    echo ""
    echo -e "${YELLOW}Get GROQ_API_KEY from https://console.groq.com${NC}"
    read -sp "Enter GROQ_API_KEY (or press Enter to skip): " GROQ_API_KEY
    echo ""
fi
if [ -n "$GROQ_API_KEY" ]; then
    gh secret set GROQ_API_KEY -b "$GROQ_API_KEY" -R "$REPO" 2>/dev/null && echo -e "${GREEN}✓ GROQ_API_KEY${NC}" || echo -e "${RED}✗ GROQ_API_KEY (failed)${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Verifying secrets...${NC}"
gh secret list -R "$REPO" 2>/dev/null | head -10 || echo -e "${RED}Could not list secrets${NC}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Setup complete!${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Go to Cloudflare Dashboard → Pages → litigaforge-blog"
echo "2. Click 'Custom Domains' → Add 'blog.litigaforge.com'"
echo "3. Go to GitHub → Actions → LitigaForge Content Pipeline"
echo "4. Click 'Run workflow' to trigger a test"
echo ""
echo -e "Blog will be live at: ${GREEN}https://blog.litigaforge.com${NC}"
echo "Articles auto-publish every 2 hours via GitHub Actions"
