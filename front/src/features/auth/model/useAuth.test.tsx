import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { useAuth } from './useAuth';
import { currentUserAtom } from '@/shared/store/auth';

// GraphQL 클라이언트 모킹
vi.mock('@/shared/api', () => ({
  graphqlClient: {
    request: vi.fn(),
  },
  setCSRFToken: vi.fn(),
}));

describe('useAuth', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider>{children}</Provider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loginWithGoogle', () => {
    it('Google 로그인 성공 시 사용자 정보와 CSRF 토큰을 저장한다', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: null,
      };
      const mockCsrfToken = 'csrf-token-123';

      const { graphqlClient } = await import('@/shared/api');
      vi.mocked(graphqlClient.request).mockResolvedValueOnce({
        loginWithGoogle: {
          user: mockUser,
          csrfToken: mockCsrfToken,
        },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.loginWithGoogle(
          'auth-code',
          'http://localhost:3000/auth/callback'
        );
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.isAuthenticated).toBe(true);
      });
    });

    it('Google 로그인 실패 시 에러를 반환한다', async () => {
      const { graphqlClient } = await import('@/shared/api');
      vi.mocked(graphqlClient.request).mockRejectedValueOnce(
        new Error('인증 실패')
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        result.current.loginWithGoogle(
          'invalid-code',
          'http://localhost:3000/auth/callback'
        )
      ).rejects.toThrow('인증 실패');
    });
  });

  describe('logout', () => {
    it('로그아웃 시 사용자 정보를 초기화한다', async () => {
      const { graphqlClient } = await import('@/shared/api');
      vi.mocked(graphqlClient.request).mockResolvedValueOnce({ logout: true });

      const store = createStore();
      store.set(currentUserAtom, {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      });

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <Provider store={store}>{children}</Provider>
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: customWrapper,
      });

      await act(async () => {
        await result.current.logout();
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
      });
    });
  });
});
