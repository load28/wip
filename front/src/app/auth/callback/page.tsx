'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { useAuth } from '@/features/auth';
import { authConfig } from '@/shared/config/auth';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithGoogle } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // URL 파라미터 기반 초기 에러 감지 (동기적)
  const initialError = useMemo(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      return 'Google 로그인이 취소되었습니다.';
    }
    if (!searchParams.get('code')) {
      return '인증 코드가 없습니다.';
    }
    return null;
  }, [searchParams]);

  useEffect(() => {
    if (initialError || isProcessing) {
      return;
    }

    const code = searchParams.get('code');
    if (!code) {
      return;
    }

    const handleLogin = async () => {
      setIsProcessing(true);
      try {
        await loginWithGoogle(code, authConfig.redirectUri);
        router.replace('/');
      } catch (err) {
        setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
      }
    };

    handleLogin();
  }, [searchParams, loginWithGoogle, router, initialError, isProcessing]);

  const displayError = initialError || error;

  if (displayError) {
    return (
      <Box
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        minHeight="100vh"
        gap={2}
      >
        <Alert severity="error">{displayError}</Alert>
        <Typography
          component="a"
          href="/"
          sx={{ color: 'primary.main', textDecoration: 'underline' }}
        >
          홈으로 돌아가기
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      gap={2}
    >
      <CircularProgress />
      <Typography>로그인 중...</Typography>
    </Box>
  );
}
