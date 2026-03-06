'use client';

import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { useTranslation } from 'react-i18next';
import { usePasskey } from '../model/usePasskey';

interface PasskeyLoginButtonProps {
  onSuccess?: () => void;
}

export function PasskeyLoginButton({ onSuccess }: PasskeyLoginButtonProps) {
  const { t } = useTranslation();
  const { loginWithPasskey, loading, error } = usePasskey();

  const handleClick = async () => {
    const user = await loginWithPasskey();
    if (user && onSuccess) {
      onSuccess();
    }
  };

  return (
    <>
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
        fullWidth
      >
        {t('auth.login.passkey')}
      </Button>
      {error && (
        <span style={{ color: 'red', fontSize: '0.85rem' }}>{error}</span>
      )}
    </>
  );
}
