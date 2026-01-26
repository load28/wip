export const MY_PROJECTS_QUERY = `
  query MyProjects {
    myProjects {
      id
      name
      description
      createdAt
      updatedAt
    }
  }
`;

export const PROJECT_QUERY = `
  query Project($id: String!) {
    project(id: $id) {
      id
      name
      description
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_PROJECT_MUTATION = `
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      name
      description
    }
  }
`;

export const UPDATE_PROJECT_MUTATION = `
  mutation UpdateProject($input: UpdateProjectInput!) {
    updateProject(input: $input) {
      id
      name
      description
    }
  }
`;

export const DELETE_PROJECT_MUTATION = `
  mutation DeleteProject($id: String!) {
    deleteProject(id: $id)
  }
`;

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface UpdateProjectInput {
  id: string;
  name?: string;
  description?: string;
}
