"""Security and authentication utilities"""

import json
from pathlib import Path
from typing import Dict, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from keycloak import KeycloakOpenID
from keycloak.exceptions import KeycloakError

from rm_be.config import settings

security = HTTPBearer(auto_error=False)
_keycloak_openid: Optional[KeycloakOpenID] = None
_mock_users: Optional[Dict] = None


def get_keycloak_client() -> Optional[KeycloakOpenID]:
    """Get or create Keycloak client instance"""
    global _keycloak_openid
    if settings.use_mock_auth:
        return None

    if _keycloak_openid is None:
        try:
            _keycloak_openid = KeycloakOpenID(
                server_url=settings.keycloak_server_url,
                client_id=settings.keycloak_client_id,
                realm_name=settings.keycloak_realm,
                client_secret_key=settings.keycloak_client_secret,
                verify=settings.keycloak_verify_ssl
            )

        except Exception:
            return None

    return _keycloak_openid


def load_mock_users() -> Dict:
    """Load mock users from JSON file"""
    global _mock_users

    if _mock_users is not None:
        return _mock_users

    mock_file = Path(settings.mock_users_file)
    if not mock_file.exists():
        mock_file = Path(__file__).parent.parent.parent / settings.mock_users_file

    if not mock_file.exists():
        raise FileNotFoundError(
            f"Mock users file not found: {settings.mock_users_file}. "
            "Please create mockusers.json in the project root."
        )

    with open(mock_file, 'r', encoding='utf-8') as f:
        _mock_users = json.load(f)

    return _mock_users


async def verify_token_keycloak(token: str) -> Dict:
    """Verify JWT token using Keycloak"""
    keycloak_client = get_keycloak_client()

    if keycloak_client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Keycloak authentication service unavailable"
        )

    try:
        public_key = (
            "-----BEGIN PUBLIC KEY-----\n"
            + keycloak_client.public_key()
            + "\n-----END PUBLIC KEY-----"
        )

        options = {
            "verify_signature": True,
            "verify_aud": False,
            "verify_exp": True
        }

        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            options=options
        )

        return payload
    
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )

    except KeycloakError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Keycloak error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication error: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"}
        )


async def verify_token_mock(token: str) -> Dict:
    """Verify token using mock users (for testing)"""
    try:
        mock_users = load_mock_users()
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Mock authentication not configured: {str(e)}"
        )

    users_dict = mock_users.get("users", {})
    user = users_dict.get(token)
    if not user:
        for user_data in users_dict.values():
            if user_data.get("email") == token or user_data.get("username") == token:
                user = user_data
                break

    if not user:
        available_users = [u.get("email", u.get("username", "unknown")) for u in users_dict.values()]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid mock token. Use user email or username as token. Available users: {', '.join(available_users)}",
            headers={"WWW-Authenticate": "Bearer"}
        )

    return {
        "sub": user.get("id", token),
        "email": user.get("email", token),
        "preferred_username": user.get("username", token),
        "name": user.get("name", ""),
        "realm_access": {
            "roles": user.get("roles", [])
        },
        "user_type": user.get("user_type", "collaborator"),
        "user_id": user.get("id", token),
    }


async def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict:
    """Verify JWT token from Keycloak or mock authentication"""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    if settings.use_mock_auth:
        return await verify_token_mock(token)
    else:
        return await verify_token_keycloak(token)


async def get_current_user(token_data: Dict = Depends(verify_token)) -> Dict:
    """Extract user information from token"""
    return {
        "user_id": token_data.get("sub") or token_data.get("user_id"),
        "email": token_data.get("email"),
        "username": token_data.get("preferred_username"),
        "name": token_data.get("name", ""),
        "roles": token_data.get("realm_access", {}).get("roles", []),
        "user_type": token_data.get("user_type", "collaborator"),
    }


def require_role(required_role: str):
    """Dependency factory to check if user has required role"""
    async def role_checker(current_user: Dict = Depends(get_current_user)):
        user_roles = current_user.get("roles", [])
        user_type = current_user.get("user_type", "")

        if required_role not in user_roles and user_type != required_role:
            if user_type != "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Role '{required_role}' required. Current roles: {user_roles}, user_type: {user_type}"
                )

        return current_user

    return role_checker


def require_user_type(required_user_type: str):
    """Dependency factory to check if user has required user_type"""
    async def user_type_checker(current_user: Dict = Depends(get_current_user)):
        user_type = current_user.get("user_type", "")

        if user_type == "admin":
            return current_user

        if user_type != required_user_type:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User type '{required_user_type}' required. Current user_type: {user_type}"
            )

        return current_user

    return user_type_checker


async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[Dict]:
    """Get current user if authenticated, None otherwise (for optional auth endpoints)"""
    if not credentials:
        return None

    try:
        token = credentials.credentials
        if settings.use_mock_auth:
            token_data = await verify_token_mock(token)
        else:
            token_data = await verify_token_keycloak(token)
        return {
            "user_id": token_data.get("sub") or token_data.get("user_id"),
            "email": token_data.get("email"),
            "username": token_data.get("preferred_username"),
            "name": token_data.get("name", ""),
            "roles": token_data.get("realm_access", {}).get("roles", []),
            "user_type": token_data.get("user_type", "collaborator"),
        }

    except HTTPException:
        return None
