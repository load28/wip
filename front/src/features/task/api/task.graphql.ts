import { graphqlClient } from '@/shared/api/graphql-client';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  projectId: string;
  assigneeId?: string;
  parentId?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  projectId: string;
  assigneeId?: string;
  parentId?: string;
  dueDate?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assigneeId?: string;
  parentId?: string;
  dueDate?: string;
}

export async function fetchTasksByProject(projectId: string): Promise<Task[]> {
  const query = `
    query TasksByProject($projectId: String!) {
      tasksByProject(projectId: $projectId) {
        id
        title
        description
        status
        priority
        projectId
        assigneeId
        parentId
        dueDate
        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphqlClient.request<{ tasksByProject: Task[] }>(query, {
    projectId,
  });
  return data.tasksByProject;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const mutation = `
    mutation CreateTask($input: CreateTaskGqlInput!) {
      createTask(input: $input) {
        id
        title
        description
        status
        priority
        projectId
        assigneeId
        parentId
        dueDate
        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphqlClient.request<{ createTask: Task }>(mutation, {
    input,
  });
  return data.createTask;
}

export async function updateTask(
  id: string,
  input: UpdateTaskInput
): Promise<Task> {
  const mutation = `
    mutation UpdateTask($id: String!, $input: UpdateTaskGqlInput!) {
      updateTask(id: $id, input: $input) {
        id
        title
        description
        status
        priority
        projectId
        assigneeId
        parentId
        dueDate
        createdAt
        updatedAt
      }
    }
  `;

  const data = await graphqlClient.request<{ updateTask: Task }>(mutation, {
    id,
    input,
  });
  return data.updateTask;
}

export async function deleteTask(id: string): Promise<boolean> {
  const mutation = `
    mutation DeleteTask($id: String!) {
      deleteTask(id: $id)
    }
  `;

  const data = await graphqlClient.request<{ deleteTask: boolean }>(mutation, {
    id,
  });
  return data.deleteTask;
}
