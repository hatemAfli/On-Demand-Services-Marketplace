import { App as AntdApp, ConfigProvider, Spin, theme } from 'antd'
import { useAuthBootstrap } from './hooks/useAuthBootstrap'
import {
  AccessBlockedPage,
  AdminLayout,
  DashboardHomePage,
  LegalDocumentsAdminPage,
  LoginPage,
  PlaceholderPage,
  ServiceCategoriesAdminPage,
  ServicesAdminPage,
  UsersAdminPage,
  UsersDetailsPage,
  CompaniesAdminPage,
  PendingProvidersPage,
  PendingCompaniesPage,
  ValidationHistoryPage,
  AdminAppointmentsPage,
  AdminAppointmentDetailPage,
  AdminComplaintsPage,
  AdminComplaintDetailPage,
  AdminReviewsPage,
  AdminReviewDetailPage,
} from './features/admin'
import {
  CompanyAdminLayout,
  CompanyDashboardPage,
  CompanyProvidersPage,
  CompanyServicesPage,
  CompanyOrdersPage,
  CompanySchedulePage,
  CompanyRatingsPage,
  CompanySettingsPage,
  CompanyPlaceholderPage,
} from './features/company_admin'
import { useAuthStore } from './stores/authStore'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import './App.css'

function BootScreen() {
  return (
    <div className="admin-boot-screen">
      <Spin size="large" />
    </div>
  )
}

function LoginRoute() {
  const user = useAuthStore((s) => s.user)
  const authReady = useAuthStore((s) => s.authReady)

  if (!authReady) return <BootScreen />
  if (user?.role === 'PLATFORM_ADMIN') return <Navigate to="/admin/dashboard" replace />
  if (user?.role === 'COMPANY_ADMIN') return <Navigate to="/company/dashboard" replace />
  return <LoginPage />
}

function HomeRoute() {
  const user = useAuthStore((s) => s.user)
  const authReady = useAuthStore((s) => s.authReady)

  if (!authReady) return <BootScreen />
  if (user?.role === 'PLATFORM_ADMIN') return <Navigate to="/admin/dashboard" replace />
  if (user?.role === 'COMPANY_ADMIN') return <Navigate to="/company/dashboard" replace />
  return <Navigate to="/login" replace />
}

function RequirePlatformAdmin() {
  const user = useAuthStore((s) => s.user)
  const authReady = useAuthStore((s) => s.authReady)

  if (!authReady) return <BootScreen />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'PLATFORM_ADMIN') return <Navigate to="/" replace />
  return <Outlet />
}

function RequireCompanyAdmin() {
  const user = useAuthStore((s) => s.user)
  const authReady = useAuthStore((s) => s.authReady)

  if (!authReady) return <BootScreen />
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'COMPANY_ADMIN') return <Navigate to="/" replace />
  return <Outlet />
}

function AppShell() {
  useAuthBootstrap()

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#6366f1',
          borderRadius: 8,
        },
      }}
    >
      <AntdApp>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/access-blocked" element={<AccessBlockedPage />} />

            <Route element={<RequirePlatformAdmin />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<DashboardHomePage />} />
                <Route path="users/all" element={<UsersAdminPage />} />
                <Route path="users/clients" element={<UsersAdminPage />} />
                <Route path="users/providers" element={<UsersAdminPage />} />
                <Route
                  path="users/companies"
                  element={<Navigate to="/admin/users/company-admins" replace />}
                />
                <Route path="users/company-admins" element={<UsersAdminPage />} />
                <Route path="users/platform-admins" element={<UsersAdminPage />} />
                <Route path="users/:id" element={<UsersDetailsPage />} />
                <Route path="companies" element={<CompaniesAdminPage />} />
                <Route path="validations/pending-providers" element={<PendingProvidersPage />} />
                <Route path="validations/pending-companies" element={<PendingCompaniesPage />} />
                <Route path="validations/history" element={<ValidationHistoryPage />} />
                <Route
                  path="catalog/categories"
                  element={<ServiceCategoriesAdminPage />}
                />
                <Route
                  path="catalog/services"
                  element={<ServicesAdminPage />}
                />
                <Route path="orders/list" element={<PlaceholderPage title="Orders" />} />
                <Route path="appointments/list" element={<AdminAppointmentsPage />} />
                <Route
                  path="appointments/:id"
                  element={<AdminAppointmentDetailPage />}
                />
                <Route path="reclamations" element={<AdminComplaintsPage />} />
                <Route
                  path="reclamations/:id"
                  element={<AdminComplaintDetailPage />}
                />
                <Route path="reviews" element={<AdminReviewsPage />} />
                <Route path="reviews/:id" element={<AdminReviewDetailPage />} />
                <Route
                  path="finance/overview"
                  element={<PlaceholderPage title="Financial overview" />}
                />
                <Route
                  path="finance/payouts"
                  element={<PlaceholderPage title="Payouts" />}
                />
                <Route
                  path="messages"
                  element={<PlaceholderPage title="Messages & support" />}
                />
                <Route
                  path="analytics/overview"
                  element={<PlaceholderPage title="Analytics overview" />}
                />
                <Route
                  path="analytics/exports"
                  element={<PlaceholderPage title="Report exports" />}
                />
                <Route
                  path="content/legal-documents"
                  element={<LegalDocumentsAdminPage />}
                />
                <Route
                  path="content/pages"
                  element={<PlaceholderPage title="Content pages" />}
                />
                <Route
                  path="content/media"
                  element={<PlaceholderPage title="Media library" />}
                />
                <Route
                  path="settings/general"
                  element={<PlaceholderPage title="General settings" />}
                />
                <Route
                  path="settings/security"
                  element={<PlaceholderPage title="Security settings" />}
                />
                <Route
                  path="activity-logs"
                  element={<PlaceholderPage title="Activity logs" />}
                />
              </Route>
            </Route>

            <Route element={<RequireCompanyAdmin />}>
              <Route path="/company" element={<CompanyAdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<CompanyDashboardPage />} />
                <Route path="providers" element={<CompanyProvidersPage />} />
                <Route path="services" element={<CompanyServicesPage />} />
                <Route path="orders" element={<CompanyOrdersPage />} />
                <Route
                  path="schedule-capacity"
                  element={<CompanySchedulePage />}
                />
                <Route path="finance" element={<CompanyPlaceholderPage title="Finance" />} />
                <Route path="ratings" element={<CompanyRatingsPage />} />
                <Route
                  path="subscription-plan"
                  element={<CompanyPlaceholderPage title="Subscription & Plan" />}
                />
                <Route path="settings" element={<CompanySettingsPage />} />
              </Route>
            </Route>

            <Route path="/" element={<HomeRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AntdApp>
    </ConfigProvider>
  )
}

export default function App() {
  return <AppShell />
}
