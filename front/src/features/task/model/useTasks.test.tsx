import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { useTasks } from './useTasks';

vi.mock('../api/task.graphql', () => ({
  fetchTasksByProject: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));

import {
  fetchTasksByProject,
  createTask,
  updateTask,
  deleteTask,
} from '../api/task.graphql';

describe('useTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('프로젝트별 태스크를 조회한다', async () => {
    const mockTasks = [
      {
        id: '1',
        title: '태스크 1',
        status: 'TODO',
        priority: 'MEDIUM',
        projectId: 'project-1',
        createdAt: '2025-01-26',
        updatedAt: '2025-01-26',
      },
      {
        id: '2',
        title: '태스크 2',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        projectId: 'project-1',
        createdAt: '2025-01-26',
        updatedAt: '2025-01-26',
      },
    ];
    (fetchTasksByProject as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockTasks
    );

    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTasks('project-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.tasks).toEqual(mockTasks);
    });
  });

  it('새 태스크를 생성한다', async () => {
    const newTask = {
      id: '3',
      title: '새 태스크',
      status: 'TODO',
      priority: 'LOW',
      projectId: 'project-1',
      createdAt: '2025-01-26',
      updatedAt: '2025-01-26',
    };
    (fetchTasksByProject as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (createTask as ReturnType<typeof vi.fn>).mockResolvedValue(newTask);

    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTasks('project-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.createTask({
      title: '새 태스크',
      projectId: 'project-1',
    });

    expect(createTask).toHaveBeenCalledWith({
      title: '새 태스크',
      projectId: 'project-1',
    });
  });

  it('상태별로 태스크를 분류한다', async () => {
    const mockTasks = [
      {
        id: '1',
        title: '할 일',
        status: 'TODO',
        priority: 'MEDIUM',
        projectId: 'project-1',
        createdAt: '2025-01-26',
        updatedAt: '2025-01-26',
      },
      {
        id: '2',
        title: '진행 중',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        projectId: 'project-1',
        createdAt: '2025-01-26',
        updatedAt: '2025-01-26',
      },
      {
        id: '3',
        title: '완료',
        status: 'DONE',
        priority: 'LOW',
        projectId: 'project-1',
        createdAt: '2025-01-26',
        updatedAt: '2025-01-26',
      },
    ];
    (fetchTasksByProject as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockTasks
    );

    const store = createStore();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );

    const { result } = renderHook(() => useTasks('project-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.tasksByStatus.TODO).toHaveLength(1);
      expect(result.current.tasksByStatus.IN_PROGRESS).toHaveLength(1);
      expect(result.current.tasksByStatus.DONE).toHaveLength(1);
    });
  });
});
