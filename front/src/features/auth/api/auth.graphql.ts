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

// 패스키 관련 GraphQL 오퍼레이션

export const START_PASSKEY_REGISTRATION = gql`
  mutation StartPasskeyRegistration {
    startPasskeyRegistration {
      challengeId
      optionsJson
    }
  }
`;

export const FINISH_PASSKEY_REGISTRATION = gql`
  mutation FinishPasskeyRegistration(
    $challengeId: String!
    $credentialJson: String!
    $name: String!
  ) {
    finishPasskeyRegistration(
      challengeId: $challengeId
      credentialJson: $credentialJson
      name: $name
    )
  }
`;

export const START_PASSKEY_AUTHENTICATION = gql`
  mutation StartPasskeyAuthentication {
    startPasskeyAuthentication {
      challengeId
      optionsJson
    }
  }
`;

export const FINISH_PASSKEY_AUTHENTICATION = gql`
  mutation FinishPasskeyAuthentication(
    $challengeId: String!
    $credentialJson: String!
  ) {
    finishPasskeyAuthentication(
      challengeId: $challengeId
      credentialJson: $credentialJson
    ) {
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

export const MY_PASSKEYS = gql`
  mutation MyPasskeys {
    myPasskeys {
      id
      name
      createdAt
    }
  }
`;

export const DELETE_PASSKEY = gql`
  mutation DeletePasskey($passkeyId: String!) {
    deletePasskey(passkeyId: $passkeyId)
  }
`;
