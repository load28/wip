import { atom } from 'jotai';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

// Base atoms
export const currentUserAtom = atom<User | null>(null);
export const csrfTokenAtom = atom<string | null>(null);
export const isSessionExpiredAtom = atom<boolean>(false);

// Derived atoms
export const isAuthenticatedAtom = atom((get) => get(currentUserAtom) !== null);
