/**
 * routes.tsx — All route definitions
 *
 * Route structure:
 *   /login                — Manager/admin login
 *   /driver/login         — Driver login (password or PIN)
 *   /                     — Manager layout (protected by ManagerRoute)
 *     /                   — Dashboard
 *     /deliveries/new     — Create delivery
 *     /deliveries/:id     — Edit delivery
 *     /inventory          — Inventory browser
 *     /batches            — Batch management
 *     /packing-lists      — Packing list viewer
 *     /receiving          — Receiving log
 *     /analytics          — Analytics dashboard
 *     /users              — User management
 *     /activity           — Activity log
 *   /driver               — Driver layout (protected by DriverRoute)
 *     /driver/deliveries  — Driver's assigned deliveries
 *     /driver/deliveries/:id — Delivery detail + proof of delivery
 *     /driver/settings    — Driver settings (PIN, password)
 */
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ManagerRoute } from '../features/auth/components/ManagerRoute'
import { DriverRoute } from '../features/auth/components/DriverRoute'
import { ManagerLayout } from '../components/layout/ManagerLayout'
import { DriverLayout } from '../components/layout/DriverLayout'

import { lazy } from 'react'
import { ComingSoon } from '../components/shared/ComingSoon'

const LoginPage = lazy(() => import('../features/auth/components/LoginPage'))
const DriverLoginPage = lazy(() => import('../features/auth/components/DriverLoginPage'))
const DashboardPage = lazy(() => import('../features/deliveries/components/DashboardPage'))
const CreateDeliveryPage = lazy(() => import('../features/deliveries/components/CreateDeliveryPage'))
const EditDeliveryPage = lazy(() => import('../features/deliveries/components/EditDeliveryPage'))
const DeliveriesPage = lazy(() => import('../features/deliveries/components/DeliveriesPage'))
const InventoryPage = lazy(() => import('../features/inventory/components/InventoryPage'))
const ReceivingPage = lazy(() => import('../features/receiving/components/ReceivingPage'))

export const router = createBrowserRouter([
  // Public routes
  { path: '/login', element: <LoginPage /> },
  { path: '/driver/login', element: <DriverLoginPage /> },

  // Manager/Admin routes
  {
    element: <ManagerRoute />,
    children: [
      {
        element: <ManagerLayout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/deliveries', element: <DeliveriesPage /> },
          { path: '/deliveries/new', element: <CreateDeliveryPage /> },
          { path: '/deliveries/:id', element: <EditDeliveryPage /> },
          { path: '/inventory', element: <InventoryPage /> },
          { path: '/batches', element: <ComingSoon /> },
          { path: '/packing-lists', element: <ComingSoon /> },
          { path: '/receiving', element: <ReceivingPage /> },
          { path: '/analytics', element: <ComingSoon /> },
          { path: '/users', element: <ComingSoon /> },
          { path: '/activity', element: <ComingSoon /> },
        ],
      },
    ],
  },

  // Driver routes
  {
    element: <DriverRoute />,
    children: [
      {
        element: <DriverLayout />,
        children: [
          { path: '/driver/deliveries', element: <ComingSoon /> },
          { path: '/driver/deliveries/:id', element: <ComingSoon /> },
          { path: '/driver/settings', element: <ComingSoon /> },
        ],
      },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/" replace /> },
])
