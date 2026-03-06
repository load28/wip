'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { useTranslation } from 'react-i18next';
import { useAuth, GoogleLoginButton } from '@/features/auth';
import {
  isWebAuthnSupported,
  isConditionalUISupported,
  authenticateWithConditionalUI,
} from '@/features/auth/api/webauthn';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, loginWithPasskey, fetchCurrentUser } = useAuth();
  const abortControllerRef = useRef<AbortController | null>(null);
  const [passkeySupported] = useState(() => isWebAuthnSupported());

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  // Conditional UI 시작
  useEffect(() => {
    let cancelled = false;

    const startConditionalUI = async () => {
      const supported = await isConditionalUISupported();
      if (!supported || cancelled) return;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const result = await authenticateWithConditionalUI(controller);
      if (result && !cancelled) {
        await fetchCurrentUser();
        router.replace('/');
      }
    };

    startConditionalUI();

    return () => {
      cancelled = true;
      abortControllerRef.current?.abort();
    };
  }, [router, fetchCurrentUser]);

  const handlePasskeyLogin = async () => {
    try {
      abortControllerRef.current?.abort();
      await loginWithPasskey();
      router.replace('/');
    } catch {
      // 사용자 취소 시 무시
    }
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      bgcolor="grey.100"
    >
      <Paper
        elevation={3}
        sx={{
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          minWidth: 320,
        }}
      >
        <Typography variant="h4" component="h1">
          {t('auth.login.title')}
        </Typography>
        <Typography variant="body1" color="text.secondary" textAlign="center">
          {t('auth.login.description')}
        </Typography>

        {/* Conditional UI용 숨겨진 input */}
        <input
          type="text"
          autoComplete="username webauthn"
          style={{
            position: 'absolute',
            opacity: 0,
            width: 0,
            height: 0,
          }}
          tabIndex={-1}
        />

        <GoogleLoginButton />

        {passkeySupported && (
          <>
            <Divider sx={{ width: '100%' }}>{t('auth.login.or')}</Divider>
            <Button
              variant="outlined"
              onClick={handlePasskeyLogin}
              startIcon={<FingerprintIcon />}
              sx={{ textTransform: 'none', fontWeight: 500 }}
              fullWidth
            >
              {t('auth.login.passkey')}
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
}
