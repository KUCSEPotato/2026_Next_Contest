# Devory PostgreSQL ERD

아래 ERD는 01_postgresql_schema.sql 기준의 핵심 관계를 요약한 다이어그램이다.

```mermaid
erDiagram
    USERS ||--o{ USER_SKILLS : has
    SKILLS ||--o{ USER_SKILLS : mapped

    USERS ||--o{ IDEAS : writes
    IDEAS ||--o{ IDEA_BOOKMARKS : bookmarked
    USERS ||--o{ IDEA_BOOKMARKS : bookmarks
    IDEAS ||--o{ IDEA_LIKES : liked
    USERS ||--o{ IDEA_LIKES : likes

    IDEAS o|--o{ PROJECTS : promoted_to
    USERS ||--o{ PROJECTS : leads
    PROJECTS ||--o{ PROJECT_MEMBERS : has
    USERS ||--o{ PROJECT_MEMBERS : joins

    PROJECTS ||--o{ PROJECT_MILESTONES : tracks
    PROJECTS ||--o{ PROJECT_RECRUITMENTS : recruits

    PROJECTS ||--o{ APPLICATIONS : receives
    USERS ||--o{ APPLICATIONS : applies

    PROJECTS ||--o{ INVITATIONS : sends
    USERS ||--o{ INVITATIONS : invites

    PROJECTS ||--o{ TODOS : contains
    USERS o|--o{ TODOS : assigned

    PROJECTS ||--o{ RETROSPECTIVES : documents
    USERS ||--o{ RETROSPECTIVES : writes

    PROJECTS ||--o{ FAILURE_STORIES : records
    USERS ||--o{ FAILURE_STORIES : writes

    PROJECTS ||--o{ ADOPTION_REQUESTS : requested
    USERS ||--o{ ADOPTION_REQUESTS : requests

    PROJECTS ||--o{ REVIEWS : evaluated_in
    USERS ||--o{ REVIEWS : reviewer
    USERS ||--o{ REVIEWS : reviewee
    USERS ||--|| USER_RATING_AGGREGATES : aggregated

    SUBSCRIPTION_PLANS ||--o{ USER_SUBSCRIPTIONS : purchased
    USERS ||--o{ USER_SUBSCRIPTIONS : owns
    USER_SUBSCRIPTIONS ||--o{ PAYMENT_EVENTS : logs

    PROJECTS ||--o{ CHAT_ROOMS : has
    CHAT_ROOMS ||--o{ CHAT_MESSAGES : contains
    USERS o|--o{ CHAT_MESSAGES : sends

    USERS ||--o{ NOTIFICATIONS : receives

    USERS ||--o{ REPORTS : reports
    USERS o|--o{ REPORTS : target_user
    PROJECTS o|--o{ REPORTS : target_project
```

## 관계 해설 요약
- users는 아이디어/프로젝트/지원/리뷰/알림의 중심 엔티티다.
- projects는 협업 실행 단위이며 members, applications, todos, reviews를 가진다.
- subscriptions는 plans -> user_subscriptions -> payment_events로 결제 이력을 추적한다.
- reports는 유저 또는 프로젝트를 신고 대상으로 가질 수 있다.
