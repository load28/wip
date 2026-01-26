# 업무 관리 툴 설계 문서

## 개요

Next.js 기반의 범용 업무 관리 툴 (개인/회사 업무 관리)

**작성일**: 2025-01-26

---

## 1. 기술 스택

### 프론트엔드
| 항목 | 기술 |
|------|------|
| 프레임워크 | Next.js (App Router, PPR) |
| UI 라이브러리 | MUI + Tailwind CSS |
| 상태 관리 | Jotai |
| GraphQL 클라이언트 | Relay |
| 실시간 협업 | Yjs + WebSocket |
| 테스트 | Vitest + React Testing Library |
| 폼 관리 | React Hook Form + Zod |
| 국제화 | react-i18next |

### 백엔드
| 항목 | 기술 |
|------|------|
| 프레임워크 | Rust + Actix-web |
| GraphQL | async-graphql (Relay 스펙) |
| 데이터베이스 | SQLite (향후 PostgreSQL 마이그레이션 가능) |
| 인증 | Google OAuth + JWT |

---

## 2. 아키텍처

### 전체 구조

```
┌─────────────────┐     ┌─────────────────────────────────┐
│   Next.js App   │     │        Backend (Rust)           │
│                 │     │                                 │
│  - Relay Client │────▶│  async-graphql (Relay 스펙)     │
│  - Jotai        │ GQL │         ↓                       │
│  - Yjs Client   │     │    Actix-web                    │
│                 │◀───▶│    SQLite + WebSocket           │
└─────────────────┘ WS  └─────────────────────────────────┘
```

### 통신 구조

| 엔드포인트 | 프로토콜 | 용도 |
|-----------|---------|------|
| `/graphql` | HTTP | Query, Mutation |
| `/graphql/ws` | WebSocket | Subscription |
| `/ws/collab` | WebSocket | Yjs 실시간 협업 |

**중요**: REST 엔드포인트 없음. 모든 통신은 GraphQL + WebSocket으로 처리.

### Next.js 렌더링 전략

| 사용함 | 사용 안 함 |
|--------|-----------|
| App Router (라우팅) | Server Action |
| 클라이언트 컴포넌트 | API Routes |
| PPR (정적 셸 + 동적 콘텐츠) | 서버 컴포넌트에서 데이터 fetch |

---

## 3. FSD (Feature-Sliced Design) 구조

```
src/
├── app/                          # 앱 초기화, 라우팅, 프로바이더
│   ├── providers/
│   ├── styles/
│   ├── routes/
│   └── index.tsx
│
├── pages/                        # 페이지 단위 컴포넌트
│   ├── home/
│   ├── project/
│   └── settings/
│
├── widgets/                      # 독립적인 UI 블록
│   ├── task-board/
│   ├── task-list/
│   ├── task-calendar/
│   └── sidebar/
│
├── features/                     # 재사용 가능한 기능
│   ├── create-task/
│   ├── drag-drop-task/
│   ├── assign-user/
│   ├── auth/
│   └── real-time-sync/
│
├── entities/                     # 비즈니스 엔티티
│   ├── task/
│   ├── project/
│   ├── user/
│   └── comment/
│
└── shared/                       # 공통 유틸리티
    ├── ui/
    ├── api/
    ├── lib/
    ├── config/
    ├── store/
    └── types/
```

### FSD 핵심 규칙

- 상위 레이어는 하위 레이어만 import 가능 (Pages → Widgets → Features → Entities → Shared)
- 같은 레이어 간 import는 `@x` 표기법으로만 허용 (주로 Entities에서)
- 각 슬라이스는 `index.ts`로 Public API 정의

### 세그먼트 구조

| 세그먼트 | 용도 |
|---------|------|
| `ui/` | UI 컴포넌트 |
| `model/` | 상태, 비즈니스 로직, 훅 |
| `api/` | Relay fragments, GraphQL 관련 |
| `lib/` | 유틸 함수 |
| `config/` | 설정, 상수 |

---

## 4. 컴포넌트 설계 규칙

### 분리 기준

| 기준 | 조건 | 액션 |
|------|------|------|
| 줄 수 | 150줄 초과 | 하위 컴포넌트로 분리 |
| 재사용 | 2회 이상 사용 | 공통 컴포넌트로 추출 |
| 로직 복잡도 | 30줄 이상 | 커스텀 훅으로 분리 |
| 책임 | 복수의 역할 | 역할별 컴포넌트 분리 |

### 로직 분리 규칙

- 간단한 로직: 컴포넌트 내 유지
- 복잡한 로직 (30줄 이상): 커스텀 훅으로 분리

---

## 5. 상태 관리 (Jotai)

### 상태 분류 기준

