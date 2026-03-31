from fastapi import APIRouter

from app.api.v1.endpoints import admin
from app.api.v1.endpoints import adoptions
from app.api.v1.endpoints import auth
from app.api.v1.endpoints import chats
from app.api.v1.endpoints import ideas
from app.api.v1.endpoints import matching
from app.api.v1.endpoints import notifications
from app.api.v1.endpoints import projects
from app.api.v1.endpoints import recommendations
from app.api.v1.endpoints import reviews
from app.api.v1.endpoints import search
from app.api.v1.endpoints import subscriptions
from app.api.v1.endpoints import users

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(ideas.router, prefix="/ideas", tags=["ideas"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(matching.router, prefix="/matching", tags=["matching"])
api_router.include_router(adoptions.router, prefix="/adoptions", tags=["adoptions"])
api_router.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(subscriptions.router, prefix="/subscriptions", tags=["subscriptions"])
api_router.include_router(recommendations.router, prefix="/recommendations", tags=["recommendations"])
api_router.include_router(chats.router, prefix="/chats", tags=["chats"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
