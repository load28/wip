import { useState, useCallback } from 'react';
import { graphqlClient } from '@/shared/api/graphql-client';
import {
  MY_PROJECTS_QUERY,
  CREATE_PROJECT_MUTATION,
  UPDATE_PROJECT_MUTATION,
  DELETE_PROJECT_MUTATION,
  Project,
  CreateProjectInput,
  UpdateProjectInput,
} from '../api/project.graphql';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await graphqlClient.request<{ myProjects: Project[] }>(
        MY_PROJECTS_QUERY
      );
      setProjects(data.myProjects);
      return data.myProjects;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : '프로젝트 목록을 가져오는데 실패했습니다.';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createProject = useCallback(
    async (input: CreateProjectInput) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await graphqlClient.request<{ createProject: Project }>(
          CREATE_PROJECT_MUTATION,
          { input }
        );
        await fetchProjects();
        return data.createProject;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '프로젝트 생성에 실패했습니다.';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchProjects]
  );

  const updateProject = useCallback(
    async (input: UpdateProjectInput) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await graphqlClient.request<{ updateProject: Project }>(
          UPDATE_PROJECT_MUTATION,
          { input }
        );
        await fetchProjects();
        return data.updateProject;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '프로젝트 수정에 실패했습니다.';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchProjects]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      setIsLoading(true);
      setError(null);
      try {
        await graphqlClient.request<{ deleteProject: boolean }>(
          DELETE_PROJECT_MUTATION,
          { id }
        );
        await fetchProjects();
        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '프로젝트 삭제에 실패했습니다.';
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchProjects]
  );

  return {
    projects,
    isLoading,
    error,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
  };
}
