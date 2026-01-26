import { HTMLAttributes } from 'react';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'circle' | 'box';
  animation?: 'pulse' | 'wave';
}

export const Skeleton = ({
  width,
  height,
  variant = 'box',
  animation = 'pulse',
  className = '',
  style,
  ...props
}: SkeletonProps) => {
  const variantClasses = {
    text: 'rounded h-4',
    circle: 'rounded-full',
    box: 'rounded-md',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-pulse',
  };

  const combinedStyle = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    ...style,
  };

  return (
    <div
      className={`bg-gray-200 ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={combinedStyle}
      {...props}
    />
  );
};
