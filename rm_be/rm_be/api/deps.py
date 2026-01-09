"""API dependencies for dependency injection"""

from typing import Dict

from fastapi import Depends, HTTPException, status

from rm_be.core.security import (get_current_user, get_optional_user,
                                 require_role, require_user_type)

CurrentUser = Depends(get_current_user)
OptionalUser = Depends(get_optional_user)


def RequireRole(role: str):
    """Factory for role-based dependencies"""
    return Depends(require_role(role))

def RequireUserType(user_type: str):
    """Factory for user type-based dependencies"""
    return Depends(require_user_type(user_type))

RequireAdmin = Depends(require_user_type("admin"))
RequireResponsible = Depends(require_user_type("responsible"))
RequireCollaborator = Depends(require_user_type("collaborator"))

def RequireAdminOrResponsible():
    """Check if user is admin or responsible"""
    async def checker(current_user: Dict = Depends(get_current_user)):
        user_type = current_user.get("user_type", "")
        if user_type not in ["admin", "responsible"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin or Responsible access required"
            )
        return current_user
    return Depends(checker)
