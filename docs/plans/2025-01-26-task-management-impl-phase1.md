# Phase 1: 프로젝트 초기 설정 및 기반 구축 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 프론트엔드와 백엔드의 기본 프로젝트 구조를 설정하고, 개발 환경을 구축한다.

**Architecture:** 프론트엔드(Next.js + FSD)와 백엔드(Rust + Actix-web)는 별도 프로젝트로 분리. 패키지 매니저는 bun 사용.

**Tech Stack:** Next.js 14, Rust, bun, Cargo, ESLint, Prettier, Husky, Vitest

---

## Task 1: 프론트엔드 프로젝트 루트 설정

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/.gitignore`
- Create: `frontend/.nvmrc`

**Step 1: frontend 디렉토리 생성**

```bash
mkdir -p frontend
cd frontend
```

**Step 2: package.json 생성**

```json
{
  "name": "task-management-frontend",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "prepare": "husky"
  },
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@mui/material": "^5.15.0",
    "@mui/icons-material": "^5.15.0",
    "@mui/material-nextjs": "^5.15.0",
    "@emotion/react": "^11.11.0",
    "@emotion/styled": "^11.11.0",
    "jotai": "^2.6.0",
    "react-hook-form": "^7.49.0",
    "@hookform/resolvers": "^3.3.0",
    "zod": "^3.22.0",
    "react-i18next": "^14.0.0",
    "i18next": "^23.7.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.56.0",
    "eslint-config-next": "^14.2.0",
    "prettier": "^3.2.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.2.0",
    "@commitlint/cli": "^18.4.0",
    "@commitlint/config-conventional": "^18.4.0",
    "vitest": "^1.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "@testing-library/react": "^14.1.0",
    "@testing-library/jest-dom": "^6.2.0",
    "@testing-library/user-event": "^14.5.0",
    "jsdom": "^23.2.0",
    "@vitest/coverage-v8": "^1.2.0"
  }
}
```

**Step 3: .gitignore 생성**

```
# Dependencies
node_modules/

# Build
.next/
out/
dist/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Test
coverage/

# Bun
bun.lockb
```

**Step 4: .nvmrc 생성**

```
20
```

**Step 5: 의존성 설치**

```bash
cd frontend && bun install
```

**Step 6: 커밋**

```bash
cd frontend && git init
git add package.json .gitignore .nvmrc bun.lockb
git commit -m "chore: 프론트엔드 프로젝트 초기 설정"
```

---

## Task 2: TypeScript 및 Next.js 설정

**Files:**
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.js`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/postcss.config.js`

**Step 1: tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 2: next.config.js 생성**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    ppr: true,
  },
};

module.exports = nextConfig;
```

**Step 3: tailwind.config.ts 생성**

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    preflight: false, // MUI와 충돌 방지
  },
};

export default config;
```

**Step 4: postcss.config.js 생성**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**Step 5: 커밋**

```bash
git add tsconfig.json next.config.js tailwind.config.ts postcss.config.js
git commit -m "chore: TypeScript, Next.js, Tailwind 설정"
```

---

## Task 3: ESLint, Prettier, Husky, Commitlint 설정

**Files:**
- Create: `frontend/.eslintrc.json`
- Create: `frontend/.prettierrc`
- Create: `frontend/commitlint.config.js`
- Create: `frontend/lint-staged.config.js`
- Create: `frontend/.husky/pre-commit`
- Create: `frontend/.husky/commit-msg`

**Step 1: .eslintrc.json 생성**

```json
{
  "extends": "next/core-web-vitals"
}
```

**Step 2: .prettierrc 생성**

```json
{}
```

**Step 3: commitlint.config.js 생성**

```js
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore']
    ],
    'subject-empty': [2, 'never'],
  },
};
```

**Step 4: lint-staged.config.js 생성**

```js
module.exports = {
  '*.{ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md}': ['prettier --write'],
};
```

**Step 5: Husky 초기화**

```bash
bunx husky init
```

**Step 6: .husky/pre-commit 생성**

```bash
bunx lint-staged
```

**Step 7: .husky/commit-msg 생성**

```bash
bunx --no -- commitlint --edit "$1"
```

**Step 8: 커밋**

```bash
git add .eslintrc.json .prettierrc commitlint.config.js lint-staged.config.js .husky/
git commit -m "chore: ESLint, Prettier, Husky, Commitlint 설정"
```

---

## Task 4: FSD 디렉토리 구조 생성

**Files:**
- Create: FSD 레이어별 디렉토리 및 index.ts

**Step 1: FSD 레이어 디렉토리 생성**

```bash
# app layer
mkdir -p src/app/providers
mkdir -p src/app/styles
mkdir -p src/app/routes

