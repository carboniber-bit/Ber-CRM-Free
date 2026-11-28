// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { ProjectPriority } from '../../types/project'
import { PROJECT_PRIORITY_LABELS, ProjectPriorityBadge } from './ProjectPriorityBadge'

afterEach(cleanup)

describe('ProjectPriorityBadge', () => {
  it('renderiza as quatro prioridades sem reutilizar labels de leads', () => {
    const priorities: ProjectPriority[] = ['very_high', 'high', 'medium', 'low']
    render(<div>{priorities.map((priority) => <ProjectPriorityBadge key={priority} priority={priority} />)}</div>)
    for (const priority of priorities) {
      expect(screen.getByText(PROJECT_PRIORITY_LABELS[priority]).textContent).toBe(PROJECT_PRIORITY_LABELS[priority])
    }
  })
})
