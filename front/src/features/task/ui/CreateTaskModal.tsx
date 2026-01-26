'use client';

import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import type { CreateTaskInput } from '../api/task.graphql';

interface CreateTaskModalProps {
  open: boolean;
  projectId: string;
  onClose: () => void;
  onSubmit: (data: CreateTaskInput) => Promise<void>;
}

const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'task.form.titleRequired')
    .max(100, 'task.form.titleMaxLength'),
  description: z
    .string()
    .max(1000, 'task.form.descriptionMaxLength')
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']).default('TODO'),
});

type FormData = z.infer<typeof createTaskSchema>;

export function CreateTaskModal({
  open,
  projectId,
  onClose,
  onSubmit,
}: CreateTaskModalProps) {
  const { t } = useTranslation();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    watch,
    setValue,
  } = useForm<FormData>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: {
      priority: 'MEDIUM',
      status: 'TODO',
    },
  });

  const handleFormSubmit = async (data: FormData) => {
    await onSubmit({
      ...data,
      projectId,
    });
    reset();
    onClose();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(handleFormSubmit)}>
        <DialogTitle>{t('task.form.createTitle')}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <TextField
              {...register('title')}
              label={t('task.form.title')}
              fullWidth
              error={!!errors.title}
              helperText={errors.title && t(errors.title.message as string)}
            />
            <TextField
              {...register('description')}
              label={t('task.form.description')}
              fullWidth
              multiline
              rows={3}
              error={!!errors.description}
              helperText={
                errors.description && t(errors.description.message as string)
              }
            />
            <FormControl fullWidth>
              <InputLabel>{t('task.card.priority')}</InputLabel>
              <Select
                value={watch('priority')}
                label={t('task.card.priority')}
                onChange={(e) =>
                  setValue(
                    'priority',
                    e.target.value as 'LOW' | 'MEDIUM' | 'HIGH'
                  )
                }
              >
                <MenuItem value="LOW">{t('task.priority.low')}</MenuItem>
                <MenuItem value="MEDIUM">{t('task.priority.medium')}</MenuItem>
                <MenuItem value="HIGH">{t('task.priority.high')}</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t('task.form.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {t('task.form.submit')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