# pages layer
mkdir -p src/pages/home/ui
mkdir -p src/pages/dashboard/ui
mkdir -p src/pages/project/ui
mkdir -p src/pages/settings/ui

# widgets layer
mkdir -p src/widgets/task-board/ui
mkdir -p src/widgets/task-board/model
mkdir -p src/widgets/task-list/ui
mkdir -p src/widgets/task-list/model
mkdir -p src/widgets/task-calendar/ui
mkdir -p src/widgets/task-calendar/model
mkdir -p src/widgets/sidebar/ui

# features layer
mkdir -p src/features/create-task/ui
mkdir -p src/features/create-task/model
mkdir -p src/features/auth/ui
mkdir -p src/features/auth/model
mkdir -p src/features/drag-drop-task/ui
mkdir -p src/features/drag-drop-task/model

# entities layer
mkdir -p src/entities/task/ui
mkdir -p src/entities/task/model
mkdir -p src/entities/task/api
mkdir -p src/entities/project/ui
mkdir -p src/entities/project/model
mkdir -p src/entities/project/api
mkdir -p src/entities/user/ui
mkdir -p src/entities/user/model
mkdir -p src/entities/comment/ui
mkdir -p src/entities/comment/model

# shared layer
mkdir -p src/shared/ui/skeleton
mkdir -p src/shared/ui/error-boundary
mkdir -p src/shared/ui/connection-status
mkdir -p src/shared/api
mkdir -p src/shared/lib/i18n/locales
mkdir -p src/shared/lib/error
mkdir -p src/shared/lib/test-utils
mkdir -p src/shared/store
mkdir -p src/shared/config
mkdir -p src/shared/types
```

**Step 2: shared 레이어 index.ts 파일 생성**

Create `src/shared/ui/index.ts`:
```ts
export * from './skeleton';
export * from './error-boundary';
export * from './connection-status';
```

Create `src/shared/lib/index.ts`:
```ts
export * from './i18n';
export * from './error';
export * from './test-utils';
```

Create `src/shared/store/index.ts`:
```ts
export * from './auth';
export * from './theme';
export * from './ui';
export * from './connection';
```

Create `src/shared/config/index.ts`:
```ts
// 설정 export
```

Create `src/shared/types/index.ts`:
```ts
// 타입 export
```

Create `src/shared/index.ts`:
```ts
export * from './ui';
export * from './lib';
export * from './store';
export * from './config';
export * from './types';
```

**Step 3: entities 레이어 index.ts 파일 생성**

Create `src/entities/task/index.ts`:
```ts
// Task entity public API
```

Create `src/entities/project/index.ts`:
```ts
// Project entity public API
```

Create `src/entities/user/index.ts`:
```ts
// User entity public API
```

Create `src/entities/comment/index.ts`:
```ts
// Comment entity public API
```

Create `src/entities/index.ts`:
```ts
export * from './task';
export * from './project';
export * from './user';
export * from './comment';
```

**Step 4: features 레이어 index.ts 파일 생성**

Create `src/features/create-task/index.ts`:
```ts
// Create task feature public API
```

Create `src/features/auth/index.ts`:
```ts
// Auth feature public API
```

Create `src/features/drag-drop-task/index.ts`:
```ts
// Drag drop task feature public API
```

Create `src/features/index.ts`:
```ts
export * from './create-task';
export * from './auth';
export * from './drag-drop-task';
```

**Step 5: widgets 레이어 index.ts 파일 생성**

Create `src/widgets/task-board/index.ts`:
```ts
// Task board widget public API
```

Create `src/widgets/task-list/index.ts`:
```ts
// Task list widget public API
```

Create `src/widgets/task-calendar/index.ts`:
```ts
// Task calendar widget public API
```

Create `src/widgets/sidebar/index.ts`:
```ts
// Sidebar widget public API
```

Create `src/widgets/index.ts`:
```ts
export * from './task-board';
export * from './task-list';
export * from './task-calendar';
export * from './sidebar';
```

**Step 6: pages 레이어 index.ts 파일 생성**

Create `src/pages/home/index.ts`:
```ts
// Home page public API
```

Create `src/pages/dashboard/index.ts`:
```ts
// Dashboard page public API
```

Create `src/pages/project/index.ts`:
```ts
// Project page public API
```

Create `src/pages/settings/index.ts`:
```ts
// Settings page public API
```

Create `src/pages/index.ts`:
```ts
export * from './home';
export * from './dashboard';
export * from './project';
export * from './settings';
```

**Step 7: 커밋**

```bash
git add src/
git commit -m "chore: FSD 디렉토리 구조 생성"
```

---

## Task 5: Vitest 테스트 환경 설정

**Files:**
- Create: `frontend/vitest.config.ts`
- Create: `frontend/vitest.setup.ts`
- Create: `frontend/src/shared/lib/test-utils/index.ts`

**Step 1: vitest.config.ts 생성**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        '**/*.config.*',
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Step 2: vitest.setup.ts 생성**

```ts
import '@testing-library/jest-dom/vitest';
```

**Step 3: BDD 헬퍼 함수 생성 - src/shared/lib/test-utils/index.ts**

```ts
import { describe, it } from 'vitest';

