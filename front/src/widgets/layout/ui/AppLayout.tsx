'use client';

import { ReactNode } from 'react';
import { useAtom } from 'jotai';
import Box from '@mui/material/Box';
import { sidebarOpenAtom, sidebarWidthAtom } from '@/shared/store';
import { Sidebar } from '@/widgets/sidebar';

const COLLAPSED_WIDTH = 64;

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isOpen] = useAtom(sidebarOpenAtom);
  const [width] = useAtom(sidebarWidthAtom);

  const currentWidth = isOpen ? width : COLLAPSED_WIDTH;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <Box
        component="main"
        role="main"
        sx={{
          flexGrow: 1,
          p: 3,
          ml: `${currentWidth}px`,
          transition: 'margin-left 0.2s ease-in-out',
          backgroundColor: 'grey.50',
          minHeight: '100vh',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
