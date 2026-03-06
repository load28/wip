'use client';

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import FolderIcon from '@mui/icons-material/Folder';
import TaskIcon from '@mui/icons-material/Task';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from '@/features/auth';
import { useProjects } from '@/features/project';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography color="text.secondary" variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold">
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              backgroundColor: `${color}.light`,
              borderRadius: 2,
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { projects, fetchProjects } = useProjects();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const stats = {
    projects: projects.length,
    tasks: 0, // TODO: 전체 태스크 수 API 연동
    completed: 0, // TODO: 완료된 태스크 수 API 연동
  };

  return (
    <Box>
      <Box mb={4}>
        <Typography variant="h4" fontWeight="bold">
          {t('dashboard.header.welcome')}
          {user?.name && `, ${user.name}`}
        </Typography>
        <Typography color="text.secondary">
          {t('dashboard.header.description')}
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title={t('dashboard.stats.projects')}
            value={stats.projects}
            icon={<FolderIcon sx={{ color: 'primary.main' }} />}
            color="primary"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title={t('dashboard.stats.tasks')}
            value={stats.tasks}
            icon={<TaskIcon sx={{ color: 'info.main' }} />}
            color="info"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <StatCard
            title={t('dashboard.stats.completed')}
            value={stats.completed}
            icon={<CheckCircleIcon sx={{ color: 'success.main' }} />}
            color="success"
          />
        </Grid>
      </Grid>
    </Box>
  );
}
