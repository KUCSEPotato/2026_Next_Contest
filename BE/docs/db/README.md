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

### 통합 실행 옵션
- 전체 스키마와 ideas tech_stack/hashtags 보정을 한 번에 적용하려면 04_postgresql_schema_with_idea_tech_stack_hashtags_backfill.sql을 실행
- 이 옵션은 01/03을 대체하기 위한 것이 아니라, 통합 실행 편의를 위한 보조 스크립트

## 설계 원칙
- soft delete: 주요 테이블에 deleted_at 컬럼
- 감사 추적: created_at, updated_at
- 성능: 조회 패턴 중심 인덱스 선반영
- 데이터 무결성: UNIQUE, CHECK, FK 제약 적극 사용
