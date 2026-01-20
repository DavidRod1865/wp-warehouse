import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  fetchDriverDeliveriesByFolder,
  type DriverDeliverySummary,
} from '../services/deliveryConfirm';

export default function DriverDeliveries() {
  const { user, profile, signOut } = useAuth();
  const [deliveries, setDeliveries] = useState<DriverDeliverySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;

    const loadDeliveries = async () => {
      setLoading(true);
      setError('');
      try {
        let folderId = profile?.driver_sortly_folder_id ?? null;

        if (!folderId) {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('driver_sortly_folder_id')
            .eq('id', user.id)
            .single();

          if (userError) throw userError;
          folderId = userData?.driver_sortly_folder_id ?? null;
        }

        if (!folderId) {
          setDeliveries([]);
          setError('No truck folder assigned. Contact your manager.');
          return;
        }

        const data = await fetchDriverDeliveriesByFolder(folderId);
        setDeliveries(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load deliveries'
        );
      } finally {
        setLoading(false);
      }
    };

    loadDeliveries();
  }, [user, profile]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              My Deliveries
            </h1>
            <p className="text-sm text-gray-500">
              Confirm completed deliveries
            </p>
          </div>
          <button
            onClick={signOut}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading && (
          <div className="text-center text-gray-500">Loading deliveries...</div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {!loading && deliveries.length === 0 && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No deliveries assigned yet.
          </div>
        )}

        <div className="space-y-4">
          {deliveries.map((delivery) => (
            <Link
              key={delivery.id}
              to={`/driver/deliveries/${delivery.id}`}
              className="block bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Delivery #</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {delivery.delivery_number}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    delivery.status === 'delivered'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {delivery.status === 'delivered' ? 'Completed' : 'Pending'}
                </span>
              </div>

              <div className="mt-3 text-sm text-gray-600">
                <p className="font-medium text-gray-900">
                  {delivery.projects?.name || 'Residential / Service'}
                </p>
                <p className="truncate">
                  To: {delivery.to_address.company_name || delivery.to_address.street_address}
                </p>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Created {new Date(delivery.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
