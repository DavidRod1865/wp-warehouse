import type { SortlyItem } from '../types/sortly';

interface DeleteConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  item: SortlyItem | null;
  loading: boolean;
}

export default function DeleteConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  item,
  loading,
}: DeleteConfirmDialogProps) {
  if (!isOpen || !item) return null;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full">
        <div className="p-6">
          {/* Icon */}
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          {/* Header */}
          <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
            Delete Item?
          </h2>

          {/* Content */}
          <div className="mb-6">
            <p className="text-gray-600 text-center mb-3">
              Are you sure you want to delete this item?
            </p>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              <div className="text-sm">
                <span className="font-medium text-gray-700">Name:</span>{' '}
                <span className="text-gray-900">{item.name}</span>
              </div>
              {item.quantity !== undefined && (
                <div className="text-sm">
                  <span className="font-medium text-gray-700">Quantity:</span>{' '}
                  <span className="text-gray-900">{item.quantity}</span>
                </div>
              )}
              {item.sid && (
                <div className="text-sm">
                  <span className="font-medium text-gray-700">SKU:</span>{' '}
                  <span className="text-gray-900">{item.sid}</span>
                </div>
              )}
            </div>

            <p className="text-red-600 text-sm text-center mt-3 font-medium">
              This action cannot be undone.
            </p>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
