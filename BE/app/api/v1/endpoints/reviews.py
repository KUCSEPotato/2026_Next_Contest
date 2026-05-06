from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.v1.response import success_response
from app.db.session import get_db
from app.dependencies.auth import get_current_user_id
from app.models import Project
from app.models import Review
from app.models import User
from app.models import UserRatingAggregate

router = APIRouter()


@router.post("/projects/{project_id}", summary="리뷰 생성", description="특정 프로젝트 맥락에서 동료 리뷰를 생성합니다.")
async def create_project_review(
    project_id: int,
    payload: dict = Body(default={}),
    current_user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict:
    """프로젝트 리뷰 생성 API.

    Swagger 테스트 방법:
    - Authorization 헤더를 설정합니다.
    - body 예시: reviewee_id/teamwork_score/contribution_score/responsibility_score/comment

    검증/처리:
    - reviewee_id 필수
    - 자기 자신 리뷰 금지
    - 리뷰 저장 후 대상 사용자의 평점 집계를 즉시 재계산합니다.
    """
    reviewee_id = payload.get("reviewee_id")
    if not reviewee_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="reviewee_id is required")
    if reviewee_id == current_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot review yourself")

    review = Review(
        project_id=project_id,
        reviewer_id=current_user_id,
        reviewee_id=reviewee_id,
        teamwork_score=payload.get("teamwork_score", 3),
        contribution_score=payload.get("contribution_score", 3),
        responsibility_score=payload.get("responsibility_score", 3),
        comment=payload.get("comment"),
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    aggregate_row = (
        db.query(
            func.count(Review.id),
            func.avg(Review.teamwork_score),
            func.avg(Review.contribution_score),
            func.avg(Review.responsibility_score),
        )
        .filter(Review.reviewee_id == reviewee_id)
        .one()
    )
    agg = db.get(UserRatingAggregate, reviewee_id)
    if agg is None:
        agg = UserRatingAggregate(user_id=reviewee_id)
        db.add(agg)
    agg.review_count = int(aggregate_row[0] or 0)
    agg.avg_teamwork = round(float(aggregate_row[1] or 0), 2)
    agg.avg_contribution = round(float(aggregate_row[2] or 0), 2)
    agg.avg_responsibility = round(float(aggregate_row[3] or 0), 2)
    db.commit()
    return success_response(data={"id": review.id})


@router.get("/projects/{project_id}", summary="프로젝트 리뷰 목록", description="프로젝트 리뷰 목록을 조회합니다.")
async def list_project_reviews(project_id: int, db: Session = Depends(get_db)) -> dict:
    """프로젝트 리뷰 목록 조회 API.

    Swagger 테스트 방법:
    - path의 `project_id`를 전달합니다.
    - 최신 리뷰부터 반환합니다.
    """
    reviews = db.query(Review).filter(Review.project_id == project_id).order_by(Review.created_at.desc()).all()
    result = []
    for review in reviews:
        reviewer = db.get(User, review.reviewer_id)
        reviewee = db.get(User, review.reviewee_id)
        result.append(
            {
                "id": review.id,
                "reviewer": {
                    "id": reviewer.id,
                    "nickname": reviewer.nickname,
                    "avatar_url": reviewer.avatar_url,
                },
                "reviewee": {
                    "id": reviewee.id,
                    "nickname": reviewee.nickname,
                },
                "teamwork_score": review.teamwork_score,
                "contribution_score": review.contribution_score,
                "responsibility_score": review.responsibility_score,
                "comment": review.comment,
                "created_at": review.created_at,
            }
        )
    return success_response(data=result)


@router.get("/users/{user_id}", summary="사용자 리뷰 목록", description="특정 사용자가 받은 리뷰 목록을 조회합니다.")
async def list_user_reviews(user_id: int, db: Session = Depends(get_db)) -> dict:
    """사용자 수신 리뷰 목록 API.

    Swagger 테스트 방법:
    - path의 `user_id`를 전달합니다.
    - 해당 사용자가 reviewee인 리뷰를 최신순으로 반환합니다.
    """
@router.get("/users/{user_id}", summary="사용자 리뷰 목록", description="특정 사용자가 받은 리뷰 목록을 조회합니다.")
async def list_user_reviews(user_id: int, db: Session = Depends(get_db)) -> dict:
    """사용자 수신 리뷰 목록 API.

    Swagger 테스트 방법:
    - path의 `user_id`를 전달합니다.
    - 해당 사용자가 reviewee인 리뷰를 최신순으로 반환합니다.
    """
    reviews = db.query(Review).filter(Review.reviewee_id == user_id).order_by(Review.created_at.desc()).all()
    result = []
    for review in reviews:
        reviewer = db.get(User, review.reviewer_id)
        project = db.get(Project, review.project_id)
        result.append(
            {
                "id": review.id,
                "reviewer": {
                    "id": reviewer.id,
                    "nickname": reviewer.nickname,
                    "avatar_url": reviewer.avatar_url,
                },
                "project": {
                    "id": project.id,
                    "title": project.title,
                },
                "teamwork_score": review.teamwork_score,
                "contribution_score": review.contribution_score,
                "responsibility_score": review.responsibility_score,
                "comment": review.comment,
                "created_at": review.created_at,
            }
        )
    return success_response(data=result)


@router.get("/users/{user_id}/rating", summary="사용자 평점 조회", description="사용자 평점 집계 정보를 조회합니다.")
async def get_user_rating(user_id: int, db: Session = Depends(get_db)) -> dict:
    """사용자 평점 집계 조회 API.

    Swagger 테스트 방법:
    - path의 `user_id`를 전달합니다.

    검증:
    - 집계 데이터가 없으면 `404`를 반환합니다.
    """
    agg = db.get(UserRatingAggregate, user_id)
    if agg is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rating aggregate not found")
    return success_response(
        data={
            "user_id": user_id,
            "review_count": agg.review_count,
            "avg_teamwork": float(agg.avg_teamwork),
            "avg_contribution": float(agg.avg_contribution),
            "avg_responsibility": float(agg.avg_responsibility),
        }
    )