| 조건 | 위치 | 예시 |
|------|------|------|
| 앱 전역 + 페이지 이동 후 유지 | `shared/store/` | 인증, 테마 |
| 도메인 관련 + 여러 컴포넌트 공유 | `entities/*/model/` | 선택된 태스크 |
| 기능 관련 + 해당 기능 내 공유 | `features/*/model/` | 폼 입력값 |
| 단일 컴포넌트 | `useState` | 드롭다운 열림 상태 |

### 파일 구조

```
src/
├── shared/
│   └── store/
│       ├── auth.ts       # 인증 상태
│       ├── theme.ts      # 테마 상태
│       ├── ui.ts         # UI 상태
│       └── index.ts
│
├── entities/
│   └── task/
│       └── model/
│           └── task.atom.ts
│
├── features/
│   └── create-task/
│       └── model/
│           └── form.atom.ts
```

---

## 6. 인증 설계

### Google OAuth 흐름

```
1. 클라이언트 → Google OAuth 로그인
2. Google → 클라이언트 (code 반환)
3. 클라이언트 → loginWithGoogle mutation (code 전달)
4. 서버:
   - Google에 code → token 교환
   - Google에서 사용자 정보 조회
   - DB에 사용자 저장/업데이트
   - Access Token (JWT, 1시간) 생성
   - Refresh Token (랜덤, 30일) 생성 → DB 저장
   - CSRF Token 생성 → DB 저장
   - Set-Cookie (HttpOnly, Secure, SameSite=Lax)
5. 클라이언트 ← LoginPayload (user, csrfToken)
```

### 토큰 관리

| 토큰 | 만료 시간 | 저장 위치 |
|------|----------|----------|
| Access Token | 1시간 | HttpOnly Cookie |
| Refresh Token | 30일 | HttpOnly Cookie + DB |
| CSRF Token | 세션 유지 | DB + 클라이언트 메모리 |

### 보안

- **쿠키 설정**: `HttpOnly; Secure; SameSite=Lax`
- **CSRF 보호**: SameSite 쿠키 (1차) + Synchronizer Token (2차)

---

## 7. 에러 핸들링

### 에러 분류 및 처리

| 에러 종류 | 처리 위치 | UI 표시 | 복구 방식 |
|----------|----------|---------|----------|
| 401 Unauthorized | 중앙 | 로그인 모달 | 재로그인 |
| 500 Server Error | 중앙 | Toast | 자동 재시도 (3회) |
| 네트워크 에러 | 중앙 | Toast | 자동 재시도 (3회) |
| 폼 유효성 에러 | 컴포넌트 | 인라인 | 사용자 수정 |
| 비즈니스 에러 | 컴포넌트 | Toast/인라인 | 사용자 액션 |
| 렌더링 에러 | Error Boundary | Fallback UI | 재시도 버튼 |

### Error Boundary 계층

```tsx
<AppErrorBoundary fallback={<FullPageError />}>
  <Layout>
    <PageErrorBoundary fallback={<PageError />}>
      <WidgetErrorBoundary fallback={<WidgetError />}>
        <TaskBoard />
      </WidgetErrorBoundary>
    </PageErrorBoundary>
  </Layout>
</AppErrorBoundary>
```

---

## 8. 폼 관리

### 스택

- **라이브러리**: React Hook Form
- **유효성 검사**: Zod
- **에러 메시지**: i18n 연동

### 파일 구조

```
features/create-task/
├── model/
│   ├── schema.ts           # Zod 스키마
│   └── useCreateTaskForm.ts
└── ui/
    └── CreateTaskForm.tsx
```

### 예시

```tsx
// schema.ts
import { z } from 'zod';
import i18n from '@/shared/lib/i18n';

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, { message: i18n.t('task.form.titleRequired') }),
});
```

---

## 9. 테스트 설계

### 스택

- **프레임워크**: Vitest + React Testing Library
- **E2E**: 없음
- **커버리지 목표**: 80% 이상

### TDD 원칙

- 컴포넌트/훅 작성 전 반드시 테스트 먼저 작성
- 테스트가 곧 스펙 문서 역할

### 스타일별 적용

| 대상 | TDD 스타일 | 형식 |
|------|-----------|------|
| 유틸 함수 (`lib/`) | Classic | describe → it |
| 커스텀 훅 (`model/`) | Classic | describe → it |
| UI 컴포넌트 (`ui/`) | BDD | describe → context → it |
| 사용자 시나리오 | BDD | Given-When-Then |

### 테스트 파일 위치

- 소스 파일 옆에 colocate: `TaskCard.tsx` → `TaskCard.test.tsx`

### 테스트 명세 언어

- **한글** 사용: `it('태스크를 생성하면 목록에 추가된다')`

