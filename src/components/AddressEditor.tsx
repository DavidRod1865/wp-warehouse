import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen } from "@fortawesome/free-solid-svg-icons";
import { Input } from "./ui/Input";
import type { Address } from "../types/address";

interface VendorOption {
  id: number;
  company_name: string;
}

interface AddressEditorProps {
  label: string;
  address: Address;
  onChange: (address: Address) => void;
  isEditing: boolean;
  onToggleEdit: () => void;
  required?: boolean;
  /** Vendor list for the dropdown */
  vendors?: VendorOption[];
  /** Called when a vendor is selected from the dropdown */
  onVendorSelect?: (vendorId: string) => void;
  /** Extra options to prepend in the vendor dropdown (e.g. "Use project address") */
  extraOptions?: Array<{ value: string; label: string }>;
  /** Show a warning when address is empty in display mode */
  emptyWarning?: string;
  /** Whether the address is empty (controls warning display) */
  isEmpty?: boolean;
}

export default function AddressEditor({
  label,
  address,
  onChange,
  isEditing,
  onToggleEdit,
  required,
  vendors = [],
  onVendorSelect,
  extraOptions = [],
  emptyWarning,
  isEmpty,
}: AddressEditorProps) {
  const setField = (field: keyof Address, value: string) => {
    onChange({ ...address, [field]: value });
  };

  return (
    <div className="space-y-4 border-2 border-base-200 p-4 rounded-lg bg-base-200">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-base-content">
          {label}{" "}
          {required && <span className="text-error">*</span>}
        </h3>
        <button
          type="button"
          onClick={onToggleEdit}
          className="text-primary hover:text-primary/80"
          aria-label={`Edit ${label.toLowerCase()}`}
        >
          <FontAwesomeIcon icon={faPen} />
        </button>
      </div>

      {!isEditing ? (
        isEmpty && emptyWarning ? (
          <div className="text-sm text-warning">{emptyWarning}</div>
        ) : (
          <div className="text-sm text-base-content space-y-1">
            <div className="font-medium">{address.company_name}</div>
            <div>{address.street_address}</div>
            <div>
              {address.city}, {address.state} {address.zip_code}
            </div>
            <div>{address.phone}</div>
          </div>
        )
      ) : (
        <div className="space-y-4">
          {(vendors.length > 0 || extraOptions.length > 0) && onVendorSelect && (
            <div>
              <label className="label">
                <span className="label-text font-medium inline-block pb-1">
                  Vendor
                </span>
              </label>
              <select
                value=""
                onChange={(e) => onVendorSelect(e.target.value)}
                className="select select-bordered w-full"
              >
                <option value="">Select vendor (optional)</option>
                {extraOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.company_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-3">
            <Input
              label="Company Name"
              type="text"
              value={address.company_name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("company_name", e.target.value)}
            />
            <Input
              label="Street Address"
              type="text"
              value={address.street_address}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("street_address", e.target.value)}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="City"
                type="text"
                value={address.city}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("city", e.target.value)}
              />
              <Input
                label="State"
                type="text"
                value={address.state}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("state", e.target.value)}
                placeholder="NY"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Zip Code"
                type="text"
                value={address.zip_code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("zip_code", e.target.value)}
              />
              <Input
                label="Phone"
                type="tel"
                value={address.phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField("phone", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
