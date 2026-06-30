#!/usr/bin/env python3
"""
Push blog domain updates to GitHub via the GitHub API.

This script creates a new commit directly on the GitHub API,
updating all files with the new domain: blog.litigaforge.com
"""

import os
import base64
import json
import urllib.request
import urllib.error

REPO = "arif806-cyber/litigaforge-blog"
PAT = (
    os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN_NOEXPIRE")
    or os.environ.get("GITHUB_PERSONAL_ACCESS_TOKEN", "")
)
NEW_DOMAIN = "blog.litigaforge.com"
OLD_DOMAIN = "litigaforge.com"

# Files to update with their new content
# Each entry: (file_path, content_string)
# Content will be created as new blobs

def api_call(method, path, body=None):
    """Make a GitHub API call."""
    url = f"https://api.github.com/{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {PAT}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    req.add_header("Content-Type", "application/json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

# Read updated files from the working directory
WORK_DIR = "/home/runner/workspace/litigaforge-blog-work"

def read_file(path):
    with open(os.path.join(WORK_DIR, path), "r") as f:
        return f.read()

# List of files to update (path relative to repo root)
FILES_TO_UPDATE = [
    "astro.config.mjs",
    "pipeline.py",
    ".github/workflows/pipeline.yml",
    "src/content/blog/welcome.md",
    "src/pages/index.astro",
    "src/pages/blog/index.astro",
    "src/pages/blog/[slug].astro",
    "README.md",
]

# Read all file contents
print("Reading updated files from workspace...")
file_contents = {}
for f in FILES_TO_UPDATE:
    try:
        content = read_file(f)
        file_contents[f] = content
        print(f"  {f}: {len(content)} bytes")
    except FileNotFoundError:
        print(f"  {f}: NOT FOUND (skipping)")

# Step 1: Get current branch ref
print("\nStep 1: Getting current branch ref...")
status, ref_data = api_call("GET", f"repos/{REPO}/git/ref/heads/main")
print(f"  Status: {status}")
if status != 200:
    print(f"  ERROR: {ref_data}")
    exit(1)

current_commit = ref_data["object"]["sha"]
print(f"  Current commit: {current_commit[:8]}")

# Step 2: Get current commit to get tree
print("\nStep 2: Getting current commit...")
status, commit_data = api_call("GET", f"repos/{REPO}/git/commits/{current_commit}")
current_tree = commit_data["tree"]["sha"]
print(f"  Current tree: {current_tree[:8]}")

# Step 3: Create new blobs for each file
print("\nStep 3: Creating new blobs...")
new_blobs = []
for path, content in file_contents.items():
    status, blob_data = api_call("POST", f"repos/{REPO}/git/blobs", {
        "content": content,
        "encoding": "utf-8"
    })
    if status == 201:
        new_blobs.append({
            "path": path,
            "mode": "100644",
            "type": "blob",
            "sha": blob_data["sha"]
        })
        print(f"  {path}: blob={blob_data['sha'][:8]}")
    else:
        print(f"  {path}: ERROR {status} - {blob_data}")

# Step 4: Get the current tree to find files to keep
print("\nStep 4: Getting current tree...")
status, tree_data = api_call("GET", f"repos/{REPO}/git/trees/{current_tree}?recursive=1")
if status != 200:
    print(f"  ERROR: {tree_data}")
    exit(1)

print(f"  Tree entries: {len(tree_data['tree'])}")

# Build the new tree - keep existing entries except for files we're updating
updated_paths = {b["path"] for b in new_blobs}
new_tree_entries = []

for entry in tree_data["tree"]:
    if entry["path"] in updated_paths:
        # Skip - will be replaced with new blob
        continue
    if entry["type"] == "tree":
        # Keep directory entries
        new_tree_entries.append({
            "path": entry["path"],
            "mode": entry["mode"],
            "type": entry["type"],
            "sha": entry["sha"]
        })
    elif entry["type"] == "blob":
        # Keep unmodified file blobs
        new_tree_entries.append({
            "path": entry["path"],
            "mode": entry["mode"],
            "type": entry["type"],
            "sha": entry["sha"]
        })

# Add new blobs
new_tree_entries.extend(new_blobs)

print(f"  New tree entries: {len(new_tree_entries)}")

# Step 5: Create new tree
print("\nStep 5: Creating new tree...")
status, new_tree = api_call("POST", f"repos/{REPO}/git/trees", {
    "base_tree": current_tree,
    "tree": new_tree_entries
})
if status != 201:
    print(f"  ERROR: {status} - {new_tree}")
    exit(1)
new_tree_sha = new_tree["sha"]
print(f"  New tree: {new_tree_sha[:8]}")

# Step 6: Create new commit
print("\nStep 6: Creating new commit...")
status, new_commit = api_call("POST", f"repos/{REPO}/git/commits", {
    "message": f"feat: update blog to use custom domain {NEW_DOMAIN}\n\n- Astro site URL: {NEW_DOMAIN}\n- Pipeline defaults: {NEW_DOMAIN}\n- Canonical URLs: {NEW_DOMAIN}\n- GitHub Actions fallback: {NEW_DOMAIN}\n- IndexNow key: 5a4662dfa9b58713797b87f6d724876f",
    "parents": [current_commit],
    "tree": new_tree_sha
})
if status != 201:
    print(f"  ERROR: {status} - {new_commit}")
    exit(1)
new_commit_sha = new_commit["sha"]
print(f"  New commit: {new_commit_sha[:8]}")

# Step 7: Update branch ref
print("\nStep 7: Updating branch ref...")
status, update = api_call("PATCH", f"repos/{REPO}/git/refs/heads/main", {
    "sha": new_commit_sha,
    "force": False
})
if status != 200:
    print(f"  ERROR: {status} - {update}")
    exit(1)
print(f"  Branch updated to {new_commit_sha[:8]}")

print(f"\n{'='*50}")
print(f"SUCCESS! Blog repo updated with new domain:")
print(f"  {NEW_DOMAIN}")
print(f"{'='*50}")
print(f"\nNew commit: {new_commit_sha}")
print(f"Verify: https://github.com/{REPO}/commit/{new_commit_sha}")
