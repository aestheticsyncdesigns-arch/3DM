import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import OverviewPage from './pages/OverviewPage'
import MenuBuilderPage from './pages/MenuBuilderPage'
import LiveOrdersPage from './pages/LiveOrdersPage'
import TablesPage from './pages/TablesPage'
import StaffPage from './pages/StaffPage'
import AnalyticsPage from './pages/AnalyticsPage'
import OrderHistoryPage from './pages/OrderHistoryPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="menu" element={<MenuBuilderPage />} />
            <Route path="orders" element={<LiveOrdersPage />} />
            <Route path="tables" element={<TablesPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="history" element={<OrderHistoryPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
