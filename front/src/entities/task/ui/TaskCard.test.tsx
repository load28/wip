import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'task.card.dueDate': '마감일',
        'task.priority.low': '낮음',
        'task.priority.medium': '보통',
        'task.priority.high': '높음',
      };
      return translations[key] || key;
    },
  }),
}));

import { TaskCard } from './TaskCard';

describe('TaskCard', () => {
  const mockTask = {
    id: '1',
    title: '테스트 태스크',
    description: '태스크 설명',
    status: 'TODO' as const,
    priority: 'HIGH' as const,
    projectId: 'project-1',
    createdAt: '2025-01-26T00:00:00Z',
    updatedAt: '2025-01-26T00:00:00Z',
  };

  it('태스크 제목이 표시된다', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('테스트 태스크')).toBeInTheDocument();
  });

  it('우선순위 배지가 표시된다', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('높음')).toBeInTheDocument();
  });
});
