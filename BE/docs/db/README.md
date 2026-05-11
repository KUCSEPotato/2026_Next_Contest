# DB Schema Package (PostgreSQL)

이 폴더는 Devory 백엔드의 PostgreSQL 기준 DB 설계 산출물을 담는다.

## 파일 구성
- 01_postgresql_schema.sql: 테이블, enum, 제약조건, 인덱스, 트리거를 포함한 실행 가능한 DDL
- 02_erd.md: 핵심 테이블 관계 ERD(mermaid)
- 03_add_idea_tech_stack_hashtags.sql: 기존 ideas 테이블에 tech_stack/hashtags 컬럼을 추가하는 보정 스크립트
- 04_postgresql_schema_with_idea_tech_stack_hashtags_backfill.sql: 01+03 통합 버전(전체 스키마 + ideas tech_stack/hashtags 보정)

## 적용 순서
1. PostgreSQL 데이터베이스 생성
2. 01_postgresql_schema.sql 실행
3. 기존 DB가 있으면 03_add_idea_tech_stack_hashtags.sql 실행
4. 02_erd.md로 구조 검토

### 최근 마이그레이션 파일
- `12_add_user_onboarding_fields.sql` — 사용자 온보딩 필드(`name`, `phone_number`, `onboarding_step`, `onboarding_completed_at`)를 추가합니다. 기존 사용자에는 `onboarding_step` 기본값으로 `'completed'`가 설정되어 서비스 동작을 방해하지 않습니다.
- `17_add_comment_anonymous.sql` — 댓글 익명 처리용 `is_anonymous` 컬럼 추가 및 인덱스 생성.
- `18_add_file_upload_support.sql` — 게시물/아이디어 파일 추적 테이블 생성(soft-delete, s3_key, s3_url 등).
- `19_extend_recruitment_fields.sql` — `project_recruitments` 테이블에 `category`, `difficulty`, `summary`, `deadline` 및 인덱스 추가.
- `20_create_chat_room_members.sql` — 채팅방 참여자 관리용 `chat_room_members` 테이블 생성. 리더가 채팅방 생성 시 특정 멤버만 선택 가능하게 함. 액세스 제어: 메시지 조회/전송, 웹소켓 접근을 `ChatRoomMember`로 제한.

### 통합 실행 옵션
- 전체 스키마와 ideas tech_stack/hashtags 보정을 한 번에 적용하려면 04_postgresql_schema_with_idea_tech_stack_hashtags_backfill.sql을 실행
- 이 옵션은 01/03을 대체하기 위한 것이 아니라, 통합 실행 편의를 위한 보조 스크립트

### 마이그레이션 적용 권장 절차
1. 변경 전 데이터베이스 백업을 만듭니다 (예: `pg_dump`).
2. 테스트/스테이징 환경에서 스크립트를 먼저 실행해 문제가 없는지 확인합니다.
3. 마이그레이션 실행 예 (psql):

```bash
# from CI runner or admin machine with psql access
psql -U <db_user> -h <db_host> -d <db_name> -f BE/docs/db/12_add_user_onboarding_fields.sql
psql -U <db_user> -h <db_host> -d <db_name> -f BE/docs/db/17_add_comment_anonymous.sql
psql -U <db_user> -h <db_host> -d <db_name> -f BE/docs/db/18_add_file_upload_support.sql
psql -U <db_user> -h <db_host> -d <db_name> -f BE/docs/db/19_extend_recruitment_fields.sql
psql -U <db_user> -h <db_host> -d <db_name> -f BE/migrations/versions/20_create_chat_room_members.sql
```

4. 마이그레이션 후 애플리케이션을 재시작하거나 컨테이너를 재배포합니다.

### 주의 사항(특히 `12_add_user_onboarding_fields.sql`)
- 이 마이그레이션은 기존 사용자에 대해 `onboarding_step`을 `'completed'`로 기본 설정합니다. 만약 기존 사용자에게 온보딩을 다시 진행시키고자 한다면, 배포 후 별도 스크립트로 `onboarding_step` 값을 조정해야 합니다.
- 마이그레이션 스크립트는 idempotent하게 작성되어 있으나, 실행 전 백업을 권장합니다.

## 설계 원칙
- soft delete: 주요 테이블에 deleted_at 컬럼
- 감사 추적: created_at, updated_at
- 성능: 조회 패턴 중심 인덱스 선반영
- 데이터 무결성: UNIQUE, CHECK, FK 제약 적극 사용
