import { describe, it, expect } from 'vitest';
import { createStore } from 'jotai';
import { sidebarOpenAtom, sidebarWidthAtom, toggleSidebarAtom } from './layout';

describe('layout store', () => {
  it('사이드바 초기 상태는 열려있다', () => {
    const store = createStore();
    expect(store.get(sidebarOpenAtom)).toBe(true);
  });

  it('사이드바 너비 기본값은 240이다', () => {
    const store = createStore();
    expect(store.get(sidebarWidthAtom)).toBe(240);
  });

  it('toggleSidebar는 사이드바 상태를 토글한다', () => {
    const store = createStore();
    expect(store.get(sidebarOpenAtom)).toBe(true);
    store.set(toggleSidebarAtom);
    expect(store.get(sidebarOpenAtom)).toBe(false);
    store.set(toggleSidebarAtom);
    expect(store.get(sidebarOpenAtom)).toBe(true);
  });
});
