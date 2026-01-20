export interface Address {
  company_name: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  [key: string]: string; // Allow index access for dynamic iteration
}

export const DEFAULT_FROM_ADDRESS: Address = {
  company_name: "With Pride HVAC",
  street_address: "77 Marine Street",
  city: "Farmingdale",
  state: "NY",
  zip_code: "11735",
  phone: "516-731-2573"
};

export const EMPTY_ADDRESS: Address = {
  company_name: "",
  street_address: "",
  city: "",
  state: "",
  zip_code: "",
  phone: ""
};
