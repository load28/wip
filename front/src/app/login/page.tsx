'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import Divider from '@mui/material/Divider';
import {
  useAuth,
  GoogleLoginButton,
  PasskeyLoginButton,
} from '@/features/auth';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, router]);

  const handlePasskeySuccess = () => {
    router.replace('/');
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
        <GoogleLoginButton />
        <Divider sx={{ width: '100%' }}>{t('auth.login.or')}</Divider>
        <PasskeyLoginButton onSuccess={handlePasskeySuccess} />
      </Paper>
    </Box>
  );
}
