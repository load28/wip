'use client';

import { useAtom, useSetAtom } from 'jotai';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import SettingsIcon from '@mui/icons-material/Settings';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LogoutIcon from '@mui/icons-material/Logout';
import {
  sidebarOpenAtom,
  sidebarWidthAtom,
  toggleSidebarAtom,
} from '@/shared/store';
import { useAuth } from '@/features/auth';

const COLLAPSED_WIDTH = 64;

interface NavItem {
  key: string;
  path: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { key: 'nav.dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { key: 'nav.projects', path: '/projects', icon: <FolderIcon /> },
  { key: 'nav.settings', path: '/settings', icon: <SettingsIcon /> },
];

export function Sidebar() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen] = useAtom(sidebarOpenAtom);
  const [width] = useAtom(sidebarWidthAtom);
  const toggle = useSetAtom(toggleSidebarAtom);
  const { user, logout } = useAuth();

  const currentWidth = isOpen ? width : COLLAPSED_WIDTH;

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: currentWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: currentWidth,
          boxSizing: 'border-box',
          transition: 'width 0.2s ease-in-out',
          overflowX: 'hidden',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: isOpen ? 'space-between' : 'center',
          p: 2,
          minHeight: 64,
        }}
      >
        {isOpen && (
          <Typography variant="h6" noWrap>
            TaskFlow
          </Typography>
        )}
        <IconButton onClick={() => toggle()}>
          {isOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />}
        </IconButton>
      </Box>

      <Divider />

      <List>
        {navItems.map((item) => (
          <ListItem key={item.key} disablePadding>
            <ListItemButton
              selected={pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                minHeight: 48,
                justifyContent: isOpen ? 'initial' : 'center',
                px: 2.5,
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: isOpen ? 2 : 'auto',
                  justifyContent: 'center',
                }}
              >
                {item.icon}
              </ListItemIcon>
              {isOpen && <ListItemText primary={t(item.key)} />}
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Divider />

      {user && (
        <Box sx={{ p: 2 }}>
          {isOpen && (
            <Typography variant="body2" color="text.secondary" noWrap>
              {user.name || user.email}
            </Typography>
          )}
          <ListItemButton
            onClick={handleLogout}
            sx={{
              minHeight: 48,
              justifyContent: isOpen ? 'initial' : 'center',
              px: isOpen ? 0 : 2.5,
              mt: 1,
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                mr: isOpen ? 2 : 'auto',
                justifyContent: 'center',
              }}
            >
              <LogoutIcon />
            </ListItemIcon>
            {isOpen && <ListItemText primary={t('auth.logout.button')} />}
          </ListItemButton>
        </Box>
      )}
    </Drawer>
  );
}
