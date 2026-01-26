import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  describe('기본 렌더링', () => {
    it('기본 스켈레톤이 렌더링된다', () => {
      render(<Skeleton data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    });

    it('지정된 너비와 높이가 적용된다', () => {
      render(<Skeleton width={100} height={50} data-testid="skeleton" />);
      const skeleton = screen.getByTestId('skeleton');
      expect(skeleton).toHaveStyle({ width: '100px', height: '50px' });
    });
  });

  describe('variant', () => {
    it('text variant는 rounded 스타일이 적용된다', () => {
      render(<Skeleton variant="text" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('rounded');
    });

    it('circle variant는 rounded-full 스타일이 적용된다', () => {
      render(<Skeleton variant="circle" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('rounded-full');
    });

    it('box variant는 rounded-md 스타일이 적용된다', () => {
      render(<Skeleton variant="box" data-testid="skeleton" />);
      expect(screen.getByTestId('skeleton')).toHaveClass('rounded-md');
    });
  });
});
