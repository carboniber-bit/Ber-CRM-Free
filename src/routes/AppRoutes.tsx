import { Route, Routes } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout'
import { AppLayout } from '../layouts/AppLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { LeadsPage } from '../pages/LeadsPage'
import { OpportunitiesPage } from '../pages/OpportunitiesPage'
import { PipelinePage } from '../pages/PipelinePage'
import { LeadNewPage } from '../pages/LeadNewPage'
import { LeadDetailPage } from '../pages/LeadDetailPage'
import { LeadEditPage } from '../pages/LeadEditPage'
import { FollowUpsPage } from '../pages/FollowUpsPage'
import { StatusPage } from '../pages/StatusPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>
      <Route path="/status" element={<StatusPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/oportunidades" element={<OpportunitiesPage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/followups" element={<FollowUpsPage />} />
          <Route path="/leads/novo" element={<LeadNewPage />} />
          <Route path="/leads/:id" element={<LeadDetailPage />} />
          <Route path="/leads/:id/editar" element={<LeadEditPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}