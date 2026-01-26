import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoginPage from './page';

// useRouter 모킹
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

// useAuth 모킹
vi.mock('@/features/auth', () => ({
  useAuth: () => ({
    isAuthenticated: false,
  }),
  GoogleLoginButton: () => <button>Google로 로그인</button>,
}));

// useTranslation 모킹
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.login.title': '로그인',
        'auth.login.description': '계속하려면 로그인하세요',
      };
      return translations[key] || key;
    },
  }),
}));

describe('LoginPage', () => {
  it('로그인 페이지가 렌더링된다', () => {
    render(<LoginPage />);

    expect(screen.getByText('로그인')).toBeInTheDocument();
    expect(screen.getByText('계속하려면 로그인하세요')).toBeInTheDocument();
    expect(screen.getByText('Google로 로그인')).toBeInTheDocument();
  });

  it('Google 로그인 버튼이 표시된다', () => {
    render(<LoginPage />);

    const button = screen.getByRole('button', { name: /Google로 로그인/i });
    expect(button).toBeInTheDocument();
  });
});
