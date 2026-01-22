import { useState, useEffect } from 'react';
import type { SortlyItem } from '../types/sortly';

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Partial<SortlyItem>) => Promise<void>;
  onDelete?: () => void;
  editItem?: SortlyItem | null;
  parentFolderId: number | null;
}

export default function ItemFormModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  editItem,
  parentFolderId,
}: ItemFormModalProps) {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [sku, setSku] = useState('');
  const [notes, setNotes] = useState('');
  const [brand, setBrand] = useState('');
  const [partNumber, setPartNumber] = useState('');
  const [dateReceived, setDateReceived] = useState<string>('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Populate form when editing
  useEffect(() => {
    if (editItem) {
      setName(editItem.name || '');
      setQuantity(editItem.quantity || 0);
      setSku(editItem.sid || '');
      setNotes(editItem.notes || '');
      setTags(editItem.tags?.join(', ') || '');

      // Try to extract metadata from notes field (our temporary storage)
      if (editItem.notes) {
        const metadataMatch = editItem.notes.match(/^\[(.*?)\]/);
        if (metadataMatch) {
          const metadata = metadataMatch[1];
          const brandMatch = metadata.match(/Brand: ([^|]+)/);
          const partNumMatch = metadata.match(/Part Number: ([^|]+)/);
          const dateMatch = metadata.match(/Date Received: ([^|]+)/);

          if (brandMatch) setBrand(brandMatch[1].trim());
          if (partNumMatch) setPartNumber(partNumMatch[1].trim());
          if (dateMatch) setDateReceived(dateMatch[1].trim());
          else setDateReceived(''); // Empty if not found

          // Remove metadata from notes display
          const notesWithoutMetadata = editItem.notes.replace(/^\[.*?\]\n?/, '');
          setNotes(notesWithoutMetadata);
        } else {
          setDateReceived(''); // Empty if no metadata
        }
      } else {
        setDateReceived(''); // Empty if no notes
      }

      // Also check custom attributes if they exist (if user has them set up)
      if (editItem.custom_attribute_values) {
        const brandAttr = editItem.custom_attribute_values.find(
          attr => attr.custom_attribute_name === 'Brand'
        );
        const partNumAttr = editItem.custom_attribute_values.find(
          attr => attr.custom_attribute_name === 'Part Number'
        );
        const dateAttr = editItem.custom_attribute_values.find(
          attr => attr.custom_attribute_name === 'Date Received'
        );

        if (brandAttr?.value) setBrand(brandAttr.value);
        if (partNumAttr?.value) setPartNumber(partNumAttr.value);
        if (dateAttr?.value) setDateReceived(dateAttr.value);
      }
    } else {
      resetForm();
    }
  }, [editItem]);

  const resetForm = () => {
    setName('');
    setQuantity(0);
    setSku('');
    setNotes('');
    setBrand('');
    setPartNumber('');
    setDateReceived('');
    setTags('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (quantity < 0) {
      setError('Quantity cannot be negative');
      return;
    }

    setLoading(true);

    try {
      const itemData: Partial<SortlyItem> = {
        name: name.trim(),
        quantity,
        ...(sku && { sid: sku }),
        ...(tags && { tags: tags.split(',').map(t => t.trim()).filter(Boolean) }),
      };

      // Custom attributes are stored in notes for now since they require setup in Sortly account
      // We'll include them in the notes field if provided
      let notesWithMetadata = notes;

      if (brand || partNumber || dateReceived) {
        const metadata: string[] = [];
        if (brand) metadata.push(`Brand: ${brand}`);
        if (partNumber) metadata.push(`Part Number: ${partNumber}`);
        if (dateReceived) metadata.push(`Date Received: ${dateReceived}`);

        const metadataText = `[${metadata.join(' | ')}]`;
        notesWithMetadata = notesWithMetadata
          ? `${metadataText}\n${notesWithMetadata}`
          : metadataText;
      }

      if (notesWithMetadata) {
        itemData.notes = notesWithMetadata;
      }

      // Add parent_id only for new items
      if (!editItem && parentFolderId !== null) {
        itemData.parent_id = parentFolderId;
      }

      await onSave(itemData);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {editItem ? 'Edit Item' : 'Add New Item'}
            </h2>
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name */}
              <div className="md:col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Item name"
                />
              </div>

              {/* Quantity */}
              <div>
                <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  id="quantity"
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
                  required
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* SKU/Barcode */}
              <div>
                <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1">
                  SKU/Barcode
                </label>
                <input
                  id="sku"
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>

              {/* Date Received */}
              <div>
                <label htmlFor="dateReceived" className="block text-sm font-medium text-gray-700 mb-1">
                  Date Received
                </label>
                <input
                  id="dateReceived"
                  type="date"
                  value={dateReceived}
                  onChange={(e) => setDateReceived(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Brand */}
              <div>
                <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
                  Brand
                </label>
                <input
                  id="brand"
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>

              {/* Part Number */}
              <div>
                <label htmlFor="partNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Part Number
                </label>
                <input
                  id="partNumber"
                  type="text"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Optional"
                />
              </div>

              {/* Tags */}
              <div className="md:col-span-2">
                <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  id="tags"
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., electronics, fragile"
                />
              </div>

              {/* Notes */}
              <div className="md:col-span-2">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Additional notes"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 pt-4">
              {editItem && onDelete ? (
                <>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                  >
                    Delete
                  </button>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                  >
                    {loading ? 'Saving...' : 'Update'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                  >
                    {loading ? 'Saving...' : 'Create'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
