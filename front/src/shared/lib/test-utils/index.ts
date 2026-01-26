import { describe, it } from 'vitest';

// BDD 스타일 헬퍼
export const context = describe;
export const given = describe;
export const when = describe;
export const then = it;

// Re-export testing library
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
