import argparse
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import or_

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.entities import User


def create_admin_user(
    *,
    login_id: str,
    password: str,
    email: str,
    name: str | None = None,
    phone_number: str | None = None,
) -> None:
    db = SessionLocal()
    try:
        user = (
            db.query(User)
            .filter(
                or_(User.email == email, User.nickname == login_id),
                User.deleted_at.is_(None),
            )
            .first()
        )

        if user is None:
            user = User(
                email=email,
                nickname=login_id,
                name=name,
                phone_number=phone_number,
                password_hash=hash_password(password),
                is_active=True,
                is_verified=True,
                role="admin",
                onboarding_step="completed",
            )
            db.add(user)
            action = "created"
        else:
            user.email = email
            user.nickname = login_id
            user.password_hash = hash_password(password)
            user.name = name or user.name
            user.phone_number = phone_number or user.phone_number
            user.is_active = True
            user.is_verified = True
            user.role = "admin"
            user.onboarding_step = "completed"
            action = "updated"

        db.commit()
        print(f"Admin user {action}: id={user.id}, login_id={user.nickname}, email={user.email}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or update a Devory admin user.")
    parser.add_argument("--login-id", default=os.getenv("ADMIN_LOGIN_ID"), required=not os.getenv("ADMIN_LOGIN_ID"))
    parser.add_argument("--password", default=os.getenv("ADMIN_PASSWORD"), required=not os.getenv("ADMIN_PASSWORD"))
    parser.add_argument("--email", default=os.getenv("ADMIN_EMAIL", "admin@devory.local"))
    parser.add_argument("--name", default=os.getenv("ADMIN_NAME", "Devory Admin"))
    parser.add_argument("--phone-number", default=os.getenv("ADMIN_PHONE_NUMBER", "000-0000-0000"))
    args = parser.parse_args()

    create_admin_user(
        login_id=args.login_id,
        password=args.password,
        email=args.email,
        name=args.name,
        phone_number=args.phone_number,
    )


if __name__ == "__main__":
    main()
