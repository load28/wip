'use client';

import { useCallback, useState } from 'react';
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';
import { useAtom, useSetAtom } from 'jotai';
import { graphqlClient, setCSRFToken } from '@/shared/api';
import {
  currentUserAtom,
  csrfTokenAtom,
  User,
} from '@/shared/store/auth';
import {
  START_PASSKEY_REGISTRATION,
  FINISH_PASSKEY_REGISTRATION,
  START_PASSKEY_AUTHENTICATION,
  FINISH_PASSKEY_AUTHENTICATION,
} from '../api/auth.graphql';

interface StartRegistrationPayload {
  startPasskeyRegistration: {
    challengeId: string;
    optionsJson: string;
  };
}

interface StartAuthenticationPayload {
  startPasskeyAuthentication: {
    challengeId: string;
    optionsJson: string;
  };
}

interface FinishAuthenticationPayload {
  finishPasskeyAuthentication: {
    user: User;
    csrfToken: string;
  };
}

export function usePasskey() {
  const [user, setUser] = useAtom(currentUserAtom);
  const [, setCsrfToken] = useAtom(csrfTokenAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /// 패스키 등록 (로그인된 사용자가 패스키 추가)
  const registerPasskey = useCallback(
    async (name: string = 'My Passkey') => {
      setLoading(true);
      setError(null);

      try {
        // 1. 서버에서 등록 옵션 요청
        const startData =
          await graphqlClient.request<StartRegistrationPayload>(
            START_PASSKEY_REGISTRATION,
          );

        const { challengeId, optionsJson } =
          startData.startPasskeyRegistration;
        const options = JSON.parse(optionsJson);

        // 2. 브라우저 WebAuthn API로 크레덴셜 생성
        const credential = await startRegistration({ optionsJSON: options });

        // 3. 서버에 크레덴셜 등록 완료
        await graphqlClient.request(FINISH_PASSKEY_REGISTRATION, {
          challengeId,
          credentialJson: JSON.stringify(credential),
          name,
        });

        return true;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : '패스키 등록에 실패했습니다';
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  /// 패스키로 로그인
  const loginWithPasskey = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. 서버에서 인증 옵션 요청
      const startData =
        await graphqlClient.request<StartAuthenticationPayload>(
          START_PASSKEY_AUTHENTICATION,
        );

      const { challengeId, optionsJson } =
        startData.startPasskeyAuthentication;
      const options = JSON.parse(optionsJson);

      // 2. 브라우저 WebAuthn API로 인증
      const credential = await startAuthentication({ optionsJSON: options });

      // 3. 서버에 인증 완료 및 로그인
      const finishData =
        await graphqlClient.request<FinishAuthenticationPayload>(
          FINISH_PASSKEY_AUTHENTICATION,
          {
            challengeId,
            credentialJson: JSON.stringify(credential),
          },
        );

      const { user: loggedInUser, csrfToken } =
        finishData.finishPasskeyAuthentication;

      setUser(loggedInUser);
      setCsrfToken(csrfToken);
      setCSRFToken(csrfToken);

      return loggedInUser;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '패스키 로그인에 실패했습니다';
      setError(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [setUser, setCsrfToken]);

  return {
    registerPasskey,
    loginWithPasskey,
    loading,
    error,
  };
}
