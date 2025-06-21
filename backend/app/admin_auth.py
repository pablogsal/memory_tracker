"""
Admin authentication middleware and dependencies for GitHub OAuth protection.
"""

import secrets
import logging
from datetime import datetime, UTC, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status, Request, Cookie
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_database
from .models import AdminSession
from .oauth import github_oauth, GitHubUser
from .config import get_settings

logger = logging.getLogger(__name__)


async def create_admin_session(
    db: AsyncSession, github_user: GitHubUser, duration_hours: int = 24
) -> str:
    """Create a new admin session for a GitHub user."""
    logger.info(f"🔐 CREATE_ADMIN_SESSION: Starting session creation for user {github_user.login}")
    logger.info(f"🔐 CREATE_ADMIN_SESSION: GitHub user data - ID: {github_user.id}, login: {github_user.login}")
    
    try:
        session_token = secrets.token_urlsafe(48)
        expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=duration_hours)
        
        logger.info(f"🔐 CREATE_ADMIN_SESSION: Generated session token (first 8 chars): {session_token[:8]}")
        logger.info(f"🔐 CREATE_ADMIN_SESSION: Session expires at: {expires_at}")
        
        admin_session = AdminSession(
            session_token=session_token,
            github_user_id=github_user.id,
            github_username=github_user.login,
            github_name=github_user.name,
            github_email=github_user.email,
            github_avatar_url=github_user.avatar_url,
            expires_at=expires_at,
        )
        
        logger.info(f"🔐 CREATE_ADMIN_SESSION: AdminSession object created successfully")
        
        db.add(admin_session)
        logger.info(f"🔐 CREATE_ADMIN_SESSION: Added to database session, committing...")
        
        await db.commit()
        logger.info(f"🔐 CREATE_ADMIN_SESSION: Database commit successful")
        
        await db.refresh(admin_session)
        logger.info(f"🔐 CREATE_ADMIN_SESSION: Database refresh successful, session ID: {admin_session.id}")
        
        return session_token
        
    except Exception as e:
        import traceback
        logger.error(f"❌ CREATE_ADMIN_SESSION: Error creating admin session: {e}")
        logger.error(f"❌ CREATE_ADMIN_SESSION: Full traceback: {traceback.format_exc()}")
        raise


async def get_admin_session(
    db: AsyncSession, session_token: str
) -> Optional[AdminSession]:
    """Get an active admin session by token."""
    logger.info(f"🔐 GET_ADMIN_SESSION: Looking up session with token (first 8 chars): {session_token[:8]}")
    
    try:
        current_time = datetime.now(UTC).replace(tzinfo=None)
        logger.info(f"🔐 GET_ADMIN_SESSION: Current time: {current_time}")
        
        query = select(AdminSession).where(
            and_(
                AdminSession.session_token == session_token,
                AdminSession.is_active == True,
                AdminSession.expires_at > current_time,
            )
        )
        
        logger.info(f"🔐 GET_ADMIN_SESSION: Executing database query...")
        result = await db.execute(query)
        session = result.scalars().first()
        
        if session:
            logger.info(f"🔐 GET_ADMIN_SESSION: Found session - ID: {session.id}, user: {session.github_username}, expires: {session.expires_at}")
            logger.info(f"🔐 GET_ADMIN_SESSION: Session active: {session.is_active}, expires in future: {session.expires_at > current_time}")
        else:
            logger.warning(f"🔐 GET_ADMIN_SESSION: No session found for token")
            
            # Debug: Check if session exists but is expired/inactive
            debug_query = select(AdminSession).where(AdminSession.session_token == session_token)
            debug_result = await db.execute(debug_query)
            debug_session = debug_result.scalars().first()
            
            if debug_session:
                logger.warning(f"🔐 GET_ADMIN_SESSION: DEBUG - Found session but it's filtered out:")
                logger.warning(f"🔐 GET_ADMIN_SESSION: DEBUG - Active: {debug_session.is_active}, Expires: {debug_session.expires_at}, Current: {current_time}")
            else:
                logger.warning(f"🔐 GET_ADMIN_SESSION: DEBUG - No session exists with this token at all")
        
        return session
        
    except Exception as e:
        import traceback
        logger.error(f"❌ GET_ADMIN_SESSION: Error retrieving admin session: {e}")
        logger.error(f"❌ GET_ADMIN_SESSION: Full traceback: {traceback.format_exc()}")
        raise


async def invalidate_admin_session(db: AsyncSession, session_token: str) -> None:
    """Invalidate an admin session."""
    result = await db.execute(
        select(AdminSession).where(AdminSession.session_token == session_token)
    )
    session = result.scalars().first()
    if session:
        session.is_active = False
        await db.commit()


async def cleanup_expired_sessions(db: AsyncSession) -> None:
    """Clean up expired admin sessions."""
    result = await db.execute(
        select(AdminSession).where(
            and_(
                AdminSession.expires_at <= datetime.now(UTC).replace(tzinfo=None),
                AdminSession.is_active == True,
            )
        )
    )
    expired_sessions = result.scalars().all()
    
    for session in expired_sessions:
        session.is_active = False
    
    if expired_sessions:
        await db.commit()


async def require_admin_auth(
    request: Request,
    admin_session_token: Optional[str] = Cookie(None, alias="admin_session"),
    db: AsyncSession = Depends(get_database),
) -> AdminSession:
    """
    Dependency to require admin authentication.
    Checks for admin session cookie and validates it.
    """
    logger.info(f"🔐 REQUIRE_ADMIN_AUTH: Starting auth check for {request.url.path}")
    logger.info(f"🔐 REQUIRE_ADMIN_AUTH: Session token present: {admin_session_token is not None}")
    
    if admin_session_token:
        logger.info(f"🔐 REQUIRE_ADMIN_AUTH: Session token (first 8 chars): {admin_session_token[:8]}")
    
    if not admin_session_token:
        logger.warning(f"❌ REQUIRE_ADMIN_AUTH: No session token provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        logger.info(f"🔐 REQUIRE_ADMIN_AUTH: Calling get_admin_session...")
        session = await get_admin_session(db, admin_session_token)
        logger.info(f"🔐 REQUIRE_ADMIN_AUTH: get_admin_session returned: {session is not None}")
    except Exception as e:
        # Log the database error with more details
        import traceback
        logger.error(f"❌ REQUIRE_ADMIN_AUTH: Database error in admin auth: {e}")
        logger.error(f"❌ REQUIRE_ADMIN_AUTH: Full traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication service unavailable",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not session:
        logger.warning(f"❌ REQUIRE_ADMIN_AUTH: No valid session found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin session",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    logger.info(f"✅ REQUIRE_ADMIN_AUTH: Authentication successful for user: {session.github_username}")
    
    # Check if user is still an admin (for existing sessions, we need a valid token)
    # Note: This check is disabled for existing sessions as we don't store the access token
    # Team membership is verified during initial login only
    # if not await github_oauth.is_admin_user(session.github_username):
    #     await invalidate_admin_session(db, admin_session_token)
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Admin privileges revoked",
    #     )
    
    return session


async def optional_admin_auth(
    request: Request,
    admin_session_token: Optional[str] = Cookie(None, alias="admin_session"),
    db: AsyncSession = Depends(get_database),
) -> Optional[AdminSession]:
    """
    Optional admin authentication dependency.
    Returns None if not authenticated, AdminSession if authenticated.
    """
    if not admin_session_token:
        return None
    
    try:
        return await require_admin_auth(request, admin_session_token, db)
    except HTTPException:
        return None