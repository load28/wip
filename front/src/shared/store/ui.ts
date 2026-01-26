import { atom } from 'jotai';

export const sidebarOpenAtom = atom<boolean>(true);
export const modalOpenAtom = atom<string | null>(null);
