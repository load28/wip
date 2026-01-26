import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import {
  currentUserAtom,
  isAuthenticatedAtom,
  isSessionExpiredAtom,
} from './auth';

describe('auth store', () => {
  it('초기 상태에서 사용자는 null이다', () => {
    const store = createStore();
    expect(store.get(currentUserAtom)).toBeNull();
  });

  it('초기 상태에서 인증되지 않은 상태이다', () => {
    const store = createStore();
    expect(store.get(isAuthenticatedAtom)).toBe(false);
  });

  it('사용자가 설정되면 인증된 상태가 된다', () => {
    const store = createStore();
    store.set(currentUserAtom, {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
    });
    expect(store.get(isAuthenticatedAtom)).toBe(true);
  });

  it('세션 만료 상태를 설정할 수 있다', () => {
    const store = createStore();
    expect(store.get(isSessionExpiredAtom)).toBe(false);
    store.set(isSessionExpiredAtom, true);
    expect(store.get(isSessionExpiredAtom)).toBe(true);
  });
});
