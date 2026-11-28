// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { PROJECT_STATUSES } from '../../types/project'
import { PROJECT_STATUS_LABELS, ProjectStatusBadge } from './ProjectStatusBadge'

afterEach(cleanup)

describe('ProjectStatusBadge', () => {
  it('renderiza todos os status de projeto com label próprio', () => {
    render(<div>{PROJECT_STATUSES.map((status) => <ProjectStatusBadge key={status} status={status} />)}</div>)
    for (const status of PROJECT_STATUSES) {
      expect(screen.getByText(PROJECT_STATUS_LABELS[status]).textContent).toBe(PROJECT_STATUS_LABELS[status])
    }
    expect(screen.queryByText('Em negociação')).toBeNull()
  })
})
