import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
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
  from_address: Address;
  to_address: Address;
  delivery_type: string;
  truck_name: string | null;
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
  const { profile, signOut } = useAuth();
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
      setDeliveries(data || []);
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              With Pride HVAC
            </h1>
            <p className="text-sm text-gray-600">Delivery Management</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {profile?.email}
              </p>
              <p className="text-xs text-gray-500 capitalize">
                {profile?.role.replace("_", " ")}
              </p>
            </div>
            <button
              onClick={signOut}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Warehouse Inventory Card */}
            <button
              onClick={() => navigate("/inventory")}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Warehouse Inventory
                </h3>
                <span className="text-2xl">📦</span>
              </div>
              <p className="text-gray-600 text-sm">
                View and manage warehouse stock
              </p>
            </button>

            {/* Create Delivery Card */}
            <button
              onClick={() => navigate("/deliveries/create")}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Create Delivery
                </h3>
                <span className="text-2xl">🚚</span>
              </div>
              <p className="text-gray-600 text-sm">
                Create new delivery ticket
              </p>
            </button>

            {/* Activity Log Card */}
            <button
              onClick={() => navigate("/activity-log")}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Activity Log
                </h3>
                <span className="text-2xl">📋</span>
              </div>
              <p className="text-gray-600 text-sm">View all system activity</p>
            </button>

            {/* Vendors Card */}
            <button
              onClick={() => navigate("/vendors")}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Vendors</h3>
                <span className="text-2xl">🏢</span>
              </div>
              <p className="text-gray-600 text-sm">
                Manage vendor addresses and contacts
              </p>
            </button>

            {/* Driver Management Card */}
            <button
              onClick={() => navigate("/drivers")}
              className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow text-left"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Driver Management
                </h3>
                <span className="text-2xl">👤</span>
              </div>
              <p className="text-gray-600 text-sm">
                Link drivers to truck folders
              </p>
            </button>

          </div>
        </div>

        {/* Deliveries Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Deliveries</h2>
            <button
              onClick={() => navigate("/deliveries/create")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              + New Delivery
            </button>
          </div>

          {/* Advanced Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* Clear Filters Button */}
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
            <nav className="flex space-x-8 px-6">
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Delivery #
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Truck
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      From
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      To
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
                            <span className="text-xs text-gray-500 capitalize">
                              {delivery.delivery_type.replace("_", " ")}
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

                        {/* Truck */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {delivery.truck_name || "-"}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Left Column - Addresses */}
                              <div className="space-y-4">
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
                                    <div className="text-sm text-gray-600">
                                      Tel: {delivery.from_address.phone}
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
                                    <div className="text-sm text-gray-600">
                                      Tel: {delivery.to_address.phone}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Right Column - Metadata & Actions */}
                              <div className="space-y-4">
                                {/* Metadata */}
                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    Delivery Information
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">
                                        Created:
                                      </span>
                                      <span className="font-medium text-gray-900">
                                        {new Date(
                                          delivery.created_at
                                        ).toLocaleString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                          hour: "numeric",
                                          minute: "2-digit",
                                        })}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">
                                        Type:
                                      </span>
                                      <span className="font-medium text-gray-900 capitalize">
                                        {delivery.delivery_type.replace(
                                          "_",
                                          " "
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                      <span className="text-gray-600">
                                        Status:
                                      </span>
                                      <span>
                                        {getStatusBadge(delivery.status)}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Quick Actions */}
                                <div className="bg-white rounded-lg p-4 shadow-sm">
                                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                                    Quick Actions
                                  </div>
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
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(
                                          `/deliveries/${delivery.id}/edit`
                                        );
                                      }}
                                      className="flex-1 px-4 py-2 bg-white text-gray-700 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50
     transition-colors"
                                    >
                                      Edit
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
