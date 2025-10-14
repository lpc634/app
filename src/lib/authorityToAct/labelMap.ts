export const authorityToActLabelMap: Record<string, string> = {
  // Client
  firstName: "First Name",
  lastName: "Last Name",
  company: "Company",
  email: "Email",
  phone: "Phone",
  client_name: "Client Name",
  client_email: "Client Email",
  client_phone: "Client Phone",

  // Addresses
  clientAddress: "Client Address",
  invoiceAddress: "Invoice Address",
  siteAddress: "Property Address",
  property_address: "Property Address",

  // Authority
  authorityRole: "Authority Role",
  docsLandRegistry: "Land Registry",
  docsLease: "Lease Agreement",
  docsManagement: "Management Contract",
  docsOther: "Other Supporting Docs",
  changeUndertaking: "Change/Undertaking",

  // Site
  propertyType: "Property Type",
  premisesOccupied: "Premises Occupied",
  sitePlanAvailable: "Site Plan Available",
  photosAvailable: "Photos Available",
  trespassDescription: "Description of Trespass",
  tents: "Tents/Shelters",
  vehicles: "Motor Vehicles",
  persons: "Persons",
  dogsOnSite: "Dogs on Site",
  livestockOnSite: "Livestock on Site",

  // Accounts/Invoice
  invoiceCompany: "Invoice Company",
  accountsTitle: "Accounts Title",
  accountsFirst: "Accounts First Name",
  accountsLast: "Accounts Last Name",
  accountsEmail: "Accounts Email",
  accountsPhone: "Accounts Phone",
  vatNumber: "VAT Number",
  poNumber: "PO Number",

  // Signature
  sigTitle: "Signatory Title",
  sigFirst: "Signatory First Name",
  sigLast: "Signatory Last Name",
  signatureDate: "Date of Signature",
  signatureDataUrl: "Signature",
};

export function prettifyKey(key: string): string {
  if (!key) return "";
  if (authorityToActLabelMap[key]) return authorityToActLabelMap[key];
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^\w/, (m) => m.toUpperCase());
}


