import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import ProjectsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/projects',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'project.list.title': '프로젝트',
        'project.list.empty': '프로젝트가 없습니다',
        'project.list.create': '새 프로젝트',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/features/project', () => ({
  useProjects: () => ({
    projects: [],
    isLoading: false,
    error: null,
    fetchProjects: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
  }),
}));

describe('ProjectsPage', () => {
  it('프로젝트 목록 페이지가 렌더링된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <ProjectsPage />
      </Provider>
    );

    expect(screen.getByText('프로젝트')).toBeInTheDocument();
  });

  it('프로젝트가 없을 때 empty 메시지가 표시된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <ProjectsPage />
      </Provider>
    );

    expect(screen.getByText('프로젝트가 없습니다')).toBeInTheDocument();
  });

  it('새 프로젝트 버튼이 표시된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <ProjectsPage />
      </Provider>
    );

    expect(
      screen.getByRole('button', { name: /새 프로젝트/i })
    ).toBeInTheDocument();
  });
});
