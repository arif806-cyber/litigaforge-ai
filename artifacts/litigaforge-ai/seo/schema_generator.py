"""
seo/schema_generator.py — JSON-LD schema.org generator for LitigaForge AI

Supports five page types:
  Article       — blog posts and legal articles
  FAQPage       — Q&A and legal-aid pages
  LegalService  — lawyers directory, subscription / pricing pages
  BreadcrumbList — navigation breadcrumbs for any page
  Organization  — site-level org markup

No external dependencies — stdlib only.

Usage:
    from seo.schema_generator import inject_schema, inject_multiple

    html = inject_schema("FAQPage", {
        "questions": [{"q": "Can I...", "a": "Yes, under..."}],
    })
    # Returns: <script type="application/ld+json">...</script>
"""
import json
import os

SITE_URL = os.getenv("PUBLIC_SITE_URL", "https://litigaforge.com").rstrip("/")
ORG_NAME = "LitigaForge AI"
LOGO_URL = f"{SITE_URL}/logo.png"
CONTACT_EMAIL = "legal@litigaforge.com"


# ── Shared org fragment ───────────────────────────────────────────────────────

def _org_fragment() -> dict:
    return {
        "@type": "Organization",
        "@id": f"{SITE_URL}/#organization",
        "name": ORG_NAME,
        "url": SITE_URL,
        "logo": {"@type": "ImageObject", "url": LOGO_URL},
        "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "customer support",
            "email": CONTACT_EMAIL,
            "availableLanguage": ["English", "Hindi", "Telugu"],
        },
        "sameAs": [
            "https://blog.litigaforge.com",
            f"{SITE_URL}/about",
        ],
    }


# ── Schema builders ───────────────────────────────────────────────────────────

def _article(data: dict) -> dict:
    url = data.get("url", "")
    return {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": data.get("title", ""),
        "description": data.get("description", ""),
        "url": url,
        "datePublished": data.get("date_published", ""),
        "dateModified": data.get("date_modified") or data.get("date_published", ""),
        "image": data.get("image_url") or LOGO_URL,
        "author": _org_fragment(),
        "publisher": _org_fragment(),
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "inLanguage": data.get("language", "en-IN"),
        "keywords": data.get("keywords", ""),
    }


def _faq(data: dict) -> dict:
    questions = data.get("questions", [])
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": q.get("q", ""),
                "acceptedAnswer": {"@type": "Answer", "text": q.get("a", "")},
            }
            for q in questions
            if q.get("q") and q.get("a")
        ],
    }


def _legal_service(data: dict) -> dict:
    schema: dict = {
        "@context": "https://schema.org",
        "@type": "LegalService",
        "name": data.get("name", ORG_NAME),
        "url": data.get("url", SITE_URL),
        "description": data.get("description", ""),
        "areaServed": data.get("area_served", ["IN"]),
        "serviceType": data.get("service_type", "Legal Services"),
        "provider": _org_fragment(),
    }
    if data.get("offers"):
        schema["hasOfferCatalog"] = {
            "@type": "OfferCatalog",
            "name": "Subscription Plans",
            "itemListElement": [
                {
                    "@type": "Offer",
                    "name": plan.get("name", ""),
                    "description": plan.get("description", ""),
                    "price": str(plan.get("price", 0)),
                    "priceCurrency": plan.get("currency", "INR"),
                    "availability": "https://schema.org/InStock",
                }
                for plan in data["offers"]
            ],
        }
    return schema


def _breadcrumb(data: dict) -> dict:
    items = data.get("items", [])
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": i + 1,
                "name": item.get("name", ""),
                "item": item.get("url", ""),
            }
            for i, item in enumerate(items)
        ],
    }


def _organization(data: dict) -> dict:
    return {
        "@context": "https://schema.org",
        **_org_fragment(),
        "description": data.get(
            "description",
            "AI-powered client-lawyer matching and legal analysis platform for India",
        ),
        "foundingDate": "2024",
        "areaServed": data.get("area_served", ["IN", "Telangana", "Andhra Pradesh"]),
    }


_BUILDERS = {
    "Article": _article,
    "FAQPage": _faq,
    "LegalService": _legal_service,
    "BreadcrumbList": _breadcrumb,
    "Organization": _organization,
}


# ── Public API ────────────────────────────────────────────────────────────────

def build_schema(page_type: str, data: dict) -> dict:
    """Build and return a schema.org dict for the given page_type + data.
    Returns an empty dict for unknown types.
    """
    builder = _BUILDERS.get(page_type)
    return builder(data) if builder else {}


def inject_schema(page_type: str, data: dict) -> str:
    """Return a ``<script type="application/ld+json">`` block.
    Returns an empty string for unknown types or empty schemas.
    """
    schema = build_schema(page_type, data)
    if not schema:
        return ""
    return (
        '<script type="application/ld+json">\n'
        + json.dumps(schema, ensure_ascii=False, indent=2)
        + "\n</script>"
    )


def inject_multiple(schemas: list[tuple[str, dict]]) -> str:
    """Inject multiple JSON-LD blocks, one per (page_type, data) pair.
    Returns a newline-joined string of non-empty blocks.
    """
    return "\n".join(
        block
        for page_type, data in schemas
        if (block := inject_schema(page_type, data))
    )
