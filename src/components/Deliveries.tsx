import { useState, useEffect, useRef } from 'react';
import { DateRangePicker } from 'react-date-range';
import type { RangeKeyDict } from 'react-date-range';
import 'react-date-range/dist/styles.css';
import 'react-date-range/dist/theme/default.css';
import { searchItems, fetchAllFolders, fetchSubfolders, moveItem } from '../services/sortlyApi';
import type { SortlyItem } from '../types/sortly';
import { jsPDF } from 'jspdf';

interface Delivery {
  id: string;
  orderNumber: string;
  date: string;
  status: 'draft' | 'pending' | 'en-route' | 'delivered';
  driver?: string;
  driverFolderId?: number;
  whereFrom?: string;
  destination: string;
  destinationFolderId?: number;
  notes?: string;
  items: Array<{
    name: string;
    quantity: number;
    sortlyItemId?: number;
    sku?: string;
    originalFolderId?: number; // Track where item came from before moving to truck
  }>;
}

// Default delivery orders (will be used if localStorage is empty)
const defaultDeliveries: Delivery[] = [
  {
    id: '1',
    orderNumber: 'DO-2024-001',
    date: '2026-01-15',
    status: 'delivered',
    driver: 'John Smith',
    destination: '123 Main St, City, State 12345',
    items: [
      { name: 'Widget A', quantity: 10 },
      { name: 'Widget B', quantity: 5 },
    ],
  },
  {
    id: '2',
    orderNumber: 'DO-2024-002',
    date: '2026-01-20',
    status: 'pending',
    driver: 'Jane Doe',
    destination: '456 Oak Ave, City, State 67890',
    items: [
      { name: 'Widget C', quantity: 15 },
      { name: 'Widget D', quantity: 8 },
    ],
  },
  {
    id: '3',
    orderNumber: 'DO-2024-003',
    date: '2026-01-25',
    status: 'en-route',
    driver: 'Mike Johnson',
    destination: '789 Pine Rd, City, State 11111',
    items: [
      { name: 'Widget E', quantity: 20 },
    ],
  },
  {
    id: '4',
    orderNumber: 'DO-2024-004',
    date: '2026-01-30',
    status: 'draft',
    driver: undefined,
    destination: '321 Elm St, City, State 22222',
    items: [
      { name: 'Widget F', quantity: 12 },
      { name: 'Widget G', quantity: 7 },
    ],
  },
  {
    id: '5',
    orderNumber: 'DO-2024-005',
    date: '2026-02-05',
    status: 'delivered',
    driver: 'Sarah Williams',
    destination: '654 Maple Dr, City, State 33333',
    items: [
      { name: 'Widget H', quantity: 25 },
    ],
  },
  {
    id: '6',
    orderNumber: 'DO-2024-006',
    date: '2026-02-10',
    status: 'pending',
    driver: 'Tom Brown',
    destination: '987 Cedar Ln, City, State 44444',
    items: [
      { name: 'Widget I', quantity: 18 },
      { name: 'Widget J', quantity: 9 },
    ],
  },
];

// Load deliveries from localStorage or use defaults
const loadDeliveries = (): Delivery[] => {
  try {
    const stored = localStorage.getItem('warehouse-deliveries');
    if (stored) {
      const deliveries: Delivery[] = JSON.parse(stored);
      
      // Migration: Add originalFolderId to items that don't have it
      const migratedDeliveries = deliveries.map(delivery => ({
        ...delivery,
        items: delivery.items.map(item => ({
          ...item,
          // If originalFolderId is missing, set to undefined for backward compatibility
          originalFolderId: item.originalFolderId ?? undefined
        }))
      }));
      
      // Save migrated data back to localStorage if any changes were made
      const needsMigration = deliveries.some(delivery =>
        delivery.items.some(item => !('originalFolderId' in item))
      );
      
      if (needsMigration) {
        localStorage.setItem('warehouse-deliveries', JSON.stringify(migratedDeliveries));
        console.log('Migrated delivery data to include originalFolderId tracking');
      }
      
      return migratedDeliveries;
    }
  } catch (error) {
    console.error('Error loading deliveries from localStorage:', error);
  }
  return defaultDeliveries;
};

// Save deliveries to localStorage
const saveDeliveries = (deliveries: Delivery[]): void => {
  try {
    localStorage.setItem('warehouse-deliveries', JSON.stringify(deliveries));
    console.log(`Saved ${deliveries.length} deliveries to localStorage`);
  } catch (error) {
    console.error('Error saving deliveries to localStorage:', error);
  }
};

// Clear deliveries cache (useful for development/testing)
const clearDeliveriesCache = (): void => {
  try {
    localStorage.removeItem('warehouse-deliveries');
    console.log('Cleared deliveries cache');
  } catch (error) {
    console.error('Error clearing deliveries cache:', error);
  }
};

// Export utility for console access
if (typeof window !== 'undefined') {
  (window as typeof window & { clearDeliveriesCache: typeof clearDeliveriesCache }).clearDeliveriesCache = clearDeliveriesCache;
}

// Custom hook to manage deliveries with localStorage sync
const useDeliveries = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>(() => loadDeliveries());

  const updateDeliveries = (newDeliveries: Delivery[]) => {
    setDeliveries(newDeliveries);
    saveDeliveries(newDeliveries);
  };

  return [deliveries, updateDeliveries] as const;
};