// BDD 스타일 헬퍼
export const context = describe;
export const given = describe;
export const when = describe;
export const then = it;

// Re-export testing library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
```

**Step 4: 테스트 실행 확인**

Run: `bun test`
Expected: 테스트 파일이 없으므로 "No test files found" 메시지

**Step 5: 커밋**

```bash
git add vitest.config.ts vitest.setup.ts src/shared/lib/test-utils/
git commit -m "chore: Vitest 테스트 환경 설정 및 BDD 헬퍼 추가"
```

---

## Task 6: 국제화 (i18n) 설정

**Files:**
- Create: `frontend/src/shared/lib/i18n/index.ts`
- Create: `frontend/src/shared/lib/i18n/index.test.ts`
- Create: `frontend/src/shared/lib/i18n/locales/ko.json`
- Create: `frontend/src/shared/lib/i18n/locales/en.json`

**Step 1: 실패하는 테스트 작성 - src/shared/lib/i18n/index.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import i18n from './index';

describe('i18n', () => {
  it('한국어가 기본 언어로 설정되어 있다', () => {
    expect(i18n.language).toBe('ko');
  });

  it('번역 키로 한국어 텍스트를 가져올 수 있다', () => {
    const text = i18n.t('common.loading');
    expect(text).toBe('로딩 중...');
  });

  it('영어로 언어를 변경할 수 있다', async () => {
    await i18n.changeLanguage('en');
    const text = i18n.t('common.loading');
    expect(text).toBe('Loading...');
    await i18n.changeLanguage('ko'); // 원복
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `bun test src/shared/lib/i18n/index.test.ts`
Expected: FAIL - "Cannot find module './index'"

**Step 3: src/shared/lib/i18n/locales/ko.json 생성**

```json
{
  "common": {
    "loading": "로딩 중...",
    "error": "오류가 발생했습니다",
    "retry": "다시 시도",
    "save": "저장",
    "cancel": "취소",
    "delete": "삭제",
    "edit": "수정",
    "create": "생성"
  },
  "auth": {
    "login": {
      "button": "Google로 로그인",
      "error": "로그인에 실패했습니다"
    },
    "logout": {
      "button": "로그아웃"
    }
  },
  "project": {
    "form": {
      "title": "프로젝트 이름",
      "description": "설명",
      "submit": "생성하기",
      "cancel": "취소"
    },
    "list": {
      "empty": "프로젝트가 없습니다",
      "create": "새 프로젝트"
    }
  },
  "task": {
    "card": {
      "dueDate": "마감일",
      "assignee": "담당자",
      "priority": "우선순위"
    },
    "form": {
      "title": "제목",
      "titleRequired": "제목을 입력해주세요",
      "titleMaxLength": "제목은 100자 이내로 입력해주세요",
      "description": "설명",
      "descriptionMaxLength": "설명은 1000자 이내로 입력해주세요",
      "submit": "생성",
      "cancel": "취소"
    },
    "status": {
      "todo": "할 일",
      "inProgress": "진행 중",
      "done": "완료"
    },
    "priority": {
      "low": "낮음",
      "medium": "보통",
      "high": "높음"
    }
  },
  "dashboard": {
    "header": {
      "welcome": "환영합니다",
      "description": "업무를 효율적으로 관리하세요"
    }
  },
  "settings": {
    "title": "설정",
    "language": "언어",
    "theme": "테마"
  }
}
```

**Step 4: src/shared/lib/i18n/locales/en.json 생성**

```json
{
  "common": {
    "loading": "Loading...",
    "error": "An error occurred",
    "retry": "Retry",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create"
  },
  "auth": {
    "login": {
      "button": "Login with Google",
      "error": "Login failed"
    },
    "logout": {
      "button": "Logout"
    }
  },
  "project": {
    "form": {
      "title": "Project Name",
      "description": "Description",
      "submit": "Create",
      "cancel": "Cancel"
    },
    "list": {
      "empty": "No projects",
      "create": "New Project"
    }
  },
  "task": {
    "card": {
      "dueDate": "Due Date",
      "assignee": "Assignee",
      "priority": "Priority"
    },
    "form": {
      "title": "Title",
      "titleRequired": "Please enter a title",
      "titleMaxLength": "Title must be 100 characters or less",
      "description": "Description",
      "descriptionMaxLength": "Description must be 1000 characters or less",
      "submit": "Create",
      "cancel": "Cancel"
    },
    "status": {
      "todo": "To Do",
      "inProgress": "In Progress",
      "done": "Done"
    },
    "priority": {
      "low": "Low",
      "medium": "Medium",
      "high": "High"
    }
  },
  "dashboard": {
    "header": {
      "welcome": "Welcome",
      "description": "Manage your tasks efficiently"
    }
  },
  "settings": {
    "title": "Settings",
    "language": "Language",
    "theme": "Theme"
  }
}
```

**Step 5: src/shared/lib/i18n/index.ts 구현**

```ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko.json';
import en from './locales/en.json';

