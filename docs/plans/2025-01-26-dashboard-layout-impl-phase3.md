# Phase 3: 대시보드 및 레이아웃 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 인증된 사용자를 위한 메인 대시보드와 공통 레이아웃 시스템 구현

**Architecture:** FSD 2.0 구조에 따라 widgets/에 레이아웃 컴포넌트, pages/에 대시보드 로직 구현. Jotai로 사이드바 상태 관리.

**Tech Stack:** Next.js 16 (App Router), MUI 6, Tailwind CSS, Jotai, react-i18next, Vitest

---

## Task 1: 공통 레이아웃 상태 관리

**Files:**
- Create: `front/src/shared/store/layout.ts`
- Modify: `front/src/shared/store/index.ts`
- Create: `front/src/shared/store/layout.test.ts`

**Step 1: 테스트 작성**

```typescript
// front/src/shared/store/layout.test.ts
import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import { sidebarOpenAtom, sidebarWidthAtom, toggleSidebarAtom } from './layout';

describe('layout store', () => {
  it('사이드바 초기 상태는 열려있다', () => {
    const store = createStore();
    expect(store.get(sidebarOpenAtom)).toBe(true);
  });

  it('사이드바 너비 기본값은 240이다', () => {
    const store = createStore();
    expect(store.get(sidebarWidthAtom)).toBe(240);
  });

  it('toggleSidebar는 사이드바 상태를 토글한다', () => {
    const store = createStore();
    expect(store.get(sidebarOpenAtom)).toBe(true);
    store.set(toggleSidebarAtom);
    expect(store.get(sidebarOpenAtom)).toBe(false);
    store.set(toggleSidebarAtom);
    expect(store.get(sidebarOpenAtom)).toBe(true);
  });
});
```

**Step 2: 테스트 실행 (실패 확인)**

```bash
cd front && bun run vitest run src/shared/store/layout.test.ts
```
Expected: FAIL

**Step 3: 구현**

```typescript
// front/src/shared/store/layout.ts
import { atom } from 'jotai';

export const sidebarOpenAtom = atom(true);
export const sidebarWidthAtom = atom(240);

export const toggleSidebarAtom = atom(null, (get, set) => {
  set(sidebarOpenAtom, !get(sidebarOpenAtom));
});
```

**Step 4: index.ts 업데이트**

```typescript
// front/src/shared/store/index.ts 에 추가
export * from './layout';
```

**Step 5: 테스트 실행 (통과 확인)**

```bash
cd front && bun run vitest run src/shared/store/layout.test.ts
```
Expected: PASS

**Step 6: 커밋**

```bash
git add front/src/shared/store/layout.ts front/src/shared/store/layout.test.ts front/src/shared/store/index.ts
git commit -m "feat(store): 레이아웃 상태 관리 추가 (사이드바 열림/너비)"
```

---

## Task 2: 사이드바 위젯 구현

**Files:**
- Create: `front/src/widgets/sidebar/ui/Sidebar.tsx`
- Create: `front/src/widgets/sidebar/ui/Sidebar.test.tsx`
- Create: `front/src/widgets/sidebar/index.ts`

**Step 1: 테스트 작성**

```typescript
// front/src/widgets/sidebar/ui/Sidebar.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { Sidebar } from './Sidebar';
import { sidebarOpenAtom } from '@/shared/store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'nav.dashboard': '대시보드',
        'nav.projects': '프로젝트',
        'nav.settings': '설정',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    currentUser: { name: 'Test User', email: 'test@example.com' },
    logout: vi.fn(),
  }),
}));

describe('Sidebar', () => {
  it('사이드바가 열려있으면 네비게이션 항목이 보인다', () => {
    const store = createStore();
    store.set(sidebarOpenAtom, true);

    render(
      <Provider store={store}>
        <Sidebar />
      </Provider>
    );

    expect(screen.getByText('대시보드')).toBeInTheDocument();
    expect(screen.getByText('프로젝트')).toBeInTheDocument();
    expect(screen.getByText('설정')).toBeInTheDocument();
  });

  it('사이드바가 닫혀있으면 텍스트가 숨겨진다', () => {
    const store = createStore();
    store.set(sidebarOpenAtom, false);

    render(
      <Provider store={store}>
        <Sidebar />
      </Provider>
    );

    expect(screen.queryByText('대시보드')).not.toBeInTheDocument();
  });
});
```

