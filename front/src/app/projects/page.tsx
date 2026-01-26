'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import CircularProgress from '@mui/material/CircularProgress';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import { useProjects } from '@/features/project';
import { CreateProjectModal } from '@/features/project/ui/CreateProjectModal';
import { ProjectCard } from '@/entities/project';

export default function ProjectsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { projects, isLoading, fetchProjects } = useProjects();
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleProjectClick = (projectId: string) => {
    router.push(`/projects/${projectId}`);
  };

  return (
    <Box>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" fontWeight="bold">
          {t('project.list.title')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsModalOpen(true)}
        >
          {t('project.list.create')}
        </Button>
      </Box>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : projects.length === 0 ? (
        <Box textAlign="center" py={4}>
          <FolderIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography color="text.secondary">
            {t('project.list.empty')}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={3}>
          {projects.map((project) => (
            <Grid key={project.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <ProjectCard
                project={project}
                onClick={() => handleProjectClick(project.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <CreateProjectModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </Box>
  );
}
