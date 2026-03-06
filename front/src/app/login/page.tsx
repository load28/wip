'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { useTranslation } from 'react-i18next';
import {
  useAuth,
  GoogleLoginButton,
  PasskeyLoginButton,
} from '@/features/auth';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated, loginWithPasskey, isPasskeySupported } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  const handlePasskeySuccess = useCallback(() => {
    router.replace('/');
  }, [router]);

  const handlePasskeyError = useCallback((err: Error) => {
    setError(err.message);
  }, []);

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

        {error && (
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <GoogleLoginButton />

        {isPasskeySupported && (
          <>
            <Divider sx={{ width: '100%' }}>OR</Divider>
            <PasskeyLoginButton
              onLogin={loginWithPasskey}
              onSuccess={handlePasskeySuccess}
              onError={handlePasskeyError}
            />
          </>
        )}
      </Paper>
    </Box>
  );
}
