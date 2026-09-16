import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import QueuePage from './pages/QueuePage'
import OrdersPage from './pages/OrdersPage'
import NewOrderPage from './pages/NewOrderPage'
import MenuPage from './pages/MenuPage'
import DashboardPage from './pages/DashboardPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
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
