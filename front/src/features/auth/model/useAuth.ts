'use client';

import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback } from 'react';
import { graphqlClient, setCSRFToken } from '@/shared/api';
import {
  currentUserAtom,
  csrfTokenAtom,
  isAuthenticatedAtom,
  isSessionExpiredAtom,
  User,
} from '@/shared/store/auth';
import {
  LOGIN_WITH_GOOGLE,
  LOGOUT,
  REFRESH_TOKEN,
  GET_ME,
} from '../api/auth.graphql';
import {
  authenticateWithPasskey,
  registerPasskey,
  isPasskeySupported,
} from '@/shared/lib/passkey';

interface LoginPayload {
  loginWithGoogle: {
    user: User;
    csrfToken: string;
  };
}

interface MePayload {
  me: User | null;
}

export function useAuth() {
  const [user, setUser] = useAtom(currentUserAtom);
  const [csrfToken, setCsrfToken] = useAtom(csrfTokenAtom);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const setSessionExpired = useSetAtom(isSessionExpiredAtom);

  const loginWithGoogle = useCallback(
    async (code: string, redirectUri: string) => {
      const data = await graphqlClient.request<LoginPayload>(
        LOGIN_WITH_GOOGLE,
        {
          code,
          redirectUri,
        },
      );

      setUser(data.loginWithGoogle.user);
      setCsrfToken(data.loginWithGoogle.csrfToken);
      setCSRFToken(data.loginWithGoogle.csrfToken);

      return data.loginWithGoogle.user;
    },
    [setUser, setCsrfToken],
  );

  const loginWithPasskey = useCallback(async () => {
    const result = await authenticateWithPasskey();

    setUser(result.user);
    setCsrfToken(result.csrfToken);
    setCSRFToken(result.csrfToken);

    return result.user;
  }, [setUser, setCsrfToken]);

  const addPasskey = useCallback(async () => {
    await registerPasskey();
  }, []);

  const logout = useCallback(async () => {
    await graphqlClient.request(LOGOUT);
    setUser(null);
    setCsrfToken(null);
    setCSRFToken('');
  }, [setUser, setCsrfToken]);

  const refreshToken = useCallback(async () => {
    try {
      await graphqlClient.request(REFRESH_TOKEN);
      return true;
    } catch {
      setSessionExpired(true);
      return false;
    }
  }, [setSessionExpired]);

  const fetchCurrentUser = useCallback(async () => {
    try {
      const data = await graphqlClient.request<MePayload>(GET_ME);
      if (data.me) {
        setUser(data.me);
      }
      return data.me;
    } catch {
      return null;
    }
  }, [setUser]);

  return {
    user,
    isAuthenticated,
    csrfToken,
    loginWithGoogle,
    loginWithPasskey,
    addPasskey,
    isPasskeySupported: isPasskeySupported(),
    logout,
    refreshToken,
    fetchCurrentUser,
  };
}
