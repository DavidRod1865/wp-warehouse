import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen } from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { sortlyClient } from "../lib/sortly";
import { fetchAllFolders } from "../services/sortlyApi";
import { generateDeliveryNumber } from "../utils/deliveryNumber";
import { useAuth } from "../contexts/AuthContext";
import type { SortlyItem } from "../types/sortly";
import ItemSelector from "../components/ItemSelector";
import ManualItemModal from "../components/ManualItemModal";
import type { Address } from "../types/address";
import { DEFAULT_FROM_ADDRESS, EMPTY_ADDRESS } from "../types/address";
import type { ActivityLogEntry } from "../types/activity";

interface Project {
  id: number;
  name: string;
  status: string;
  sortly_project_folder_id: number;
  sortly_warehouse_folder_id?: number;
  sortly_jobsite_folder_id?: number;
  general_contractor?: string;
  project_address?: Address;
  activity_log?: Array<{
    timestamp: string;
    action: string;
    delivery_number?: string;
    items?: Array<{ name: string; quantity: number }>;
    details?: Record<string, unknown>;
  }>;
}

interface Truck {
  id: number;
  name: string;
}

interface VendorAddress {
  id: number;
  company_name: string;
  street_address: string;
  town: string;
  state: string;
  zipcode: string;
}

interface DeliveryItem {
  sortly_item_id: number | null;
  item_name: string;
  quantity: number;
  available_quantity: number;
  location: string;
  is_manual?: boolean;
  custom_attribute_values?: Array<{
    custom_attribute_id: number;
    custom_attribute_name: string;
    value: string;
  }>;
}

