import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import RequireAuth from './components/layout/RequireAuth'
import LoginPage from './pages/LoginPage'
import QueuePage from './pages/QueuePage'
import OrdersPage from './pages/OrdersPage'
import NewOrderPage from './pages/NewOrderPage'
import MenuPage from './pages/MenuPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="queue" element={<QueuePage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/new" element={<NewOrderPage />} />
        <Route path="menu" element={<MenuPage />} />
      </Route>
    </Routes>
  )
}