i18n.use(initReactI18next).init({
  resources: {
    ko: { translation: ko },
    en: { translation: en },
  },
  lng: 'ko',
  fallbackLng: 'ko',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
```

**Step 6: 테스트 실행하여 통과 확인**

Run: `bun test src/shared/lib/i18n/index.test.ts`
Expected: PASS

**Step 7: 커밋**

```bash
git add src/shared/lib/i18n/
git commit -m "feat: i18n 설정 및 한국어/영어 번역 파일 추가"
```

---

## Task 7: Jotai 전역 스토어 설정

**Files:**
- Create: `frontend/src/shared/store/auth.ts`
- Create: `frontend/src/shared/store/auth.test.ts`
- Create: `frontend/src/shared/store/theme.ts`
- Create: `frontend/src/shared/store/ui.ts`
- Create: `frontend/src/shared/store/connection.ts`

**Step 1: 실패하는 테스트 작성 - src/shared/store/auth.test.ts**

```ts
import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
  currentUserAtom,
  isAuthenticatedAtom,
  isSessionExpiredAtom,
  csrfTokenAtom,
} from './auth';

describe('auth store', () => {
  it('초기 상태에서 사용자는 null이다', () => {
    const store = createStore();
    expect(store.get(currentUserAtom)).toBeNull();
  });

  it('초기 상태에서 인증되지 않은 상태이다', () => {
    const store = createStore();
    expect(store.get(isAuthenticatedAtom)).toBe(false);
  });

  it('사용자가 설정되면 인증된 상태가 된다', () => {
    const store = createStore();
    store.set(currentUserAtom, {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
    });
    expect(store.get(isAuthenticatedAtom)).toBe(true);
  });

  it('세션 만료 상태를 설정할 수 있다', () => {
    const store = createStore();
    expect(store.get(isSessionExpiredAtom)).toBe(false);
    store.set(isSessionExpiredAtom, true);
    expect(store.get(isSessionExpiredAtom)).toBe(true);
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `bun test src/shared/store/auth.test.ts`
Expected: FAIL

**Step 3: src/shared/store/auth.ts 구현**

```ts
import { atom } from 'jotai';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

// Base atoms
export const currentUserAtom = atom<User | null>(null);
export const csrfTokenAtom = atom<string | null>(null);
export const isSessionExpiredAtom = atom<boolean>(false);

// Derived atoms
export const isAuthenticatedAtom = atom((get) => get(currentUserAtom) !== null);
```

**Step 4: 테스트 실행하여 통과 확인**

Run: `bun test src/shared/store/auth.test.ts`
Expected: PASS

**Step 5: src/shared/store/theme.ts 생성**

```ts
import { atom } from 'jotai';

export type ThemeMode = 'light' | 'dark' | 'system';

export const themeModeAtom = atom<ThemeMode>('system');
```

**Step 6: src/shared/store/ui.ts 생성**

```ts
import { atom } from 'jotai';

export const sidebarOpenAtom = atom<boolean>(true);
export const modalOpenAtom = atom<string | null>(null);
```

**Step 7: src/shared/store/connection.ts 생성**

```ts
import { atom } from 'jotai';

export type ConnectionStatus = 'online' | 'offline' | 'syncing';

export const connectionStatusAtom = atom<ConnectionStatus>('online');
```

**Step 8: src/shared/store/index.ts 업데이트**

```ts
export * from './auth';
export * from './theme';
export * from './ui';
export * from './connection';
```

**Step 9: 커밋**

```bash
git add src/shared/store/
git commit -m "feat: Jotai 전역 스토어 설정 (auth, theme, ui, connection)"
```

---

## Task 8: 공통 UI 컴포넌트 - Skeleton

**Files:**
- Create: `frontend/src/shared/ui/skeleton/Skeleton.tsx`
- Create: `frontend/src/shared/ui/skeleton/Skeleton.test.tsx`
- Create: `frontend/src/shared/ui/skeleton/index.ts`

**Step 1: 실패하는 테스트 작성 - src/shared/ui/skeleton/Skeleton.test.tsx**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  describe('기본 렌더링', () => {
    it('기본 스켈레톤이 렌더링된다', () => {
      render(<Skeleton data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('지정된 너비와 높이가 적용된다', () => {
      render(<Skeleton width={100} height={50} data-testid="skeleton" />);
      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveStyle({ width: '100px', height: '50px' });
    });
  });

  describe('variant', () => {
    it('text variant는 rounded 스타일이 적용된다', () => {
      render(<Skeleton variant="text" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('rounded');
    });

    it('circle variant는 rounded-full 스타일이 적용된다', () => {
      render(<Skeleton variant="circle" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('rounded-full');
    });

    it('box variant는 rounded-md 스타일이 적용된다', () => {
      render(<Skeleton variant="box" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('rounded-md');
    });
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `bun test src/shared/ui/skeleton/Skeleton.test.tsx`
Expected: FAIL

**Step 3: src/shared/ui/skeleton/Skeleton.tsx 구현**

```tsx
import { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circle' | 'box';
  animation?: 'pulse' | 'wave';
}

export const Skeleton = ({
  width,
  height,
  variant = 'box',
  animation = 'pulse',
  className = '',
  style,
  ...props
}: SkeletonProps) => {
  const variantClasses = {
    text: 'rounded h-4',
    circle: 'rounded-full',
    box: 'rounded-md',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse',
  };

  const combinedStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  return (
    <div
      className={`bg-gray-200 ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={combinedStyle}
      {...props}
    />
  );
};
```

**Step 4: 테스트 실행하여 통과 확인**

Run: `bun test src/shared/ui/skeleton/Skeleton.test.tsx`
Expected: PASS

**Step 5: src/shared/ui/skeleton/index.ts 생성**

```ts
export { Skeleton } from './Skeleton';
export type { SkeletonProps } from './Skeleton';
```

**Step 6: 커밋**

```bash
git add src/shared/ui/skeleton/
git commit -m "feat: 공통 Skeleton UI 컴포넌트 추가"
```

---

## Task 9: Error Boundary 컴포넌트

**Files:**
- Create: `frontend/src/shared/ui/error-boundary/ErrorBoundary.tsx`
- Create: `frontend/src/shared/ui/error-boundary/index.ts`

**Step 1: src/shared/ui/error-boundary/ErrorBoundary.tsx 구현**

```tsx
'use client';

import { Component, ReactNode, ErrorInfo } from 'react';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export const AppErrorBoundary = ({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) => (
  <ErrorBoundary
    fallback={fallback || <div className="p-8 text-center">앱에서 오류가 발생했습니다.</div>}
  >
    {children}
  </ErrorBoundary>
);

export const PageErrorBoundary = ({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) => (
  <ErrorBoundary
    fallback={fallback || <div className="p-4 text-center">페이지를 불러오는 중 오류가 발생했습니다.</div>}
  >
    {children}
  </ErrorBoundary>
);

export const WidgetErrorBoundary = ({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) => (
  <ErrorBoundary
    fallback={fallback || <div className="p-2 text-center text-sm">오류가 발생했습니다.</div>}
  >
    {children}
  </ErrorBoundary>
);
```

**Step 2: src/shared/ui/error-boundary/index.ts 생성**

```ts
export {
  ErrorBoundary,
  AppErrorBoundary,
  PageErrorBoundary,
  WidgetErrorBoundary,
} from './ErrorBoundary';
export type { ErrorBoundaryProps } from './ErrorBoundary';
```

**Step 3: src/shared/ui/index.ts 업데이트**

```ts
export * from './skeleton';
export * from './error-boundary';
```

**Step 4: 커밋**

```bash
git add src/shared/ui/error-boundary/ src/shared/ui/index.ts
git commit -m "feat: Error Boundary 컴포넌트 추가 (App, Page, Widget 레벨)"
```

---

## Task 10: Connection Status 컴포넌트

**Files:**
- Create: `frontend/src/shared/ui/connection-status/ConnectionIcon.tsx`
- Create: `frontend/src/shared/ui/connection-status/ConnectionIcon.test.tsx`
- Create: `frontend/src/shared/ui/connection-status/index.ts`

**Step 1: 실패하는 테스트 작성 - src/shared/ui/connection-status/ConnectionIcon.test.tsx**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { ConnectionIcon } from './ConnectionIcon';
import { connectionStatusAtom } from '@/shared/store/connection';

describe('ConnectionIcon', () => {
  it('온라인 상태에서 초록색 아이콘을 표시한다', () => {
    const store = createStore();
    store.set(connectionStatusAtom, 'online');

    render(
      <Provider store={store}>
        <ConnectionIcon />
      </Provider>
    );

    expect(screen.getByTitle('online')).toBeInTheDocument();
  });

  it('오프라인 상태에서 회색 아이콘을 표시한다', () => {
    const store = createStore();
    store.set(connectionStatusAtom, 'offline');

    render(
      <Provider store={store}>
        <ConnectionIcon />
      </Provider>
    );

    expect(screen.getByTitle('offline')).toBeInTheDocument();
  });
});
```

**Step 2: 테스트 실행하여 실패 확인**

Run: `bun test src/shared/ui/connection-status/ConnectionIcon.test.tsx`
Expected: FAIL

**Step 3: src/shared/ui/connection-status/ConnectionIcon.tsx 구현**

```tsx
'use client';

import { useAtomValue } from 'jotai';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';
import SyncIcon from '@mui/icons-material/Sync';
import { connectionStatusAtom } from '@/shared/store/connection';

export const ConnectionIcon = () => {
  const status = useAtomValue(connectionStatusAtom);

  const icons = {
    online: <WifiIcon className="text-green-500" />,
    offline: <WifiOffIcon className="text-gray-400" />,
    syncing: <SyncIcon className="text-blue-500 animate-spin" />,
  };

  return (
    <div title={status} className="flex items-center">
      {icons[status]}
    </div>
  );
};
```

**Step 4: 테스트 실행하여 통과 확인**

Run: `bun test src/shared/ui/connection-status/ConnectionIcon.test.tsx`
Expected: PASS

**Step 5: src/shared/ui/connection-status/index.ts 생성**

```ts
export { ConnectionIcon } from './ConnectionIcon';
```

**Step 6: src/shared/ui/index.ts 업데이트**

```ts
export * from './skeleton';
export * from './error-boundary';
export * from './connection-status';
```

**Step 7: 커밋**

```bash
git add src/shared/ui/connection-status/ src/shared/ui/index.ts
git commit -m "feat: Connection Status 아이콘 컴포넌트 추가"
```

---

## Task 11: Next.js App Router 기본 페이지 설정

**Files:**
- Create: `frontend/src/app/routes/layout.tsx`
- Create: `frontend/src/app/routes/page.tsx`
- Create: `frontend/src/app/styles/globals.css`
- Create: `frontend/next-env.d.ts`

**Step 1: src/app/styles/globals.css 생성**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 2: src/app/routes/layout.tsx 생성**

```tsx
import type { Metadata } from 'next';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v14-appRouter';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Task Management Tool',
  description: '업무 관리 툴',
};

const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AppRouterCacheProvider>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
```

**Step 3: src/app/routes/page.tsx 생성**

```tsx
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Task Management Tool</h1>
      <p className="text-gray-600">업무 관리 툴에 오신 것을 환영합니다.</p>
    </main>
  );
}
```

**Step 4: next-env.d.ts 생성**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.
```

**Step 5: 개발 서버 실행 확인**

Run: `bun dev`
Expected: http://localhost:3000 에서 페이지 표시

**Step 6: 커밋**

```bash
git add src/app/ next-env.d.ts
git commit -m "feat: Next.js App Router 기본 레이아웃 및 홈페이지 설정"
```

---

## Task 12: 백엔드 Rust 프로젝트 생성

**Files:**
- Create: `backend/Cargo.toml`
- Create: `backend/src/main.rs`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`

**Step 1: backend 디렉토리 생성**

```bash
mkdir -p backend/src
cd backend
```

**Step 2: Cargo.toml 생성**

```toml
[package]
name = "task-management-backend"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4"
actix-cors = "0.7"
actix-rt = "2"
async-graphql = { version = "7", features = ["chrono"] }
async-graphql-actix-web = "7"
sqlx = { version = "0.7", features = ["runtime-tokio", "sqlite", "chrono"] }
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4", "serde"] }
jsonwebtoken = "9"
bcrypt = "0.15"
reqwest = { version = "0.11", features = ["json"] }
dotenvy = "0.15"
thiserror = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[dev-dependencies]
actix-rt = "2"
```

**Step 3: src/main.rs 생성**

```rust
use actix_cors::Cors;
use actix_web::{web, App, HttpServer};
use dotenvy::dotenv;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting server at http://127.0.0.1:8080");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header();

        App::new()
            .wrap(cors)
            .route("/health", web::get().to(|| async { "OK" }))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}
```

**Step 4: .env.example 생성**

```
DATABASE_URL=sqlite:./data.db
JWT_SECRET=your-secret-key-change-in-production
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
RUST_LOG=info
```

**Step 5: .gitignore 생성**

```
/target
Cargo.lock
.env
*.db
*.db-journal
```

**Step 6: 빌드 확인**

Run: `cargo check`
Expected: 컴파일 성공

**Step 7: git 초기화 및 커밋**

```bash
git init
git add Cargo.toml src/ .env.example .gitignore
git commit -m "chore: Rust 백엔드 프로젝트 초기 설정"
```

---

## 체크포인트 요약

Phase 1 완료 후 구조:

```
frontend/
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── postcss.config.js
├── vitest.config.ts
├── vitest.setup.ts
├── next-env.d.ts
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── .nvmrc
├── commitlint.config.js
├── lint-staged.config.js
├── .husky/
│   ├── pre-commit
│   └── commit-msg
└── src/
    ├── app/
    │   ├── providers/
    │   ├── styles/
    │   │   └── globals.css
    │   └── routes/
    │       ├── layout.tsx
    │       └── page.tsx
    ├── pages/
    │   ├── home/
    │   ├── dashboard/
    │   ├── project/
    │   └── settings/
    ├── widgets/
    │   ├── task-board/
    │   ├── task-list/
    │   ├── task-calendar/
    │   └── sidebar/
    ├── features/
    │   ├── create-task/
    │   ├── auth/
    │   └── drag-drop-task/
    ├── entities/
    │   ├── task/
    │   ├── project/
    │   ├── user/
    │   └── comment/
    └── shared/
        ├── ui/
        │   ├── skeleton/
        │   ├── error-boundary/
        │   └── connection-status/
        ├── lib/
        │   ├── i18n/
        │   └── test-utils/
        ├── store/
        │   ├── auth.ts
        │   ├── theme.ts
        │   ├── ui.ts
        │   └── connection.ts
        ├── api/
        ├── config/
        └── types/

backend/
├── Cargo.toml
├── .env.example
├── .gitignore
└── src/
    └── main.rs
```

---

## 다음 Phase 예고

**Phase 2: 백엔드 핵심 기능**
- SQLite 데이터베이스 스키마 및 마이그레이션
- GraphQL 스키마 (async-graphql, Relay 스펙)
- 인증 (Google OAuth, JWT, CSRF)
- WebSocket 서버 (Subscription, Yjs)

**Phase 3: 프론트엔드 핵심 기능**
- Relay 설정 및 GraphQL 연동
- 인증 플로우 구현 (Google OAuth)
- 라우팅 및 AuthGuard

**Phase 4: 비즈니스 로직**
- 프로젝트/태스크 CRUD
- 칸반 보드, 리스트, 캘린더 뷰
- 실시간 협업 (Yjs)