export default function Deliveries() {
  const [deliveries, setDeliveries] = useDeliveries();

  // Calculate this week's start (Monday) and end (Sunday)
  const getThisWeekRange = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Adjust to Monday
    const startOfWeek = new Date(today.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // Add 6 days to get Sunday
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { startOfWeek, endOfWeek };
  };

  const { startOfWeek, endOfWeek } = getThisWeekRange();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'draft' | 'pending' | 'en-route' | 'delivered'>('all');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: startOfWeek,
    endDate: endOfWeek,
    key: 'selection',
  });
  // Generate delivery order number in WP-MMDDYY-## format
  const generateOrderNumber = (): string => {
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const year = String(today.getFullYear()).slice(-2);
    const dateStr = `${month}${day}${year}`;
    
    // Count deliveries for today
    const todayStr = today.toISOString().split('T')[0];
    const todayDeliveries = deliveries.filter(d => d.date === todayStr);
    const orderNum = String(todayDeliveries.length + 1).padStart(2, '0');
    
    return `WP-${dateStr}-${orderNum}`;
  };

  const [newDelivery, setNewDelivery] = useState<{
    orderNumber: string;
    date: string;
    driver: string;
    driverFolderId?: number;
    whereFrom: string;
    destination: string;
    destinationFolderId?: number;
    notes: string;
    items: Array<{
      name: string;
      quantity: number;
      sortlyItemId?: number;
      availableQuantity: number;
      sku?: string;
    }>;
  }>({
    orderNumber: '',
    date: '',
    driver: '',
    driverFolderId: undefined,
    whereFrom: '',
    destination: '',
    destinationFolderId: undefined,
    notes: '',
    items: [],
  });

  // Multi-stage modal state
  const [currentStage, setCurrentStage] = useState(1);
  const totalStages = 4;
  
  // Folder state
  const [jobListFolders, setJobListFolders] = useState<SortlyItem[]>([]);
  const [deliveryTruckFolders, setDeliveryTruckFolders] = useState<SortlyItem[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedDestinationFolder, setSelectedDestinationFolder] = useState<SortlyItem | null>(null);
  const [selectedDriverFolder, setSelectedDriverFolder] = useState<SortlyItem | null>(null);
  
  // Item search state
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSearchResults, setItemSearchResults] = useState<SortlyItem[]>([]);
  const [isSearchingItems, setIsSearchingItems] = useState(false);
  const [showItemSearch, setShowItemSearch] = useState(false);
  
  // Loading and error states
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDelivery, setEditingDelivery] = useState<Delivery | null>(null);
  const [editFormData, setEditFormData] = useState<{
    orderNumber: string;
    date: string;
    driver: string;
    driverFolderId?: number;
    whereFrom: string;
    destination: string;
    destinationFolderId?: number;
    notes: string;
    items: Array<{
      name: string;
      quantity: number;
      sortlyItemId?: number;
      sku?: string;
      originalFolderId?: number;
      availableQuantity?: number; // Current available quantity in Sortly
      warehouseQuantity?: number; // Quantity in warehouse
      truckQuantity?: number; // Quantity currently in truck
    }>;
  }>({
    orderNumber: '',
    date: '',
    driver: '',
    driverFolderId: undefined,
    whereFrom: '',
    destination: '',
    destinationFolderId: undefined,
    notes: '',
    items: [],
  });
  
  // Edit modal folder state
  const [editJobListFolders, setEditJobListFolders] = useState<SortlyItem[]>([]);
  const [editDeliveryTruckFolders, setEditDeliveryTruckFolders] = useState<SortlyItem[]>([]);
  const [editLoadingFolders, setEditLoadingFolders] = useState(false);
  
  // Edit inventory checking state
  const [loadingInventoryData, setLoadingInventoryData] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  const filteredDeliveries = deliveries.filter(delivery => {
    // Filter by status
    if (selectedStatus !== 'all' && delivery.status !== selectedStatus) {
      return false;
    }
    
    // Filter by date range if dates are selected
    if (dateRange.startDate && dateRange.endDate) {
      const deliveryDate = new Date(delivery.date + 'T00:00:00');
      deliveryDate.setHours(0, 0, 0, 0);
      const startDate = new Date(dateRange.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateRange.endDate);
      endDate.setHours(23, 59, 59, 999);
      return deliveryDate >= startDate && deliveryDate <= endDate;
    }
    
    return true;
  });

  const datePickerRef = useRef<HTMLDivElement>(null);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker]);

  const handleDateRangeChange = (ranges: RangeKeyDict) => {
    if (ranges.selection) {
      setDateRange({
        startDate: ranges.selection.startDate || new Date(),
        endDate: ranges.selection.endDate || new Date(),
        key: 'selection',
      });
    }
  };

  // Load folders when modal opens
  useEffect(() => {
    const loadFolders = async () => {
      if (!showCreateModal) return;
      
      try {
        setLoadingFolders(true);
        const allFolders = await fetchAllFolders(false);
        
        // Find Job List and Delivery Truck parent folders
        const jobListFolder = allFolders.find(folder => 
          folder.name.toLowerCase().includes('job sites') || 
          folder.name.toLowerCase() === 'job sites'
        );
        const deliveryTruckFolder = allFolders.find(folder => 
          folder.name.toLowerCase().includes('delivery trucks') || 
          folder.name.toLowerCase() === 'delivery trucks'
        );
        
        // Get subfolders if parent folders exist
        if (jobListFolder?.id) {
          const subfolders = await fetchSubfolders(jobListFolder.id, false);
          setJobListFolders(subfolders);
        }
        
        if (deliveryTruckFolder?.id) {
          const subfolders = await fetchSubfolders(deliveryTruckFolder.id, false);
          setDeliveryTruckFolders(subfolders);
        }
      } catch (err) {
        console.error('Error loading folders:', err);
        setSaveError('Failed to load folders. Please try again.');
      } finally {
        setLoadingFolders(false);
      }
    };

    loadFolders();
  }, [showCreateModal]);

  // Search items from Sortly
  useEffect(() => {
    const searchTimeout = setTimeout(async () => {
      if (itemSearchQuery.trim().length > 0) {
        try {
          setIsSearchingItems(true);
          const results = await searchItems(itemSearchQuery.trim());
          setItemSearchResults(results);
        } catch (err) {
          console.error('Error searching items:', err);
          setItemSearchResults([]);
        } finally {
          setIsSearchingItems(false);
        }
      } else {
        setItemSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(searchTimeout);
  }, [itemSearchQuery]);

  // Move delivery items from original location to driver folder
  const moveDeliveryItems = async (delivery: Delivery): Promise<void> => {
    if (!delivery.driverFolderId) {
      throw new Error('No driver folder specified for this delivery');
    }

    const itemsToMove = delivery.items.filter(item => item.sortlyItemId && item.quantity > 0);
    
    if (itemsToMove.length === 0) {
      throw new Error('No items to move for this delivery');
    }

    // Process items sequentially to avoid API rate limits
    for (const item of itemsToMove) {
      try {
        // Find the current item to get its current quantity and location
        const searchResults = await searchItems(item.name || '');
        const currentItem = searchResults.find(i => i.id === item.sortlyItemId);
        
        if (!currentItem) {
          throw new Error(`Item ${item.name} not found in inventory`);
        }

        const quantityToMove = item.quantity || 0;
        const originalFolderId = currentItem.parent_id || null;

        // Store the original folder ID in the delivery item for future reference
        // Update the delivery in state to include original folder tracking
        const updatedDeliveries = deliveries.map((d: Delivery) => 
          d.id === delivery.id 
            ? {
                ...d,
                items: d.items.map((i: Delivery['items'][0]) => 
                  i.sortlyItemId === item.sortlyItemId 
                    ? { ...i, originalFolderId: originalFolderId || undefined }
                    : i
                )
              }
            : d
        );
        setDeliveries(updatedDeliveries);

        // Use Sortly's dedicated move API that handles quantity and location in one call
        console.log(`Moving ${quantityToMove} of item ${item.name} (ID: ${item.sortlyItemId}) from folder ${originalFolderId} to driver folder ${delivery.driverFolderId}`);
        await moveItem(
          item.sortlyItemId!, 
          quantityToMove, 
          delivery.driverFolderId, 
          true // leave_zero_quantity = true to keep items with 0 quantity
        );
        
        // Add delay between API calls to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        console.error(`Error moving item ${item.name}:`, err);
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        throw new Error(`Failed to move item "${item.name}": ${errorMessage}`);
      }
    }
  };

  // Update delivery status and sync to localStorage
  const updateDeliveryStatus = (deliveryId: string, newStatus: 'draft' | 'pending' | 'en-route' | 'delivered'): void => {
    const updatedDeliveries = deliveries.map(delivery => 
      delivery.id === deliveryId 
        ? { ...delivery, status: newStatus }
        : delivery
    );
    setDeliveries(updatedDeliveries);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'en-route':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Fetch real-time inventory data for edit modal
  const fetchInventoryData = async (items: Delivery['items'], delivery: Delivery): Promise<Delivery['items']> => {
    setLoadingInventoryData(true);
    setInventoryError(null);
    
    try {
      const itemsWithInventory = await Promise.all(
        items.map(async (item) => {
          if (!item.sortlyItemId || !item.name) return item;
          
          try {
            // First, search for all instances of this item to understand its distribution
            const searchResults = await searchItems(item.name);
            const allItemInstances = searchResults.filter(i => i.id === item.sortlyItemId);
            
            console.log(`\n=== INVENTORY DEBUG for ${item.name} (ID: ${item.sortlyItemId}) ===`);
            console.log('Search results:', searchResults);
            console.log('Filtered instances:', allItemInstances);
            console.log('Item originalFolderId:', item.originalFolderId);
            console.log('Delivery driverFolderId:', delivery.driverFolderId);
            console.log('Delivery status:', delivery.status);
            
            let warehouseQuantity = 0;
            let truckQuantity = 0;
            
            // For each search result, get ALL instances of this item (not just filtered by ID)
            const allItemsWithSameName = searchResults.filter(i => i.name === item.name);
            console.log('All items with same name:', allItemsWithSameName);
            
            // Sum up quantities from all instances of this item
            for (const instance of allItemsWithSameName) {
              const quantity = Number(instance.quantity) || 0;
              console.log(`Processing instance: id=${instance.id}, parent_id=${instance.parent_id}, quantity=${quantity}`);
              
              // Check if this instance is in the truck folder
              if (delivery.driverFolderId && instance.parent_id === delivery.driverFolderId) {
                truckQuantity += quantity;
                console.log(`-> Added ${quantity} to truck quantity (now ${truckQuantity})`);
              }
              // Check if this instance is in the original warehouse location
              else if (item.originalFolderId && instance.parent_id === item.originalFolderId) {
                warehouseQuantity += quantity;
                console.log(`-> Added ${quantity} to warehouse quantity (now ${warehouseQuantity})`);
              }
              // If no originalFolderId, and this is not the truck folder, treat as warehouse
              else if (!delivery.driverFolderId || instance.parent_id !== delivery.driverFolderId) {
                warehouseQuantity += quantity;
                console.log(`-> Added ${quantity} to warehouse quantity [default location] (now ${warehouseQuantity})`);
              } else {
                console.log(`-> Skipped instance (doesn't match any criteria)`);
              }
            }
            
            const totalAvailable = Number(warehouseQuantity) + Number(truckQuantity);
            
            console.log(`FINAL: ${item.name} inventory: warehouse=${warehouseQuantity}, truck=${truckQuantity}, total=${totalAvailable}`);
            console.log(`=== END DEBUG ===\n`);
            
            return {
              ...item,
              availableQuantity: totalAvailable,
              warehouseQuantity,
              truckQuantity
            };
          } catch (err) {
            console.error(`Error fetching inventory for ${item.name}:`, err);
            return { ...item, availableQuantity: 0, warehouseQuantity: 0, truckQuantity: 0 };
          }
        })
      );
      
      return itemsWithInventory;
    } catch (error) {
      console.error('Error fetching inventory data:', error);
      setInventoryError('Failed to load inventory data. Please try again.');
      return items;
    } finally {
      setLoadingInventoryData(false);
    }
  };

  // Load folders for edit modal
  const loadEditFolders = async () => {
    setEditLoadingFolders(true);
    try {
      const allFolders = await fetchAllFolders(false);
      
      // Find "Job Sites" and "Delivery Trucks" folders
      const jobSitesFolder = allFolders.find(folder => 
        folder.name?.toLowerCase().includes('job sites')
      );
      const deliveryTrucksFolder = allFolders.find(folder => 
        folder.name?.toLowerCase().includes('delivery trucks')
      );
      
      if (jobSitesFolder?.id) {
        const jobSubfolders = await fetchSubfolders(jobSitesFolder.id, false);
        setEditJobListFolders(jobSubfolders);
      }
      
      if (deliveryTrucksFolder?.id) {
        const truckSubfolders = await fetchSubfolders(deliveryTrucksFolder.id, false);
        setEditDeliveryTruckFolders(truckSubfolders);
      }
    } catch (error) {
      console.error('Error loading folders for edit modal:', error);
      setInventoryError('Failed to load folder data. Please try again.');
    } finally {
      setEditLoadingFolders(false);
    }
  };

  // Edit delivery handler
  const handleEditDelivery = async (delivery: Delivery) => {
    setEditingDelivery(delivery);
    setShowEditModal(true);
    
    // Load folders first, then fetch inventory data and set up form
    await loadEditFolders();
    
    const itemsWithInventory = await fetchInventoryData(delivery.items, delivery);
    
    // Set initial form data
    setEditFormData({
      orderNumber: delivery.orderNumber,
      date: delivery.date,
      driver: delivery.driver || '',
      driverFolderId: delivery.driverFolderId,
      whereFrom: delivery.whereFrom || '',
      destination: delivery.destination,
      destinationFolderId: delivery.destinationFolderId,
      notes: delivery.notes || '',
      items: itemsWithInventory,
    });
  };


  // Delete delivery handler
  const handleDeleteDelivery = async (delivery: Delivery) => {
    const confirmed = window.confirm(`Are you sure you want to delete delivery order ${delivery.orderNumber}? This action cannot be undone.`);
    
    if (!confirmed) return;

    try {
      // For pending orders, return items to warehouse before deleting
      if (delivery.status === 'pending') {
        console.log(`Returning items to warehouse for delivery ${delivery.orderNumber}`);
        
        for (const item of delivery.items) {
          if (item.sortlyItemId && item.originalFolderId && item.quantity > 0) {
            console.log(`Returning ${item.quantity} of ${item.name} to folder ${item.originalFolderId}`);
            await moveItem(
              item.sortlyItemId,
              item.quantity,
              item.originalFolderId,
              true // leave_zero_quantity = true
            );
            
            // Add delay between API calls
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }

      // Remove delivery from localStorage
      const updatedDeliveries = deliveries.filter(d => d.id !== delivery.id);
      setDeliveries(updatedDeliveries);
      
      console.log(`Delivery ${delivery.orderNumber} deleted successfully`);
    } catch (error) {
      console.error('Error deleting delivery:', error);
      alert('Error deleting delivery order. Please try again.');
    }
  };

  // Save edit changes handler
  const handleSaveEditChanges = async () => {
    if (!editingDelivery) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const originalItems = editingDelivery.items;
      const editedItems = editFormData.items;

      // Only handle item movements via Sortly API for pending orders
      // Draft orders haven't moved items to truck yet, so no Sortly updates needed
      if (editingDelivery.status === 'pending') {
        console.log('Delivery is pending - processing Sortly item movements');
        // Check if driver folder changed
        const driverFolderChanged = editingDelivery.driverFolderId !== editFormData.driverFolderId;
        
        if (driverFolderChanged && editFormData.driverFolderId) {
          console.log(`Driver folder changed from ${editingDelivery.driverFolderId} to ${editFormData.driverFolderId}`);
          // Move all items from old truck folder to new truck folder
          for (const item of originalItems) {
            if (item.sortlyItemId && item.quantity > 0) {
              console.log(`Moving ${item.quantity} of ${item.name} from old truck to new truck folder ${editFormData.driverFolderId}`);
              await moveItem(
                item.sortlyItemId,
                item.quantity,
                editFormData.driverFolderId,
                true
              );
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        }

        // Find items that were removed (exist in original but not in edited)
        const removedItems = originalItems.filter(originalItem =>
          !editedItems.find(editedItem => editedItem.sortlyItemId === originalItem.sortlyItemId)
        );

        // Find items with quantity changes
        const changedItems = editedItems
          .filter(editedItem => {
            const originalItem = originalItems.find(orig => orig.sortlyItemId === editedItem.sortlyItemId);
            return originalItem && originalItem.quantity !== editedItem.quantity;
          })
          .map(editedItem => {
            const originalItem = originalItems.find(orig => orig.sortlyItemId === editedItem.sortlyItemId)!;
            return {
              ...editedItem,
              originalQuantity: originalItem.quantity,
              quantityDiff: editedItem.quantity - originalItem.quantity,
              originalFolderId: originalItem.originalFolderId,
            };
          });

        // Return removed items to warehouse
        for (const removedItem of removedItems) {
          if (removedItem.sortlyItemId && removedItem.originalFolderId && removedItem.quantity > 0) {
            console.log(`Returning ${removedItem.quantity} of ${removedItem.name} to folder ${removedItem.originalFolderId}`);
            await moveItem(
              removedItem.sortlyItemId,
              removedItem.quantity,
              removedItem.originalFolderId,
              true
            );
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }

        // Handle quantity changes (only if driver folder didn't change to avoid double moves)
        if (!driverFolderChanged) {
          console.log(`Processing ${changedItems.length} changed items:`, changedItems);
          
          for (const changedItem of changedItems) {
            console.log(`Processing changed item: ${changedItem.name}, quantityDiff: ${changedItem.quantityDiff}, originalFolderId: ${changedItem.originalFolderId}`);
            
            if (changedItem.sortlyItemId && changedItem.quantityDiff !== 0) {
              if (changedItem.quantityDiff > 0) {
                // Increased quantity - need to find where to get the additional items from
                console.log(`Need to add ${changedItem.quantityDiff} more of ${changedItem.name} to truck`);
                
                // First, try to get from warehouse (originalFolderId)
                if (changedItem.originalFolderId) {
                  console.log(`Moving additional ${changedItem.quantityDiff} of ${changedItem.name} from warehouse (folder ${changedItem.originalFolderId}) to truck`);
                  await moveItem(
                    changedItem.sortlyItemId,
                    changedItem.quantityDiff,
                    editFormData.driverFolderId || editingDelivery.driverFolderId!,
                    true
                  );
                } else {
                  // If no originalFolderId, search for the item and move from any available location
                  console.log(`No originalFolderId for ${changedItem.name}, searching for available inventory...`);
                  const searchResults = await searchItems(changedItem.name);
                  const availableItem = searchResults.find(i => i.name === changedItem.name && (i.quantity || 0) >= changedItem.quantityDiff);
                  
                  if (availableItem && availableItem.id) {
                    console.log(`Found available inventory in folder ${availableItem.parent_id}, moving ${changedItem.quantityDiff} to truck`);
                    await moveItem(
                      availableItem.id,
                      changedItem.quantityDiff,
                      editFormData.driverFolderId || editingDelivery.driverFolderId!,
                      true
                    );
                  } else {
                    console.error(`Could not find enough inventory for ${changedItem.name}`);
                  }
                }
              } else {
                // Decreased quantity - return excess from truck to warehouse
                console.log(`Need to remove ${Math.abs(changedItem.quantityDiff)} of ${changedItem.name} from truck`);
                
                if (changedItem.originalFolderId) {
                  console.log(`Returning ${Math.abs(changedItem.quantityDiff)} of ${changedItem.name} to warehouse (folder ${changedItem.originalFolderId})`);
                  await moveItem(
                    changedItem.sortlyItemId,
                    Math.abs(changedItem.quantityDiff),
                    changedItem.originalFolderId,
                    true
                  );
                } else {
                  // If no originalFolderId, find the warehouse folder by searching for the item
                  console.log(`No originalFolderId for ${changedItem.name}, searching for warehouse location...`);
                  const searchResults = await searchItems(changedItem.name);
                  const warehouseItem = searchResults.find(i => 
                    i.name === changedItem.name && 
                    i.parent_id !== (editFormData.driverFolderId || editingDelivery.driverFolderId)
                  );
                  
                  if (warehouseItem && warehouseItem.parent_id) {
                    console.log(`Found warehouse location (folder ${warehouseItem.parent_id}), returning ${Math.abs(changedItem.quantityDiff)} from truck`);
                    await moveItem(
                      changedItem.sortlyItemId,
                      Math.abs(changedItem.quantityDiff),
                      warehouseItem.parent_id,
                      true
                    );
                  } else {
                    console.error(`Could not find warehouse location for ${changedItem.name} to return items`);
                  }
                }
              }
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        }
      } else {
        console.log(`Delivery status is '${editingDelivery.status}' - skipping Sortly item movements. Only pending deliveries sync to Sortly.`);
      }

      // Update the delivery in localStorage
      const updatedDelivery: Delivery = {
        ...editingDelivery,
        orderNumber: editFormData.orderNumber,
        date: editFormData.date,
        driver: editFormData.driver || undefined,
        driverFolderId: editFormData.driverFolderId,
        whereFrom: editFormData.whereFrom || undefined,
        destination: editFormData.destination,
        destinationFolderId: editFormData.destinationFolderId,
        notes: editFormData.notes || undefined,
        items: editFormData.items.filter(item => item.quantity > 0).map(item => ({
          name: item.name,
          quantity: item.quantity,
          sortlyItemId: item.sortlyItemId,
          sku: item.sku,
          originalFolderId: item.originalFolderId, // Preserve original folder tracking
        })),
      };

      const updatedDeliveries = deliveries.map(d =>
        d.id === editingDelivery.id ? updatedDelivery : d
      );
      setDeliveries(updatedDeliveries);

      // Close modal
      setShowEditModal(false);
      setEditingDelivery(null);
      setEditFormData({
        orderNumber: '',
        date: '',
        driver: '',
        driverFolderId: undefined,
        whereFrom: '',
        destination: '',
        destinationFolderId: undefined,
        notes: '',
        items: [],
      });

      console.log(`Delivery ${updatedDelivery.orderNumber} updated successfully`);
    } catch (error) {
      console.error('Error saving delivery changes:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateDelivery = async () => {
    setIsSaving(true);
    setSaveError(null);
    
    try {
      // First, create the delivery record
      const delivery: Delivery = {
        id: Date.now().toString(),
        orderNumber: newDelivery.orderNumber || generateOrderNumber(),
        date: newDelivery.date,
        status: 'draft',
        driver: newDelivery.driver || undefined,
        driverFolderId: newDelivery.driverFolderId,
        whereFrom: newDelivery.whereFrom || undefined,
        destination: newDelivery.destination,
        destinationFolderId: newDelivery.destinationFolderId,
        notes: newDelivery.notes || undefined,
        items: newDelivery.items
          .filter(item => item.name && item.quantity > 0 && item.sortlyItemId)
          .map(item => ({
            name: item.name,
            quantity: item.quantity,
            sortlyItemId: item.sortlyItemId,
            sku: item.sku,
          })),
      };

      // Items will be moved when the delivery order is printed (draft → pending)

      setDeliveries([...deliveries, delivery]);
      setShowCreateModal(false);
      setNewDelivery({
        orderNumber: '',
        date: '',
        driver: '',
        driverFolderId: undefined,
        whereFrom: '',
        destination: '',
        destinationFolderId: undefined,
        notes: '',
        items: [],
      });
      setItemSearchQuery('');
      setSelectedDriverFolder(null);
      setSelectedDestinationFolder(null);
      setCurrentStage(1);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to create delivery order');
      console.error('Error creating delivery:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const addItemFromSearch = (item: SortlyItem) => {
    const existingIndex = newDelivery.items.findIndex(i => i.sortlyItemId === item.id);
    if (existingIndex >= 0) {
      // Item already added, just update
      const updatedItems = [...newDelivery.items];
      updatedItems[existingIndex] = {
        ...updatedItems[existingIndex],
        name: item.name,
        availableQuantity: item.quantity || 0,
      };
      setNewDelivery({ ...newDelivery, items: updatedItems });
    } else {
      // Add new item
      setNewDelivery({
        ...newDelivery,
        items: [...newDelivery.items, {
          name: item.name,
          quantity: 0,
          sortlyItemId: item.id,
          availableQuantity: item.quantity || 0,
          sku: item.sid,
        }],
      });
    }
    setItemSearchQuery('');
    setShowItemSearch(false);
  };


  const updateItem = (index: number, field: 'name' | 'quantity', value: string | number) => {
    const updatedItems = [...newDelivery.items];
    const currentItem = updatedItems[index];
    const maxQuantity = currentItem.availableQuantity || 0;
    
    if (field === 'quantity') {
      const qty = typeof value === 'number' ? value : parseInt(String(value)) || 0;
      // Validate quantity doesn't exceed available
      const validQuantity = Math.min(qty, maxQuantity);
      updatedItems[index] = { ...currentItem, quantity: validQuantity };
    } else {
      updatedItems[index] = { ...currentItem, name: value as string };
    }
    setNewDelivery({ ...newDelivery, items: updatedItems });
  };

  const removeItem = (index: number) => {
    const updatedItems = newDelivery.items.filter((_, i) => i !== index);
    setNewDelivery({ ...newDelivery, items: updatedItems.length > 0 ? updatedItems : [{ name: '', quantity: 0, sortlyItemId: undefined, availableQuantity: 0 }] });
  };

  const selectDriverFolder = (folderId: number) => {
    const folder = deliveryTruckFolders.find(f => f.id === folderId);
    if (folder) {
      setSelectedDriverFolder(folder);
      setNewDelivery({
        ...newDelivery,
        driver: folder.name,
        driverFolderId: folder.id,
      });
    }
  };

  const selectDestinationFolder = (folderId: number) => {
    const folder = jobListFolders.find(f => f.id === folderId);
    if (folder) {
      setSelectedDestinationFolder(folder);
      setNewDelivery({
        ...newDelivery,
        destinationFolderId: folder.id,
      });
    }
  };

  // Stage validation
  const canProceedToNextStage = (): boolean => {
    switch (currentStage) {
      case 1: // Basic Info
        return !!(newDelivery.date && newDelivery.whereFrom && newDelivery.destination);
      case 2: // Folders
        return !!(newDelivery.driverFolderId && newDelivery.destinationFolderId);
      case 3: // Items
        return newDelivery.items.filter(item => item.sortlyItemId && item.quantity > 0).length > 0;
      default:
        return true;
    }
  };

  const handleNextStage = () => {
    if (canProceedToNextStage() && currentStage < totalStages) {
      setCurrentStage(currentStage + 1);
    }
  };

  const handlePreviousStage = () => {
    if (currentStage > 1) {
      setCurrentStage(currentStage - 1);
    }
  };

  // Generate PDF for delivery order
  const generatePDF = async (delivery: Delivery) => {
    try {
      // If this is a draft delivery, move items and update status to pending
      if (delivery.status === 'draft') {
        console.log(`Moving items for delivery ${delivery.orderNumber} (first print)`);
        await moveDeliveryItems(delivery);
        updateDeliveryStatus(delivery.id, 'pending');
        console.log(`Delivery ${delivery.orderNumber} status updated to pending`);
      }
    } catch (error) {
      console.error('Error moving items:', error);
      alert(`Error moving items: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return; // Don't generate PDF if moving items failed
    }
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = margin;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DELIVERY ORDER', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Order Number
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Order Number: ${delivery.orderNumber}`, margin, yPos);
    yPos += 8;

    // Date and Driver
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(delivery.date + 'T00:00:00').toLocaleDateString()}`, margin, yPos);
    doc.text(`Driver: ${delivery.driver || 'Unassigned'}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 8;

    // Destination
    doc.text(`Delivery Address: ${delivery.destination}`, margin, yPos);
    yPos += 10;

    // Items Table Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Item', margin, yPos);
    doc.text('SKU', margin + 60, yPos);
    doc.text('Quantity', pageWidth - margin - 30, yPos, { align: 'right' });
    yPos += 6;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    // Items
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    delivery.items.forEach((item) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = margin;
      }
      doc.text(item.name || 'N/A', margin, yPos);
      doc.text(item.sku || 'N/A', margin + 60, yPos);
      doc.text(String(item.quantity), pageWidth - margin - 30, yPos, { align: 'right' });
      yPos += 7;
    });

    // Footer
    const totalQuantity = delivery.items.reduce((sum, item) => sum + item.quantity, 0);
    yPos += 5;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Items: ${delivery.items.length}`, margin, yPos);
    doc.text(`Total Quantity: ${totalQuantity}`, pageWidth - margin, yPos, { align: 'right' });

    // Open print dialog
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
  };

  // Download PDF for delivery order
  const downloadPDF = async (delivery: Delivery) => {
    try {
      // If this is a draft delivery, move items and update status to pending
      if (delivery.status === 'draft') {
        console.log(`Moving items for delivery ${delivery.orderNumber} (first download)`);
        await moveDeliveryItems(delivery);
        updateDeliveryStatus(delivery.id, 'pending');
        console.log(`Delivery ${delivery.orderNumber} status updated to pending`);
      }
    } catch (error) {
      console.error('Error moving items:', error);
      alert(`Error moving items: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return; // Don't download PDF if moving items failed
    }
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = margin;

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('DELIVERY ORDER', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Order Number
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(`Order Number: ${delivery.orderNumber}`, margin, yPos);
    yPos += 8;

    // Date and Driver
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date: ${new Date(delivery.date + 'T00:00:00').toLocaleDateString()}`, margin, yPos);
    doc.text(`Driver: ${delivery.driver || 'Unassigned'}`, pageWidth - margin, yPos, { align: 'right' });
    yPos += 8;

    // Destination
    doc.text(`Delivery Address: ${delivery.destination}`, margin, yPos);
    yPos += 10;

    // Items Table Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Item', margin, yPos);
    doc.text('SKU', margin + 60, yPos);
    doc.text('Quantity', pageWidth - margin - 30, yPos, { align: 'right' });
    yPos += 6;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;

    // Items
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    delivery.items.forEach((item) => {
      if (yPos > 250) {
        doc.addPage();
        yPos = margin;
      }
      doc.text(item.name || 'N/A', margin, yPos);
      doc.text(item.sku || 'N/A', margin + 60, yPos);
      doc.text(String(item.quantity), pageWidth - margin - 30, yPos, { align: 'right' });
      yPos += 7;
    });

    // Footer
    const totalQuantity = delivery.items.reduce((sum, item) => sum + item.quantity, 0);
    yPos += 5;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Items: ${delivery.items.length}`, margin, yPos);
    doc.text(`Total Quantity: ${totalQuantity}`, pageWidth - margin, yPos, { align: 'right' });

    // Download
    doc.save(`Delivery-Order-${delivery.orderNumber}.pdf`);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Deliveries</h1>
            <p className="text-sm text-gray-500 mt-1">Manage delivery orders and track drivers</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Create Delivery Order
          </button>
        </div>

        {/* Filters */}
        <div className="mt-4 space-y-3">
          {/* Status Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedStatus === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedStatus('draft')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedStatus === 'draft'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Draft
            </button>
            <button
              onClick={() => setSelectedStatus('pending')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedStatus === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setSelectedStatus('en-route')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedStatus === 'en-route'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              En-Route
            </button>
            <button
              onClick={() => setSelectedStatus('delivered')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedStatus === 'delivered'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Delivered
            </button>
          </div>
          
          {/* Date Range Filter */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Filter by Date Range:
            </label>
            <div className="relative flex items-center gap-2 flex-1 max-w-md">
              <button
                onClick={() => setShowDatePicker(!showDatePicker)}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm text-gray-900 bg-white"
              >
                {dateRange.startDate && dateRange.endDate
                  ? `${dateRange.startDate.toLocaleDateString()} - ${dateRange.endDate.toLocaleDateString()}`
                  : 'Select Date Range'}
              </button>
              {(dateRange.startDate || dateRange.endDate) && (
                <button
                  onClick={() => {
                    setDateRange({
                      startDate: new Date(),
                      endDate: new Date(),
                      key: 'selection',
                    });
                    setShowDatePicker(false);
                  }}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors whitespace-nowrap"
                  title="Clear date filter"
                >
                  Clear
                </button>
              )}
              {showDatePicker && (
                <div ref={datePickerRef} className="absolute top-full left-0 mt-2 z-50 bg-white border border-gray-300 rounded-lg shadow-lg">
                  <DateRangePicker
                    ranges={[dateRange]}
                    onChange={handleDateRangeChange}
                    moveRangeOnFirstSelection={false}
                    months={2}
                    direction="horizontal"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Deliveries List */}
      <div className="flex-1 overflow-auto p-6">
        {filteredDeliveries.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 text-lg">No deliveries found</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{delivery.orderNumber}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(delivery.status)}`}>
                        {delivery.status.charAt(0).toUpperCase() + delivery.status.slice(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <p className="text-sm text-gray-500">Date</p>
                        <p className="text-sm font-medium text-gray-900">{new Date(delivery.date + 'T00:00:00').toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Driver</p>
                        <p className="text-sm font-medium text-gray-900">{delivery.driver || 'Unassigned'}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-sm text-gray-500">Destination</p>
                        <p className="text-sm font-medium text-gray-900">{delivery.destination}</p>
                      </div>
                    </div>
                      <div className="mt-4">
                      <p className="text-sm text-gray-500 mb-2">Items</p>
                      <div className="flex flex-wrap gap-2">
                        {delivery.items.map((item, idx) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-gray-100 rounded-md text-sm text-gray-700"
                          >
                            {item.name} (Qty: {item.quantity})
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {/* Print/Download PDF Buttons */}
                      <button
                        onClick={() => generatePDF(delivery)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                          delivery.status === 'draft'
                            ? 'bg-blue-600 text-white hover:bg-blue-700 border-0'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                        title={delivery.status === 'draft' ? 'Print PDF and move items to truck' : 'Print PDF'}
                      >
                        {delivery.status === 'draft' ? 'Print & Move Items' : 'Print PDF'}
                      </button>
                      <button
                        onClick={() => downloadPDF(delivery)}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                          delivery.status === 'draft'
                            ? 'bg-green-600 text-white hover:bg-green-700 border-0'
                            : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                        }`}
                        title={delivery.status === 'draft' ? 'Download PDF and move items to truck' : 'Download PDF'}
                      >
                        {delivery.status === 'draft' ? 'Download & Move Items' : 'Download PDF'}
                      </button>
                      
                      {/* Edit/Delete Buttons - Only show for draft and pending orders */}
                      {(delivery.status === 'draft' || delivery.status === 'pending') && (
                        <>
                          <button
                            onClick={() => handleEditDelivery(delivery)}
                            className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-yellow-600 text-white hover:bg-yellow-700"
                            title="Edit delivery order details and items"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDelivery(delivery)}
                            className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-red-600 text-white hover:bg-red-700"
                            title="Delete delivery order"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                    
                    {/* Status Information */}
                    {delivery.status === 'draft' && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <div className="flex items-start">
                          <svg className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="text-sm font-medium text-amber-800">Items not yet moved</p>
                            <p className="text-xs text-amber-700 mt-1">Items will be moved to the truck folder when you print or download the PDF for the first time.</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Delivery Modal - Multi-Stage Wizard */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header with Progress */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Create Delivery Order</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewDelivery({
                      orderNumber: '',
                      date: '',
                      driver: '',
                      driverFolderId: undefined,
                      whereFrom: '',
                      destination: '',
                      destinationFolderId: undefined,
                      notes: '',
                      items: [],
                    });
                    setItemSearchQuery('');
                    setSelectedDriverFolder(null);
                    setSelectedDestinationFolder(null);
                    setCurrentStage(1);
                    setSaveError(null);
                    setShowItemSearch(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Progress Indicator */}
              <div className="flex items-center justify-between">
                {[1, 2, 3, 4].map((stage) => (
                  <div key={stage} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm ${
                          currentStage >= stage
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {stage}
                      </div>
                      <p className="text-xs mt-2 text-gray-600 text-center">
                        {stage === 1 && 'Basic Info'}
                        {stage === 2 && 'Folders'}
                        {stage === 3 && 'Items'}
                        {stage === 4 && 'Review'}
                      </p>
                    </div>
                    {stage < 4 && (
                      <div
                        className={`h-1 flex-1 mx-2 ${
                          currentStage > stage ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Content - Stage-based */}
            <div className="p-6">
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-red-800">{saveError}</p>
                </div>
              )}

              {/* Stage 1: Basic Info */}
              {currentStage === 1 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Order Number
                    </label>
                    <input
                      type="text"
                      value={newDelivery.orderNumber || generateOrderNumber()}
                      onChange={(e) => setNewDelivery({ ...newDelivery, orderNumber: e.target.value })}
                      placeholder="Auto-generated"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50"
                      readOnly
                    />
                    <p className="text-xs text-gray-500 mt-1">Auto-generated in WP-MMDDYY-## format</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Delivery Date *
                    </label>
                    <input
                      type="date"
                      value={newDelivery.date}
                      onChange={(e) => setNewDelivery({ ...newDelivery, date: e.target.value })}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Where From *
                    </label>
                    <input
                      type="text"
                      value={newDelivery.whereFrom}
                      onChange={(e) => setNewDelivery({ ...newDelivery, whereFrom: e.target.value })}
                      placeholder="Source location (e.g., Main Warehouse)"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Where To (Destination) *
                    </label>
                    <input
                      type="text"
                      value={newDelivery.destination}
                      onChange={(e) => setNewDelivery({ ...newDelivery, destination: e.target.value })}
                      placeholder="Full address or destination name"
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      value={newDelivery.notes}
                      onChange={(e) => setNewDelivery({ ...newDelivery, notes: e.target.value })}
                      placeholder="Additional notes or instructions..."
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Stage 2: Folders */}
              {currentStage === 2 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Folders</h3>
                  
                  {loadingFolders ? (
                    <div className="text-center py-8">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                      <p className="text-sm text-gray-500">Loading folders...</p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Destination *
                        </label>
                        <p className="text-xs text-gray-500 mb-2">Select from available job site folders</p>
                        <select
                          value={newDelivery.destinationFolderId || ''}
                          onChange={(e) => {
                            const folderId = parseInt(e.target.value);
                            if (folderId) {
                              selectDestinationFolder(folderId);
                            } else {
                              setSelectedDestinationFolder(null);
                              setNewDelivery({ ...newDelivery, destinationFolderId: undefined });
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select a destination folder...</option>
                          {jobListFolders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                        {jobListFolders.length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">No job site folders found. Make sure the "Job Sites" folder exists.</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Driver's Truck *
                        </label>
                        <p className="text-xs text-gray-500 mb-2">Select from available delivery truck folders</p>
                        <select
                          value={newDelivery.driverFolderId || ''}
                          onChange={(e) => {
                            const folderId = parseInt(e.target.value);
                            if (folderId) {
                              selectDriverFolder(folderId);
                            } else {
                              setSelectedDriverFolder(null);
                              setNewDelivery({ ...newDelivery, driver: '', driverFolderId: undefined });
                            }
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="">Select a delivery truck folder...</option>
                          {deliveryTruckFolders.map((folder) => (
                            <option key={folder.id} value={folder.id}>
                              {folder.name}
                            </option>
                          ))}
                        </select>
                        {deliveryTruckFolders.length === 0 && (
                          <p className="text-xs text-amber-600 mt-1">No delivery truck folders found. Make sure the "Delivery Trucks" folder exists.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Stage 3: Items */}
              {currentStage === 3 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Items</h3>
                  
                  {/* Item Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Items from Sortly *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={itemSearchQuery}
                        onChange={(e) => {
                          setItemSearchQuery(e.target.value);
                          setShowItemSearch(true);
                        }}
                        onFocus={() => setShowItemSearch(true)}
                        placeholder="Search items by name or SKU..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      {showItemSearch && itemSearchQuery && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {isSearchingItems ? (
                            <div className="p-3 text-center text-sm text-gray-500">Searching...</div>
                          ) : itemSearchResults.length === 0 ? (
                            <div className="p-3 text-center text-sm text-gray-500">No items found</div>
                          ) : (
                            itemSearchResults.map((item) => (
                              <button
                                key={item.id}
                                onClick={() => addItemFromSearch(item)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                              >
                                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                <div className="flex justify-between text-xs text-gray-500 mt-1">
                                  <span>Qty: {item.quantity || 0}</span>
                                  {item.sid && <span>SKU: {item.sid}</span>}
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Selected Items */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Selected Items ({newDelivery.items.filter(item => item.sortlyItemId).length})
                    </label>
                    <div className="space-y-3">
                      {newDelivery.items
                        .filter(item => item.sortlyItemId)
                        .map((item) => {
                          const actualIndex = newDelivery.items.findIndex(i => i.sortlyItemId === item.sortlyItemId);
                          return (
                            <div key={item.sortlyItemId} className="p-3 border border-gray-200 rounded-md bg-gray-50">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                  {item.sku && (
                                    <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                                  )}
                                  <p className="text-xs text-gray-500">Available: {item.availableQuantity || 0}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeItem(actualIndex)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Quantity to Move
                                </label>
                                <input
                                  type="number"
                                  value={item.quantity || ''}
                                  onChange={(e) => updateItem(actualIndex, 'quantity', parseInt(e.target.value) || 0)}
                                  min="1"
                                  max={item.availableQuantity || 0}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                                {item.quantity > (item.availableQuantity || 0) && (
                                  <p className="text-xs text-red-600 mt-1">Quantity exceeds available ({item.availableQuantity || 0})</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      {newDelivery.items.filter(item => item.sortlyItemId).length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4 border border-gray-200 rounded-md bg-gray-50">
                          No items added. Search and select items above.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Stage 4: Review */}
              {currentStage === 4 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Review & Confirm</h3>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Order Number</p>
                        <p className="text-sm font-medium text-gray-900">{newDelivery.orderNumber || generateOrderNumber()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Delivery Date</p>
                        <p className="text-sm font-medium text-gray-900">{newDelivery.date ? new Date(newDelivery.date + 'T00:00:00').toLocaleDateString() : 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Where From</p>
                        <p className="text-sm font-medium text-gray-900">{newDelivery.whereFrom || 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Where To</p>
                        <p className="text-sm font-medium text-gray-900">{newDelivery.destination || 'Not set'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Destination Folder</p>
                        <p className="text-sm font-medium text-gray-900">{selectedDestinationFolder?.name || 'Not selected'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Driver's Truck Folder</p>
                        <p className="text-sm font-medium text-gray-900">{selectedDriverFolder?.name || 'Not selected'}</p>
                      </div>
                    </div>
                    
                    {newDelivery.notes && (
                      <div>
                        <p className="text-xs text-gray-500">Notes</p>
                        <p className="text-sm font-medium text-gray-900">{newDelivery.notes}</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-xs text-gray-500 mb-2">Items ({newDelivery.items.filter(item => item.sortlyItemId).length})</p>
                      <div className="space-y-2">
                        {newDelivery.items
                          .filter(item => item.sortlyItemId && item.quantity > 0)
                          .map((item) => (
                            <div key={item.sortlyItemId} className="flex justify-between text-sm">
                              <span className="text-gray-900">{item.name}</span>
                              <span className="text-gray-600">Qty: {item.quantity}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Footer */}
            <div className="p-6 border-t border-gray-200 flex justify-between gap-3">
              <div className="flex gap-3">
                {currentStage > 1 && (
                  <button
                    onClick={handlePreviousStage}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={isSaving}
                  >
                    Back
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewDelivery({
                      orderNumber: '',
                      date: '',
                      driver: '',
                      driverFolderId: undefined,
                      whereFrom: '',
                      destination: '',
                      destinationFolderId: undefined,
                      notes: '',
                      items: [],
                    });
                    setItemSearchQuery('');
                    setSelectedDriverFolder(null);
                    setSelectedDestinationFolder(null);
                    setCurrentStage(1);
                    setSaveError(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
              
              <div className="flex gap-3">
                {currentStage < totalStages ? (
                  <button
                    onClick={handleNextStage}
                    disabled={!canProceedToNextStage()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    onClick={handleCreateDelivery}
                    disabled={
                      isSaving ||
                      !newDelivery.date ||
                      !newDelivery.whereFrom ||
                      !newDelivery.destination ||
                      !newDelivery.driverFolderId ||
                      !newDelivery.destinationFolderId ||
                      newDelivery.items.filter(item => item.sortlyItemId && item.quantity > 0).length === 0
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Create Delivery'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Delivery Modal */}
      {showEditModal && editingDelivery && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Edit Delivery Order - {editingDelivery.orderNumber}
                </h2>
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDelivery(null);
                    setEditFormData({
                      orderNumber: '',
                      date: '',
                      driver: '',
                      driverFolderId: undefined,
                      whereFrom: '',
                      destination: '',
                      destinationFolderId: undefined,
                      notes: '',
                      items: [],
                    });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              {saveError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-red-800">{saveError}</p>
                </div>
              )}

              {loadingInventoryData && (
                <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                    <p className="text-sm text-blue-800">Loading current inventory data...</p>
                  </div>
                </div>
              )}

              {inventoryError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
                  <p className="text-sm text-red-800">{inventoryError}</p>
                </div>
              )}

              {/* Basic Information */}
              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Order Number *
                    </label>
                    <input
                      type="text"
                      value={editFormData.orderNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, orderNumber: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={editFormData.date}
                      onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                      onClick={(e) => (e.target as HTMLInputElement).showPicker()}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Where From
                  </label>
                  <input
                    type="text"
                    value={editFormData.whereFrom}
                    onChange={(e) => setEditFormData({ ...editFormData, whereFrom: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Source location (e.g., Main Warehouse)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Where To (Destination) *
                  </label>
                  <input
                    type="text"
                    value={editFormData.destination}
                    onChange={(e) => setEditFormData({ ...editFormData, destination: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    placeholder="Full address or destination name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={editFormData.notes}
                    onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                    rows={3}
                    placeholder="Enter any additional notes..."
                  />
                </div>
              </div>

              {/* Folder Selection */}
              <div className="space-y-4 mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Folder Selection</h3>
                
                {editLoadingFolders ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                    <p className="text-sm text-gray-500">Loading folders...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Destination Folder
                      </label>
                      <p className="text-xs text-gray-500 mb-2">Select from available job site folders</p>
                      <select
                        value={editFormData.destinationFolderId || ''}
                        onChange={(e) => {
                          const folderId = parseInt(e.target.value) || undefined;
                          setEditFormData({ ...editFormData, destinationFolderId: folderId });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Select a destination folder...</option>
                        {editJobListFolders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                      {editJobListFolders.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">No job site folders found. Make sure the "Job Sites" folder exists.</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Driver's Truck Folder
                      </label>
                      <p className="text-xs text-gray-500 mb-2">Select from available delivery truck folders</p>
                      <select
                        value={editFormData.driverFolderId || ''}
                        onChange={(e) => {
                          const folderId = parseInt(e.target.value) || undefined;
                          const folder = editDeliveryTruckFolders.find(f => f.id === folderId);
                          setEditFormData({ 
                            ...editFormData, 
                            driverFolderId: folderId,
                            driver: folder?.name || editFormData.driver // Update driver name if folder selected
                          });
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">Select a delivery truck folder...</option>
                        {editDeliveryTruckFolders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                      {editDeliveryTruckFolders.length === 0 && (
                        <p className="text-xs text-amber-600 mt-1">No delivery truck folders found. Make sure the "Delivery Trucks" folder exists.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Items Section */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
                
                {editFormData.items.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No items in this delivery order</p>
                ) : (
                  <div className="space-y-3">
                    {editFormData.items.map((item, index) => {
                      const maxQuantity = (item.availableQuantity || 0);
                      const isQuantityValid = item.quantity <= maxQuantity;
                      const originalQuantity = editingDelivery?.items.find(orig => orig.sortlyItemId === item.sortlyItemId)?.quantity || 0;
                      
                      return (
                        <div key={index} className="p-4 border border-gray-200 rounded-md bg-gray-50">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{item.name}</p>
                              {item.sku && <p className="text-sm text-gray-500">SKU: {item.sku}</p>}
                              
                              {/* Inventory Status */}
                              <div className="mt-2 text-xs space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-gray-600">Available Total:</span>
                                  <span className="font-medium">{maxQuantity}</span>
                                </div>
                                {item.warehouseQuantity !== undefined && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">In Warehouse:</span>
                                    <span>{item.warehouseQuantity}</span>
                                  </div>
                                )}
                                {item.truckQuantity !== undefined && (
                                  <div className="flex justify-between">
                                    <span className="text-gray-600">In Truck:</span>
                                    <span>{item.truckQuantity}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                const updatedItems = editFormData.items.filter((_, idx) => idx !== index);
                                setEditFormData({ ...editFormData, items: updatedItems });
                              }}
                              className="ml-4 px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-100 rounded transition-colors"
                              title="Remove item from delivery"
                            >
                              Remove
                            </button>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Updated Delivery Amount
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={maxQuantity}
                                value={item.quantity}
                                onChange={(e) => {
                                  const newQuantity = parseInt(e.target.value) || 0;
                                  const updatedItems = editFormData.items.map((itm, idx) =>
                                    idx === index ? { ...itm, quantity: newQuantity } : itm
                                  );
                                  setEditFormData({ ...editFormData, items: updatedItems });
                                }}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 ${
                                  isQuantityValid 
                                    ? 'border-gray-300 focus:ring-blue-500' 
                                    : 'border-red-300 focus:ring-red-500 bg-red-50'
                                }`}
                              />
                              {!isQuantityValid && (
                                <p className="text-xs text-red-600 mt-1">
                                  Quantity exceeds available inventory ({maxQuantity} available)
                                </p>
                              )}
                              {item.quantity !== originalQuantity && (
                                <p className="text-xs text-blue-600 mt-1">
                                  {item.quantity > originalQuantity 
                                    ? `+${item.quantity - originalQuantity} (increase)`
                                    : `${item.quantity - originalQuantity} (decrease)`
                                  }
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDelivery(null);
                  }}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveEditChanges()}
                  disabled={
                    !editFormData.orderNumber || 
                    !editFormData.date || 
                    !editFormData.destination || 
                    isSaving ||
                    // Check if any items have invalid quantities
                    editFormData.items.some(item => item.quantity > (item.availableQuantity || 0))
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
