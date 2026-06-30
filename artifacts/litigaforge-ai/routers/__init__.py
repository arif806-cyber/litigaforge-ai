"""
LitigaForge AI — Router Modules
"""
from routers.auth         import router as auth_router
from routers.subscription import router as subscription_router
from routers.matching     import router as matching_router
from routers.chat         import router as chat_router
from routers.community    import router as community_router
from routers.watch        import router as watch_router
from routers.alerts       import router as alerts_router
from routers.admin        import router as admin_router
from routers.lawyer       import router as lawyer_router
from routers.documents_free import router as documents_free_router
from routers.paid_documents import router as paid_documents_router
from routers.passkeys     import router as passkeys_router
from routers.push         import router as push_router
from routers.judgments    import router as judgments_router
from routers.research      import router as research_router
from routers.llm           import router as llm_router
from routers.workspace        import router as workspace_router
from routers.personalization  import router as personalization_router
from routers.presence         import router as presence_router
from routers.cnr              import router as cnr_router

__all__ = [
    "auth_router",
    "subscription_router",
    "matching_router",
    "chat_router",
    "community_router",
    "watch_router",
    "alerts_router",
    "admin_router",
    "lawyer_router",
    "documents_free_router",
    "paid_documents_router",
    "passkeys_router",
    "push_router",
    "judgments_router",
    "research_router",
    "llm_router",
    "workspace_router",
    "personalization_router",
    "presence_router",
    "cnr_router",
]
