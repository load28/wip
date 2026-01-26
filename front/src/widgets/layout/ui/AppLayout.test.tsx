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
