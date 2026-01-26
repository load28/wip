import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: 'project-1' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'task.status.todo': '할 일',
        'task.status.inprogress': '진행 중',
        'task.status.done': '완료',
        'task.form.createTitle': '새 태스크 생성',
        'common.loading': '로딩 중...',
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock('@/features/task', () => ({
  useTasks: () => ({
    tasks: [],
    tasksByStatus: { TODO: [], IN_PROGRESS: [], DONE: [] },
    isLoading: false,
    error: null,
    createTask: vi.fn(),
  }),
  CreateTaskModal: () => null,
}));

vi.mock('@/features/project', () => ({
  useProjects: () => ({
    projects: [{ id: 'project-1', name: '테스트 프로젝트' }],
    isLoading: false,
  }),
}));

vi.mock('@/entities/task', () => ({
  TaskCard: () => null,
}));

import ProjectDetailPage from './page';

describe('ProjectDetailPage', () => {
  it('칸반 보드 컬럼이 표시된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <ProjectDetailPage />
      </Provider>
    );

    expect(screen.getByText('할 일')).toBeInTheDocument();
    expect(screen.getByText('진행 중')).toBeInTheDocument();
    expect(screen.getByText('완료')).toBeInTheDocument();
  });

  it('프로젝트 이름이 표시된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <ProjectDetailPage />
      </Provider>
    );

    expect(screen.getByText('테스트 프로젝트')).toBeInTheDocument();
  });
});
