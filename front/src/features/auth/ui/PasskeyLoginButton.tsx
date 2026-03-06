'use client';

import { useCallback, useState } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FingerprintIcon from '@mui/icons-material/Fingerprint';

interface PasskeyLoginButtonProps {
  onLogin: () => Promise<unknown>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function PasskeyLoginButton({
  onLogin,
  onSuccess,
  onError,
}: PasskeyLoginButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      await onLogin();
      onSuccess?.();
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error('패스키 로그인 실패'));
    } finally {
      setLoading(false);
    }
  }, [onLogin, onSuccess, onError]);

  return (
    <Button
      variant="outlined"
      onClick={handleClick}
      disabled={loading}
      startIcon={
        loading ? (
          <CircularProgress size={20} color="inherit" />
        ) : (
          <FingerprintIcon />
        )
      }
      sx={{
        textTransform: 'none',
        fontWeight: 500,
      }}
    >
      패스키로 로그인
    </Button>
  );
}
