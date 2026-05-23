"""
LitigaForge AI — Admin Router
Superuser-only lawyer verification and user management.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from auth import get_superuser
from database import fetch, fetchrow, execute

router = APIRouter(tags=["admin"])


class RejectRequest(BaseModel):
    reason: str = ""


@router.get("/admin/lawyers/pending")
async def admin_pending_lawyers(current_user: dict = Depends(get_superuser)):
    rows = await fetch(
        """SELECT id, name, email, phone, bar_number, district, practice_areas,
                  experience_years, created_at
           FROM lawyers WHERE verified = FALSE
           ORDER BY created_at DESC""",
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"total": len(rows), "lawyers": rows}


@router.post("/admin/lawyers/{lawyer_id}/approve")
async def admin_approve_lawyer(lawyer_id: int, current_user: dict = Depends(get_superuser)):
    row = await fetchrow(
        "UPDATE lawyers SET verified = TRUE, verification_status = 'verified' WHERE id = $1 RETURNING id",
        lawyer_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Lawyer not found")
    return {"success": True, "lawyer_id": lawyer_id, "status": "verified"}


@router.post("/admin/lawyers/{lawyer_id}/reject")
async def admin_reject_lawyer(lawyer_id: int, req: RejectRequest, current_user: dict = Depends(get_superuser)):
    row = await fetchrow(
        "UPDATE lawyers SET verification_status = 'rejected' WHERE id = $1 RETURNING id",
        lawyer_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Lawyer not found")
    return {"success": True, "lawyer_id": lawyer_id, "status": "rejected", "reason": req.reason}


@router.get("/admin/users")
async def admin_list_users(
    page: int = 1,
    limit: int = 50,
    current_user: dict = Depends(get_superuser),
):
    offset = max((page - 1) * limit, 0)
    rows = await fetch(
        """SELECT id, name, email, subscription_tier,
                  cases_this_month, is_superuser, created_at
           FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2""",
        limit, offset,
    )
    for r in rows:
        r["created_at"] = str(r["created_at"])
    return {"page": page, "limit": limit, "users": rows}


@router.post("/admin/users/{user_id}/reset-usage")
async def admin_reset_usage(user_id: int, current_user: dict = Depends(get_superuser)):
    await execute("UPDATE users SET cases_this_month = 0 WHERE id = $1", user_id)
    return {"success": True}
