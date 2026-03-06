'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useTranslation } from 'react-i18next';
import { usePasskey } from '../model/usePasskey';

interface PasskeyRegisterButtonProps {
  onSuccess?: () => void;
}

export function PasskeyRegisterButton({
  onSuccess,
}: PasskeyRegisterButtonProps) {
  const { t } = useTranslation();
  const { registerPasskey, loading, error } = usePasskey();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const handleRegister = async () => {
    const passkeyName = name.trim() || 'My Passkey';
    const success = await registerPasskey(passkeyName);
    if (success) {
      setOpen(false);
      setName('');
      onSuccess?.();
    }
  };

  return (
    <>
      <Button
        variant="outlined"
        onClick={() => setOpen(true)}
        startIcon={<FingerprintIcon />}
        sx={{ textTransform: 'none' }}
      >
        {t('auth.passkey.register')}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('auth.passkey.registerTitle')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label={t('auth.passkey.name')}
            fullWidth
            variant="outlined"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Passkey"
          />
          {error && (
            <span style={{ color: 'red', fontSize: '0.85rem', marginTop: 8 }}>
              {error}
            </span>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
          <Button
            onClick={handleRegister}
            disabled={loading}
            variant="contained"
            startIcon={
              loading ? <CircularProgress size={16} color="inherit" /> : null
            }
          >
            {t('auth.passkey.register')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
