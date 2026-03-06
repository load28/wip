# Passkey(WebAuthn) 로그인 기능 설계

## 개요
기존 Google OAuth 로그인에 더해 Passkey(WebAuthn) 로그인을 추가한다.
사용자는 설정 페이지에서 패스키를 등록하고, 로그인 페이지에서 Conditional UI를 통해 패스키로 인증할 수 있다.

## 기술 스택
- **백엔드**: webauthn-rs 크레이트, actix-web REST 엔드포인트
- **프론트엔드**: Web Authentication API (navigator.credentials), Conditional UI
- **DB**: SQLite (sqlx) — passkey_credentials 테이블 추가

## 아키텍처

```
[로그인 페이지]
  ├── Google 로그인 버튼 (기존)
  └── Conditional UI (autocomplete="webauthn")
        ↓ navigator.credentials.get()
[REST 엔드포인트]
  POST /api/webauthn/register/begin    → challenge 발급
  POST /api/webauthn/register/finish   → 공개키 저장
  POST /api/webauthn/auth/begin        → challenge 발급
  POST /api/webauthn/auth/finish       → 서명 검증 → JWT 발급
[SQLite] passkey_credentials 테이블
```

## DB 스키마 변경

### users 테이블
- `google_id`: NOT NULL → NULL 허용 (패스키 전용 사용자 지원)

### 새 테이블: passkey_credentials
```sql
CREATE TABLE passkey_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_json TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'My Passkey',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    last_used_at TEXT
);
CREATE INDEX idx_passkey_credentials_user_id ON passkey_credentials(user_id);
```

## 백엔드 모듈 구조

```
src/
  services/webauthn_service.rs     -- WebAuthn 초기화, challenge 관리 (인메모리)
  routes/webauthn.rs               -- REST 핸들러
  repositories/passkey_repository.rs
  models/passkey.rs
```

### WebAuthn 서비스
- `webauthn-rs`의 `Webauthn` 인스턴스를 앱 상태로 관리
- Challenge를 인메모리 HashMap + TTL(5분)로 관리

### REST 엔드포인트
1. **등록 begin**: 로그인 필수. CreationChallengeResponse 반환
2. **등록 finish**: credential 검증 후 DB 저장
3. **인증 begin**: 익명 가능. RequestChallengeResponse 반환 (allowCredentials 비움)
4. **인증 finish**: 서명 검증, userHandle로 사용자 식별, JWT 발급

## 프론트엔드

### 새 파일
- `src/features/auth/api/webauthn.ts` — API 호출 + navigator.credentials 래퍼
- `src/features/auth/ui/PasskeyLoginButton.tsx` — 명시적 패스키 로그인 버튼 (폴백)

### 수정 파일
- `src/app/login/page.tsx` — Conditional UI 적용
- `src/app/settings/page.tsx` — 패스키 등록/관리 UI

## 에러 처리
- 패스키 미지원 브라우저: graceful degradation (버튼 숨김)
- Challenge 만료: 재시도 안내
- 중복 credential: DB unique 제약
