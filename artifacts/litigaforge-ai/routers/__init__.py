"""
LitigaForge AI — Router Modules
All 9 specialized router modules.
"""
from routers.auth         import router as auth_router
from routers.forge        import router as forge_router
from routers.subscription import router as subscription_router
from routers.matching     import router as matching_router
from routers.chat         import router as chat_router
from routers.community    import router as community_router
from routers.watch        import router as watch_router
from routers.alerts       import router as alerts_router
from routers.admin        import router as admin_router
from routers.lawyer       import router as lawyer_router

__all__ = [
    "auth_router",
    "forge_router",
    "subscription_router",
    "matching_router",
    "chat_router",
    "community_router",
    "watch_router",
    "alerts_router",
    "admin_router",
    "lawyer_router",
]
