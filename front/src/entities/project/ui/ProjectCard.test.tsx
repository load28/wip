import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { ProjectCard } from './ProjectCard';

describe('ProjectCard', () => {
  const mockProject = {
    id: 'project-1',
    name: '테스트 프로젝트',
    description: '프로젝트 설명',
    ownerId: 'user-1',
    createdAt: '2025-01-26',
    updatedAt: '2025-01-26',
  };

  it('프로젝트 이름이 표시된다', () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText('테스트 프로젝트')).toBeInTheDocument();
  });

  it('클릭하면 onClick이 호출된다', () => {
    const onClick = vi.fn();
    render(<ProjectCard project={mockProject} onClick={onClick} />);

    fireEvent.click(screen.getByText('테스트 프로젝트'));
    expect(onClick).toHaveBeenCalled();
  });
});
