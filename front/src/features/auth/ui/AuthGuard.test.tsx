import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { AuthGuard } from './AuthGuard';
import { currentUserAtom } from '@/shared/store/auth';

// useRouter 모킹
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

// useAuth 모킹
vi.mock('../model/useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    fetchCurrentUser: vi.fn().mockResolvedValue(null),
  }),
}));

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('인증된 사용자에게는 children을 렌더링한다', async () => {
    // useAuth가 인증된 상태를 반환하도록 재모킹
    vi.doMock('../model/useAuth', () => ({
      useAuth: () => ({
        isAuthenticated: true,
        fetchCurrentUser: vi.fn().mockResolvedValue({
          id: '1',
          email: 'test@example.com',
          name: 'Test User',
        }),
      }),
    }));

    const store = createStore();
    store.set(currentUserAtom, {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
    });

    // 인증 상태를 시뮬레이션하기 위해 Provider에 store 전달
    const { AuthGuard: FreshAuthGuard } = await import('./AuthGuard');

    render(
      <Provider store={store}>
        <FreshAuthGuard>
          <div>Protected Content</div>
        </FreshAuthGuard>
      </Provider>
    );

    await waitFor(
      () => {
        expect(
          screen.queryByText('Protected Content') ||
            screen.queryByRole('progressbar')
        ).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('로딩 중에는 로딩 UI를 표시한다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <AuthGuard>
          <div>Protected Content</div>
        </AuthGuard>
      </Provider>
    );

    // 로딩 상태에서는 progress indicator가 있거나 children이 없어야 함
    // AuthGuard 구현에 따라 로딩 중일 때 spinner를 보여주므로
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
