# DB Schema Package (PostgreSQL)

이 폴더는 Devory 백엔드의 PostgreSQL 기준 DB 설계 산출물을 담는다.

## 파일 구성
- 01_postgresql_schema.sql: 테이블, enum, 제약조건, 인덱스, 트리거를 포함한 실행 가능한 DDL
- 02_erd.md: 핵심 테이블 관계 ERD(mermaid)

## 적용 순서
1. PostgreSQL 데이터베이스 생성
2. 01_postgresql_schema.sql 실행
3. 02_erd.md로 구조 검토

## 설계 원칙
- soft delete: 주요 테이블에 deleted_at 컬럼
- 감사 추적: created_at, updated_at
- 성능: 조회 패턴 중심 인덱스 선반영
- 데이터 무결성: UNIQUE, CHECK, FK 제약 적극 사용
