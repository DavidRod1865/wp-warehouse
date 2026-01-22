import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen } from "@fortawesome/free-solid-svg-icons";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { sortlyClient } from "../lib/sortly";
import { fetchAllFolders } from "../services/sortlyApi";
import { useAuth } from "../contexts/AuthContext";
import ItemSelector from "../components/ItemSelector";
import ManualItemModal from "../components/ManualItemModal";
import type { SortlyItem } from "../types/sortly";
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
  original_quantity?: number;
  is_manual?: boolean;
  custom_attribute_values?: Array<{
    custom_attribute_id: number;
    custom_attribute_name: string;
    value: string;
  }>;
}

interface Delivery {
  id: number;
  delivery_number: string;
  po_reference?: string | null;
  project_id: number | null;
  driver_id: string | null;
  status: string;
  from_address: Address;
  to_address: Address;
  from_location_id: number;
  truck_sortly_folder_id: number;
  from_location_type: string;
  activity_log: Array<{
    timestamp: string;
    action: string;
    user_id?: string;
    user_email?: string;
    details?: Record<string, unknown>;
  }>;
}

export default function EditDelivery() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Form state
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [poReference, setPoReference] = useState("");
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

  const getItemKey = (item: {
    sortly_item_id: number | null;
    item_name: string;
    notes?: string | null;
    location?: string;
  }) => {
    if (item.sortly_item_id !== null) {
      return `sortly:${item.sortly_item_id}`;
    }
    const location = item.notes ?? item.location ?? "";
    return `manual:${item.item_name.trim().toLowerCase()}|${location
      .trim()
      .toLowerCase()}`;
  };

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showItemSelector, setShowItemSelector] = useState(false);
  const [isEditingFromAddress, setIsEditingFromAddress] = useState(false);
  const [isEditingToAddress, setIsEditingToAddress] = useState(false);
  const [showProjectAddressModal, setShowProjectAddressModal] = useState(false);
  const [projectAddressDraft, setProjectAddressDraft] = useState({
    street_address: "",
    city: "",
    state: "",
    zip_code: "",
  });

  useEffect(() => {
    loadDelivery();
  }, [id]);

  useEffect(() => {
    if (!delivery || !loading) return;

    // Show warning if project changes for pending delivery
    if (delivery.status === "pending" && projectId !== delivery.project_id) {
      const newProjectName = projectId
        ? projects.find((p) => p.id === projectId)?.name
        : "No Project (Residential)";
      const oldProjectName = delivery.project_id
        ? projects.find((p) => p.id === delivery.project_id)?.name
        : "No Project (Residential)";

      const confirmed = window.confirm(
        `⚠️ WARNING: Changing from "${oldProjectName}" to "${newProjectName}" will:\n\n` +
          "1. Remove all items from the current truck\n" +
          "2. Return them to the original source location\n" +
          "3. Move items from the NEW source location to the truck\n\n" +
          "This is a significant change. Do you want to continue?"
      );

      if (!confirmed) {
        // Revert the change
        setProjectId(delivery.project_id);
        if (delivery.project_id) {
          const project = projects.find((p) => p.id === delivery.project_id);
          if (project) {
            setFromLocationId(project.sortly_warehouse_folder_id ?? null);
          }
        } else {
          setFromLocationId(delivery.from_location_id);
        }
      }
    }
  }, [projectId, delivery, loading, projects]);

  const loadDelivery = async () => {
    setLoading(true);
    try {
      // Fetch delivery
      const { data: deliveryData, error: deliveryError } = await supabase
        .from("deliveries")
        .select("*")
        .eq("id", id)
        .single();

      if (deliveryError) throw deliveryError;

      if (deliveryData.status === "delivered") {
        setError("Cannot edit delivered orders");
        setTimeout(() => navigate(`/deliveries/${id}`), 2000);
        return;
      }

      setDelivery(deliveryData);
      setProjectId(deliveryData.project_id);
      setPoReference(deliveryData.po_reference || "");
      setFromAddress(deliveryData.from_address);
      setToAddress(deliveryData.to_address);
      setTruckFolderId(deliveryData.truck_sortly_folder_id);
      setFromLocationId(deliveryData.from_location_id);

      // Fetch delivery items
      const { data: itemsData, error: itemsError } = await supabase
        .from("delivery_items")
        .select("*")
        .eq("delivery_id", id);

      if (itemsError) throw itemsError;

      // Convert to DeliveryItem format
      const items: DeliveryItem[] = itemsData.map((item) => ({
        sortly_item_id: item.sortly_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        available_quantity: item.quantity,
        location: item.notes || "",
        original_quantity: item.quantity,
        is_manual: item.sortly_item_id === null,
        custom_attribute_values: item.custom_attribute_values,
      }));

      setDeliveryItems(items);

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

      // Fetch trucks and root folders
      const response = await sortlyClient.listItems({ per_page: 100 });
      const allItems = response.data || [];

      const truckFolders = allItems.filter(
        (item: SortlyItem) =>
          item.type === "folder" && item.parent_id === 102892637
      );
      setTrucks(
        truckFolders.map((t: SortlyItem) => ({ id: t.id, name: t.name }))
      );

      const rootFolderItems = allItems.filter(
        (item: SortlyItem) =>
          item.type === "folder" &&
          (item.parent_id === null || item.parent_id === undefined)
      );
      setRootFolders(rootFolderItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load delivery");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!delivery || !fromLocationId || !truckFolderId) {
      setError("Please fill in all required fields");
      return;
    }


    // Validate quantities (only if there are items)
    if (deliveryItems.length > 0) {
      const invalidItems = deliveryItems.filter((item) => item.quantity <= 0);
      if (invalidItems.length > 0) {
        setError("All items must have a quantity greater than 0");
        return;
      }
    }

    setSaving(true);
    setError("");

    try {
      // Fetch original delivery items from DB for activity tracking
      const { data: originalItemsData } = await supabase
        .from("delivery_items")
        .select("*")
        .eq("delivery_id", id);

      const originalItems = originalItemsData || [];
      const originalItemKeys = new Set(
        originalItems.map((item) => getItemKey(item))
      );
      const originalItemByKey = new Map(
        originalItems.map((item) => [getItemKey(item), item])
      );
      const originalSortlyItems = originalItems.filter(
        (item) => item.sortly_item_id !== null
      );

      // Only handle Sortly movements if delivery is pending
      if (delivery.status === "pending") {
        const originalItemMap = new Map(
          originalSortlyItems.map((item) => [item.sortly_item_id, item])
        );

        // Check if truck or source location changed
        const truckChanged = truckFolderId !== delivery.truck_sortly_folder_id;
        const sourceChanged = fromLocationId !== delivery.from_location_id;

        if (truckChanged || sourceChanged) {
          console.log(
            "Truck or source location changed - reverting and re-applying all items"
          );

          // Step 1: Move all original items back from old truck to old source (REMOVE from truck)
          for (const originalItem of originalSortlyItems) {
            const itemInTruck = await sortlyClient.findItemInFolder(
              originalItem.sortly_item_id,
              originalItem.item_name,
              delivery.truck_sortly_folder_id
            );

            if (itemInTruck) {
              await sortlyClient.removeDeliveryNote(
                itemInTruck.id,
                delivery.delivery_number
              );

              // Move back and REMOVE from truck
              await sortlyClient.moveItemWithOptions(
                itemInTruck.id,
                originalItem.quantity,
                delivery.from_location_id,
                false // Don't leave in truck
              );

              // Find the item in old source and remove delivery note
              const itemInSource = await sortlyClient.findItemInFolder(
                originalItem.sortly_item_id,
                originalItem.item_name,
                delivery.from_location_id
              );

              if (itemInSource) {
                await sortlyClient.removeDeliveryNote(
                  itemInSource.id,
                  delivery.delivery_number
                );
              }

              console.log(
                `✓ Moved ${originalItem.quantity} of ${originalItem.item_name} from old truck back to source`
              );
            }
          }

          // Step 2: Move all new items from new source to new truck (KEEP in source)
          for (const item of deliveryItems) {
            if (item.sortly_item_id === null) continue;
            await sortlyClient.moveItemWithOptions(
              item.sortly_item_id,
              item.quantity,
              truckFolderId,
              true // Keep in source
            );

            // Find and add note to the new item in truck
            const itemInNewTruck = await sortlyClient.findItemInFolder(
              item.sortly_item_id,
              item.item_name,
              truckFolderId
            );

            if (itemInNewTruck) {
              await sortlyClient.addDeliveryNote(
                itemInNewTruck.id,
                truckFolderId,
                delivery.delivery_number
              );
            }

            console.log(
              `✓ Moved ${item.quantity} of ${item.item_name} to new truck`
            );
          }
        } else {
          // Handle removed items - Move back from truck to source (REMOVE from truck)
          for (const originalItem of originalSortlyItems) {
            const stillExists = deliveryItems.find(
              (item) => item.sortly_item_id === originalItem.sortly_item_id
            );
            if (!stillExists) {
              const itemInTruck = await sortlyClient.findItemInFolder(
                originalItem.sortly_item_id,
                originalItem.item_name,
                truckFolderId
              );

              if (itemInTruck) {
                await sortlyClient.removeDeliveryNote(
                  itemInTruck.id,
                  delivery.delivery_number
                );

                // Move back to source
                await sortlyClient.moveItemWithOptions(
                  itemInTruck.id,
                  originalItem.quantity,
                  fromLocationId,
                  false // Don't leave in truck
                );

                // Find the item in source and remove delivery note
                const itemInSource = await sortlyClient.findItemInFolder(
                  originalItem.sortly_item_id,
                  originalItem.item_name,
                  fromLocationId
                );

                if (itemInSource) {
                  await sortlyClient.removeDeliveryNote(
                    itemInSource.id,
                    delivery.delivery_number
                  );
                }

                console.log(
                  `✓ Removed item: Moved ${originalItem.quantity} of ${originalItem.item_name} back from truck`
                );
              }
            }
          }

          // Handle quantity changes and new items
          for (const item of deliveryItems) {
            if (item.sortly_item_id === null) continue;
            const originalItem = originalItemMap.get(item.sortly_item_id);

            if (!originalItem) {
              // NEW ITEM: Move from source to truck (KEEP in source)
              await sortlyClient.moveItemWithOptions(
                item.sortly_item_id,
                item.quantity,
                truckFolderId,
                true // Keep in source
              );

              const itemInTruck = await sortlyClient.findItemInFolder(
                item.sortly_item_id,
                item.item_name,
                truckFolderId
              );

              if (itemInTruck) {
                await sortlyClient.addDeliveryNote(
                  itemInTruck.id,
                  truckFolderId,
                  delivery.delivery_number
                );
              }

              console.log(
                `✓ New item: Moved ${item.quantity} of ${item.item_name} to truck`
              );
            } else {
              // EXISTING ITEM: Handle quantity changes
              const quantityDiff = item.quantity - originalItem.quantity;

              if (quantityDiff > 0) {
                // Need to add more to truck
                await sortlyClient.moveItemWithOptions(
                  item.sortly_item_id,
                  quantityDiff,
                  truckFolderId,
                  true // Keep in source
                );
                console.log(
                  `✓ Increased: Moved ${quantityDiff} additional units of ${item.item_name} to truck`
                );
              } else if (quantityDiff < 0) {
                // Need to reduce quantity in truck - move some back to source
                const itemInTruck = await sortlyClient.findItemInFolder(
                  item.sortly_item_id,
                  item.item_name,
                  truckFolderId
                );

                if (itemInTruck) {
                  // Move back to source (this removes from truck)
                  await sortlyClient.moveItemWithOptions(
                    itemInTruck.id,
                    Math.abs(quantityDiff),
                    fromLocationId,
                    false // Don't leave in truck
                  );

                  console.log(
                    `✓ Moved ${Math.abs(
                      quantityDiff
                    )} units back to source, removing delivery note...`
                  );

                  // Wait a bit for Sortly to process the move
                  await new Promise((resolve) => setTimeout(resolve, 1000));

                  // Refresh the items list and find ALL items with this name in source folder
                  const allItemsInSource: SortlyItem[] = [];
                  let page = 1;
                  let hasMore = true;

                  while (hasMore) {
                    const response = await sortlyClient.listItems({
                      parent_id: fromLocationId,
                      per_page: 100,
                      page,
                    });
                    if (response.data && response.data.length > 0) {
                      allItemsInSource.push(...response.data);
                      hasMore = response.data.length === 100;
                      page++;
                    } else {
                      hasMore = false;
                    }
                  }

                  // Find ALL items with this name (there might be multiple after the move)
                  const matchingItems = allItemsInSource.filter(
                    (i) =>
                      i.name.trim().toLowerCase() ===
                        item.item_name.trim().toLowerCase() &&
                      i.parent_id === fromLocationId
                  );

                  // Remove delivery note from all matching items
                  for (const matchingItem of matchingItems) {
                    if (
                      matchingItem.notes &&
                      matchingItem.notes.includes(
                        `[Delivery: ${delivery.delivery_number}]`
                      )
                    ) {
                      await sortlyClient.removeDeliveryNote(
                        matchingItem.id,
                        delivery.delivery_number
                      );
                      console.log(
                        `✓ Removed delivery note from item ID ${matchingItem.id}`
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }

      if (delivery.status === "pending") {
        const newManualItems = deliveryItems.filter(
          (item) =>
            item.sortly_item_id === null &&
            !originalItemKeys.has(getItemKey(item))
        );
        if (newManualItems.length > 0) {
          for (const item of newManualItems) {
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
              delivery.delivery_number
            );
          }
        }
      }

      // Update delivery in database with granular activity tracking
      const activityEntries: ActivityLogEntry[] = [];
      const currentItemKeys = new Set(
        deliveryItems.map((item) => getItemKey(item))
      );

      // Track item additions
      const addedItems = deliveryItems.filter(
        (item) => !originalItemKeys.has(getItemKey(item))
      );
      if (addedItems.length > 0) {
        activityEntries.push({
          timestamp: new Date().toISOString(),
          action: "items_added",
          user_id: user?.id,
          user_email: user?.email,
          user_name: profile?.username || user?.email?.split('@')[0],
          details: {
            items_added: addedItems.map((item) => ({
              item_name: item.item_name,
              quantity: item.quantity,
            })),
          },
        });
      }

      // Track item removals
      const removedItems = originalItems.filter(
        (orig) => !currentItemKeys.has(getItemKey(orig))
      );
      if (removedItems.length > 0) {
        activityEntries.push({
          timestamp: new Date().toISOString(),
          action: "items_removed",
          user_id: user?.id,
          user_email: user?.email,
          user_name: profile?.username || user?.email?.split('@')[0],
          details: {
            items_removed: removedItems.map((item) => ({
              item_name: item.item_name,
              quantity: item.quantity,
            })),
          },
        });
      }

      // Track quantity changes
      const quantityChanges = deliveryItems
        .map((item) => {
          const original = originalItemByKey.get(getItemKey(item));
          if (original && original.quantity !== item.quantity) {
            return {
              item_name: item.item_name,
              old_quantity: original.quantity,
              new_quantity: item.quantity,
            };
          }
          return null;
        })
        .filter((change): change is { item_name: string; old_quantity: number; new_quantity: number } => change !== null);

      if (quantityChanges.length > 0) {
        activityEntries.push({
          timestamp: new Date().toISOString(),
          action: "items_quantity_changed",
          user_id: user?.id,
          user_email: user?.email,
          user_name: profile?.username || user?.email?.split('@')[0],
          details: {
            quantity_changes: quantityChanges,
          },
        });
      }

      // Track truck changes
      if (delivery.truck_sortly_folder_id !== truckFolderId) {
        const oldTruck = trucks.find((t) => t.id === delivery.truck_sortly_folder_id);
        const newTruck = trucks.find((t) => t.id === truckFolderId);
        activityEntries.push({
          timestamp: new Date().toISOString(),
          action: "truck_changed",
          user_id: user?.id,
          user_email: user?.email,
          user_name: profile?.username || user?.email?.split('@')[0],
          details: {
            truck_changed: {
              from: oldTruck?.name || "Unknown",
              to: newTruck?.name || "Unknown",
            },
          },
        });
      }

      // Track project changes
      if (delivery.project_id !== projectId) {
        const oldProject = projects.find((p) => p.id === delivery.project_id);
        const newProject = projects.find((p) => p.id === projectId);
        activityEntries.push({
          timestamp: new Date().toISOString(),
          action: "project_changed",
          user_id: user?.id,
          user_email: user?.email,
          user_name: profile?.username || user?.email?.split('@')[0],
          details: {
            project_changed: {
              from: oldProject?.name || null,
              to: newProject?.name || null,
            },
          },
        });
      }

      // Track from address changes
      const fromAddressChanged = JSON.stringify(delivery.from_address) !== JSON.stringify(fromAddress);
      if (fromAddressChanged) {
        const changes: Record<string, { old: string; new: string }> = {};
        Object.keys(fromAddress).forEach((key) => {
          if (delivery.from_address && delivery.from_address[key] !== fromAddress[key]) {
            changes[key] = {
              old: delivery.from_address[key] || "",
              new: fromAddress[key] || "",
            };
          }
        });
        if (Object.keys(changes).length > 0) {
          activityEntries.push({
            timestamp: new Date().toISOString(),
            action: "address_changed",
            user_id: user?.id,
            user_email: user?.email,
            user_name: profile?.username || user?.email?.split('@')[0],
            details: {
              address_changed: {
                field: "from_address",
                changes,
              },
            },
          });
        }
      }

      // Track to address changes
      const toAddressChanged = JSON.stringify(delivery.to_address) !== JSON.stringify(toAddress);
      if (toAddressChanged) {
        const changes: Record<string, { old: string; new: string }> = {};
        Object.keys(toAddress).forEach((key) => {
          if (delivery.to_address && delivery.to_address[key] !== toAddress[key]) {
            changes[key] = {
              old: delivery.to_address[key] || "",
              new: toAddress[key] || "",
            };
          }
        });
        if (Object.keys(changes).length > 0) {
          activityEntries.push({
            timestamp: new Date().toISOString(),
            action: "address_changed",
            user_id: user?.id,
            user_email: user?.email,
            user_name: profile?.username || user?.email?.split('@')[0],
            details: {
              address_changed: {
                field: "to_address",
                changes,
              },
            },
          });
        }
      }

      // If any changes were tracked, use the detailed entries; otherwise, log a generic "edited" action
      const updatedActivityLog = [
        ...(delivery.activity_log || []),
        ...(activityEntries.length > 0
          ? activityEntries
          : [
              {
                timestamp: new Date().toISOString(),
                action: "edited",
                user_id: user?.id,
                user_email: user?.email,
                user_name: profile?.username || user?.email?.split('@')[0],
                details: {
                  status: delivery.status,
                },
              } as ActivityLogEntry,
            ]),
      ];

      const { error: updateError } = await supabase
        .from("deliveries")
        .update({
          po_reference: poReference.trim() || null,
          project_id: projectId,
          from_address: fromAddress,
          to_address: toAddress,
          from_location_id: fromLocationId,
          truck_sortly_folder_id: truckFolderId,
          truck_name: trucks.find((t) => t.id === truckFolderId)?.name || null,
          activity_log: updatedActivityLog,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Delete old delivery items
      const { error: deleteItemsError } = await supabase
        .from("delivery_items")
        .delete()
        .eq("delivery_id", id);

      if (deleteItemsError) throw deleteItemsError;

      // Insert new delivery items
      const deliveryItemsData = deliveryItems.map((item) => ({
        delivery_id: parseInt(id!),
        sortly_item_id: item.sortly_item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        notes: item.location,
        custom_attribute_values: item.custom_attribute_values || null,
      }));

      const { error: insertItemsError } = await supabase
        .from("delivery_items")
        .insert(deliveryItemsData);

      if (insertItemsError) throw insertItemsError;

      alert("Delivery updated successfully!");
      navigate(`/deliveries/${id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update delivery"
      );
    } finally {
      setSaving(false);
    }
  };

  const availableTruckIds = new Set(trucks.map((truck) => truck.id));

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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Edit Delivery
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Delivery #: {delivery.delivery_number}
              </p>
            </div>
            <button
              onClick={() => navigate(`/deliveries/${id}`)}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Cancel
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            {/* Basic Information */}
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
                    onChange={(e) => {
                      const value = e.target.value
                        ? parseInt(e.target.value)
                        : null;

                      // Show warning if delivery is pending and truck is changing
                      if (
                        delivery &&
                        delivery.status === "pending" &&
                        value !== delivery.truck_sortly_folder_id
                      ) {
                        const newTruckName = trucks.find(
                          (t) => t.id === value
                        )?.name;
                        const oldTruckName = trucks.find(
                          (t) => t.id === delivery.truck_sortly_folder_id
                        )?.name;

                        const confirmed = window.confirm(
                          `⚠️ WARNING: Changing from "${oldTruckName}" to "${newTruckName}" will:\n\n` +
                            "1. Remove all items from the current truck\n" +
                            "2. Move them to the NEW truck\n\n" +
                            "Do you want to continue?"
                        );

                        if (!confirmed) {
                          return; // Don't change
                        }
                      }

                      setTruckFolderId(value);
                    }}
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

                {/* Project Selection */}
                {/* Project Selection */}
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

                        // Show warning if delivery is pending and project is changing
                        if (
                          delivery &&
                          delivery.status === "pending" &&
                          value !== delivery.project_id
                        ) {
                          const newProjectName = value
                            ? projects.find((p) => p.id === value)?.name
                            : "No Project (Residential)";
                          const oldProjectName = delivery.project_id
                            ? projects.find((p) => p.id === delivery.project_id)
                                ?.name
                            : "No Project (Residential)";

                          const confirmed = window.confirm(
                            `⚠️ WARNING: Changing from "${oldProjectName}" to "${newProjectName}" will:\n\n` +
                              "1. Remove all items from the current truck\n" +
                              "2. Return them to the original source location\n" +
                              "3. Move items from the NEW source location to the truck\n\n" +
                              "This is a significant change. Do you want to continue?"
                          );

                          if (!confirmed) {
                            return; // Don't change
                          }
                        }

                        setProjectId(value);
                        setIsEditingToAddress(false);
                        if (value) {
                          const project = projects.find((p) => p.id === value);
                          if (project) {
                            setFromLocationId(project.sortly_warehouse_folder_id ?? null);
                            if (project.project_address?.street_address && isAddressEmpty(toAddress)) {
                              setToAddress({
                                ...project.project_address,
                                company_name:
                                  project.project_address.company_name ||
                                  project.name,
                                phone: project.project_address.phone || "",
                              });
                            }
                          }
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
                            {item.location}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const newItems = [...deliveryItems];
                                newItems[index].quantity =
                                  parseFloat(e.target.value) || 0;
                                setDeliveryItems(newItems);
                              }}
                              className="w-20 px-2 py-1 border border-gray-300 rounded"
                            />
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
                onClick={() => navigate(`/deliveries/${id}`)}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                {saving ? "Saving..." : "Save Changes"}
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