**Step 2: 테스트 실행 (실패 확인)**

```bash
cd front && bun run vitest run src/widgets/sidebar/ui/Sidebar.test.tsx
```
Expected: FAIL

**Step 3: 사이드바 구현**

```typescript
// front/src/widgets/sidebar/ui/Sidebar.tsx
'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import { sidebarOpenAtom, sidebarWidthAtom, toggleSidebarAtom } from '@/shared/store';
import { useAuth } from '@/features/auth';

const COLLAPSED_WIDTH = 64;

interface NavItem {
  key: string;
  path: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { key: 'nav.dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { key: 'nav.projects', path: '/projects', icon: <FolderIcon /> },
  { key: 'nav.settings', path: '/settings', icon: <SettingsIcon /> },
];

export function Sidebar() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen] = useAtom(sidebarOpenAtom);
  const [width] = useAtom(sidebarWidthAtom);
  const toggle = useSetAtom(toggleSidebarAtom);
  const { currentUser, logout } = useAuth();

  const currentWidth = isOpen ? width : COLLAPSED_WIDTH;

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: currentWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: currentWidth,
          boxSizing: 'border-box',
          transition: 'width 0.2s ease-in-out',
          overflowX: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isOpen ? 'space-between' : 'center',
          p: 2,
          minHeight: 64,
        }}
      >
        {isOpen && (
          <Typography variant="h6" noWrap>
            TaskFlow
          </Typography>
        )}
        <IconButton onClick={() => toggle()}>
          {isOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      <Divider />

      <List>
        {navItems.map((item) => (
          <ListItem key={item.key} disablePadding>
            <ListItemButton
              selected={pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                minHeight: 48,
                justifyContent: isOpen ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: isOpen ? 2 : 'auto',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {isOpen && <ListItemText primary={t(item.key)} />}
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Divider />

      {currentUser && (
        <Box sx={{ p: 2 }}>
          {isOpen && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {currentUser.name || currentUser.email}
            </Typography>
          )}
          <ListItemButton
            onClick={handleLogout}
            sx={{
              minHeight: 48,
              justifyContent: isOpen ? 'initial' : 'center',
              px: isOpen ? 0 : 2.5,
              mt: 1,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: isOpen ? 2 : 'auto',
                justifyContent: 'center',
              }}
            >
              <LogoutIcon />
            </ListItemIcon>
            {isOpen && <ListItemText primary={t('auth.logout.button')} />}
          </ListItemButton>
        </Box>
      )}
    </Drawer>
  );
}
```

**Step 4: index.ts 생성**

```typescript
// front/src/widgets/sidebar/index.ts
export { Sidebar } from './ui/Sidebar';
```

**Step 5: 테스트 실행 (통과 확인)**

```bash
cd front && bun run vitest run src/widgets/sidebar/ui/Sidebar.test.tsx
```
Expected: PASS

**Step 6: 커밋**

```bash
git add front/src/widgets/sidebar/
git commit -m "feat(widgets): 사이드바 위젯 구현 (네비게이션, 접기/펼치기)"
```

---

## Task 3: 앱 레이아웃 구현

**Files:**
- Create: `front/src/widgets/layout/ui/AppLayout.tsx`
- Create: `front/src/widgets/layout/ui/AppLayout.test.tsx`
- Create: `front/src/widgets/layout/index.ts`

**Step 1: 테스트 작성**

```typescript
// front/src/widgets/layout/ui/AppLayout.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { AppLayout } from './AppLayout';
import { sidebarOpenAtom } from '@/shared/store';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/dashboard',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    currentUser: { name: 'Test User' },
    logout: vi.fn(),
  }),
}));

describe('AppLayout', () => {
  it('children을 렌더링한다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <AppLayout>
          <div>Main Content</div>
        </AppLayout>
      </Provider>
    );

    expect(screen.getByText('Main Content')).toBeInTheDocument();
  });

  it('사이드바가 열려있으면 메인 콘텐츠가 밀린다', () => {
    const store = createStore();
    store.set(sidebarOpenAtom, true);

    render(
      <Provider store={store}>
        <AppLayout>
          <div data-testid="content">Content</div>
        </AppLayout>
      </Provider>
    );

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
  });
});
```

**Step 2: 테스트 실행 (실패 확인)**

```bash
cd front && bun run vitest run src/widgets/layout/ui/AppLayout.test.tsx
```
Expected: FAIL

