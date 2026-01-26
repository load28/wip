'use client';

import { ReactNode } from 'react';
import { AuthGuard } from '@/features/auth';
import { AppLayout } from '@/widgets/layout';

interface ProjectDetailLayoutProps {
  children: ReactNode;
}

export default function ProjectDetailLayout({
  children,
}: ProjectDetailLayoutProps) {
  return (
    <AuthGuard>
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  );
}
