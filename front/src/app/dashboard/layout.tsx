'use client';

import { ReactNode } from 'react';
import { AuthGuard } from '@/features/auth';
import { AppLayout } from '@/widgets/layout';

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <AppLayout>{children}</AppLayout>
    </AuthGuard>
  );
}
