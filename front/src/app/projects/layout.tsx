'use client';

import { ReactNode } from 'react';
import { AuthGuard } from '@/features/auth';
import { AppLayout } from '@/widgets/layout';

interface ProjectsLayoutProps {
  children: ReactNode;
}

export default function ProjectsLayout({ children }: ProjectsLayoutProps) {
  return (
    <AuthGuard>
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  );
}