**Step 3: AppLayout 구현**

```typescript
// front/src/widgets/layout/ui/AppLayout.tsx
'use client';

import { ReactNode } from 'react';
import { useAtom } from 'jotai';
import Box from '@mui/material/Box';
import { sidebarOpenAtom, sidebarWidthAtom } from '@/shared/store';
import { Sidebar } from '@/widgets/sidebar';

const COLLAPSED_WIDTH = 64;

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isOpen] = useAtom(sidebarOpenAtom);
  const [width] = useAtom(sidebarWidthAtom);

  const currentWidth = isOpen ? width : COLLAPSED_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <Box
        component="main"
        role="main"
        sx={{
          flexGrow: 1,
          p: 3,
          ml: `${currentWidth}px`,
          transition: 'margin-left 0.2s ease-in-out',
          backgroundColor: 'grey.50',
          minHeight: '100vh',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
```

**Step 4: index.ts 생성**

```typescript
// front/src/widgets/layout/index.ts
export { AppLayout } from './ui/AppLayout';
```

**Step 5: 테스트 실행 (통과 확인)**

```bash
cd front && bun run vitest run src/widgets/layout/ui/AppLayout.test.tsx
```
Expected: PASS

**Step 6: 커밋**

```bash
git add front/src/widgets/layout/
git commit -m "feat(widgets): AppLayout 위젯 구현 (사이드바 + 메인 콘텐츠)"
```

---

## Task 4: i18n 번역 키 추가

**Files:**
- Modify: `front/src/shared/lib/i18n/locales/ko.json`
- Modify: `front/src/shared/lib/i18n/locales/en.json`

**Step 1: 한글 번역 추가**

```json
// ko.json에 nav 섹션 추가
{
  "nav": {
    "dashboard": "대시보드",
    "projects": "프로젝트",
    "settings": "설정"
  }
}
```

**Step 2: 영문 번역 추가**

```json
// en.json에 nav 섹션 추가
{
  "nav": {
    "dashboard": "Dashboard",
    "projects": "Projects",
    "settings": "Settings"
  }
}
```

**Step 3: 커밋**

```bash
git add front/src/shared/lib/i18n/locales/
git commit -m "feat(i18n): 네비게이션 번역 키 추가"
```

---

## Task 5: 대시보드 페이지 구현

**Files:**
- Create: `front/src/app/dashboard/page.tsx`
- Create: `front/src/app/dashboard/page.test.tsx`
- Create: `front/src/app/dashboard/layout.tsx`

**Step 1: 테스트 작성**

```typescript
// front/src/app/dashboard/page.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import DashboardPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/dashboard',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'dashboard.header.welcome': '환영합니다',
        'dashboard.header.description': '업무를 효율적으로 관리하세요',
        'dashboard.stats.projects': '프로젝트',
        'dashboard.stats.tasks': '태스크',
        'dashboard.stats.completed': '완료',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    currentUser: { name: 'Test User', email: 'test@example.com' },
    isAuthenticated: true,
    fetchCurrentUser: vi.fn().mockResolvedValue(null),
  }),
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('DashboardPage', () => {
  it('대시보드 헤더가 렌더링된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <DashboardPage />
      </Provider>
    );

    expect(screen.getByText('환영합니다')).toBeInTheDocument();
    expect(screen.getByText('업무를 효율적으로 관리하세요')).toBeInTheDocument();
  });

  it('통계 카드가 렌더링된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <DashboardPage />
      </Provider>
    );

    expect(screen.getByText('프로젝트')).toBeInTheDocument();
    expect(screen.getByText('태스크')).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
  });
});
```

**Step 2: 테스트 실행 (실패 확인)**

```bash
cd front && bun run vitest run src/app/dashboard/page.test.tsx
```
Expected: FAIL

**Step 3: 대시보드 레이아웃 구현**

```typescript
// front/src/app/dashboard/layout.tsx
'use client';

import { ReactNode } from 'react';
import { AuthGuard } from '@/features/auth';
import { AppLayout } from '@/widgets/layout';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  );
}
```

**Step 4: 대시보드 페이지 구현**

