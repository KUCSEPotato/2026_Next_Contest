import sys
import os

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from faker import Faker
from sqlalchemy.exc import IntegrityError

from app.db.session import SessionLocal
from app.models.entities import User
from app.core.security import hash_password

fake = Faker('ko_KR')  # Use Korean locale for more relevant data

def generate_mock_users(num=50):
    db = SessionLocal()
    created_count = 0

    try:
        for i in range(num):
            # Generate unique email and nickname
            email = fake.email()
            nickname = fake.user_name()

            # Check if email or nickname already exists
            existing_user = db.query(User).filter(
                (User.email == email) | (User.nickname == nickname)
            ).first()
            if existing_user:
                print(f"Skipping duplicate: {email} or {nickname}")
                continue

            # Generate password and hash it
            password = fake.password(length=12)
            password_hash = hash_password(password)

            # Generate other fields
            bio = fake.text(max_nb_chars=200) if fake.boolean(chance_of_getting_true=70) else None
            avatar_url = fake.image_url() if fake.boolean(chance_of_getting_true=50) else None
            is_verified = fake.boolean(chance_of_getting_true=80)  # 80% chance of being verified

            user = User(
                email=email,
                password_hash=password_hash,
                nickname=nickname,
                bio=bio,
                avatar_url=avatar_url,
                is_active=True,
                is_verified=is_verified,
                role='user'
            )

            db.add(user)
            created_count += 1

            if i % 10 == 0:
                print(f"Created {i+1} users...")

        db.commit()
        print(f"Successfully created {created_count} mock users.")

    except IntegrityError as e:
        db.rollback()
        print(f"Integrity error occurred: {e}. Some users might have duplicate emails or nicknames.")
    except Exception as e:
        db.rollback()
        print(f"An error occurred: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    generate_mock_users(50)