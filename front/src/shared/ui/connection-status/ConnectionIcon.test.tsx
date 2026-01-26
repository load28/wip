import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { ConnectionIcon } from './ConnectionIcon';
import { connectionStatusAtom } from '@/shared/store/connection';

describe('ConnectionIcon', () => {
  it('온라인 상태에서 초록색 아이콘을 표시한다', () => {
    const store = createStore();
    store.set(connectionStatusAtom, 'online');

    render(
      <Provider store={store}>
        <ConnectionIcon />
      </Provider>
    );

    expect(screen.getByTitle('online')).toBeInTheDocument();
  });

  it('오프라인 상태에서 회색 아이콘을 표시한다', () => {
    const store = createStore();
    store.set(connectionStatusAtom, 'offline');

    render(
      <Provider store={store}>
        <ConnectionIcon />
      </Provider>
    );

    expect(screen.getByTitle('offline')).toBeInTheDocument();
  });
});