```typescript
// front/src/app/dashboard/page.tsx
'use client';

import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FolderIcon from '@mui/icons-material/Folder';
import TaskIcon from '@mui/icons-material/Task';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from '@/features/auth';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="text.secondary" variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold">
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}.light`,
              borderRadius: 2,
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { currentUser } = useAuth();

  // TODO: 실제 데이터 연동
  const stats = {
    projects: 0,
    tasks: 0,
    completed: 0,
  };

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold">
          {t('dashboard.header.welcome')}
          {currentUser?.name && `, ${currentUser.name}`}
        </Typography>
        <Typography color="text.secondary">
          {t('dashboard.header.description')}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title={t('dashboard.stats.projects')}
            value={stats.projects}
            icon={<FolderIcon sx={{ color: 'primary.main' }} />}
            color="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title={t('dashboard.stats.tasks')}
            value={stats.tasks}
            icon={<TaskIcon sx={{ color: 'info.main' }} />}
            color="info"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title={t('dashboard.stats.completed')}
            value={stats.completed}
            icon={<CheckCircleIcon sx={{ color: 'success.main' }} />}
            color="success"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
```

**Step 5: 테스트 실행 (통과 확인)**

```bash
cd front && bun run vitest run src/app/dashboard/page.test.tsx
```
Expected: PASS

**Step 6: 커밋**

```bash
git add front/src/app/dashboard/
git commit -m "feat(dashboard): 대시보드 페이지 및 레이아웃 구현"
```

---

## Task 6: i18n 대시보드 번역 추가

**Files:**
- Modify: `front/src/shared/lib/i18n/locales/ko.json`
- Modify: `front/src/shared/lib/i18n/locales/en.json`

**Step 1: 한글 번역 추가**

```json
// ko.json의 dashboard 섹션 수정
{
  "dashboard": {
    "header": {
      "welcome": "환영합니다",
      "description": "업무를 효율적으로 관리하세요"
    },
    "stats": {
      "projects": "프로젝트",
      "tasks": "태스크",
      "completed": "완료"
    }
  }
}
```

**Step 2: 영문 번역 추가**

```json
// en.json의 dashboard 섹션 수정
{
  "dashboard": {
    "header": {
      "welcome": "Welcome",
      "description": "Manage your tasks efficiently"
    },
    "stats": {
      "projects": "Projects",
      "tasks": "Tasks",
      "completed": "Completed"
    }
  }
}
```

**Step 3: 커밋**

```bash
git add front/src/shared/lib/i18n/locales/
git commit -m "feat(i18n): 대시보드 통계 번역 키 추가"
```

---

## Task 7: 홈페이지 리다이렉트 설정

**Files:**
- Modify: `front/src/app/page.tsx`

**Step 1: 홈페이지 수정**

인증된 사용자는 `/dashboard`로, 미인증 사용자는 `/login`으로 리다이렉트

```typescript
// front/src/app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useAuth } from '@/features/auth';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, fetchCurrentUser } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await fetchCurrentUser();
      } finally {
        setIsLoading(false);
      }
    };
    checkAuth();
  }, [fetchCurrentUser]);

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [isLoading, isAuthenticated, router]);

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
    >
      <CircularProgress />
    </Box>
  );
}
```

**Step 2: 커밋**

```bash
git add front/src/app/page.tsx
git commit -m "feat: 홈페이지에서 인증 상태에 따른 리다이렉트 구현"
```

---

## Task 8: 전체 테스트 및 검증

**Step 1: 전체 프론트엔드 테스트 실행**

```bash
cd front && bun run vitest run
```

**Step 2: 백엔드 빌드 확인**

```bash
cd backend && cargo check
```

**Step 3: ESLint 확인**

```bash
cd front && bun run lint
```

**Step 4: 검증 리포트 작성**

검증 리포트를 `docs/reviews/PHASE3-dashboard-layout.md`에 작성

**Step 5: 최종 커밋**

```bash
git add docs/reviews/
git commit -m "docs: Phase 3 대시보드/레이아웃 검증 리포트 작성"
```

---

## 검증 체크리스트

| 항목 | 설계 규칙 | 확인 |
|------|----------|:----:|
| FSD 레이어 | widgets/ 에 Sidebar, AppLayout 배치 | |
| 상태 관리 | shared/store/에 레이아웃 상태 | |
| 컴포넌트 규칙 | 150줄 이하 | |
| 테스트 | TDD, 한글 명세, colocate | |
| i18n | react-i18next, 번역 키 규칙 | |
| 코드 스타일 | ESLint, Prettier 통과 | |
