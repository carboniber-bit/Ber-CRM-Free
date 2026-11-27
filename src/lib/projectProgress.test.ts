import { describe, expect, it } from 'vitest'
import type { ProjectTask } from '../types/project'
import { calculateProjectProgress, suggestProjectDueDate } from './projectProgress'

const task = (status: ProjectTask['status']): ProjectTask => ({
  id: status, owner_id: 'owner', project_id: 'project', title: status,
  description: null, status, responsible_name: null, start_date: null,
  due_date: null, priority: 'medium', position: 0, notes: null,
  completed_at: null, cancelled_at: null, created_at: '', updated_at: '',
})

describe('calculateProjectProgress', () => {
  it('ignora tarefas canceladas no denominador', () => {
    expect(calculateProjectProgress([task('completed'), task('pending'), task('cancelled')]))
      .toEqual({ progressPercent: 50, activeTasks: 2, completedTasks: 1 })
  })

  it('retorna null quando não há tarefas ativas', () => {
    expect(calculateProjectProgress([])).toEqual({ progressPercent: null, activeTasks: 0, completedTasks: 0 })
    expect(calculateProjectProgress([task('cancelled')])).toEqual({ progressPercent: null, activeTasks: 0, completedTasks: 0 })
  })

  it('retorna 100 quando todas as tarefas ativas foram concluídas', () => {
    expect(calculateProjectProgress([task('completed'), task('completed')]).progressPercent).toBe(100)
  })
})

describe('suggestProjectDueDate', () => {
  it('sugere 15 dias para site e 7 para social media', () => {
    expect(suggestProjectDueDate('Site institucional', '2026-11-25')).toBe('2026-12-10')
    expect(suggestProjectDueDate('Social media', '2026-11-25')).toBe('2026-12-02')
  })

  it('retorna null sem início e usa 15 dias para serviço desconhecido', () => {
    expect(suggestProjectDueDate('Consultoria', null)).toBeNull()
    expect(suggestProjectDueDate('Consultoria', '2026-11-25')).toBe('2026-12-10')
  })

  it('rejeita formato inválido e datas inexistentes no calendário real', () => {
    expect(suggestProjectDueDate('Site institucional', '2026-2-03')).toBeNull()
    expect(suggestProjectDueDate('Site institucional', '2026/11/25')).toBeNull()
    expect(suggestProjectDueDate('Site institucional', '2026-13-01')).toBeNull()
    expect(suggestProjectDueDate('Site institucional', '2026-02-30')).toBeNull()
  })

  it('soma dias em UTC na virada de mês e de ano e retorna YYYY-MM-DD', () => {
    expect(suggestProjectDueDate('Site institucional', '2026-11-20')).toBe('2026-12-05')
    expect(suggestProjectDueDate('Site institucional', '2026-12-20')).toBe('2027-01-04')
    expect(suggestProjectDueDate('Social media', '2026-12-28')).toBe('2027-01-04')

    const result = suggestProjectDueDate('Site institucional', '2026-12-20')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toHaveLength(10)
  })
})