export default function CreateDelivery() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Form state
  const [deliveryNumber, setDeliveryNumber] = useState("");
  const [poReference, setPoReference] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);
  const [fromAddress, setFromAddress] = useState<Address>(DEFAULT_FROM_ADDRESS);
  const [toAddress, setToAddress] = useState<Address>(EMPTY_ADDRESS);
  const [truckFolderId, setTruckFolderId] = useState<number | null>(null);
  const [fromLocationId, setFromLocationId] = useState<number | null>(null);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryItem[]>([]);
  const [showManualItemModal, setShowManualItemModal] = useState(false);

  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [rootFolders, setRootFolders] = useState<SortlyItem[]>([]);
  const [vendors, setVendors] = useState<VendorAddress[]>([]);
  const [isEditingToAddress, setIsEditingToAddress] = useState(false);
  const [showProjectAddressModal, setShowProjectAddressModal] = useState(false);
  const [projectAddressDraft, setProjectAddressDraft] = useState({
    street_address: "",
    city: "",
    state: "",
    zip_code: "",
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [isEditingFromAddress, setIsEditingFromAddress] = useState(false);

  useEffect(() => {
    initializeForm();
  }, []);

  // Auto-populate to address when project is selected
  useEffect(() => {
    if (projectId) {
      const selectedProject = projects.find(p => p.id === projectId);
      if (selectedProject?.project_address) {
        setToAddress(selectedProject.project_address);
      }
    }
  }, [projectId, projects]);

  const initializeForm = async () => {
    setLoading(true);
    try {
      // Generate delivery number
      const number = await generateDeliveryNumber();
      setDeliveryNumber(number);

      // Fetch projects
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "active")
        .order("name");

      if (projectsError) throw projectsError;
      let projects = projectsData || [];

      // Refresh project names from Sortly to avoid stale folder names
      const allFolders = await fetchAllFolders(false);

      // Auto-create missing projects from Sortly folders (if possible)
      const projectsFolder = allFolders.find(
        (folder) => folder.name?.toLowerCase() === "projects"
      );
      const childrenByParent = new Map<number, SortlyItem[]>();
      allFolders.forEach((folder) => {
        if (folder.parent_id !== null && folder.parent_id !== undefined) {
          const existing = childrenByParent.get(folder.parent_id) || [];
          existing.push(folder);
          childrenByParent.set(folder.parent_id, existing);
        }
      });

      if (projectsFolder?.id) {
        const projectFolders = allFolders.filter(
          (folder) =>
            folder.parent_id === projectsFolder.id &&
            folder.type === "folder"
        );
        const missingProjects = projectFolders.filter(
          (folder) =>
            !projects.some(
              (project) => project.sortly_project_folder_id === folder.id
            )
        );
        const newProjects = missingProjects
          .map((folder) => {
            const children = childrenByParent.get(folder.id) || [];
            const warehouseFolder = children.find((child) =>
              child.name?.toLowerCase().includes("warehouse")
            );
            const jobsiteFolder = children.find((child) => {
              const name = child.name?.toLowerCase() || "";
              return name.includes("job site") || name.includes("jobsite");
            });

            if (!warehouseFolder?.id || !jobsiteFolder?.id) {
              return null;
            }

            return {
              name: folder.name,
              status: "active",
              sortly_project_folder_id: folder.id,
              sortly_warehouse_folder_id: warehouseFolder.id,
              sortly_jobsite_folder_id: jobsiteFolder.id,
            };
          })
          .filter((project): project is NonNullable<typeof project> => !!project);

        if (newProjects.length > 0) {
          const { data: insertedProjects, error: insertError } = await supabase
            .from("projects")
            .insert(newProjects)
            .select("*");

          if (!insertError && insertedProjects) {
            projects = [...projects, ...insertedProjects];
          } else if (insertError) {
            console.warn("Failed to sync projects from Sortly:", insertError);
          }
        }
      }

      const folderNameById = new Map(
        allFolders.map((folder) => [folder.id, folder.name])
      );
      const projectsWithSortlyNames = projects.map((project) => ({
        ...project,
        name:
          folderNameById.get(project.sortly_project_folder_id) || project.name,
      }));

      // Deduplicate by Sortly project folder id to avoid double entries
      const uniqueProjects = Array.from(
        new Map(
          projectsWithSortlyNames.map((project) => [
            project.sortly_project_folder_id,
            project,
          ])
        ).values()
      );
      setProjects(uniqueProjects);

      // Fetch vendors
      const { data: vendorData, error: vendorError } = await supabase
        .from("vendor_addresses")
        .select("id, company_name, street_address, town, state, zipcode")
        .order("company_name");

      if (vendorError) throw vendorError;
      setVendors((vendorData || []) as VendorAddress[]);

      // Fetch all Sortly items to find trucks and root folders
      const response = await sortlyClient.listItems({ per_page: 100 });
      const allItems = response.data || [];

      // Find truck folders (children of "Delivery Trucks" folder ID: 102892637)
      const truckFolders = allItems.filter(
        (item: SortlyItem) =>
          item.type === "folder" && item.parent_id === 102892637
      );
      setTrucks(
        truckFolders.map((t: SortlyItem) => ({ id: t.id, name: t.name }))
      );

      // Find root folders (folders with no parent)
      const rootFolderItems = allItems.filter(
        (item: SortlyItem) =>
          item.type === "folder" &&
          (item.parent_id === null || item.parent_id === undefined)
      );
      setRootFolders(rootFolderItems);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to initialize form"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!fromLocationId || !truckFolderId || deliveryItems.length === 0) {
      setError("Please fill in all required fields and add at least one item");
      return;
    }


    setSaving(true);
    setError("");

    const truckName = trucks.find((t) => t.id === truckFolderId)?.name;
    const projectName = projectId ? projects.find((p) => p.id === projectId)?.name : undefined;
    const driverName = undefined;

    try {
      // Build activity log
      const activityLog: ActivityLogEntry[] = [
        {
          timestamp: new Date().toISOString(),
          action: "created",
          user_id: user?.id,
          user_email: user?.email,
          user_name: profile?.username || user?.email?.split('@')[0],
          details: {
            status: "draft",
            delivery_type: projectId ? "project_delivery" : "service_delivery",
            project_name: projectName,
            truck_name: truckName,
            items_count: deliveryItems.length,
            po_reference: poReference.trim() || null,
          },
        },
      ];

      // Add driver assigned activity if driver is selected
      if (driverName) {
        activityLog.push({
          timestamp: new Date().toISOString(),
          action: "driver_assigned",
          user_id: user?.id,
          user_email: user?.email,
          user_name: profile?.username || user?.email?.split('@')[0],
          details: {
            driver_assigned: {
              driver_name: driverName,
            },
          },
        });
      }

      // Create delivery record in database
      const { data: delivery, error: deliveryError } = await supabase
        .from("deliveries")
        .insert({
          delivery_number: deliveryNumber,
          po_reference: poReference.trim() || null,
          project_id: projectId,
          delivery_type: projectId ? "project_delivery" : "service_delivery",
          status: "draft",
          created_by: user?.id,
          from_address: fromAddress,
          to_address: toAddress,
          from_location_type: projectId ? "project_warehouse" : "root_folder",
          from_location_id: fromLocationId,
          truck_sortly_folder_id: truckFolderId,
          truck_name: truckName,
          activity_log: activityLog,
        })
        .select()
        .single();

      if (deliveryError) throw deliveryError;
      if (!delivery) throw new Error("Failed to create delivery");

      // Create delivery items
      const deliveryItemsData = deliveryItems.map((item) => ({
        delivery_id: delivery.id,
        sortly_item_id: item.sortly_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        notes: item.location,
        custom_attribute_values: item.custom_attribute_values || null,
      }));

      const { error: itemsError } = await supabase
        .from("delivery_items")
        .insert(deliveryItemsData);

      if (itemsError) throw itemsError;

      alert("Delivery saved as draft successfully!");
      navigate("/deliveries");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = async () => {
    if (!fromLocationId || !truckFolderId || deliveryItems.length === 0) {
      setError("Please fill in all required fields and add at least one item");
      return;
    }


    // Validate quantities
    const invalidItems = deliveryItems.filter(
      (item) =>
        item.quantity <= 0 ||
        (item.sortly_item_id !== null && item.quantity > item.available_quantity)
    );
    if (invalidItems.length > 0) {
      setError(
        "Please enter valid quantities for all items (must be greater than 0 and not exceed available quantity)"
      );
      return;
    }

    const truckName = trucks.find((t) => t.id === truckFolderId)?.name;
    const projectName = projectId ? projects.find((p) => p.id === projectId)?.name : undefined;
    const driverName = undefined;

    setSaving(true);
    setError("");

    try {
      // Build activity log
      const activityLog: ActivityLogEntry[] = [
        {
          timestamp: new Date().toISOString(),
          action: "created",
          user_id: user?.id,
          user_email: user?.email,
          user_name: profile?.username || user?.email?.split('@')[0],
          details: {
            status: "pending",
            delivery_type: projectId ? "project_delivery" : "service_delivery",
            project_name: projectName,
            truck_name: truckName,
            items_count: deliveryItems.length,
            po_reference: poReference.trim() || null,
          },
        },
      ];

      // Add driver assigned activity if driver is selected
      if (driverName) {
        activityLog.push({
          timestamp: new Date().toISOString(),
          action: "driver_assigned",
          user_id: user?.id,
          user_email: user?.email,
          user_name: profile?.username || user?.email?.split('@')[0],
          details: {
            driver_assigned: {
              driver_name: driverName,
            },
          },
        });
      }

      // Add printed activity
      activityLog.push({
        timestamp: new Date().toISOString(),
        action: "printed",
        user_id: user?.id,
        user_email: user?.email,
        user_name: profile?.username || user?.email?.split('@')[0],
        details: {
          status: "pending",
          note: "Delivery order printed and items moved to truck",
            po_reference: poReference.trim() || null,
        },
      });

      // Create delivery record in database
      const { data: delivery, error: deliveryError } = await supabase
        .from("deliveries")
        .insert({
          delivery_number: deliveryNumber,
          po_reference: poReference.trim() || null,
          project_id: projectId,
          delivery_type: projectId ? "project_delivery" : "service_delivery",
          status: "pending",
          created_by: user?.id,
          from_address: fromAddress,
          to_address: toAddress,
          from_location_type: projectId ? "project_warehouse" : "root_folder",
          from_location_id: fromLocationId,
          truck_sortly_folder_id: truckFolderId,
          truck_name: truckName,
          activity_log: activityLog,
        })
        .select()
        .single();

      if (deliveryError) throw deliveryError;
      if (!delivery) throw new Error("Failed to create delivery");

      // Create delivery items
      const deliveryItemsData = deliveryItems.map((item) => ({
        delivery_id: delivery.id,
        sortly_item_id: item.sortly_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        notes: item.location,
        custom_attribute_values: item.custom_attribute_values || null,
      }));

      const { error: itemsError } = await supabase
        .from("delivery_items")
        .insert(deliveryItemsData);

      if (itemsError) throw itemsError;

      // Move items in Sortly from source to truck (keep in source if quantity > 0)
      console.log("Moving items from source to truck...");
      for (const item of deliveryItems) {
        if (item.sortly_item_id === null) continue;
        try {
          await sortlyClient.moveItemWithOptions(
            item.sortly_item_id,
            item.quantity,
            truckFolderId,
            true // Leave zero quantity item in source
          );

          // Find the newly created item in truck and add delivery note
          const itemInTruck = await sortlyClient.findItemInFolder(
            item.sortly_item_id,
            item.item_name,
            truckFolderId
          );

          if (itemInTruck) {
            await sortlyClient.addDeliveryNote(
              itemInTruck.id,
              truckFolderId,
              deliveryNumber
            );
          }

          console.log(`✓ Moved ${item.quantity} of ${item.item_name} to truck`);
        } catch (moveError) {
          console.error(`Failed to move item ${item.item_name}:`, moveError);
        }
      }

      const manualItems = deliveryItems.filter(
        (item) => item.sortly_item_id === null
      );

      if (manualItems.length > 0) {
        for (const item of manualItems) {
          const created = await sortlyClient.createItem({
            name: item.item_name,
            quantity: item.quantity,
            parent_id: truckFolderId,
          });
          const createdItem = created?.data ?? created;

          if (!createdItem?.id) {
            throw new Error(
              `Failed to create manual item "${item.item_name}" in Sortly`
            );
          }

          await sortlyClient.addDeliveryNote(
            createdItem.id,
            truckFolderId,
            deliveryNumber
          );
        }
      }

      // Update project activity log if project exists
      if (projectId) {
        const project = projects.find((p) => p.id === projectId);
        if (project) {
          const projectActivity = project.activity_log || [];
          const newActivity = {
            timestamp: new Date().toISOString(),
            action: "delivery_created",
            delivery_number: deliveryNumber,
            items: deliveryItems.map((item) => ({
              name: item.item_name,
              quantity: item.quantity,
            })),
            details: {
              truck: trucks.find((t) => t.id === truckFolderId)?.name,
              status: "pending",
            },
          };

          await supabase
            .from("projects")
            .update({
              activity_log: [...projectActivity, newActivity],
            })
            .eq("id", projectId);
        }
      }

      alert(
        "Delivery order created and printed! Items have been moved to truck."
      );
      navigate("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create delivery"
      );
    } finally {
      setSaving(false);
    }
  };

  const availableTruckIds = new Set(trucks.map((truck) => truck.id));

  const applyVendorAddress = (vendor: VendorAddress | null) => {
    if (!vendor) return;
    setFromAddress({
      company_name: vendor.company_name,
      street_address: vendor.street_address,
      city: vendor.town,
      state: vendor.state,
      zip_code: vendor.zipcode,
      phone: "",
    });
  };

  const applyVendorAddressTo = (vendor: VendorAddress | null) => {
    if (!vendor) return;
    setToAddress({
      company_name: vendor.company_name,
      street_address: vendor.street_address,
      city: vendor.town,
      state: vendor.state,
      zip_code: vendor.zipcode,
      phone: "",
    });
  };

  const isAddressEmpty = (address: Address) =>
    !address.street_address.trim() &&
    !address.city.trim() &&
    !address.state.trim() &&
    !address.zip_code.trim();

  const selectedProject = projectId
    ? projects.find((project) => project.id === projectId) || null
    : null;

  const projectHasAddress =
    !!selectedProject?.project_address?.street_address?.trim();

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
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Create Delivery
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Delivery #: {deliveryNumber}
              </p>
            </div>
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Cancel
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {showProjectAddressModal && selectedProject && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Add Project Address
                </h2>
                <button
                  onClick={() => setShowProjectAddressModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    value={projectAddressDraft.street_address}
                    onChange={(e) =>
                      setProjectAddressDraft({
                        ...projectAddressDraft,
                        street_address: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={projectAddressDraft.city}
                    onChange={(e) =>
                      setProjectAddressDraft({
                        ...projectAddressDraft,
                        city: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      State
                    </label>
                    <input
                      type="text"
                      value={projectAddressDraft.state}
                      onChange={(e) =>
                        setProjectAddressDraft({
                          ...projectAddressDraft,
                          state: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      maxLength={2}
                      placeholder="NY"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Zip Code
                    </label>
                    <input
                      type="text"
                      value={projectAddressDraft.zip_code}
                      onChange={(e) =>
                        setProjectAddressDraft({
                          ...projectAddressDraft,
                          zip_code: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowProjectAddressModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!projectAddressDraft.street_address.trim()) {
                      setError("Street address is required.");
                      return;
                    }
                    const updatedAddress: Address = {
                      company_name: selectedProject.name,
                      street_address: projectAddressDraft.street_address.trim(),
                      city: projectAddressDraft.city.trim(),
                      state: projectAddressDraft.state.trim(),
                      zip_code: projectAddressDraft.zip_code.trim(),
                      phone: "",
                    };
                    const { error: updateError } = await supabase
                      .from("projects")
                      .update({ project_address: updatedAddress })
                      .eq("id", selectedProject.id);

                    if (updateError) {
                      setError(updateError.message);
                      return;
                    }

                    setProjects((prev) =>
                      prev.map((project) =>
                        project.id === selectedProject.id
                          ? { ...project, project_address: updatedAddress }
                          : project
                      )
                    );
                    setToAddress(updatedAddress);
                    setShowProjectAddressModal(false);
                    setError("");
                  }}
                  className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 space-y-6">
            {/* Basic Information Section */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Delivery Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Truck Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Truck <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={truckFolderId || ""}
                    onChange={(e) =>
                      setTruckFolderId(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select Truck</option>
                    {trucks
                      .filter((truck) => availableTruckIds.has(truck.id))
                      .map((truck) => (
                        <option key={truck.id} value={truck.id}>
                          {truck.name}
                        </option>
                      ))}
                  </select>
                </div>

                {/* Project Selection (Optional) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Project (Optional)
                    </label>
                    {selectedProject && !projectHasAddress && (
                      <button
                        type="button"
                        onClick={() => {
                          setProjectAddressDraft({
                            street_address: "",
                            city: "",
                            state: "",
                            zip_code: "",
                          });
                          setShowProjectAddressModal(true);
                        }}
                        className="px-2 py-1 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
                      >
                        Add project address
                      </button>
                    )}
                  </div>
                  <div className="flex items-start gap-2">
                    <select
                      value={projectId || ""}
                      onChange={(e) => {
                        const value = e.target.value
                          ? parseInt(e.target.value)
                          : null;
                        setProjectId(value);
                        setIsEditingToAddress(false);
                        // If project selected, auto-set from location
                        if (value) {
                          const project = projects.find((p) => p.id === value);
                          if (project) {
                            setFromLocationId(project.sortly_warehouse_folder_id ?? null);
                            if (project.project_address?.street_address) {
                              setToAddress({
                                ...project.project_address,
                                company_name:
                                  project.project_address.company_name ||
                                  project.name,
                                phone: project.project_address.phone || "",
                              });
                            }
                          }
                        } else {
                          setToAddress(EMPTY_ADDRESS);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">No Project (Residential)</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* From Address */}
                <div className="space-y-4 border border-gray-300 p-4 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      From Address <span className="text-red-500">*</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsEditingFromAddress((prev) => !prev)}
                      className="text-blue-600 hover:text-blue-800"
                      aria-label="Edit from address"
                      title="Edit from address"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                  </div>

                  {!isEditingFromAddress ? (
                    <div className="text-sm text-gray-900 space-y-1">
                      <div className="font-medium">
                        {fromAddress.company_name}
                      </div>
                      <div>{fromAddress.street_address}</div>
                      <div>
                        {fromAddress.city}, {fromAddress.state}{" "}
                        {fromAddress.zip_code}
                      </div>
                      <div>{fromAddress.phone}</div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Vendor
                        </label>
                        <select
                          value=""
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "default") {
                              setFromAddress(DEFAULT_FROM_ADDRESS);
                              return;
                            }
                            const vendor = vendors.find(
                              (v) => v.id === Number(value)
                            );
                            if (vendor) {
                              applyVendorAddress(vendor);
                            }
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select vendor (optional)</option>
                          <option value="default">
                            With Pride HVAC (default)
                          </option>
                          {vendors.map((vendor) => (
                            <option key={vendor.id} value={vendor.id}>
                              {vendor.company_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Company Name
                          </label>
                          <input
                            type="text"
                            value={fromAddress.company_name}
                            onChange={(e) =>
                              setFromAddress({
                                ...fromAddress,
                                company_name: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Street Address
                          </label>
                          <input
                            type="text"
                            value={fromAddress.street_address}
                            onChange={(e) =>
                              setFromAddress({
                                ...fromAddress,
                                street_address: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            City
                          </label>
                          <input
                            type="text"
                            value={fromAddress.city}
                            onChange={(e) =>
                              setFromAddress({
                                ...fromAddress,
                                city: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            State
                          </label>
                          <input
                            type="text"
                            value={fromAddress.state}
                            onChange={(e) =>
                              setFromAddress({
                                ...fromAddress,
                                state: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            maxLength={2}
                            placeholder="NY"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Zip Code
                          </label>
                          <input
                            type="text"
                            value={fromAddress.zip_code}
                            onChange={(e) =>
                              setFromAddress({
                                ...fromAddress,
                                zip_code: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={fromAddress.phone}
                            onChange={(e) =>
                              setFromAddress({
                                ...fromAddress,
                                phone: e.target.value,
                              })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* To Address */}
                <div className="space-y-4 border border-gray-300 p-4 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">
                      To Address <span className="text-red-500">*</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => setIsEditingToAddress((prev) => !prev)}
                      className="text-blue-600 hover:text-blue-800"
                      aria-label="Edit to address"
                      title="Edit to address"
                    >
                      <FontAwesomeIcon icon={faPen} />
                    </button>
                  </div>

                  {!isEditingToAddress ? (
                    isAddressEmpty(toAddress) ? (
                      <div className="text-sm text-amber-600">
                        Add a project address, select a vendor, or enter an
                        address manually.
                      </div>
                    ) : (
                      <div className="text-sm text-gray-900 space-y-1">
                        <div className="font-medium">
                          {toAddress.company_name}
                        </div>
                        <div>{toAddress.street_address}</div>
                        <div>
                          {toAddress.city}, {toAddress.state}{" "}
                          {toAddress.zip_code}
                        </div>
                        <div>{toAddress.phone}</div>
                      </div>
                    )
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Vendor
                        </label>
                        <select
                          value=""
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "project" && selectedProject?.project_address) {
                              setToAddress({
                                ...selectedProject.project_address,
                                company_name:
                                  selectedProject.project_address.company_name ||
                                  selectedProject.name,
                                phone: selectedProject.project_address.phone || "",
                              });
                              return;
                            }
                            const vendor = vendors.find(
                              (v) => v.id === Number(value)
                            );
                            if (vendor) {
                              applyVendorAddressTo(vendor);
                            }
                          }}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select vendor (optional)</option>
                          {projectHasAddress && (
                            <option value="project">Use project address</option>
                          )}
                          {vendors.map((vendor) => (
                            <option key={vendor.id} value={vendor.id}>
                              {vendor.company_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Company Name
                          </label>
                          <input
                            type="text"
                            value={toAddress.company_name}
                            onChange={(e) =>
                              setToAddress({ ...toAddress, company_name: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Street Address
                          </label>
                          <input
                            type="text"
                            value={toAddress.street_address}
                            onChange={(e) =>
                              setToAddress({ ...toAddress, street_address: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            City
                          </label>
                          <input
                            type="text"
                            value={toAddress.city}
                            onChange={(e) =>
                              setToAddress({ ...toAddress, city: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            State
                          </label>
                          <input
                            type="text"
                            value={toAddress.state}
                            onChange={(e) =>
                              setToAddress({ ...toAddress, state: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            maxLength={2}
                            placeholder="NY"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Zip Code
                          </label>
                          <input
                            type="text"
                            value={toAddress.zip_code}
                            onChange={(e) =>
                              setToAddress({ ...toAddress, zip_code: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone
                          </label>
                          <input
                            type="tel"
                            value={toAddress.phone}
                            onChange={(e) =>
                              setToAddress({ ...toAddress, phone: e.target.value })
                            }
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* PO / Reference */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    PO / Reference
                  </label>
                  <input
                    type="text"
                    value={poReference}
                    onChange={(e) => setPoReference(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter PO or reference"
                  />
                </div>

                {/* From Location (only if no project) */}
                {!projectId && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Items Source Location{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={fromLocationId || ""}
                      onChange={(e) =>
                        setFromLocationId(
                          e.target.value ? parseInt(e.target.value) : null
                        )
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Source Folder</option>
                      {rootFolders.map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Items Section */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Items</h2>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowItemSelector(true)}
                    disabled={!fromLocationId}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    + Add Items
                  </button>
                  <button
                    onClick={() => setShowManualItemModal(true)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    + Add Manual Item
                  </button>
                </div>
              </div>

              {deliveryItems.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                  <p className="text-gray-500">No items added yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {!fromLocationId
                      ? "Select a source location first"
                      : 'Click "Add Items" to get started'}
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Item
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Brand
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Part #
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {deliveryItems.map((item, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {item.item_name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {item.custom_attribute_values?.find(
                              (a) =>
                                a.custom_attribute_name.toLowerCase() ===
                                "brand"
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
                            {item.location}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <input
                              type="number"
                              min="1"
                              max={
                                item.sortly_item_id
                                  ? item.available_quantity
                                  : undefined
                              }
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...deliveryItems];
                                newItems[index].quantity =
                                  parseFloat(e.target.value) || 0;
                                setDeliveryItems(newItems);
                              }}
                              className="w-20 px-2 py-1 border border-gray-300 rounded"
                            />
                            {item.sortly_item_id && (
                              <span className="ml-2 text-xs text-gray-500">
                                / {item.available_quantity}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <button
                              onClick={() => {
                                setDeliveryItems(
                                  deliveryItems.filter((_, i) => i !== index)
                                );
                              }}
                              className="text-red-600 hover:text-red-800"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                onClick={handleSaveDraft}
                disabled={saving || deliveryItems.length === 0}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save as Draft
              </button>
              <button
                onClick={handlePrint}
                disabled={saving || deliveryItems.length === 0 || !truckFolderId}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Print & Create Delivery
              </button>
            </div>
          </div>
        </div>

        {/* Item Selector Modal */}
        <ItemSelector
          isOpen={showItemSelector}
          onClose={() => setShowItemSelector(false)}
          fromLocationId={fromLocationId!}
          onAddItems={(items) => {
            setDeliveryItems([...deliveryItems, ...items]);
            setShowItemSelector(false);
          }}
          excludeItemIds={deliveryItems
            .map((item) => item.sortly_item_id)
            .filter((id): id is number => id !== null)}
          hasProject={projectId !== null}
        />

        <ManualItemModal
          isOpen={showManualItemModal}
          onClose={() => setShowManualItemModal(false)}
          onAddItem={(item) => {
            setDeliveryItems([
              ...deliveryItems,
              {
                sortly_item_id: null,
                item_name: item.item_name,
                quantity: item.quantity,
                available_quantity: item.quantity,
                location: "Manual item",
                is_manual: true,
              },
            ]);
          }}
        />
      </main>
    </div>
  );
}
