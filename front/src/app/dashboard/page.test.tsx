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

vi.mock('@/features/project', () => ({
  useProjects: () => ({
    projects: [
      { id: '1', name: '프로젝트 1' },
      { id: '2', name: '프로젝트 2' },
    ],
    isLoading: false,
    fetchProjects: vi.fn(),
  }),
}));

describe('DashboardPage', () => {
  it('대시보드 헤더가 렌더링된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <DashboardPage />
      </Provider>
    );

    expect(screen.getByText(/환영합니다/)).toBeInTheDocument();
    expect(
      screen.getByText('업무를 효율적으로 관리하세요')
    ).toBeInTheDocument();
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
