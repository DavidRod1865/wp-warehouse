import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Address } from '../types/address';

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

interface Delivery {
  id: number;
  delivery_number: string;
  status?: string;
  created_at?: string;
  activity_log?: Array<{
    timestamp: string;
    action: string;
    user_id?: string;
    user_email?: string;
    details?: Record<string, any>;
  }>;
  truck_sortly_folder_id?: number;
  truck_name?: string;
  projects?: {
    name: string;
  } | Array<{ name: string }> | null;
}

interface ActivityLogEntry {
  timestamp: string;
  action: string;
  user_email?: string;
  delivery_number?: string;
  delivery_id?: number;
  project_name?: string;
  truck_name?: string;
  details?: Record<string, any>;
  source: 'delivery' | 'project';
}

export default function ActivityLog() {
  const navigate = useNavigate();
  
  // Filter state
  const [filterType, setFilterType] = useState<'all' | 'project' | 'delivery' | 'truck'>('all');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<number | null>(null);
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  
  // Data state
  const [projects, setProjects] = useState<Project[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFilterOptions();
  }, []);

  useEffect(() => {
    loadActivityLogs();
  }, [filterType, selectedProjectId, selectedDeliveryId, selectedTruckId, dateFrom, dateTo]);

  const loadFilterOptions = async () => {
    try {
      // Load projects
      const { data: projectsData } = await supabase
        .from('projects')
        .select('*')
        .eq('status', 'active')
        .order('name');
      setProjects(projectsData || []);

      // Load deliveries for dropdown
      const { data: deliveriesData } = await supabase
        .from('deliveries')
        .select('id, delivery_number, truck_sortly_folder_id, truck_name')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100);
      
      setDeliveries(deliveriesData || []);

      // Extract unique trucks from deliveries
      const uniqueTrucks = new Map<number, string>();
      deliveriesData?.forEach(d => {
        if (d.truck_sortly_folder_id && d.truck_name) {
          uniqueTrucks.set(d.truck_sortly_folder_id, d.truck_name);
        }
      });
      
      const trucksArray = Array.from(uniqueTrucks.entries()).map(([id, name]) => ({ id, name }));
      setTrucks(trucksArray);

    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadActivityLogs = async () => {
    setLoading(true);
    try {
      const allActivities: ActivityLogEntry[] = [];

      // Build delivery query
      let deliveryQuery = supabase
        .from('deliveries')
        .select(`
          id,
          delivery_number,
          status,
          created_at,
          activity_log,
          truck_sortly_folder_id,
          truck_name,
          projects (name)
        `)
        .is('deleted_at', null);

      // Apply filters
      if (filterType === 'project' && selectedProjectId) {
        deliveryQuery = deliveryQuery.eq('project_id', selectedProjectId);
      }
      if (filterType === 'delivery' && selectedDeliveryId) {
        deliveryQuery = deliveryQuery.eq('id', selectedDeliveryId);
      }
      if (filterType === 'truck' && selectedTruckId) {
        deliveryQuery = deliveryQuery.eq('truck_sortly_folder_id', selectedTruckId);
      }
      if (dateFrom) {
        deliveryQuery = deliveryQuery.gte('created_at', new Date(dateFrom).toISOString());
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        deliveryQuery = deliveryQuery.lte('created_at', endDate.toISOString());
      }

      const { data: deliveriesData } = await deliveryQuery.order('created_at', { ascending: false });

      // Extract activity logs from deliveries
      deliveriesData?.forEach(delivery => {
        if (delivery.activity_log && Array.isArray(delivery.activity_log)) {
          delivery.activity_log.forEach(log => {
            allActivities.push({
              ...log,
              delivery_number: delivery.delivery_number,
              delivery_id: delivery.id,
              project_name: Array.isArray(delivery.projects)
                ? (delivery.projects as Array<{ name: string }>)[0]?.name
                : (delivery.projects as { name: string } | null)?.name,
              truck_name: delivery.truck_name,
              source: 'delivery'
            });
          });
        }
      });

      // If filtering by project, also get project activity logs
      if (filterType === 'project' && selectedProjectId) {
        const { data: projectData } = await supabase
          .from('projects')
          .select('activity_log, name')
          .eq('id', selectedProjectId)
          .single();

        if (projectData?.activity_log && Array.isArray(projectData.activity_log)) {
          projectData.activity_log.forEach((log: Omit<ActivityLogEntry, 'source' | 'project_name'>) => {
            allActivities.push({
              ...log,
              project_name: projectData.name,
              source: 'project'
            });
          });
        }
      }

      // Sort by timestamp descending
      allActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivityLogs(allActivities);
    } catch (error) {
      console.error('Error loading activity logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const styles: Record<string, string> = {
      created: 'bg-blue-100 text-blue-800',
      printed: 'bg-purple-100 text-purple-800',
      edited: 'bg-yellow-100 text-yellow-800',
      deleted: 'bg-red-100 text-red-800',
      delivered: 'bg-green-100 text-green-800',
      delivery_created: 'bg-indigo-100 text-indigo-800'
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[action] || 'bg-gray-100 text-gray-800'}`}>
        {action.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const resetFilters = () => {
    setFilterType('all');
    setSelectedProjectId(null);
    setSelectedDeliveryId(null);
    setSelectedTruckId(null);
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Filter Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter By
              </label>
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as 'all' | 'project' | 'delivery' | 'truck');
                  setSelectedProjectId(null);
                  setSelectedDeliveryId(null);
                  setSelectedTruckId(null);
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Activity</option>
                <option value="project">By Project</option>
                <option value="delivery">By Delivery</option>
                <option value="truck">By Truck</option>
              </select>
            </div>

            {/* Project Filter */}
            {filterType === 'project' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Project
                </label>
                <select
                  value={selectedProjectId || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Delivery Filter */}
            {filterType === 'delivery' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Delivery
                </label>
                <select
                  value={selectedDeliveryId || ''}
                  onChange={(e) => setSelectedDeliveryId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a delivery</option>
                  {deliveries.map(delivery => (
                    <option key={delivery.id} value={delivery.id}>
                      {delivery.delivery_number}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Truck Filter */}
            {filterType === 'truck' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Truck
                </label>
                <select
                  value={selectedTruckId || ''}
                  onChange={(e) => setSelectedTruckId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a truck</option>
                  {trucks.map(truck => (
                    <option key={truck.id} value={truck.id}>
                      {truck.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Date
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Date
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <button
              onClick={resetFilters}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Reset Filters
            </button>
            <div className="text-sm text-gray-600 self-center">
              Showing {activityLogs.length} activities
            </div>
          </div>
        </div>

        {/* Activity Log Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading activity logs...</p>
            </div>
          ) : activityLogs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No activity found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[800px] divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Delivery
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Project
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Truck
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {activityLogs.map((log, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {log.delivery_number ? (
                          <button
                            onClick={() => navigate(`/deliveries/${log.delivery_id}`)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {log.delivery_number}
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.project_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.truck_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {log.user_email || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {log.details ? (
                          <details className="cursor-pointer">
                            <summary className="text-blue-600 hover:text-blue-800">View</summary>
                            <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
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