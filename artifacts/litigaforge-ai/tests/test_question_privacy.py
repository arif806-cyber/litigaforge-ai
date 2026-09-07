import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("SESSION_SECRET", "test-secret-123456789012345678901234567890")
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")

from routers.community import (
    QuestionRequest,
    normalize_public_question,
    redact_public_question,
)


def test_question_sharing_is_private_by_default():
    assert QuestionRequest(question="Can my landlord retain my deposit?").share_anonymously is False


def test_public_copy_removes_direct_identifiers_places_and_amounts():
    source = (
        "My name is Arjun Mehta. Advocate Priya Sharma called me on "
        "+91 98765 43210 at Indiranagar Bangalore. Email arjun@example.com. "
        "The disputed amount is INR 2,50,000."
    )
    public = redact_public_question(source)
    assert "Arjun" not in public
    assert "Priya" not in public
    assert "98765" not in public
    assert "Indiranagar" not in public
    assert "arjun@example.com" not in public
    assert "2,50,000" not in public


def test_normalized_question_digest_is_case_and_whitespace_insensitive():
    assert normalize_public_question("  Can I appeal?  ") == normalize_public_question("can   i APPEAL?")
    assert len(normalize_public_question("Can I appeal?")) == 64