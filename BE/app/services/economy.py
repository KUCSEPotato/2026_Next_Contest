from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models import CoinTransaction
from app.models import Idea
from app.models import Notification
from app.models import Project
from app.models import User


PROJECT_REWARD_POINTS = {
    "registration": 10,
    "started": 15,
    "completed": 25,
    "recycled": 8,
}


def _build_transaction_key(event_type: str, source_type: str | None, source_id: int | None) -> tuple[str, str | None, int | None]:
    return event_type, source_type, source_id


def award_coins(
    db: Session,
    *,
    user_id: int,
    amount: int,
    event_type: str,
    source_type: str | None = None,
    source_id: int | None = None,
    note: str | None = None,
) -> int:
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coin amount must be positive")

    existing = (
        db.query(CoinTransaction)
        .filter(
            CoinTransaction.user_id == user_id,
            CoinTransaction.event_type == event_type,
            CoinTransaction.source_type == source_type,
            CoinTransaction.source_id == source_id,
        )
        .first()
    )
    if existing is not None:
        return existing.balance_after

    user = db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    user.coin_balance = int(user.coin_balance or 0) + amount
    transaction = CoinTransaction(
        user_id=user_id,
        amount=amount,
        balance_after=user.coin_balance,
        event_type=event_type,
        source_type=source_type,
        source_id=source_id,
        note=note,
    )
    db.add(transaction)
    return user.coin_balance


def spend_coins(
    db: Session,
    *,
    user_id: int,
    amount: int,
    event_type: str,
    source_type: str | None = None,
    source_id: int | None = None,
    note: str | None = None,
) -> int:
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Coin amount must be positive")

    user = db.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    current_balance = int(user.coin_balance or 0)
    if current_balance < amount:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail="Not enough coins")

    user.coin_balance = current_balance - amount
    transaction = CoinTransaction(
        user_id=user_id,
        amount=-amount,
        balance_after=user.coin_balance,
        event_type=event_type,
        source_type=source_type,
        source_id=source_id,
        note=note,
    )
    db.add(transaction)
    return user.coin_balance


def notify_user(
    db: Session,
    *,
    user_id: int,
    notification_type: str,
    title: str,
    body: str | None = None,
    data: dict | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        title=title,
        body=body,
        data=data or {},
    )
    db.add(notification)
    return notification


def reward_project_registration(db: Session, project: Project) -> int:
    return award_coins(
        db,
        user_id=project.leader_id,
        amount=PROJECT_REWARD_POINTS["registration"],
        event_type="project.registration",
        source_type="project",
        source_id=project.id,
        note=f"Project registration reward for {project.title}",
    )


def reward_project_started(db: Session, project: Project) -> int:
    return award_coins(
        db,
        user_id=project.leader_id,
        amount=PROJECT_REWARD_POINTS["started"],
        event_type="project.started",
        source_type="project",
        source_id=project.id,
        note=f"Project started reward for {project.title}",
    )


def reward_project_completed(db: Session, project: Project) -> int:
    return award_coins(
        db,
        user_id=project.leader_id,
        amount=PROJECT_REWARD_POINTS["completed"],
        event_type="project.completed",
        source_type="project",
        source_id=project.id,
        note=f"Project completion reward for {project.title}",
    )


def reward_project_recycled(db: Session, project: Project) -> int:
    return award_coins(
        db,
        user_id=project.leader_id,
        amount=PROJECT_REWARD_POINTS["recycled"],
        event_type="project.recycled",
        source_type="project",
        source_id=project.id,
        note=f"Project recycled to idea for {project.title}",
    )


def reward_idea_adopted(db: Session, idea: Idea, project: Project) -> int:
    return award_coins(
        db,
        user_id=idea.author_id,
        amount=20,
        event_type="idea.adopted",
        source_type="idea",
        source_id=idea.id,
        note=f"Idea adopted into project {project.title}",
    )


def send_stale_project_notifications(db: Session, *, stale_days: int = 30) -> int:
    cutoff = datetime.now(timezone.utc) - timedelta(days=stale_days)
    stale_projects = (
        db.query(Project)
        .filter(
            Project.deleted_at.is_(None),
            Project.status == "planning",
            Project.created_at <= cutoff,
        )
        .all()
    )

    created_count = 0
    for project in stale_projects:
        existing_notifications = (
            db.query(Notification)
            .filter(
                Notification.user_id == project.leader_id,
                Notification.type == "project.stale_reminder",
            )
            .all()
        )
        exists = any((notification.data or {}).get("project_id") == project.id for notification in existing_notifications)
        if exists:
            continue

        notify_user(
            db,
            user_id=project.leader_id,
            notification_type="project.stale_reminder",
            title="30일 이상 진행되지 않은 프로젝트입니다.",
            body="영감의 샘으로 흘려보내겠습니까? 프로젝트를 버리면 코인을 받을 수 있습니다.",
            data={"project_id": project.id, "project_title": project.title, "stale_days": stale_days},
        )
        created_count += 1

    return created_count