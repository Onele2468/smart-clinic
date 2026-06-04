import { useAuth } from "@/contexts/AuthContext";

export type ClinicType = "private" | "government" | "ngo";

/**
 * Feature flags derived from clinic type + billing setting.
 * Single source of truth for module visibility across the app.
 *
 * Government clinics: no billing, no cashier, no pharmacy, no laboratory,
 *   no inventory, no suppliers. Workflow: reception → doctor → completed.
 *
 * NGO clinics: same modules as private clinics (billing optional per setting).
 */
export interface ClinicModules {
  clinicType: ClinicType;
  hasBilling: boolean;
  hasPharmacy: boolean;
  hasLaboratory: boolean;
  hasCashier: boolean;
  hasInventory: boolean;
  hasSuppliers: boolean;
}

export function useClinicModules(): ClinicModules {
  const { clinicMembership } = useAuth();
  const clinicType = (clinicMembership?.clinicType ?? "private") as ClinicType;
  const billingEnabled = clinicMembership?.billingEnabled ?? true;

  const isGovernment = clinicType === "government";

  return {
    clinicType,
    hasBilling: !isGovernment && billingEnabled,
    hasPharmacy: !isGovernment,
    hasLaboratory: !isGovernment,
    hasCashier: !isGovernment,
    hasInventory: !isGovernment,
    hasSuppliers: !isGovernment,
  };
}

/** Roles that do not exist in government clinics (department-tied roles). */
export const GOVERNMENT_EXCLUDED_ROLES = new Set([
  "pharmacist",
  "lab_technician",
  "cashier",
]);
