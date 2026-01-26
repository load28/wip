# Phase 5: 설정 페이지 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 사용자 설정 페이지 구현 - 언어 선택, 테마 전환

**Architecture:** FSD 구조에 따라 app/settings 페이지, shared/store에 설정 상태 관리

**Tech Stack:** Next.js, MUI, Jotai, react-i18next

---

## Task 1: 설정 페이지 구현

**Files:**
- Create: `front/src/app/settings/page.tsx`
- Create: `front/src/app/settings/page.test.tsx`
- Create: `front/src/app/settings/layout.tsx`

**Step 1: 테스트 작성**

```typescript
// front/src/app/settings/page.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import SettingsPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/settings',
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'settings.title': '설정',
        'settings.language': '언어',
        'settings.theme': '테마',
      };
      return translations[key] || key;
    },
    i18n: { language: 'ko', changeLanguage: vi.fn() },
  }),
}));

describe('SettingsPage', () => {
  it('설정 페이지가 렌더링된다', () => {
    const store = createStore();

    render(
      <Provider store={store}>
        <SettingsPage />
      </Provider>
    );

    expect(screen.getByText('설정')).toBeInTheDocument();
    expect(screen.getByText('언어')).toBeInTheDocument();
    expect(screen.getByText('테마')).toBeInTheDocument();
  });
});
```

**Step 2: 설정 페이지 구현**

```typescript
// front/src/app/settings/page.tsx
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
import { themeModeAtom } from '@/shared/store';

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
          <FormControl fullWidth>
            <InputLabel>{t('settings.language')}</InputLabel>
            <Select
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
          <FormControl fullWidth>
            <InputLabel>{t('settings.theme')}</InputLabel>
            <Select
              value={themeMode}
              label={t('settings.theme')}
              onChange={(e) => setThemeMode(e.target.value as 'light' | 'dark')}
            >
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>
    </Box>
  );
}
```

**Step 3: 레이아웃 구현**

**Step 4: 테스트 실행**

**Step 5: 커밋**

---

## Task 2: 전체 테스트 및 검증

**Step 1: 전체 프론트엔드 테스트 실행**

```bash
cd front && bun run vitest run
```

**Step 2: 백엔드 빌드 확인**

```bash
cd backend && cargo check
```

---

## 검증 체크리스트

| 항목 | 설계 규칙 | 확인 |
|------|----------|:----:|
| FSD 레이어 | app/settings 페이지 | |
| 상태 관리 | shared/store/theme.ts | |
| i18n | react-i18next 연동 | |
| 테스트 | TDD, 한글 명세 | |
