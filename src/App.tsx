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

function ManagerRoute({ children }: { children: React.ReactNode }) {
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

  if (!user) return <Navigate to="/login" />;

  if (profile?.role === 'driver') {
    return <Navigate to="/driver/deliveries" />;
  }

  return <>{children}</>;
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
      <Route
        path="/"
        element={
          user ? (
            profile?.role === 'driver' ? (
              <Navigate to="/driver/deliveries" />
            ) : (
              <Dashboard />
            )
          ) : (
            <LoginSelector />
          )
        }
      />
      <Route path="/inventory" element={<ManagerRoute><WarehouseInventory /></ManagerRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
      <Route path="/deliveries/create" element={<ManagerRoute><CreateDelivery /></ManagerRoute>} />
      <Route path="/deliveries/:id" element={<ManagerRoute><DeliveryDetail /></ManagerRoute>} />
      <Route path="/deliveries/:id/edit" element={<ManagerRoute><EditDelivery /></ManagerRoute>} />
      <Route path="/activity-log" element={<ManagerRoute><ActivityLog /></ManagerRoute>} />
      <Route path="/vendors" element={<ManagerRoute><Vendors /></ManagerRoute>} />
      <Route path="/drivers" element={<ManagerRoute><DriverManagement /></ManagerRoute>} />
      <Route path="/driver/deliveries" element={<DriverRoute><DriverDeliveries /></DriverRoute>} />
      <Route path="/driver/deliveries/:id" element={<DriverRoute><DriverDeliveryDetail /></DriverRoute>} />
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