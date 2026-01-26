import { atom } from 'jotai';

export type ThemeMode = 'light' | 'dark' | 'system';

export const themeModeAtom = atom<ThemeMode>('system');
