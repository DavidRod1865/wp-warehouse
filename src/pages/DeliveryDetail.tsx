import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { sortlyClient } from "../lib/sortly";
import { useAuth } from "../contexts/AuthContext";
import { generateDeliveryPDF } from "../utils/generateDeliveryPDF";
import type { Address } from "../types/address";
import ActivityTimeline from "../components/ActivityTimeline";
import type { ActivityLogEntry } from "../types/activity";

interface Delivery {
  id: number;
  delivery_number: string;
  project_id: number | null;
  driver_id: string | null;
  delivery_type: string;
  status: string;
  created_by: string;
  created_at: string;
  delivered_at: string | null;
  signature_data: string | null;
  signature_name: string | null;
  notes: string | null;
  from_address: Address;
  to_address: Address;
  from_location_type: string;
  from_location_id: number;
  truck_sortly_folder_id: number;
  truck_name: string | null;
  activity_log: Array<{
    timestamp: string;
    action: string;
    user_id?: string;
    user_email?: string;
    details?: Record<string, unknown>;
  }>;
  projects?: {
    name: string;
  } | null;
}

interface DeliveryItem {
  id: number;
  sortly_item_id: number;
  item_name: string;
  quantity: number;
  notes: string | null;
  custom_attribute_values?: Array<{
    custom_attribute_id: number;
    custom_attribute_name: string;
    value: string;
  }> | null;
}

interface DeliveryConfirmation {
  id: number;
  delivery_id: number;
  driver_id: string;
  completed_at: string;
  signed_by_name: string;
  signature_url: string | null;
  signature_storage_path: string | null;
  status: string;
  notes: string | null;
  created_at: string;
}

