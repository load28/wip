import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GoogleLoginButton } from './GoogleLoginButton';

// window.location 모킹
const mockAssign = vi.fn();
Object.defineProperty(window, 'location', {
  value: { assign: mockAssign, origin: 'http://localhost:3000' },
  writable: true,
});

vi.mock('@/shared/config/auth', () => ({
  getGoogleAuthUrl: vi.fn(
    () => 'https://accounts.google.com/o/oauth2/v2/auth?test=1'
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'auth.login.button': 'Google로 로그인',
      };
      return translations[key] || key;
    },
  }),
}));

describe('GoogleLoginButton', () => {
  it('Google 로그인 버튼이 렌더링된다', () => {
    render(<GoogleLoginButton />);
    expect(
      screen.getByRole('button', { name: /google로 로그인/i })
    ).toBeInTheDocument();
  });

  it('버튼 클릭 시 Google OAuth URL로 이동한다', () => {
    render(<GoogleLoginButton />);

    const button = screen.getByRole('button', { name: /google로 로그인/i });
    fireEvent.click(button);

    expect(mockAssign).toHaveBeenCalledWith(
      'https://accounts.google.com/o/oauth2/v2/auth?test=1'
    );
  });

  it('로딩 상태에서는 버튼이 비활성화된다', () => {
    render(<GoogleLoginButton loading />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
