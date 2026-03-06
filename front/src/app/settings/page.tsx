'use client';

import { useState, useRef } from 'react';
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
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import DeleteIcon from '@mui/icons-material/Delete';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import AddIcon from '@mui/icons-material/Add';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListItemSecondaryAction from '@mui/material/ListItemSecondaryAction';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { themeModeAtom, ThemeMode } from '@/shared/store';
import {
  isWebAuthnSupported,
  listPasskeys,
  registerPasskey,
  deletePasskey,
} from '@/features/auth/api/webauthn';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const [themeMode, setThemeMode] = useAtom(themeModeAtom);

  const [passkeys, setPasskeys] = useState<
    Array<{
      id: string;
      name: string;
      createdAt: string;
      lastUsedAt: string | null;
    }>
  >([]);
  const [passkeySupported] = useState(() => isWebAuthnSupported());
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [newPasskeyName, setNewPasskeyName] = useState('');
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const loadPasskeys = async () => {
    try {
      const list = await listPasskeys();
      setPasskeys(list);
    } catch {
      // 무시
    }
  };

  // React Compiler 허용 패턴: ref.current == null 체크로 1회 초기화
  const initialLoadRef = useRef<Promise<void> | null>(null);
  if (initialLoadRef.current == null) {
    initialLoadRef.current = listPasskeys()
      .then((list) => setPasskeys(list))
      .catch(() => {});
  }

  const handleRegisterPasskey = async () => {
    try {
      setPasskeyError(null);
      await registerPasskey(newPasskeyName || undefined);
      setRegisterDialogOpen(false);
      setNewPasskeyName('');
      await loadPasskeys();
    } catch (e) {
      setPasskeyError(e instanceof Error ? e.message : '패스키 등록 실패');
    }
  };

  const handleDeletePasskey = async (id: string) => {
    try {
      await deletePasskey(id);
      await loadPasskeys();
    } catch {
      // 무시
    }
  };

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

      {passkeySupported && (
        <Card sx={{ mt: 2 }}>
          <CardContent>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              mb={2}
            >
              <Typography variant="subtitle1" fontWeight="medium">
                패스키 관리
              </Typography>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setRegisterDialogOpen(true)}
              >
                패스키 등록
              </Button>
            </Box>

            {passkeys.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                등록된 패스키가 없습니다.
              </Typography>
            ) : (
              <List>
                {passkeys.map((pk) => (
                  <ListItem key={pk.id}>
                    <ListItemIcon>
                      <FingerprintIcon />
                    </ListItemIcon>
                    <ListItemText
                      primary={pk.name}
                      secondary={`등록: ${new Date(pk.createdAt).toLocaleDateString()}${
                        pk.lastUsedAt
                          ? ` · 마지막 사용: ${new Date(pk.lastUsedAt).toLocaleDateString()}`
                          : ''
                      }`}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleDeletePasskey(pk.id)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>

          <Dialog
            open={registerDialogOpen}
            onClose={() => setRegisterDialogOpen(false)}
          >
            <DialogTitle>새 패스키 등록</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                margin="dense"
                label="패스키 이름 (선택)"
                fullWidth
                value={newPasskeyName}
                onChange={(e) => setNewPasskeyName(e.target.value)}
                placeholder="예: MacBook Pro, iPhone"
              />
              {passkeyError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {passkeyError}
                </Alert>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRegisterDialogOpen(false)}>취소</Button>
              <Button onClick={handleRegisterPasskey} variant="contained">
                등록
              </Button>
            </DialogActions>
          </Dialog>
        </Card>
      )}
    </Box>
  );
}