### BDD 헬퍼

```tsx
// shared/lib/test-utils.ts
export const context = describe;
export const given = describe;
export const when = describe;
export const then = it;
```

---

## 10. 국제화 (i18n)

### 스택

- **라이브러리**: react-i18next
- **지원 언어**: 한국어, 영어 (확장 가능)

### 파일 구조

```
shared/lib/i18n/
├── index.ts
├── locales/
│   ├── ko.json
│   └── en.json
└── types.ts
```

### 번역 키 네이밍

- **규칙**: `페이지.컴포넌트.항목`
- **예시**: `project.form.title`, `task.card.dueDate`

---

## 11. 로딩/스켈레톤

### 구현 방식

- **복잡한 UI**: 전용 스켈레톤 컴포넌트
- **단순 UI**: 범용 스켈레톤 조합

### 파일 위치

- **범용**: `shared/ui/skeleton/`
- **전용**: 원본 컴포넌트와 함께 (`TaskCard.skeleton.tsx`)

### Suspense 활용

```tsx
<Suspense fallback={<TaskBoardSkeleton />}>
  <TaskBoard />
</Suspense>
```

---

## 12. 라우팅

### URL 구조

| 경로 | 설명 | 인증 |
|------|------|------|
| `/` | 랜딩 페이지 | 공개 |
| `/login` | 로그인 페이지 | 공개 |
| `/callback` | OAuth 콜백 | 공개 |
| `/dashboard` | 대시보드 | 필요 |
| `/board/:projectId` | 칸반 보드 뷰 | 필요 |
| `/list/:projectId` | 리스트 뷰 | 필요 |
| `/calendar/:projectId` | 캘린더 뷰 | 필요 |
| `/settings` | 설정 | 필요 |

### 인증 가드

- **방식**: 레이아웃 래퍼 (AuthGuard 컴포넌트)
- **미들웨어 사용 안 함** (보안 이슈)
- **동작**:
  - 보호된 페이지 직접 접근 → 리다이렉트
  - 세션 만료 → 모달 표시

---

## 13. 코드 스타일

### 도구

| 도구 | 설정 |
|------|------|
| ESLint | Next.js 기본 (`eslint-config-next`) |
| Prettier | 기본값 |
| commitlint | Conventional Commits |
| husky | pre-commit, commit-msg 훅 |
| lint-staged | 스테이징 파일 린트/포맷 |

### 커밋 메시지

- **형식**: Conventional Commits
- **언어**: 한글
- **예시**: `feat: 태스크 생성 폼 추가`

### 커밋 타입

| 타입 | 용도 |
|------|------|
| feat | 새 기능 |
| fix | 버그 수정 |
| docs | 문서 |
| style | 코드 스타일 |
| refactor | 리팩토링 |
| test | 테스트 |
| chore | 빌드, 설정 |

---

## 14. 오프라인 지원

### 범위

- 오프라인에서 생성/수정/삭제 모두 가능
- CRDT (Yjs)가 충돌 자동 해결

### 저장소

- **Yjs + y-indexeddb**: 문서 자동 persist

### 상태 표시

- **아이콘만**: 상태바에 연결 상태 아이콘 표시 (online/offline/syncing)

---

## 15. 백엔드 구조

### 프로젝트 구조

```
backend/
├── src/
│   ├── main.rs
│   ├── config/
│   ├── db/
│   ├── graphql/
│   │   ├── schema.rs
│   │   ├── query.rs
│   │   ├── mutation.rs
│   │   ├── subscription.rs
│   │   └── types/
│   ├── auth/
│   │   ├── google.rs
│   │   ├── jwt.rs
│   │   ├── csrf.rs
│   │   └── middleware.rs
│   ├── ws/
│   │   ├── graphql_ws.rs
│   │   └── collab_ws.rs
│   └── services/
├── Cargo.toml
└── .env
```

### GraphQL 스키마

- **Relay 스펙 준수**: Node 인터페이스, Connection 패턴, Mutation input/payload
- **주요 타입**: User, Project, Task, Comment
- **태스크 중첩**: 무한 서브태스크 지원 (parent_id 참조)

### 데이터베이스 스키마

```sql
-- 주요 테이블
users, refresh_tokens, csrf_tokens, projects,
project_members, tasks, comments

-- 권한
project_members.role: 'viewer' | 'editor' | 'admin'

-- 태스크 상태
tasks.status: 'TODO' | 'IN_PROGRESS' | 'DONE'
tasks.priority: 'LOW' | 'MEDIUM' | 'HIGH'
```

---

## 16. 설계 검증 프로세스

### 검증 흐름

