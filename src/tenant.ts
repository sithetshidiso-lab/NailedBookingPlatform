export interface Tenant {
  businessName: string;
  logoUrl: string;
  description: string;
  phone: string;
  address: string;
  email: string;
  tagline: string;
  artistName: string;
  starEndorsement: string;
  whatsappPhone: string;
}

export const tenant: Tenant = {
  businessName: "Qflow",
  logoUrl: "/logo.png",
  description: "A professional booking, scheduler and salon management platform designed to elevate your style.",
  phone: "069 298 1893",
  address: "number two, Central Avenue, Eastleigh, 1609",
  email: "support@qflow.com",
  tagline: "Where every session feels like a breath of fresh air.",
  artistName: "your Stylist",
  starEndorsement: "✨ PROFESSIONAL SCHEDULER",
  whatsappPhone: "27692981893"
};

const urlParams = new URL(window.location.href).searchParams;
export let currentTenantId = urlParams.get('tenant') || urlParams.get('tenantId') || 'qflow-default';

export function setCurrentTenantId(newId: string) {
  currentTenantId = newId;
}

export function getTenantCollectionPath(collectionName: string) {
  return `tenants/${currentTenantId}/${collectionName}`;
}
