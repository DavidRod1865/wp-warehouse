import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

type VendorContact = {
  name: string;
  phone: string;
  email: string;
};

type Vendor = {
  id: number;
  company_name: string;
  street_address: string;
  town: string;
  state: string;
  zipcode: string;
  contacts: VendorContact[];
  created_at: string;
  updated_at: string;
};

const emptyContact: VendorContact = {
  name: "",
  phone: "",
  email: "",
};

const emptyVendor = {
  company_name: "",
  street_address: "",
  town: "",
  state: "",
  zipcode: "",
  contacts: [emptyContact],
};

export default function Vendors() {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState<number | null>(null);
  const [formData, setFormData] = useState(emptyVendor);

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    setLoading(true);
    setError("");
    try {
      const { data, error: fetchError } = await supabase
        .from("vendor_addresses")
        .select("*")
        .order("company_name");

      if (fetchError) throw fetchError;
      setVendors((data || []) as Vendor[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(emptyVendor);
    setEditingVendorId(null);
  };

  const handleAddVendor = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEditVendor = (vendor: Vendor) => {
    setFormData({
      company_name: vendor.company_name,
      street_address: vendor.street_address,
      town: vendor.town,
      state: vendor.state,
      zipcode: vendor.zipcode,
      contacts:
        vendor.contacts && vendor.contacts.length > 0
          ? vendor.contacts
          : [emptyContact],
    });
    setEditingVendorId(vendor.id);
    setShowForm(true);
  };

  const handleDeleteVendor = async (vendorId: number, name: string) => {
    const confirmed = window.confirm(
      `Delete vendor "${name}"? This cannot be undone.`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    try {
      const { error: deleteError } = await supabase
        .from("vendor_addresses")
        .delete()
        .eq("id", vendorId);

      if (deleteError) throw deleteError;
      setSuccess("Vendor deleted.");
      await loadVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete vendor");
    }
  };

  const handleContactChange = (
    index: number,
    field: keyof VendorContact,
    value: string
  ) => {
    const updatedContacts = [...formData.contacts];
    updatedContacts[index] = { ...updatedContacts[index], [field]: value };
    setFormData({ ...formData, contacts: updatedContacts });
  };

  const handleAddContact = () => {
    setFormData({ ...formData, contacts: [...formData.contacts, emptyContact] });
  };

  const handleRemoveContact = (index: number) => {
    const updated = formData.contacts.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      contacts: updated.length > 0 ? updated : [emptyContact],
    });
  };

  const handleSaveVendor = async () => {
    setError("");
    setSuccess("");

    if (
      !formData.company_name.trim() ||
      !formData.street_address.trim() ||
      !formData.town.trim() ||
      !formData.state.trim() ||
      !formData.zipcode.trim()
    ) {
      setError("Please fill out all required vendor fields.");
      return;
    }

    const cleanedContacts = formData.contacts
      .map((contact) => ({
        name: contact.name.trim(),
        phone: contact.phone.trim(),
        email: contact.email.trim(),
      }))
      .filter((contact) => contact.name || contact.phone || contact.email);

    setSaving(true);
    try {
      if (editingVendorId) {
        const { error: updateError } = await supabase
          .from("vendor_addresses")
          .update({
            company_name: formData.company_name.trim(),
            street_address: formData.street_address.trim(),
            town: formData.town.trim(),
            state: formData.state.trim(),
            zipcode: formData.zipcode.trim(),
            contacts: cleanedContacts,
          })
          .eq("id", editingVendorId);

        if (updateError) throw updateError;
        setSuccess("Vendor updated.");
      } else {
        const { error: insertError } = await supabase
          .from("vendor_addresses")
          .insert({
            company_name: formData.company_name.trim(),
            street_address: formData.street_address.trim(),
            town: formData.town.trim(),
            state: formData.state.trim(),
            zipcode: formData.zipcode.trim(),
            contacts: cleanedContacts,
          });

        if (insertError) throw insertError;
        setSuccess("Vendor added.");
      }

      setShowForm(false);
      resetForm();
      await loadVendors();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save vendor");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
            <p className="text-sm text-gray-600">
              Manage vendor addresses and contacts.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddVendor}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              + Add Vendor
            </button>
            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        {showForm && (
          <section className="bg-white rounded-lg shadow p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingVendorId ? "Edit Vendor" : "Add Vendor"}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name *
                </label>
                <input
                  type="text"
                  value={formData.company_name}
                  onChange={(e) =>
                    setFormData({ ...formData, company_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Street Address *
                </label>
                <input
                  type="text"
                  value={formData.street_address}
                  onChange={(e) =>
                    setFormData({ ...formData, street_address: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Town *
                </label>
                <input
                  type="text"
                  value={formData.town}
                  onChange={(e) =>
                    setFormData({ ...formData, town: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State *
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) =>
                    setFormData({ ...formData, state: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Zipcode *
                </label>
                <input
                  type="text"
                  value={formData.zipcode}
                  onChange={(e) =>
                    setFormData({ ...formData, zipcode: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Contacts
                </h3>
                <button
                  type="button"
                  onClick={handleAddContact}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Contact
                </button>
              </div>
              {formData.contacts.map((contact, index) => (
                <div
                  key={`contact-${index}`}
                  className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end border border-gray-200 rounded-lg p-3"
                >
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={contact.name}
                      onChange={(e) =>
                        handleContactChange(index, "name", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Phone
                    </label>
                    <input
                      type="text"
                      value={contact.phone}
                      onChange={(e) =>
                        handleContactChange(index, "phone", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={contact.email}
                      onChange={(e) =>
                        handleContactChange(index, "email", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="md:col-span-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemoveContact(index)}
                      className="text-xs text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveVendor}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Vendor"}
              </button>
            </div>
          </section>
        )}

        <section className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Vendor List
            </h2>
            {loading && (
              <span className="text-sm text-gray-500">Loading...</span>
            )}
          </div>

          {vendors.length === 0 && !loading ? (
            <div className="p-6 text-sm text-gray-500">
              No vendors yet. Click “Add Vendor” to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[800px] divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Vendor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contacts
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vendors.map((vendor) => (
                    <tr key={vendor.id}>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {vendor.company_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>{vendor.street_address}</div>
                        <div>
                          {vendor.town}, {vendor.state} {vendor.zipcode}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {vendor.contacts && vendor.contacts.length > 0 ? (
                          <ul className="space-y-1">
                            {vendor.contacts.map((contact, index) => (
                              <li key={`contact-${vendor.id}-${index}`}>
                                <div className="font-medium text-gray-900">
                                  {contact.name || "Contact"}
                                </div>
                                {(contact.phone || contact.email) && (
                                  <div className="text-xs text-gray-500">
                                    {contact.phone}
                                    {contact.phone && contact.email
                                      ? " • "
                                      : ""}
                                    {contact.email}
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-xs text-gray-400">
                            No contacts
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-right space-x-3">
                        <button
                          type="button"
                          onClick={() => handleEditVendor(vendor)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteVendor(vendor.id, vendor.company_name)
                          }
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
