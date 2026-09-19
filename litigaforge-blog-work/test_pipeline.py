import os
from datetime import datetime, timezone

import pipeline


def test_sources_are_india_only():
    assert pipeline.SUBREDDITS
    assert all(country == "India" for _, country in pipeline.SUBREDDITS)
    assert all(topic["country"] == "India" for topic in pipeline._CURATED_TOPICS)


def test_title_truncation_stops_at_word_boundary():
    title = pipeline._title_at_word_boundary("A long generated title about Telangana employment rights and legal notices", 45)
    assert len(title) <= 45
    assert not title.endswith(("A", "about", "employment", "rights", "legal", "notices"))
    assert " " not in title[-1:]


def test_markdown_has_disclaimer_and_curated_links_only():
    post = {"title": "India topic", "country": "India", "subreddit": "r/india", "score": 100, "upvotes": 100, "comments": 10}
    article = {
        "title": "Telangana contract review guide",
        "metaDescription": "Indian legal information.",
        "slug": "telangana-contract-review",
        "readTime": "5 min read",
        "country": "India",
        "legalArea": "Contract",
        "intro": "A practical guide.",
        "sections": [{"h2": "Next steps", "body": "Useful information.", "keyTakeaway": "Keep records."}],
        "faq": [],
        "cta": "Explore the case tracking tool.",
        "internalLink": "under navigating regulations obligations | Contract Review | Legal Notice Generator | Generic phrase",
        "tags": ["India"],
    }
    markdown = pipeline.build_markdown(article, post)
    assert "Legal information, not legal advice" in markdown
    assert "Contract Review" in markdown
    assert "Legal Notice Generator" in markdown
    assert "under navigating regulations obligations" not in markdown


def test_non_india_markdown_has_no_free_analysis_cta():
    post = {"title": "Foreign topic", "country": "USA", "subreddit": "r/legaladvice", "score": 100, "upvotes": 100, "comments": 10}
    article = {
        "title": "Foreign article",
        "metaDescription": "Description",
        "slug": "foreign-article",
        "readTime": "4 min read",
        "country": "USA",
        "legalArea": "General",
        "intro": "Intro",
        "sections": [],
        "faq": [],
        "cta": "Get your free AI legal analysis in 60 seconds.",
        "internalLink": "",
        "tags": [],
    }
    markdown = pipeline.build_markdown(article, post)
    assert "60 seconds" not in markdown
    assert "free AI legal analysis" not in markdown


def test_reviewer_is_rendered_only_when_configured(monkeypatch):
    post = {"title": "India topic", "country": "India", "subreddit": "r/india", "score": 1, "upvotes": 1, "comments": 1}
    article = {"title": "Guide", "metaDescription": "Description", "slug": "guide",
               "readTime": "1 min read", "country": "India", "legalArea": "General",
               "intro": "Intro", "sections": [], "faq": [], "cta": "", "internalLink": "", "tags": []}
    monkeypatch.delenv("BLOG_REVIEWER_NAME", raising=False)
    assert "Reviewed by" not in pipeline.build_markdown(article, post)
    monkeypatch.setenv("BLOG_REVIEWER_NAME", "A. Reviewer")
    rendered = pipeline.build_markdown(article, post)
    assert "Reviewed by" in rendered
    assert "A. Reviewer" in rendered


def test_explicit_non_india_fixture_is_excluded_from_sitemap_source():
    fixture = os.path.join(os.path.dirname(__file__), "tests", "fixtures", "non-india.md")
    text = open(fixture, encoding="utf-8").read()
    assert 'country: "USA"' in text
    sitemap = open(os.path.join(os.path.dirname(__file__), "src", "pages", "sitemap.xml.ts"), encoding="utf-8").read()
    assert "data.country === 'India'" in sitemap
    assert "post.slug" in sitemap


def test_weekly_counter_counts_only_current_week_india_articles(tmp_path, monkeypatch):
    content = tmp_path / "src" / "content" / "blog"
    content.mkdir(parents=True)
    (content / "india.md").write_text(
        'country: "India"\ndate: "2026-06-15T00:00:00+00:00"\n',
        encoding="utf-8",
    )
    (content / "foreign.md").write_text(
        'country: "USA"\ndate: "2026-06-15T00:00:00+00:00"\n',
        encoding="utf-8",
    )
    monkeypatch.chdir(tmp_path)
    now = datetime(2026, 6, 17, tzinfo=timezone.utc)
    assert pipeline._published_this_week(now) == 1