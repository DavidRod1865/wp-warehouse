import { useState, useEffect, Fragment } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import warehouseLogo from "../assets/WP-warehouse-logo.png";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { fetchAllFolders } from "../services/sortlyApi";
import type { Address } from "../types/address";

interface Delivery {
  id: number;
  delivery_number: string;
  project_id: number | null;
  status: string;
  created_at: string;
  delivered_at: string | null;
  signature_name: string | null;
  signature_data: string | null;
  items_count?: number;
  from_address: Address;
  to_address: Address;
  delivery_type: string;
  truck_name: string | null;
  activity_log?: Array<{
    timestamp: string;
    action: string;
    details?: {
      driver_assigned?: {
        driver_name?: string;
      };
    };
  }>;
  projects?: {
    name: string;
  } | null;
}

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

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<
    "all" | "draft" | "pending" | "delivered"
  >("all");

  // Filter states
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(
    null
  );
  const [selectedTruckId, setSelectedTruckId] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);

  const [expandedDeliveryId, setExpandedDeliveryId] = useState<number | null>(
    null
  );

  const toggleExpanded = (deliveryId: number) => {
    setExpandedDeliveryId(
      expandedDeliveryId === deliveryId ? null : deliveryId
    );
  };

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchDeliveries();
  }, [filter, selectedProjectId, selectedTruckId, selectedDate]);

  const fetchFilterOptions = async () => {
    try {
      // Fetch projects
      const { data: projectsData } = await supabase
        .from("projects")
        .select("*")
        .eq("status", "active")
        .order("name");

      let projects = projectsData || [];

      // Refresh project names from Sortly to avoid stale folder names
      const allFolders = await fetchAllFolders(false);
      const folderNameById = new Map(
        allFolders.map((folder) => [folder.id, folder.name])
      );

      const projectsWithSortlyNames = projects.map((project) => ({
        ...project,
        name:
          folderNameById.get(project.sortly_project_folder_id) || project.name,
      }));

      // Deduplicate projects by Sortly project folder id to avoid double entries
      const uniqueProjects = new Map<number, Project>();
      projectsWithSortlyNames.forEach((project) => {
        if (!uniqueProjects.has(project.sortly_project_folder_id)) {
          uniqueProjects.set(project.sortly_project_folder_id, project);
        }
      });

      setProjects(Array.from(uniqueProjects.values()));

      // Fetch unique trucks from deliveries
      const { data: deliveriesData } = await supabase
        .from("deliveries")
        .select("truck_sortly_folder_id, truck_name")
        .not("truck_name", "is", null)
        .is("deleted_at", null);

      // Extract unique trucks
      const uniqueTrucks = new Map<number, string>();
      deliveriesData?.forEach((d) => {
        if (d.truck_sortly_folder_id && d.truck_name) {
          uniqueTrucks.set(d.truck_sortly_folder_id, d.truck_name);
        }
      });

      const trucksArray = Array.from(uniqueTrucks.entries()).map(
        ([id, name]) => ({
          id,
          name,
        })
      );
      setTrucks(trucksArray);
    } catch (error) {
      console.error("Error fetching filter options:", error);
    }
  };

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("deliveries")
        .select(
          `
        *,
        projects (
          name
        )
      `
        )
        .is("deleted_at", null) // Only get non-deleted deliveries
        .order("created_at", { ascending: false });

      // Status filter
      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      // Project filter
      if (selectedProjectId) {
        query = query.eq("project_id", selectedProjectId);
      }

      // Truck filter
      if (selectedTruckId) {
        query = query.eq("truck_sortly_folder_id", selectedTruckId);
      }

      // Date filter
      if (selectedDate) {
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);
        query = query
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;
      const deliveriesData = data || [];
      const deliveryIds = deliveriesData.map((delivery) => delivery.id);

      if (deliveryIds.length === 0) {
        setDeliveries(deliveriesData);
        return;
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from("delivery_items")
        .select("delivery_id, quantity")
        .in("delivery_id", deliveryIds);

      if (itemsError) throw itemsError;

      const itemsCountByDeliveryId = new Map<number, number>();
      itemsData?.forEach((item) => {
        itemsCountByDeliveryId.set(
          item.delivery_id,
          (itemsCountByDeliveryId.get(item.delivery_id) || 0) +
            Number(item.quantity || 0)
        );
      });

      const deliveriesWithCounts = deliveriesData.map((delivery) => ({
        ...delivery,
        items_count: itemsCountByDeliveryId.get(delivery.id) || 0,
      }));

      setDeliveries(deliveriesWithCounts);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      draft: {
        bg: "bg-gray-100",
        text: "text-gray-700",
        border: "border-gray-300",
      },
      pending: {
        bg: "bg-yellow-50",
        text: "text-yellow-700",
        border: "border-yellow-300",
      },
      delivered: {
        bg: "bg-green-50",
        text: "text-green-700",
        border: "border-green-300",
      },
      "en-route": {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-300",
      },
    };

    const style = styles[status as keyof typeof styles] || styles.draft;

    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.text} ${style.border}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTruckerName = (truckName: Delivery["truck_name"]) =>
    truckName || "Pending";

  const formatSelectedDate = (value: string) => {
    if (!value) return "";
    const [year, month, day] = value.split("-").map(Number);
    if (!year || !month || !day) return value;
    return new Date(year, month - 1, day).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <img
              src={warehouseLogo}
              alt="WP Warehouse"
              className="h-10 sm:h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                With Pride HVAC
              </h1>
              <p className="text-sm text-gray-600">Warehouse Delivery</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full sm:w-auto">
            <div className="text-left sm:text-right">
              <p className="text-sm font-medium text-gray-900">
                {profile?.name || profile?.email}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {profile?.role.replace("_", " ")}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Deliveries Section */}
        <div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Deliveries</h2>
            <button
              onClick={() => navigate("/deliveries/create")}
              className="hidden sm:inline-flex w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              + New Delivery
            </button>
          </div>

          {/* Filters Menu */}
          <details className="bg-white rounded-lg shadow mb-4 sm:hidden">
            <summary className="px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 list-none flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span>Filters</span>
                <span className="text-xs text-gray-500">
                  {selectedProjectId || selectedTruckId || selectedDate
                    ? [
                        selectedProjectId
                          ? projects.find((p) => p.id === selectedProjectId)
                              ?.name
                          : null,
                        selectedTruckId
                          ? trucks.find((t) => t.id === selectedTruckId)?.name
                          : null,
                        selectedDate
                          ? formatSelectedDate(selectedDate)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" • ")
                    : "No filters selected"}
                </span>
              </div>
              <svg
                className="h-4 w-4 text-gray-500"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </summary>
            <div className="px-4 pb-4 pt-1 space-y-3">
              <div className="grid grid-cols-1 gap-4">
                {/* Project Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Project
                  </label>
                  <select
                    value={selectedProjectId || ""}
                    onChange={(e) =>
                      setSelectedProjectId(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">All Projects</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Truck Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Truck
                  </label>
                  <select
                    value={selectedTruckId || ""}
                    onChange={(e) =>
                      setSelectedTruckId(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="">All Trucks</option>
                    {trucks.map((truck) => (
                      <option key={truck.id} value={truck.id}>
                        {truck.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Filter */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>
              </div>

              {(selectedProjectId || selectedTruckId || selectedDate) && (
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setSelectedProjectId(null);
                      setSelectedTruckId(null);
                      setSelectedDate("");
                    }}
                    className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </details>

          <div className="hidden sm:block bg-white rounded-lg shadow p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Project Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project
                </label>
                <select
                  value={selectedProjectId || ""}
                  onChange={(e) =>
                    setSelectedProjectId(
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">All Projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Truck Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Truck
                </label>
                <select
                  value={selectedTruckId || ""}
                  onChange={(e) =>
                    setSelectedTruckId(
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">All Trucks</option>
                  {trucks.map((truck) => (
                    <option key={truck.id} value={truck.id}>
                      {truck.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {(selectedProjectId || selectedTruckId || selectedDate) && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={() => {
                    setSelectedProjectId(null);
                    setSelectedTruckId(null);
                    setSelectedDate("");
                  }}
                  className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="bg-white rounded-t-lg border-b border-gray-200">
            <nav className="flex gap-6 px-4 sm:px-6 overflow-x-auto whitespace-nowrap">
              {["all", "draft", "pending", "delivered"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status as typeof filter)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    filter === status
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {/* Deliveries Table */}
          {loading ? (
            <div className="bg-white rounded-b-lg shadow p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading deliveries...</p>
            </div>
          ) : deliveries.length === 0 ? (
            <div className="bg-white rounded-b-lg shadow p-12 text-center">
              <p className="text-gray-500">No deliveries found</p>
              <button
                onClick={() => navigate("/deliveries/create")}
                className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Your First Delivery
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-b-lg shadow overflow-hidden">
              <div className="sm:hidden divide-y divide-gray-200">
                {deliveries.map((delivery) => (
                  <motion.div
                    key={delivery.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {delivery.delivery_number}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(delivery.created_at).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </div>
                      </div>
                      {getStatusBadge(delivery.status)}
                    </div>
                    <div className="text-sm text-gray-900">
                      <span className="text-gray-500">Project: </span>
                      {delivery.projects?.name || "No Project"}
                    </div>
                    <div className="text-sm text-gray-900">
                      <span className="text-gray-500">From: </span>
                      {delivery.from_address.company_name ||
                        delivery.from_address.street_address}
                    </div>
                    <div className="text-sm text-gray-900">
                      <span className="text-gray-500">To: </span>
                      {delivery.to_address.company_name ||
                        delivery.to_address.street_address}
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-900">
                      <span>
                        <span className="text-gray-500">Truck: </span>
                        {delivery.truck_name || "-"}
                      </span>
                      <span>
                        <span className="text-gray-500">Pieces: </span>
                        {delivery.items_count ?? 0}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/deliveries/${delivery.id}`)}
                      className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Full Details
                    </button>
                  </motion.div>
                ))}
              </div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-[900px] divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Delivery #
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      From
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      To
                    </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        Truck
                      </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="w-12">{/* Expand icon column */}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deliveries.map((delivery) => (
                    <Fragment key={delivery.id}>
                      {/* Main Row - Clickable */}
                      <tr
                        onClick={() => toggleExpanded(delivery.id)}
                        className={`cursor-pointer transition-colors ${
                          expandedDeliveryId === delivery.id
                            ? "bg-blue-50"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        {/* Delivery Number */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-gray-900">
                              {delivery.delivery_number}
                            </span>
                          </div>
                        </td>

                        {/* Project */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {delivery.projects?.name || (
                              <span className="text-gray-400 italic">
                                No Project
                              </span>
                            )}
                          </span>
                        </td>

                        {/* From - Abbreviated */}
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {delivery.from_address.company_name ||
                              delivery.from_address.street_address}
                          </div>
                        </td>

                        {/* To - Abbreviated */}
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {delivery.to_address.company_name ||
                              delivery.to_address.street_address}
                          </div>
                        </td>

                          {/* Truck */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="text-sm text-gray-900">
                              {delivery.truck_name || "-"}
                            </span>
                          </td>

                        {/* Status */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(delivery.status)}
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(delivery.created_at).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                              }
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(delivery.created_at).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                              }
                            )}
                          </div>
                        </td>

                        {/* Expand Icon */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform ${
                              expandedDeliveryId === delivery.id
                                ? "rotate-180"
                                : ""
                            }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {expandedDeliveryId === delivery.id && (
                        <tr className="bg-gradient-to-r from-blue-50 to-gray-50 animate-fadeIn">
                          <td colSpan={8} className="px-6 py-6">
                              <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                                className="space-y-4"
                              >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* From Address */}
                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    From Address
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-sm font-semibold text-gray-900">
                                      {delivery.from_address.company_name}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                      {delivery.from_address.street_address}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                      {delivery.from_address.city},{" "}
                                      {delivery.from_address.state}{" "}
                                      {delivery.from_address.zip_code}
                                    </div>
                                  </div>
                                </div>

                                {/* To Address */}
                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    To Address
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-sm font-semibold text-gray-900">
                                      {delivery.to_address.company_name}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                      {delivery.to_address.street_address}
                                    </div>
                                    <div className="text-sm text-gray-700">
                                      {delivery.to_address.city},{" "}
                                      {delivery.to_address.state}{" "}
                                      {delivery.to_address.zip_code}
                                    </div>
                                  </div>
                                </div>
                              </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {/* Delivery Information */}
                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    Delivery Information
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">
                                          Delivery Date:
                                      </span>
                                      <span className="font-medium text-gray-900">
                                        {new Date(
                                          delivery.created_at
                                          ).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Type:</span>
                                      <span className="font-medium text-gray-900 capitalize">
                                        {delivery.delivery_type.replace(
                                          "_",
                                          " "
                                        )}
                                      </span>
                                    </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">
                                          Trucker:
                                        </span>
                                        <span className="font-medium text-gray-900">
                                          {getTruckerName(delivery.truck_name)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">
                                          Pieces Delivered:
                                        </span>
                                        <span className="font-medium text-gray-900">
                                          {delivery.items_count ?? 0}
                                        </span>
                                      </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">
                                        Status:
                                      </span>
                                        <span>{getStatusBadge(delivery.status)}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Signature */}
                                  <div className="rounded-lg p-4 shadow-sm bg-green-50 border border-green-200">
                                    <div className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-3">
                                      Signature
                                    </div>
                                    <div className="space-y-3">
                                      {delivery.signature_data ? (
                                        <img
                                          src={delivery.signature_data}
                                          alt="Delivery signature"
                                          className="w-full max-h-48 object-contain border border-green-200 rounded bg-white"
                                        />
                                      ) : (
                                        <div className="text-sm text-green-700">
                                          {delivery.delivered_at
                                            ? "Electronic signature refused. See paperwork."
                                            : "Signature pending confirmation."}
                                        </div>
                                      )}
                                      <div className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                          <span className="text-green-800">
                                            Confirmed Delivery Time:
                                          </span>
                                          <span className="font-medium text-gray-900">
                                            {delivery.delivered_at
                                              ? new Date(
                                                  delivery.delivered_at
                                                ).toLocaleString("en-US", {
                                                  month: "short",
                                                  day: "numeric",
                                                  year: "numeric",
                                                  hour: "numeric",
                                                  minute: "2-digit",
                                                })
                                              : "Pending"}
                                          </span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                          <span className="text-green-800">
                                            Signed By:
                                          </span>
                                          <span className="font-medium text-gray-900">
                                            {delivery.signature_name || "Pending"}
                                      </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/deliveries/${delivery.id}`);
                                      }}
                                      className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                      View Full Details
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
