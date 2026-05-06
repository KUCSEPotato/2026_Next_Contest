from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


ID_TYPE = BigInteger().with_variant(Integer, "sqlite")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(Text)
    github_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    google_id: Mapped[str | None] = mapped_column(String(100), unique=True)
    nickname: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    bio: Mapped[str | None] = mapped_column(Text)
    avatar_url: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str] = mapped_column(String(20), default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)


class UserSkill(Base):
    __tablename__ = "user_skills"
    __table_args__ = (UniqueConstraint("user_id", "skill_id", name="user_skills_unique"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    proficiency: Mapped[int | None] = mapped_column(SmallInteger)


class Interest(Base):
    __tablename__ = "interests"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    normalized_name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class UserInterest(Base):
    __tablename__ = "user_interests"
    __table_args__ = (UniqueConstraint("user_id", "interest_id", name="user_interests_unique"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    interest_id: Mapped[int] = mapped_column(ForeignKey("interests.id", ondelete="CASCADE"), nullable=False)
    interest_level: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Idea(Base):
    __tablename__ = "ideas"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    domain: Mapped[str | None] = mapped_column(String(50))
    tech_stack: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    hashtags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False)
    required_members: Mapped[int] = mapped_column(SmallInteger, default=1)
    is_open: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class IdeaBookmark(Base):
    __tablename__ = "idea_bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "idea_id", name="idea_bookmarks_unique"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    idea_id: Mapped[int] = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False)


class IdeaLike(Base):
    __tablename__ = "idea_likes"
    __table_args__ = (UniqueConstraint("user_id", "idea_id", name="idea_likes_unique"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    idea_id: Mapped[int] = mapped_column(ForeignKey("ideas.id", ondelete="CASCADE"), nullable=False)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    idea_id: Mapped[int | None] = mapped_column(ForeignKey("ideas.id", ondelete="SET NULL"))
    leader_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str | None] = mapped_column(String(50))
    difficulty: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="planning")
    progress_percent: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=0)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    max_members: Mapped[int] = mapped_column(SmallInteger, default=10)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProjectMember(Base):
    __tablename__ = "project_members"
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="project_members_unique"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_in_project: Mapped[str] = mapped_column(String(50), nullable=False)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ProjectSkill(Base):
    __tablename__ = "project_skills"
    __table_args__ = (UniqueConstraint("project_id", "skill_id", name="project_skills_unique"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    skill_id: Mapped[int] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), nullable=False)
    required_level: Mapped[int | None] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProjectInterest(Base):
    __tablename__ = "project_interests"
    __table_args__ = (UniqueConstraint("project_id", "interest_id", name="project_interests_unique"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    interest_id: Mapped[int] = mapped_column(ForeignKey("interests.id", ondelete="CASCADE"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProjectMilestone(Base):
    __tablename__ = "project_milestones"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[date | None] = mapped_column(Date)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)


class ProjectRecruitment(Base):
    __tablename__ = "project_recruitments"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    position_name: Mapped[str] = mapped_column(String(100), nullable=False)
    required_count: Mapped[int] = mapped_column(SmallInteger, default=1)
    status: Mapped[str] = mapped_column(String(20), default="open")
    description: Mapped[str | None] = mapped_column(Text)


class Application(Base):
    __tablename__ = "applications"
    __table_args__ = (UniqueConstraint("project_id", "applicant_id", name="applications_unique"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    applicant_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Invitation(Base):
    __tablename__ = "invitations"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    inviter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    invitee_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Todo(Base):
    __tablename__ = "todos"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    stage: Mapped[str] = mapped_column(String(30), default="planning")
    status: Mapped[str] = mapped_column(String(20), default="todo")
    priority: Mapped[int] = mapped_column(SmallInteger, default=3)
    due_date: Mapped[date | None] = mapped_column(Date)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TodoAssignment(Base):
    __tablename__ = "todo_assignments"
    __table_args__ = (UniqueConstraint("todo_id", "user_id", name="todo_assignments_unique"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    todo_id: Mapped[int] = mapped_column(ForeignKey("todos.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TodoTemplate(Base):
    __tablename__ = "todo_templates"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    template_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    stage: Mapped[str] = mapped_column(String(30), default="planning")
    priority: Mapped[int] = mapped_column(SmallInteger, default=3)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Retrospective(Base):
    __tablename__ = "retrospectives"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    what_went_well: Mapped[str | None] = mapped_column(Text)
    what_went_badly: Mapped[str | None] = mapped_column(Text)
    lessons_learned: Mapped[str | None] = mapped_column(Text)
    next_actions: Mapped[str | None] = mapped_column(Text)


class FailureStory(Base):
    __tablename__ = "failure_stories"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    problem_summary: Mapped[str] = mapped_column(Text, nullable=False)
    root_cause: Mapped[str | None] = mapped_column(Text)
    attempted_solutions: Mapped[str | None] = mapped_column(Text)
    lessons_learned: Mapped[str | None] = mapped_column(Text)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)


class AdoptionRequest(Base):
    __tablename__ = "adoption_requests"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    message: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("project_id", "reviewer_id", "reviewee_id", name="reviews_unique"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    reviewer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reviewee_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    teamwork_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    contribution_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    responsibility_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserRatingAggregate(Base):
    __tablename__ = "user_rating_aggregates"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0)
    avg_teamwork: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=0)
    avg_contribution: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=0)
    avg_responsibility: Mapped[Decimal] = mapped_column(Numeric(4, 2), default=0)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price_krw: Mapped[int] = mapped_column(Integer, nullable=False)
    cycle: Mapped[str] = mapped_column(String(20), nullable=False)
    features: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class UserSubscription(Base):
    __tablename__ = "user_subscriptions"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_id: Mapped[int] = mapped_column(ForeignKey("subscription_plans.id", ondelete="RESTRICT"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    current_period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    current_period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    cancel_at_period_end: Mapped[bool] = mapped_column(Boolean, default=False)
    external_subscription_id: Mapped[str | None] = mapped_column(String(100))


class PaymentEvent(Base):
    __tablename__ = "payment_events"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    user_subscription_id: Mapped[int | None] = mapped_column(ForeignKey("user_subscriptions.id", ondelete="SET NULL"))
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_event_id: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class ChatRoom(Base):
    __tablename__ = "chat_rooms"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str | None] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("chat_rooms.id", ondelete="CASCADE"), nullable=False)
    sender_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    message: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    target_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    target_project_id: Mapped[int | None] = mapped_column(ForeignKey("projects.id", ondelete="SET NULL"))
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open")
    handled_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    handled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CommunityPost(Base):
    __tablename__ = "community_posts"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(50), default="general")
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    view_count: Mapped[int] = mapped_column(BigInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CommunityPostComment(Base):
    __tablename__ = "community_post_comments"

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    parent_comment_id: Mapped[int | None] = mapped_column(ForeignKey("community_post_comments.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CommunityPostReaction(Base):
    __tablename__ = "community_post_reactions"
    __table_args__ = (UniqueConstraint("post_id", "user_id", "reaction_type", name="community_post_reactions_unique"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("community_posts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CommunityCommentReaction(Base):
    __tablename__ = "community_comment_reactions"
    __table_args__ = (UniqueConstraint("comment_id", "user_id", "reaction_type", name="community_comment_reactions_unique"),)

    id: Mapped[int] = mapped_column(ID_TYPE, primary_key=True, autoincrement=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("community_post_comments.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
