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
 *     /locations          — Location management (Warehouse, Trucks, Job Sites)
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

// Driver PWA pages
const DriverDeliveriesPage = lazy(() => import('../features/driver/components/DriverDeliveriesPage'))
const DriverDeliveryDetailPage = lazy(() => import('../features/driver/components/DriverDeliveryDetailPage'))
const DriverSettingsPage = lazy(() => import('../features/driver/components/DriverSettingsPage'))
const DashboardPage = lazy(() => import('../features/deliveries/components/DashboardPage'))
const CreateDeliveryPage = lazy(() => import('../features/deliveries/components/CreateDeliveryPage'))
const EditDeliveryPage = lazy(() => import('../features/deliveries/components/EditDeliveryPage'))
const DeliveriesPage = lazy(() => import('../features/deliveries/components/DeliveriesPage'))
const InventoryPage = lazy(() => import('../features/inventory/components/InventoryPage'))
const LocationsPage = lazy(() => import('../features/inventory/components/LocationsPage'))
const ReceivingPage = lazy(() => import('../features/receiving/components/ReceivingPage'))
const ClientsPage = lazy(() => import('../features/clients/components/ClientsPage'))
const ClientDetailPage = lazy(() => import('../features/clients/components/ClientDetailPage'))
const VendorsPage = lazy(() => import('../features/vendors/components/VendorsPage'))
const VendorDetailPage = lazy(() => import('../features/vendors/components/VendorDetailPage'))
const ProjectsPage = lazy(() => import('../features/projects/components/ProjectsPage'))
const PurchaseOrdersPage = lazy(() => import('../features/purchase-orders/components/PurchaseOrdersPage'))
const PoDetailPage = lazy(() => import('../features/purchase-orders/components/PoDetailPage'))
const AuditPage = lazy(() => import('../features/audit/components/AuditPage'))

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
          { path: '/locations', element: <LocationsPage /> },
          { path: '/clients', element: <ClientsPage /> },
          { path: '/clients/:id', element: <ClientDetailPage /> },
          { path: '/vendors', element: <VendorsPage /> },
          { path: '/vendors/:id', element: <VendorDetailPage /> },
          { path: '/projects', element: <ProjectsPage /> },
          { path: '/purchase-orders', element: <PurchaseOrdersPage /> },
          { path: '/purchase-orders/:id', element: <PoDetailPage /> },
          { path: '/batches', element: <ComingSoon /> },
          { path: '/packing-lists', element: <ComingSoon /> },
          { path: '/receiving', element: <ReceivingPage /> },
          { path: '/analytics', element: <ComingSoon /> },
          { path: '/users', element: <ComingSoon /> },
          { path: '/activity', element: <ComingSoon /> },
          { path: '/audit', element: <AuditPage /> },
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
          { path: '/driver/deliveries', element: <DriverDeliveriesPage /> },
          { path: '/driver/deliveries/:id', element: <DriverDeliveryDetailPage /> },
          { path: '/driver/settings', element: <DriverSettingsPage /> },
        ],
      },
    ],
  },

  // Catch-all
  { path: '*', element: <Navigate to="/" replace /> },
])
