import { atom } from 'jotai';

export type ConnectionStatus = 'online' | 'offline' | 'syncing';

export const connectionStatusAtom = atom<ConnectionStatus>('online');
