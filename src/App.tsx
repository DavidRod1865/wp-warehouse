import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginSelector from './pages/LoginSelector';
import Login from './pages/Login';
import DriverLogin from './pages/DriverLogin';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import DriverDeliveries from './pages/DriverDeliveries';
import DriverDeliveryDetail from './pages/DriverDeliveryDetail';
import DriverManagement from './pages/DriverManagement';
import Dashboard from './pages/Dashboard';
import WarehouseInventory from './pages/WarehouseInventory';
import CreateDelivery from './pages/CreateDelivery';
import DeliveryDetail from './pages/DeliveryDetail';
import EditDelivery from './pages/EditDelivery';
import ActivityLog from './pages/ActivityLog';
import Vendors from './pages/Vendors';
import Settings from './pages/Settings';
import DashboardLayout from './components/DashboardLayout';

function ManagerLayoutRoute() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginSelector />;

  if (profile?.role === 'driver') {
    return <Navigate to="/driver/deliveries" />;
  }

  return <DashboardLayout />;
}

function DriverRoute({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/driver/login" />;

  if (profile?.role !== 'driver') {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          user ? (
            <Navigate
              to={profile?.role === 'driver' ? '/driver/deliveries' : '/'}
            />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/driver/login"
        element={
          user ? (
            <Navigate
              to={profile?.role === 'driver' ? '/driver/deliveries' : '/'}
            />
          ) : (
            <DriverLogin />
          )
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<ManagerLayoutRoute />}>
        <Route index element={<Dashboard />} />
        <Route path="deliveries" element={<Dashboard />} />
        <Route path="inventory" element={<WarehouseInventory />} />
        <Route path="deliveries/create" element={<CreateDelivery />} />
        <Route path="deliveries/:id" element={<DeliveryDetail />} />
        <Route path="deliveries/:id/edit" element={<EditDelivery />} />
        <Route path="activity-log" element={<ActivityLog />} />
        <Route path="vendors" element={<Vendors />} />
        <Route path="drivers" element={<DriverManagement />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="/driver/deliveries" element={<DriverRoute><DriverDeliveries /></DriverRoute>} />
      <Route path="/driver/deliveries/:id" element={<DriverRoute><DriverDeliveryDetail /></DriverRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;