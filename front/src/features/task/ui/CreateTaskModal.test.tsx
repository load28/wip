import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'task.form.createTitle': '새 태스크 생성',
        'task.form.title': '제목',
        'task.form.titleRequired': '제목을 입력해주세요',
        'task.form.description': '설명',
        'task.form.submit': '생성',
        'task.form.cancel': '취소',
        'task.card.priority': '우선순위',
        'task.priority.low': '낮음',
        'task.priority.medium': '보통',
        'task.priority.high': '높음',
      };
      return translations[key] || key;
    },
  }),
}));

import { CreateTaskModal } from './CreateTaskModal';

describe('CreateTaskModal', () => {
  const defaultProps = {
    open: true,
    projectId: 'project-1',
    onClose: vi.fn(),
    onSubmit: vi.fn(),
  };

  it('모달이 열리면 제목 입력 필드가 표시된다', () => {
    render(<CreateTaskModal {...defaultProps} />);
    expect(screen.getByLabelText('제목')).toBeInTheDocument();
  });

  it('제목 없이 제출하면 에러가 표시된다', async () => {
    render(<CreateTaskModal {...defaultProps} />);

    fireEvent.click(screen.getByText('생성'));

    expect(await screen.findByText('제목을 입력해주세요')).toBeInTheDocument();
  });
});
