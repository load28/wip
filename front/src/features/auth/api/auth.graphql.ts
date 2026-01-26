import { gql } from 'graphql-request';

export const LOGIN_WITH_GOOGLE = gql`
  mutation LoginWithGoogle($code: String!, $redirectUri: String!) {
    loginWithGoogle(code: $code, redirectUri: $redirectUri) {
      user {
        id
        email
        name
        avatarUrl
      }
      csrfToken
    }
  }
`;

export const LOGOUT = gql`
  mutation Logout {
    logout
  }
`;

export const REFRESH_TOKEN = gql`
  mutation RefreshToken {
    refreshToken
  }
`;

export const GET_ME = gql`
  query GetMe {
    me {
      id
      email
      name
      avatarUrl
    }
  }
`;
