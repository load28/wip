import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import SettingsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/settings',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'settings.title': '설정',
        'settings.language': '언어',
        'settings.theme': '테마',
      };
      return translations[key] || key;
    },
    i18n: { language: 'ko', changeLanguage: vi.fn() },
  }),
}));

describe('SettingsPage', () => {
  it('설정 페이지가 렌더링된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <SettingsPage />
      </Provider>
    );

    expect(screen.getByText('설정')).toBeInTheDocument();
  });

  it('언어 설정이 표시된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <SettingsPage />
      </Provider>
    );

    const languageElements = screen.getAllByText('언어');
    expect(languageElements.length).toBeGreaterThan(0);
  });

  it('테마 설정이 표시된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <SettingsPage />
      </Provider>
    );

    const themeElements = screen.getAllByText('테마');
    expect(themeElements.length).toBeGreaterThan(0);
  });
});
