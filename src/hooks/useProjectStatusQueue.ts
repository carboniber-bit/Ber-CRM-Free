import { useCallback, useEffect, useRef, useState } from 'react'
import { setProjectStatus } from '../services/projectService'
import type { ProjectListItem, ProjectMoveStatus } from '../types/project'

export interface UseProjectStatusQueueOptions {
  projects: ProjectListItem[]
  onChange: (projects: ProjectListItem[]) => void
  onRefresh: () => Promise<void>
}

export interface UseProjectStatusQueueResult {
  projects: ProjectListItem[]
  pendingIds: ReadonlySet<string>
  moveProject: (id: string, status: ProjectMoveStatus) => Promise<void>
  requestRefresh: () => Promise<void>
}

function sameProjectReferences(
  current: ProjectListItem[],
  incoming: ProjectListItem[],
): boolean {
  return current.length === incoming.length
    && current.every((project, index) => project === incoming[index])
}

export function useProjectStatusQueue(
  options: UseProjectStatusQueueOptions,
): UseProjectStatusQueueResult {
  const [projects, setProjects] = useState(options.projects)
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(() => new Set())
  const projectsRef = useRef(options.projects)
  const onChangeRef = useRef(options.onChange)
  const onRefreshRef = useRef(options.onRefresh)
  const pendingMovesRef = useRef(0)
  const pendingCountsRef = useRef(new Map<string, number>())
  const mutationVersionRef = useRef(0)
  const latestIntentVersionRef = useRef(new Map<string, number>())
  const confirmedStatusRef = useRef(new Map<string, ProjectListItem['status']>())
  const queuesRef = useRef(new Map<string, Promise<void>>())
  const refreshAfterMovesRef = useRef(false)
  const pendingExternalProjectsRef = useRef(new Map<string, ProjectListItem>())
  const mountedRef = useRef(true)
  const lastExternalProjectsRef = useRef(options.projects)

  const updateProjects = useCallback((updater: (current: ProjectListItem[]) => ProjectListItem[]) => {
    const next = updater(projectsRef.current)
    projectsRef.current = next
    if (!mountedRef.current) return
    setProjects(next)
    onChangeRef.current(next)
  }, [])

  const syncPendingIds = useCallback(() => {
    if (!mountedRef.current) return
    setPendingIds(new Set(pendingCountsRef.current.keys()))
  }, [])

  const reconcileExternalProject = useCallback((id: string) => {
    const external = pendingExternalProjectsRef.current.get(id)
    if (!external) return
    pendingExternalProjectsRef.current.delete(id)

    const current = projectsRef.current.find((project) => project.id === id)
    if (!current) return
    const status = confirmedStatusRef.current.get(id) ?? current.status
    const next = projectsRef.current.map((project) => (
      project.id === id ? { ...external, status } : project
    ))
    projectsRef.current = next
    if (!mountedRef.current) return
    setProjects(next)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    for (const project of projectsRef.current) {
      if (!confirmedStatusRef.current.has(project.id)) {
        confirmedStatusRef.current.set(project.id, project.status)
      }
    }
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    onChangeRef.current = options.onChange
    onRefreshRef.current = options.onRefresh

    const incoming = options.projects
    if (sameProjectReferences(lastExternalProjectsRef.current, incoming)) {
      lastExternalProjectsRef.current = incoming
      return
    }
    lastExternalProjectsRef.current = incoming

    const next = incoming.map((incomingProject) => {
      if (!pendingCountsRef.current.has(incomingProject.id)) {
        confirmedStatusRef.current.set(incomingProject.id, incomingProject.status)
        return incomingProject
      }

      pendingExternalProjectsRef.current.set(incomingProject.id, incomingProject)
      return projectsRef.current.find((project) => project.id === incomingProject.id)
        ?? incomingProject
    })
    projectsRef.current = next
    if (!mountedRef.current) return
    setProjects(next)
  }, [options.projects, options.onChange, options.onRefresh])

  const moveProject = useCallback((id: string, status: ProjectMoveStatus): Promise<void> => {
    const current = projectsRef.current.find((project) => project.id === id)
    if (!current || current.status === status || current.status === 'delivered') {
      return Promise.resolve()
    }

    const version = ++mutationVersionRef.current
    latestIntentVersionRef.current.set(id, version)
    pendingMovesRef.current += 1
    pendingCountsRef.current.set(id, (pendingCountsRef.current.get(id) ?? 0) + 1)
    if (!confirmedStatusRef.current.has(id)) {
      confirmedStatusRef.current.set(id, current.status)
    }
    syncPendingIds()
    updateProjects((items) => items.map((project) => (
      project.id === id ? { ...project, status } : project
    )))

    const run = async () => {
      try {
        const updated = await setProjectStatus(id, status)
        confirmedStatusRef.current.set(id, updated.status)
        mutationVersionRef.current += 1
        if (latestIntentVersionRef.current.get(id) === version) {
          updateProjects((items) => items.map((project) => (
            project.id === id ? { ...project, ...updated, client_name: project.client_name } : project
          )))
        }
      } catch (error) {
        mutationVersionRef.current += 1
        if (latestIntentVersionRef.current.get(id) === version) {
          const fallback = confirmedStatusRef.current.get(id) ?? current.status
          updateProjects((items) => items.map((project) => (
            project.id === id && project.status === status
              ? { ...project, status: fallback }
              : project
          )))
        }
        throw error
      } finally {
        pendingMovesRef.current -= 1
        const remaining = pendingCountsRef.current.get(id) ?? 1
        if (remaining <= 1) {
          pendingCountsRef.current.delete(id)
          reconcileExternalProject(id)
        } else {
          pendingCountsRef.current.set(id, remaining - 1)
        }
        syncPendingIds()
        if (pendingMovesRef.current === 0 && refreshAfterMovesRef.current) {
          refreshAfterMovesRef.current = false
          void onRefreshRef.current().catch(() => undefined)
        }
      }
    }

    const pending = queuesRef.current.get(id)
    const task = pending ? pending.then(run, run) : run()
    queuesRef.current.set(id, task)
    const cleanup = () => {
      if (queuesRef.current.get(id) === task) queuesRef.current.delete(id)
    }
    void task.then(cleanup, cleanup)
    return task
  }, [reconcileExternalProject, syncPendingIds, updateProjects])

  const requestRefresh = useCallback(async (): Promise<void> => {
    if (pendingMovesRef.current > 0) {
      refreshAfterMovesRef.current = true
      return
    }
    await onRefreshRef.current()
  }, [])

  return { projects, pendingIds, moveProject, requestRefresh }
}