```
1. 태스크 시작
   └── 이슈 생성

2. 구현
   └── 설계 문서 참조하며 개발

3. 작업 리뷰 (자체 검증)
   └── 검증 리포트 작성
   └── 설계 문서 vs 구현 대조

4. 수정
   └── 검증 결과 기반 미준수 항목 수정
   └── 리포트 업데이트

5. 완료 (100% 준수 시)
   └── 리포트 저장 (docs/reviews/ + 이슈)
   └── PR 생성 가능
```

### 검증 리포트 저장 위치

- `docs/reviews/TASK-XXX-제목.md`
- 이슈 트래커에 첨부

### 검증 체크리스트 항목

1. 아키텍처 (FSD)
2. 컴포넌트 규칙
3. 상태 관리 (Jotai)
4. 폼 관리
5. 에러 핸들링
6. 테스트 (TDD)
7. 스타일/UI
8. 국제화
9. 코드 스타일
10. 통신

---

## 17. UI 디자인

- 엔터프라이즈 수준에 맞게 적절히 구현
- MUI 컴포넌트 기반 + Tailwind 커스터마이징

---

## 부록: 검증 리포트 템플릿

```markdown
# 검증 리포트: TASK-XXX 제목

## 기본 정보
- **태스크 ID**: TASK-XXX
- **PR**: #XXX
- **작성자**:
- **검증일**: YYYY-MM-DD

---

## 1. 아키텍처 (FSD)

| 항목 | 설계 규칙 | 준수 | 비고 |
|------|----------|:----:|------|
| 레이어 배치 | | | |
| 세그먼트 구조 | | | |
| import 규칙 | | | |
| Public API | | | |

## 2. 컴포넌트 규칙

| 항목 | 설계 규칙 | 준수 | 비고 |
|------|----------|:----:|------|
| 줄 수 | 150줄 이하 | | |
| 로직 분리 | 30줄 이상 시 훅 분리 | | |
| 재사용 | 2회 이상 시 추출 | | |

## 3. 상태 관리 (Jotai)

| 항목 | 설계 규칙 | 준수 | 비고 |
|------|----------|:----:|------|
| 전역 상태 위치 | shared/store/ | | |
| 도메인 상태 위치 | entities/*/model/ | | |
| 기능 상태 위치 | features/*/model/ | | |

## 4. 폼 관리

| 항목 | 설계 규칙 | 준수 | 비고 |
|------|----------|:----:|------|
| 라이브러리 | React Hook Form | | |
| 유효성 검사 | Zod | | |
| 스키마 위치 | model/schema.ts | | |
| 에러 메시지 | i18n 연동 | | |

## 5. 에러 핸들링

| 항목 | 설계 규칙 | 준수 | 비고 |
|------|----------|:----:|------|
| API 에러 | 중앙/컴포넌트 분리 | | |
| 에러 UI | 심각도별 분리 | | |
| Error Boundary | 계층적 적용 | | |

## 6. 테스트 (TDD)

| 항목 | 설계 규칙 | 준수 | 비고 |
|------|----------|:----:|------|
| 테스트 파일 위치 | 소스 옆 colocate | | |
| 커버리지 | 80% 이상 | | |
| 훅 테스트 | 단위 테스트 | | |
| 컴포넌트 테스트 | BDD 스타일 통합 | | |
| 테스트 언어 | 한글 명세 | | |

## 7. 스타일/UI

| 항목 | 설계 규칙 | 준수 | 비고 |
|------|----------|:----:|------|
| UI 라이브러리 | MUI + Tailwind | | |
| 스켈레톤 | 범용/전용 혼합 | | |

## 8. 국제화

| 항목 | 설계 규칙 | 준수 | 비고 |
|------|----------|:----:|------|
| 라이브러리 | react-i18next | | |
| 키 네이밍 | 페이지.컴포넌트.항목 | | |

## 9. 코드 스타일

| 항목 | 설계 규칙 | 준수 | 비고 |
|------|----------|:----:|------|
| ESLint | Next.js 기본 | | |
| Prettier | 기본 설정 | | |
| 커밋 메시지 | Conventional (한글) | | |

## 10. 통신

| 항목 | 설계 규칙 | 준수 | 비고 |
|------|----------|:----:|------|
| 데이터 통신 | GraphQL (Relay) | | |
| REST 사용 안 함 | - | | |

---

## 종합 결과

- **총 항목**:
- **준수**:
- **미준수**:
- **해당없음**:
- **준수율**: %

## 미준수 항목 상세

(미준수 항목이 있을 경우 상세 내용 기록)

## 수정 이력

| 날짜 | 수정 내용 |
|------|----------|
| | |

---

## 승인

- [ ] 자체 검증 완료 (100% 준수)
```
