'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import AddIcon from '@mui/icons-material/Add';
import { useTasks, CreateTaskModal, CreateTaskInput } from '@/features/task';
import { useProjects } from '@/features/project';
import { TaskCard } from '@/entities/task';

const COLUMNS = ['TODO', 'IN_PROGRESS', 'DONE'] as const;

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { projects } = useProjects();
  const { tasksByStatus, createTask } = useTasks(id);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const project = projects.find((p) => p.id === id);

  const handleCreateTask = async (data: CreateTaskInput) => {
    await createTask(data);
  };

  const getStatusLabel = (status: string) => {
    const key = status.toLowerCase().replace('_', '');
    return t(`task.status.${key}`);
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
          {project?.name || t('common.loading')}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateModalOpen(true)}
        >
          {t('task.form.createTitle')}
        </Button>
      </Box>

      <Box display="flex" gap={2} sx={{ overflowX: 'auto', pb: 2 }}>
        {COLUMNS.map((status) => (
          <Paper
            key={status}
            sx={{
              minWidth: 300,
              p: 2,
              backgroundColor: 'grey.100',
              flex: '1 1 0',
            }}
          >
            <Typography variant="h6" fontWeight="medium" mb={2}>
              {getStatusLabel(status)}
              <Typography component="span" color="text.secondary" ml={1}>
                ({tasksByStatus[status]?.length || 0})
              </Typography>
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              {tasksByStatus[status]?.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
            </Box>
          </Paper>
        ))}
      </Box>

      <CreateTaskModal
        open={createModalOpen}
        projectId={id}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateTask}
      />
    </Box>
  );
}
