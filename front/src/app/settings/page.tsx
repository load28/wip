'use client';

import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { themeModeAtom, ThemeMode } from '@/shared/store';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [themeMode, setThemeMode] = useAtom(themeModeAtom);

  const handleLanguageChange = (language: string) => {
    i18n.changeLanguage(language);
  };

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

      <Card>
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
    </Box>
  );
}
