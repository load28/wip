'use client';

import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import { themeModeAtom, ThemeMode } from '@/shared/store';
import { useAuth } from '@/features/auth';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [themeMode, setThemeMode] = useAtom(themeModeAtom);
  const { addPasskey, isPasskeySupported } = useAuth();
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language);
  };

  const handleAddPasskey = useCallback(async () => {
    setPasskeyLoading(true);
    setPasskeyMessage(null);
    try {
      await addPasskey();
      setPasskeyMessage({
        type: 'success',
        text: '패스키가 등록되었습니다.',
      });
    } catch (err) {
      setPasskeyMessage({
        type: 'error',
        text:
          err instanceof Error ? err.message : '패스키 등록에 실패했습니다.',
      });
    } finally {
      setPasskeyLoading(false);
    }
  }, [addPasskey]);

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={3}>
        {t('settings.title')}
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="medium" mb={2}>
            {t('settings.language')}
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="language-select-label">
              {t('settings.language')}
            </InputLabel>
            <Select
              labelId="language-select-label"
              value={i18n.language}
              label={t('settings.language')}
              onChange={(e) => handleLanguageChange(e.target.value)}
            >
              <MenuItem value="ko">한국어</MenuItem>
              <MenuItem value="en">English</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="medium" mb={2}>
            {t('settings.theme')}
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="theme-select-label">
              {t('settings.theme')}
            </InputLabel>
            <Select
              labelId="theme-select-label"
              value={themeMode}
              label={t('settings.theme')}
              onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
            >
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {isPasskeySupported && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight="medium" mb={1}>
              패스키
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              패스키를 등록하면 비밀번호 없이 지문, 얼굴 인식 등으로 로그인할 수
              있습니다.
            </Typography>

            {passkeyMessage && (
              <Alert
                severity={passkeyMessage.type}
                onClose={() => setPasskeyMessage(null)}
                sx={{ mb: 2 }}
              >
                {passkeyMessage.text}
              </Alert>
            )}

            <Button
              variant="outlined"
              onClick={handleAddPasskey}
              disabled={passkeyLoading}
              startIcon={
                passkeyLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  <FingerprintIcon />
                )
              }
            >
              패스키 등록
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
