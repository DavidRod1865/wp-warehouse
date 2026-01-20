import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchDeliveryItems,
  fetchDeliveryConfirmation,
  fetchDriverDeliveryDetail,
  uploadSignatureImage,
  type DeliveryConfirmation,
  type DeliveryItem,
  type DriverDeliveryDetail,
} from '../services/deliveryConfirm';
import { supabase } from '../lib/supabase';

export default function DriverDeliveryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const signatureRef = useRef<SignatureCanvas | null>(null);

  const [delivery, setDelivery] = useState<DriverDeliveryDetail | null>(null);
  const [items, setItems] = useState<DeliveryItem[]>([]);
  const [confirmation, setConfirmation] =
    useState<DeliveryConfirmation | null>(null);
  const [signedByName, setSignedByName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const deliveryId = Number(id);
    if (!deliveryId) return;

    const loadDelivery = async () => {
      setLoading(true);
      setError('');
      try {
        const [deliveryData, itemData, confirmationData] = await Promise.all([
          fetchDriverDeliveryDetail(deliveryId),
          fetchDeliveryItems(deliveryId),
          fetchDeliveryConfirmation(deliveryId),
        ]);
        const folderId = profile?.driver_sortly_folder_id;
        if (folderId && deliveryData.truck_sortly_folder_id !== folderId) {
          throw new Error('You do not have access to this delivery.');
        }
        setDelivery(deliveryData);
        setItems(itemData);
        setConfirmation(confirmationData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load delivery details'
        );
      } finally {
        setLoading(false);
      }
    };

    loadDelivery();
  }, [id, profile, user]);

  const handleClearSignature = () => {
    signatureRef.current?.clear();
  };

  const handleConfirmDelivery = async () => {
    if (!delivery || !user) return;

    if (!signedByName.trim()) {
      setError('Please enter the name of the person who signed.');
      return;
    }

    if (!signatureRef.current || signatureRef.current.isEmpty()) {
      setError('Please capture a signature before confirming.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const dataUrl = signatureRef.current
        .getTrimmedCanvas()
        .toDataURL('image/png');
      const signatureBlob = await (await fetch(dataUrl)).blob();

      const uploadResult = await uploadSignatureImage({
        deliveryId: delivery.id,
        driverId: user.id,
        file: signatureBlob,
      });

      const completedAt = new Date().toISOString();

      const { error: insertError, data: confirmationData } = await supabase
        .from('delivery_confirmations')
        .insert({
          delivery_id: delivery.id,
          driver_id: user.id,
          status: 'completed',
          completed_at: completedAt,
          signed_by_name: signedByName.trim(),
          signature_url: uploadResult.signature_url,
          signature_storage_path: uploadResult.signature_storage_path,
        })
        .select('*')
        .single();

      if (insertError) throw insertError;

      const updatedActivityLog = [
        ...(delivery.activity_log || []),
        {
          timestamp: completedAt,
          action: 'delivered',
          user_id: user.id,
          user_email: user.email,
          user_name: profile?.username || user.email?.split('@')[0],
          details: {
            signed_by_name: signedByName.trim(),
            signature_path: uploadResult.signature_storage_path,
          },
        },
      ];

      const { error: updateError } = await supabase
        .from('deliveries')
        .update({
          status: 'delivered',
          delivered_at: completedAt,
          signature_name: signedByName.trim(),
          signature_data: uploadResult.signature_url,
          activity_log: updatedActivityLog,
        })
        .eq('id', delivery.id);

      if (updateError) throw updateError;

      setConfirmation(confirmationData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to confirm delivery'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-600">Loading delivery...</p>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Delivery not found.</p>
          <button
            onClick={() => navigate('/driver/deliveries')}
            className="text-blue-600 font-medium"
          >
            Back to deliveries
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link
            to="/driver/deliveries"
            className="text-sm text-blue-600 font-medium"
          >
            ← Back
          </Link>
          <p className="text-sm text-gray-500">
            Delivery #{delivery.delivery_number}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Delivery Details
          </h2>
          <div className="mt-3 text-sm text-gray-600 space-y-2">
            <p className="font-medium text-gray-900">
              {delivery.projects?.name || 'Residential / Service'}
            </p>
            <p>
              <span className="text-gray-500">From:</span>{' '}
              {delivery.from_address.company_name ||
                delivery.from_address.street_address}
            </p>
            <p>
              <span className="text-gray-500">To:</span>{' '}
              {delivery.to_address.company_name ||
                delivery.to_address.street_address}
            </p>
            <p>
              <span className="text-gray-500">Truck:</span>{' '}
              {delivery.truck_name || 'Unassigned'}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-900">Items</h2>
          <div className="mt-3 space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{item.item_name}</p>
                  {item.notes && (
                    <p className="text-xs text-gray-500">{item.notes}</p>
                  )}
                </div>
                <p className="text-gray-700">Qty {item.quantity}</p>
              </div>
            ))}
          </div>
        </div>

        {confirmation ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-green-900">
              Delivery Confirmed
            </h2>
            <p className="text-sm text-green-800 mt-2">
              Signed by {confirmation.signed_by_name} on{' '}
              {new Date(confirmation.completed_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
            {confirmation.signature_url && (
              <img
                src={confirmation.signature_url}
                alt="Signature"
                className="mt-4 border border-green-200 rounded bg-white p-2"
              />
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-4 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Confirmation
              </h2>
              <p className="text-sm text-gray-500">
                Capture a signature and confirm completion.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Signed by (typed name)
              </label>
              <input
                type="text"
                value={signedByName}
                onChange={(e) => setSignedByName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Recipient full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Signature
              </label>
              <div className="border border-gray-300 rounded-lg bg-white">
                <SignatureCanvas
                  ref={signatureRef}
                  penColor="black"
                  canvasProps={{
                    className: 'w-full h-40',
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleClearSignature}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700"
              >
                Clear signature
              </button>
            </div>

            <button
              onClick={handleConfirmDelivery}
              disabled={saving}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {saving ? 'Saving...' : 'Confirm Delivery'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
