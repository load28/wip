'use client';

import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { useProjects } from '../model/useProjects';

const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, '프로젝트 이름을 입력해주세요')
    .max(100, '프로젝트 이름은 100자 이내로 입력해주세요'),
  description: z
    .string()
    .max(500, '설명은 500자 이내로 입력해주세요')
    .optional(),
});

type CreateProjectFormData = z.infer<typeof createProjectSchema>;

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
}

export function CreateProjectModal({ open, onClose }: CreateProjectModalProps) {
  const { t } = useTranslation();
  const { createProject, isLoading } = useProjects();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateProjectFormData>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = useCallback(
    async (data: CreateProjectFormData) => {
      try {
        await createProject(data);
        reset();
        onClose();
      } catch {
        // Error is handled in useProjects
      }
    },
    [createProject, reset, onClose]
  );

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{t('project.form.createTitle')}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <TextField
              {...register('name')}
              label={t('project.form.title')}
              error={!!errors.name}
              helperText={errors.name?.message}
              fullWidth
              autoFocus
            />
            <TextField
              {...register('description')}
              label={t('project.form.description')}
              error={!!errors.description}
              helperText={errors.description?.message}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isLoading}>
            {t('project.form.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            startIcon={isLoading ? <CircularProgress size={16} /> : null}
          >
            {t('project.form.submit')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
