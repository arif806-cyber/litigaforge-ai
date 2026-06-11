#!/bin/bash
# ============================================
# LitigaForge Blog Custom Domain Setup
# ============================================
# This script:
# 1. Updates the blog repo with new domain config
# 2. Pushes changes to GitHub
# 3. Creates a setup guide for Cloudflare + GitHub
#
# Run: bash setup_blog_domain.sh

set -e

echo "=========================================="
echo "  LitigaForge Blog Custom Domain Setup"
echo "=========================================="
echo ""

REPO="https://github.com/arif806-cyber/litigaforge-blog.git"
CLONE_DIR="/tmp/litigaforge-blog-setup"
INDEXNOW_KEY="5a4662dfa9b58713797b87f6d724876f"
BLOG_DOMAIN="blog.litigaforge.com"

# Step 1: Clone the repo
echo "Step 1: Cloning blog repo..."
rm -rf "$CLONE_DIR"
git clone --depth 1 "$REPO" "$CLONE_DIR" 2>&1 | tail -3
cd "$CLONE_DIR"
echo ""

# Step 2: Update all files with new domain
echo "Step 2: Updating domain references..."

# astro.config.mjs
sed -i "s|https://litigaforge.com|https://blog.litigaforge.com|g" astro.config.mjs
echo "  - astro.config.mjs"

# pipeline.py
sed -i 's|BLOG_DOMAIN     = os.environ.get("BLOG_DOMAIN", "litigaforge.com")|BLOG_DOMAIN     = os.environ.get("BLOG_DOMAIN", "blog.litigaforge.com")|g' pipeline.py
echo "  - pipeline.py"

# pipeline.yml
sed -i "s|secrets.BLOG_DOMAIN || 'litigaforge.com'|secrets.BLOG_DOMAIN || 'blog.litigaforge.com'|g" .github/workflows/pipeline.yml
echo "  - pipeline.yml"

# welcome.md
sed -i 's|canonicalUrl: "https://litigaforge.com/blog/welcome"|canonicalUrl: "https://blog.litigaforge.com/welcome"|g' src/content/blog/welcome.md
echo "  - welcome.md"

# index.astro
sed -i 's|https://litigaforge.com/blog|https://blog.litigaforge.com|g' src/pages/index.astro
echo "  - src/pages/index.astro"

# blog/index.astro
sed -i 's|https://litigaforge.com/blog|https://blog.litigaforge.com|g' src/pages/blog/index.astro
sed -i 's|// Blog listing page -- litigaforge.com/blog|// Blog listing page -- blog.litigaforge.com|g' src/pages/blog/index.astro
echo "  - src/pages/blog/index.astro"

# blog/[slug].astro
sed -i 's|https://litigaforge.com/blog/${post.slug}|https://blog.litigaforge.com/${post.slug}|g' src/pages/blog/[slug].astro
sed -i 's|// Individual article page -- litigaforge.com/blog/{slug}|// Individual article page -- blog.litigaforge.com/{slug}|g' src/pages/blog/[slug].astro
echo "  - src/pages/blog/[slug].astro"

# README.md
sed -i 's|BLOG_DOMAIN      = litigaforge.com|BLOG_DOMAIN      = blog.litigaforge.com|g' README.md
sed -i 's|https://litigaforge.com/{YOUR_KEY}.txt|https://blog.litigaforge.com/{YOUR_KEY}.txt|g' README.md
sed -i 's|litigaforge.com/blog|blog.litigaforge.com|g' README.md
sed -i 's|Add custom domain: `litigaforge.com` or `blog.litigaforge.com` |Add custom domain: `blog.litigaforge.com` (see below) |g' README.md
echo "  - README.md"

echo ""
echo "Step 3: Committing changes..."
git add -A
git -c user.email="bot@litigaforge.com" -c user.name="LitigaForge Bot" \
    commit -m "feat: update blog to use custom domain blog.litigaforge.com

- Astro site URL: blog.litigaforge.com
- Pipeline defaults: blog.litigaforge.com
- Canonical URLs: blog.litigaforge.com
- GitHub Actions fallback: blog.litigaforge.com
- IndexNow key: 5a4662dfa9b58713797b87f6d724876f" 2>&1 | tail -5

echo ""
echo "Step 4: Pushing to GitHub..."
# Use git push with the token embedded in the URL
GIT_PAT="${GITHUB_PERSONAL_ACCESS_TOKEN:-${GITHUB_TOKEN}}"
if [ -n "$GIT_PAT" ]; then
    git remote set-url origin "https://${GIT_PAT}@github.com/arif806-cyber/litigaforge-blog.git"
    git push origin main 2>&1 | tail -5
else
    echo "No git token available. Skipping push."
    echo "You can push manually:"
    echo "  cd $CLONE_DIR"
    echo "  git remote set-url origin https://YOUR_TOKEN@github.com/arif806-cyber/litigaforge-blog.git"
    echo "  git push origin main"
fi

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Blog files updated with: https://blog.litigaforge.com"
echo ""
echo "NEXT STEPS:"
echo ""
echo "1. GitHub Secrets (CRITICAL - pipeline won't run without these):"
echo "   Go to: https://github.com/arif806-cyber/litigaforge-blog/settings/secrets/actions"
echo "   Add these 4 Repository Secrets:"
echo ""
echo "   GEMINI_API_KEY      = <from aistudio.google.com>"
echo "   GROQ_API_KEY        = <from console.groq.com>"
echo "   INDEXNOW_KEY        = $INDEXNOW_KEY"
echo "   BLOG_DOMAIN         = $BLOG_DOMAIN"
echo ""
echo "2. Cloudflare Pages Custom Domain:"
echo "   Go to: https://dash.cloudflare.com → Pages → litigaforge-blog"
echo "   Click: Custom Domains → Add Custom Domain → blog.litigaforge.com"
echo "   Cloudflare auto-adds the CNAME record if your DNS is on Cloudflare."
echo ""
echo "3. Trigger a test run:"
echo "   Go to: https://github.com/arif806-cyber/litigaforge-blog/actions"
echo "   Click: 'LitigaForge Content Pipeline' → 'Run workflow' → max_articles=1"
echo ""
echo "Blog will be live at: https://blog.litigaforge.com"
echo "Articles auto-publish every 2 hours via GitHub Actions"
echo ""
