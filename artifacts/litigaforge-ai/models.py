"""Pydantic v2 request models with field validators for input sanitization."""

from pydantic import BaseModel, Field, field_validator
import re


def _validate_email(v: str) -> str:
    if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', v):
        raise ValueError("Invalid email format")
    return v.strip().lower()


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return _validate_email(v)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=254)
    password: str = Field(..., min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return _validate_email(v)


class ForgeRequest(BaseModel):
    prompt: str = Field(..., min_length=20, max_length=5000)
    notify_whatsapp: bool = False

    @field_validator("prompt")
    @classmethod
    def no_injection(cls, v: str) -> str:
        from sanitizer import detect_injection
        if detect_injection(v):
            raise ValueError("Prompt contains disallowed content")
        return v.strip()


class AskRequest(BaseModel):
    question: str = Field(..., min_length=5, max_length=1000)
    category: str = Field("general", max_length=50)

    @field_validator("question")
    @classmethod
    def no_injection(cls, v: str) -> str:
        from sanitizer import detect_injection
        if detect_injection(v):
            raise ValueError("Question contains disallowed content")
        return v.strip()


class DocumentAnalyzeRequest(BaseModel):
    document_text: str = Field(..., min_length=50, max_length=10000)
    document_type: str = Field("general", max_length=50)

    @field_validator("document_text")
    @classmethod
    def no_injection(cls, v: str) -> str:
        from sanitizer import detect_injection
        if detect_injection(v):
            raise ValueError("Document text contains disallowed content")
        return v.strip()


class JudgmentSearchRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=500)
    court: str = Field("all", max_length=100)

    @field_validator("query")
    @classmethod
    def no_injection(cls, v: str) -> str:
        from sanitizer import detect_injection
        if detect_injection(v):
            raise ValueError("Query contains disallowed content")
        return v.strip()


class CaseRequirementRequest(BaseModel):
    title: str = Field(..., min_length=10, max_length=200)
    case_type: str = Field(..., min_length=2, max_length=100)
    description: str = Field(..., min_length=30, max_length=2000)
    location: str = Field(..., min_length=2, max_length=100)
    budget_range: str = Field("negotiable", max_length=50)
    is_anonymous: bool = False


class ChatMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)

    @field_validator("content")
    @classmethod
    def no_injection(cls, v: str) -> str:
        from sanitizer import detect_injection
        if detect_injection(v):
            raise ValueError("Message contains disallowed content")
        return v.strip()


class LawyerRegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., max_length=20)
    email: str = Field(..., min_length=5, max_length=254)
    district: str = Field(..., min_length=2, max_length=100)
    bar_number: str = Field(..., min_length=3, max_length=50)
    experience_years: int = Field(..., ge=0, le=70)
    bio: str = Field("", max_length=1000)
    practice_areas: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)

    @field_validator("email")
    @classmethod
    def email_valid(cls, v: str) -> str:
        return _validate_email(v)
