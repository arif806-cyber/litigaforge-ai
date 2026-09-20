import os
import sys
from io import BytesIO
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import main as app_main
from routers import chat


def _upload(name: str, content_type: str, content: bytes) -> UploadFile:
    return UploadFile(
        filename=name,
        file=BytesIO(content),
        headers=Headers({"content-type": content_type}),
    )


@pytest.mark.asyncio
async def test_chat_file_rejects_files_over_ten_mb(monkeypatch):
    monkeypatch.setattr(
        chat, "_authorized_chat_participants",
        AsyncMock(return_value={"client_id": 1, "lawyer_user_id": 2}),
    )

    with pytest.raises(HTTPException) as exc:
        await chat.send_chat_file(
            request=None,
            thread_id=7,
            file=_upload("evidence.pdf", "application/pdf", b"x" * (chat.CHAT_FILE_MAX_BYTES + 1)),
            current_user={"id": 1, "name": "Client"},
        )

    assert exc.value.status_code == 413


@pytest.mark.asyncio
async def test_chat_file_rejects_non_pdf_or_image(monkeypatch):
    monkeypatch.setattr(
        chat, "_authorized_chat_participants",
        AsyncMock(return_value={"client_id": 1, "lawyer_user_id": 2}),
    )

    with pytest.raises(HTTPException) as exc:
        await chat.send_chat_file(
            request=None,
            thread_id=7,
            file=_upload("malware.exe", "application/octet-stream", b"not-an-image"),
            current_user={"id": 1, "name": "Client"},
        )

    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_chat_file_rejects_spoofed_pdf_content(monkeypatch):
    monkeypatch.setattr(
        chat, "_authorized_chat_participants",
        AsyncMock(return_value={"client_id": 1, "lawyer_user_id": 2}),
    )

    with pytest.raises(HTTPException) as exc:
        await chat.send_chat_file(
            request=None,
            thread_id=7,
            file=_upload("evidence.pdf", "application/pdf", b"not really a pdf"),
            current_user={"id": 1, "name": "Client"},
        )

    assert exc.value.status_code == 400
    assert "contents" in exc.value.detail


@pytest.mark.asyncio
async def test_chat_file_upload_stores_metadata_and_broadcasts(monkeypatch):
    class Storage:
        def __init__(self):
            self.uploaded = None

        def upload_from_bytes(self, key, content):
            self.uploaded = (key, content)

        def delete(self, key):
            pass

    storage = Storage()
    inserted = {
        "id": 10,
        "thread_id": 7,
        "sender_id": 1,
        "sender_role": "user",
        "content": "evidence.pdf",
        "message_type": "file",
        "file_url": "/secure-files/chat-file",
        "filename": "evidence.pdf",
        "file_size": 4,
        "created_at": "2026-09-19T12:00:00",
    }
    monkeypatch.setattr(
        chat, "_authorized_chat_participants",
        AsyncMock(return_value={"client_id": 1, "lawyer_user_id": 2}),
    )
    monkeypatch.setattr(chat, "fetchrow", AsyncMock(return_value=inserted))
    broadcast = AsyncMock()
    monkeypatch.setattr(chat, "_broadcast_chat_message", broadcast)
    monkeypatch.setattr("storage.get_object_storage", lambda: storage)

    result = await chat.send_chat_file(
        request=None,
        thread_id=7,
        file=_upload("evidence.pdf", "application/pdf", b"%PDF-1.7"),
        current_user={"id": 1, "name": "Client"},
    )

    assert storage.uploaded is not None
    assert storage.uploaded[0].startswith("uploads/chat_7_user_1_")
    assert storage.uploaded[1] == b"%PDF-1.7"
    assert result["message"]["message_type"] == "file"
    assert result["message"]["filename"] == "evidence.pdf"
    broadcast.assert_awaited_once()


@pytest.mark.asyncio
async def test_chat_participant_can_download_secure_attachment(monkeypatch):
    class Storage:
        def download_as_bytes(self, key):
            assert key == "uploads/chat-file.pdf"
            return b"%PDF-1.7"

    monkeypatch.setattr(
        app_main,
        "db_fetchrow",
        AsyncMock(return_value={
            "client_id": None,
            "file_path": "uploads/chat-file.pdf",
            "lawyer_id": None,
            "chat_client_id": 12,
            "chat_lawyer_user_id": 34,
        }),
    )
    monkeypatch.setattr(app_main, "_get_storage", lambda: Storage())

    response = await app_main.serve_secure_file(
        filename="chat-file.pdf",
        current_user={"id": 34},
    )

    assert response.status_code == 200
    assert response.body == b"%PDF-1.7"


@pytest.mark.asyncio
async def test_unrelated_user_cannot_download_chat_attachment(monkeypatch):
    monkeypatch.setattr(
        app_main,
        "db_fetchrow",
        AsyncMock(return_value={
            "client_id": None,
            "file_path": "uploads/chat-file.pdf",
            "lawyer_id": None,
            "chat_client_id": 12,
            "chat_lawyer_user_id": 34,
        }),
    )

    with pytest.raises(HTTPException) as exc:
        await app_main.serve_secure_file(
            filename="chat-file.pdf",
            current_user={"id": 99},
        )

    assert exc.value.status_code == 403