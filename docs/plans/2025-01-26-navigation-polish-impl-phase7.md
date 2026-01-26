# Phase 7: 네비게이션 및 UI 개선 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 프로젝트 목록에서 상세 페이지 이동, 프로젝트 카드 클릭 기능, 대시보드 통계

**Architecture:** FSD 구조에 따라 기존 컴포넌트 개선

**Tech Stack:** Next.js, MUI, Jotai, react-i18next

---

## Task 1: 프로젝트 카드에 클릭 이벤트 추가

**Files:**
- Create: `front/src/entities/project/ui/ProjectCard.tsx`
- Create: `front/src/entities/project/ui/ProjectCard.test.tsx`
- Create: `front/src/entities/project/ui/index.ts`
- Create: `front/src/entities/project/index.ts`

**Step 1: 테스트 작성**

```typescript
// front/src/entities/project/ui/ProjectCard.test.tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { ProjectCard } from './ProjectCard';

describe('ProjectCard', () => {
  const mockProject = {
    id: 'project-1',
    name: '테스트 프로젝트',
    description: '프로젝트 설명',
  };

  it('프로젝트 이름이 표시된다', () => {
    render(<ProjectCard project={mockProject} />);
    expect(screen.getByText('테스트 프로젝트')).toBeInTheDocument();
  });

  it('클릭하면 onClick이 호출된다', () => {
    const onClick = vi.fn();
    render(<ProjectCard project={mockProject} onClick={onClick} />);

    fireEvent.click(screen.getByText('테스트 프로젝트'));
    expect(onClick).toHaveBeenCalled();
  });
});
```

**Step 2: ProjectCard 구현**

```typescript
// front/src/entities/project/ui/ProjectCard.tsx
'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';
import type { Project } from '@/features/project';

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
}

export function ProjectCard({ project, onClick }: ProjectCardProps) {
  return (
    <Card>
      <CardActionArea onClick={onClick}>
        <CardContent>
          <Typography variant="h6" fontWeight="medium" gutterBottom>
            {project.name}
          </Typography>
          {project.description && (
            <Typography variant="body2" color="text.secondary">
              {project.description}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
```

**Step 3: 테스트 실행**

**Step 4: 커밋**

---

## Task 2: 프로젝트 목록 페이지에 ProjectCard 적용

**Files:**
- Modify: `front/src/app/projects/page.tsx`

**Step 1: 페이지 수정**

- useRouter를 사용하여 프로젝트 클릭 시 `/projects/[id]`로 이동
- ProjectCard 컴포넌트 사용

**Step 2: 테스트 실행**

**Step 3: 커밋**

---

## Task 3: 대시보드 통계 표시 개선

**Files:**
- Modify: `front/src/app/dashboard/page.tsx`

**Step 1: 통계 카드에 실제 데이터 연결**

- useProjects로 프로젝트 수 표시
- useTasks 또는 통계 API로 태스크 수 표시

**Step 2: 테스트 실행**

**Step 3: 커밋**

---

## Task 4: 전체 테스트 및 검증

**Step 1: 전체 프론트엔드 테스트 실행**

```bash
cd front && bun run vitest run
```

**Step 2: 백엔드 빌드 확인**

```bash
cd backend && cargo check
```

---

## 검증 체크리스트

| 항목 | 설계 규칙 | 확인 |
|------|----------|:----:|
| FSD 레이어 | entities/project 추가 | |
| 네비게이션 | 프로젝트 클릭 → 상세 페이지 | |
| 테스트 | TDD, 한글 명세 | |
