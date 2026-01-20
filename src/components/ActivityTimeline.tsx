import type { ActivityLogEntry } from '../types/activity';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheck,
  faCheckCircle,
  faPencil,
  faPrint,
  faTrash,
  faTruck,
  faFolder,
  faUser,
  faMapPin,
  faArrowsRotate,
  faFile,
} from '@fortawesome/free-solid-svg-icons';

interface ActivityTimelineProps {
  activities: ActivityLogEntry[];
  showUserNames?: boolean;
  showDetails?: boolean;
}

export default function ActivityTimeline({
  activities,
  showUserNames = true,
  showDetails = true
}: ActivityTimelineProps) {
  return (
    <div className="space-y-6">
      {activities.map((activity, index) => (
        <div key={index} className="relative flex gap-4">
          {/* Vertical Line (not for last item) */}
          {index < activities.length - 1 && (
            <div className="absolute left-6 top-12 w-px h-full bg-gray-200" />
          )}

          {/* Icon Circle */}
          <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white border-2 border-gray-200">
            {getActivityIcon(activity.action)}
          </div>

          {/* Content */}
          <div className="flex-1 pb-8">
            {/* Timestamp */}
            <div className="text-sm text-gray-500 mb-1">
              {formatActivityTimestamp(activity.timestamp)}
            </div>

            {/* User Name */}
            {showUserNames && activity.user_name && (
              <div className="font-semibold text-gray-900 mb-1">
                {activity.user_name}
              </div>
            )}

            {/* Action Description */}
            <div className="text-gray-700">
              {getActivityDescription(activity)}
            </div>

            {/* Details */}
            {showDetails && activity.details && (
              <div className="mt-2 text-sm text-gray-600">
                {renderActivityDetails(activity)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Helper function to get appropriate icon for each action
function getActivityIcon(action: string) {
  switch (action) {
    case 'created':
      return <FontAwesomeIcon icon={faCheck} className="h-6 w-6 text-green-600" />;
    case 'printed':
      return <FontAwesomeIcon icon={faPrint} className="h-6 w-6 text-purple-600" />;
    case 'delivered':
      return <FontAwesomeIcon icon={faCheckCircle} className="h-6 w-6 text-green-600" />;
    case 'edited':
    case 'items_added':
    case 'items_removed':
    case 'items_quantity_changed':
      return <FontAwesomeIcon icon={faPencil} className="h-6 w-6 text-blue-600" />;
    case 'deleted':
      return <FontAwesomeIcon icon={faTrash} className="h-6 w-6 text-red-600" />;
    case 'truck_changed':
      return <FontAwesomeIcon icon={faTruck} className="h-6 w-6 text-orange-600" />;
    case 'project_changed':
      return <FontAwesomeIcon icon={faFolder} className="h-6 w-6 text-indigo-600" />;
    case 'driver_assigned':
      return <FontAwesomeIcon icon={faUser} className="h-6 w-6 text-blue-600" />;
    case 'address_changed':
      return <FontAwesomeIcon icon={faMapPin} className="h-6 w-6 text-teal-600" />;
    case 'status_changed':
      return <FontAwesomeIcon icon={faArrowsRotate} className="h-6 w-6 text-amber-600" />;
    default:
      return <FontAwesomeIcon icon={faFile} className="h-6 w-6 text-gray-600" />;
  }
}

// Helper function to format timestamp
function formatActivityTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  return date.toLocaleDateString('en-US', options);
}

// Helper function to generate human-readable action description
function getActivityDescription(activity: ActivityLogEntry): string {
  switch (activity.action) {
    case 'created':
      return `Created delivery order`;
    case 'printed':
      return `Printed delivery order`;
    case 'delivered':
      return `Completed delivery`;
    case 'items_added':
      const addedCount = activity.details?.items_added?.length || 0;
      return `Added ${addedCount} item${addedCount !== 1 ? 's' : ''}`;
    case 'items_removed':
      const removedCount = activity.details?.items_removed?.length || 0;
      return `Removed ${removedCount} item${removedCount !== 1 ? 's' : ''}`;
    case 'items_quantity_changed':
      return `Changed item quantities`;
    case 'project_changed':
      return `Changed project assignment`;
    case 'truck_changed':
      return `Changed assigned truck`;
    case 'driver_assigned':
      return `Assigned driver`;
    case 'address_changed':
      return `Updated delivery address`;
    case 'status_changed':
      return `Changed status`;
    case 'deleted':
      return `Deleted delivery order`;
    case 'edited':
      return `Edited delivery order`;
    default:
      return `Performed ${activity.action}`;
  }
}

// Helper function to render activity-specific details
function renderActivityDetails(activity: ActivityLogEntry): React.ReactNode {
  const { action, details } = activity;

  if (!details) return null;

  switch (action) {
    case 'created':
      return (
        <div>
          {details.delivery_type && <div>Type: {details.delivery_type}</div>}
          {details.project_name && <div>Project: {details.project_name}</div>}
          {details.truck_name && <div>Truck: {details.truck_name}</div>}
          {details.items_count !== undefined && <div>Items: {details.items_count}</div>}
        </div>
      );

    case 'items_added':
      return (
        <ul className="list-disc list-inside">
          {details.items_added?.map((item, i) => (
            <li key={i}>{item.item_name} (Qty: {item.quantity})</li>
          ))}
        </ul>
      );

    case 'items_removed':
      return (
        <ul className="list-disc list-inside">
          {details.items_removed?.map((item, i) => (
            <li key={i}>{item.item_name} (Qty: {item.quantity})</li>
          ))}
        </ul>
      );

    case 'items_quantity_changed':
      return (
        <ul className="list-disc list-inside">
          {details.quantity_changes?.map((change, i) => (
            <li key={i}>
              {change.item_name}: {change.old_quantity} → {change.new_quantity}
            </li>
          ))}
        </ul>
      );

    case 'truck_changed':
      return (
        <div>
          From: {details.truck_changed?.from} → To: {details.truck_changed?.to}
        </div>
      );

    case 'project_changed':
      return (
        <div>
          From: {details.project_changed?.from || 'None'} → To: {details.project_changed?.to || 'None'}
        </div>
      );

    case 'driver_assigned':
      return <div>Driver: {details.driver_assigned?.driver_name}</div>;

    case 'delivered':
      return (
        <div>
          {details.signed_by_name && <div>Signed by: {details.signed_by_name}</div>}
        </div>
      );

    case 'address_changed':
      const field = details.address_changed?.field === 'from_address' ? 'From Address' : 'To Address';
      return (
        <div>
          <div className="font-medium">{field} updated:</div>
          <ul className="list-disc list-inside">
            {Object.entries(details.address_changed?.changes || {}).map(([key, value]) => (
              <li key={key}>
                {key}: {value.old} → {value.new}
              </li>
            ))}
          </ul>
        </div>
      );

    case 'status_changed':
      return (
        <div>
          Status: {details.previous_status} → {details.new_status}
        </div>
      );

    default:
      return null;
  }
}
