import { GraphQLClient } from 'graphql-request';
import { authConfig } from '@/shared/config/auth';

export const graphqlClient = new GraphQLClient(
  `${authConfig.backendUrl}/graphql`,
  {
    credentials: 'include', // 쿠키 포함
  }
);

// CSRF 토큰 헤더 추가 함수
export const setCSRFToken = (token: string) => {
  graphqlClient.setHeader('X-CSRF-Token', token);
};
