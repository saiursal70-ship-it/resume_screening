from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    clear_auth_cookie,
    create_access_token,
    get_current_user,
    get_password_hash,
    set_auth_cookie,
    verify_password,
)
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, LogoutResponse, RegisterRequest, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserResponse)
async def login(
    login_data: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.email == login_data.email)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    token = create_access_token(
        data={
            "sub": str(user.id),
            "email": user.email,
            "role": user.role,
        }
    )
    set_auth_cookie(response, token)

    return UserResponse(
        id=user.id,
        email=user.email,
        name=user.name,
        role=user.role,
        access_token=token,
        token_type="bearer",
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    register_data: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.email == register_data.email)
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists.",
        )

    hashed_pw = get_password_hash(register_data.password)
    new_user = User(
        email=register_data.email,
        password_hash=hashed_pw,
        name=register_data.name,
        role=register_data.role,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    token = create_access_token(
        data={
            "sub": str(new_user.id),
            "email": new_user.email,
            "role": new_user.role,
        }
    )
    set_auth_cookie(response, token)

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        name=new_user.name,
        role=new_user.role,
        access_token=token,
        token_type="bearer",
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(response: Response):
    clear_auth_cookie(response)
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
