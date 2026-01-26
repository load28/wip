import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useProjects } from './useProjects';

const mockRequest = vi.fn();

vi.mock('@/shared/api/graphql-client', () => ({
  graphqlClient: {
    request: (...args: unknown[]) => mockRequest(...args),
  },
}));

describe('useProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('프로젝트 목록을 가져온다', async () => {
    const mockProjects = [
      {
        id: '1',
        name: 'Project 1',
        description: 'Description 1',
        createdAt: '2025-01-26T00:00:00Z',
        updatedAt: '2025-01-26T00:00:00Z',
      },
    ];

    mockRequest.mockResolvedValueOnce({ myProjects: mockProjects });

    const { result } = renderHook(() => useProjects());

    await act(async () => {
      await result.current.fetchProjects();
    });

    await waitFor(() => {
      expect(result.current.projects).toEqual(mockProjects);
    });
  });

  it('프로젝트를 생성한다', async () => {
    const newProject = {
      id: '2',
      name: 'New Project',
      description: 'New Description',
    };

    mockRequest.mockResolvedValueOnce({ createProject: newProject });
    mockRequest.mockResolvedValueOnce({ myProjects: [newProject] });

    const { result } = renderHook(() => useProjects());

    await act(async () => {
      await result.current.createProject({
        name: 'New Project',
        description: 'New Description',
      });
    });

    expect(mockRequest).toHaveBeenCalled();
  });

  it('프로젝트를 삭제한다', async () => {
    mockRequest.mockResolvedValueOnce({ deleteProject: true });
    mockRequest.mockResolvedValueOnce({ myProjects: [] });

    const { result } = renderHook(() => useProjects());

    await act(async () => {
      await result.current.deleteProject('1');
    });

    expect(mockRequest).toHaveBeenCalled();
  });
});