export default function DeliveryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [confirmation, setConfirmation] =
    useState<DeliveryConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchDeliveryDetails();
  }, [id]);

  const fetchDeliveryDetails = async () => {
    setLoading(true);
    try {
      // Fetch delivery
      const { data: deliveryData, error: deliveryError } = await supabase
        .from("deliveries")
        .select(
          `
          *,
          projects (
            name
          )
        `
        )
        .eq("id", id)
        .single();

      if (deliveryError) throw deliveryError;
      setDelivery(deliveryData);

      // Fetch delivery items
      const { data: itemsData, error: itemsError } = await supabase
        .from("delivery_items")
        .select("*")
        .eq("delivery_id", id);

      if (itemsError) throw itemsError;
      setDeliveryItems(itemsData || []);

      // Fetch delivery confirmation (if any)
      const { data: confirmationData, error: confirmationError } = await supabase
        .from("delivery_confirmations")
        .select("*")
        .eq("delivery_id", id)
        .single();

      if (confirmationError && confirmationError.code !== "PGRST116") {
        throw confirmationError;
      }
      setConfirmation(confirmationData || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch delivery details"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!delivery) return;

    const confirmMessage =
      delivery.status === "pending"
        ? "This will delete the delivery and move items back from the truck to their original location. Continue?"
        : "Are you sure you want to delete this delivery?";

    if (!window.confirm(confirmMessage)) return;

    setLoading(true);
    setError("");

    try {
      // If pending, move items back from truck to original location
      if (delivery.status === "pending") {
        console.log("Moving items back from truck to original location...");
        const deliveryNote = `[Delivery: ${delivery.delivery_number}]`;
        const truckItems: Array<{
          id: number;
          name: string;
          notes?: string | null;
          quantity?: number | string | null;
        }> = [];

        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const response = await sortlyClient.listItems({
            parent_id: delivery.truck_sortly_folder_id,
            per_page: 100,
            page,
          });
          const items = response.data || [];
          items.forEach((item: typeof items[number]) => {
            if (item.type === "item") {
              truckItems.push(item);
            }
          });
          hasMore = items.length === 100;
          page += 1;
        }

        const taggedItems = truckItems.filter((item) =>
          (item.notes || "").includes(deliveryNote)
        );

        if (taggedItems.length === 0) {
          console.warn(
            "No tagged truck items found for delivery, falling back to name match."
          );
        }

        const itemsToMove = taggedItems.length > 0 ? taggedItems : deliveryItems;

        for (const item of itemsToMove) {
          try {
            const itemInTruck =
              "id" in item && "notes" in item
                ? item
                : await sortlyClient.findItemInFolder(
                    (item as unknown as DeliveryItem).sortly_item_id,
                    (item as unknown as DeliveryItem).item_name,
                    delivery.truck_sortly_folder_id
                  );

            if (!itemInTruck) {
              const itemName = "item_name" in item ? (item as unknown as DeliveryItem).item_name : (item as any).name;
              console.warn(`Item "${itemName}" not found in truck`);
              continue;
            }

            await sortlyClient.removeDeliveryNote(
              itemInTruck.id,
              delivery.delivery_number
            );

            const quantityToMove =
              Number(itemInTruck.quantity) ||
              ("quantity" in item ? Number(item.quantity) : 0);

            if (quantityToMove <= 0) {
              const truckItemName = "name" in itemInTruck ? itemInTruck.name : "";
              console.warn(`No quantity to move for item ${truckItemName}`);
              continue;
            }

            // Move back and REMOVE from truck
            await sortlyClient.moveItemWithOptions(
              itemInTruck.id,
              quantityToMove,
              delivery.from_location_id,
              false // Don't leave in truck
            );

            const truckItemName = "name" in itemInTruck ? itemInTruck.name : "";
            console.log(
              `✓ Moved ${quantityToMove} of ${truckItemName} back to source`
            );
          } catch (moveError) {
            const itemName = "item_name" in item ? (item as unknown as DeliveryItem).item_name : (item as any).name;
            console.error(`Failed to move item ${itemName}:`, moveError);
            throw moveError;
          }
        }
      }

      // Soft delete: Update deleted_at timestamp
      const updatedActivityLog = [
        ...(delivery.activity_log || []),
        {
          timestamp: new Date().toISOString(),
          action: "deleted",
          user_id: user?.id,
          user_email: user?.email,
          user_name: profile?.username || user?.email?.split('@')[0],
          details: {
            status: delivery.status,
            items_count: deliveryItems.length,
            truck_name: delivery.truck_name,
            project_id: delivery.project_id,
          },
        },
      ];

      console.log("Soft deleting delivery:", id);
      const { data: updateData, error: deleteError } = await supabase
        .from("deliveries")
        .update({
          deleted_at: new Date().toISOString(),
          activity_log: updatedActivityLog,
        })
        .eq("id", id)
        .select();

      if (deleteError) {
        console.error("Delete error:", deleteError);
        throw deleteError;
      }

      console.log("Soft delete result:", updateData);

      alert("Delivery deleted successfully");
      navigate("/");
    } catch (err) {
      console.error("Failed to delete delivery:", err);
      setError(
        err instanceof Error ? err.message : "Failed to delete delivery"
      );
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!delivery) return;

    const pdfData = {
      delivery_number: delivery.delivery_number,
      project_name: delivery.projects?.name || null,
      truck_name: delivery.truck_name,
      from_address: delivery.from_address,
      to_address: delivery.to_address,
      status: delivery.status,
      created_at: delivery.created_at,
      items: deliveryItems.map((item) => ({
        item_name: item.item_name,
        quantity: item.quantity,
        notes: item.notes,
        custom_attribute_values: item.custom_attribute_values,
      })),
    };

    generateDeliveryPDF(pdfData);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: "bg-gray-100 text-gray-800",
      pending: "bg-yellow-100 text-yellow-800",
      delivered: "bg-green-100 text-green-800",
    };

    return (
      <span
        className={`px-3 py-1 rounded-full text-xs font-medium ${
          styles[status as keyof typeof styles] || styles.draft
        }`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading delivery...</p>
        </div>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Delivery not found</p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const canEdit = delivery.status === "draft" || delivery.status === "pending";
  const canDelete =
    delivery.status === "draft" || delivery.status === "pending";

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow print:shadow-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Delivery Details
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                {delivery.delivery_number} - {getStatusBadge(delivery.status)}
              </p>
            </div>
            <div className="flex gap-3 print:hidden">
              {canEdit && (
                <button
                  onClick={() => navigate(`/deliveries/${id}/edit`)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50"
                >
                  Delete
                </button>
              )}
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Print
              </button>
              <button
                onClick={() => navigate("/")}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6 print:hidden">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 space-y-6">
            {/* Delivery Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Delivery Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Delivery Number
                  </label>
                  <p className="text-sm text-gray-900">
                    {delivery.delivery_number}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project
                  </label>
                  <p className="text-sm text-gray-900">
                    {delivery.projects?.name || (
                      <span className="text-gray-400">
                        No Project (Residential)
                      </span>
                    )}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Truck
                  </label>
                  <p className="text-sm text-gray-900">
                    {delivery.truck_name || "-"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <p className="text-sm">{getStatusBadge(delivery.status)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Address
                  </label>
                  <div className="text-sm text-gray-900">
                    <div>{delivery.from_address.company_name}</div>
                    <div>{delivery.from_address.street_address}</div>
                    <div>
                      {delivery.from_address.city}, {delivery.from_address.state}{" "}
                      {delivery.from_address.zip_code}
                    </div>
                    <div>Tel: {delivery.from_address.phone}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Address
                  </label>
                  <div className="text-sm text-gray-900">
                    <div>{delivery.to_address.company_name}</div>
                    <div>{delivery.to_address.street_address}</div>
                    <div>
                      {delivery.to_address.city}, {delivery.to_address.state}{" "}
                      {delivery.to_address.zip_code}
                    </div>
                    <div>Tel: {delivery.to_address.phone}</div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Created
                  </label>
                  <p className="text-sm text-gray-900">
                    {new Date(delivery.created_at).toLocaleString()}
                  </p>
                </div>

                {delivery.delivered_at && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivered
                    </label>
                    <p className="text-sm text-gray-900">
                      {new Date(delivery.delivered_at).toLocaleString()}
                    </p>
                  </div>
                )}

                {confirmation && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmation
                    </label>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-800">
                        Signed by {confirmation.signed_by_name} on{" "}
                        {new Date(confirmation.completed_at).toLocaleString()}
                      </p>
                      {confirmation.signature_url && (
                        <img
                          src={confirmation.signature_url}
                          alt="Signature"
                          className="mt-3 border border-green-200 rounded bg-white p-2 max-w-md"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Items */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Items ({deliveryItems.length})
              </h2>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Item Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Brand
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Part Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Location
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Quantity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {deliveryItems.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.item_name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {item.custom_attribute_values?.find(
                            (a) =>
                              a.custom_attribute_name.toLowerCase() === "brand"
                          )?.value || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {item.custom_attribute_values?.find(
                            (a) =>
                              a.custom_attribute_name.toLowerCase() ===
                              "part number"
                          )?.value || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {item.notes || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {item.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Activity Timeline */}
            <div className="print:hidden">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Timeline</h2>
              {delivery.activity_log && delivery.activity_log.length > 0 ? (
                <ActivityTimeline
                  activities={delivery.activity_log as ActivityLogEntry[]}
                  showUserNames={true}
                  showDetails={true}
                />
              ) : (
                <p className="text-gray-500">No activity recorded</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
