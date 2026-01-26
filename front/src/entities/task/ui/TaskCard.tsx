'use client';

import { useTranslation } from 'react-i18next';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import type { Task } from '@/features/task';

interface TaskCardProps {
  task: Task;
  onClick?: () => void;
}

const priorityColors = {
  LOW: 'success',
  MEDIUM: 'warning',
  HIGH: 'error',
} as const;

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { t } = useTranslation();

  return (
    <Card
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': onClick ? { boxShadow: 3 } : undefined,
      }}
      onClick={onClick}
    >
      <CardContent>
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          {task.title}
        </Typography>
        {task.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {task.description}
          </Typography>
        )}
        <Box mt={2} display="flex" gap={1} flexWrap="wrap">
          <Chip
            label={t(`task.priority.${task.priority.toLowerCase()}`)}
            size="small"
            color={priorityColors[task.priority]}
          />
          {task.dueDate && (
            <Chip
              label={`${t('task.card.dueDate')}: ${new Date(task.dueDate).toLocaleDateString()}`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
