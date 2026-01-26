import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
        'auth.logout.button': '로그아웃',
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
