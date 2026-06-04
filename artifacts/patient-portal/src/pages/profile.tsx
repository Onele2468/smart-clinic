import { useState } from "react";
import Layout from "@/components/Layout";
import {
  useGetPatientPortalMe,
  getGetPatientPortalMeQueryKey,
  useUpdatePatientPortalProfile,
  usePatientPortalChangePassword,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { User, Phone, Mail, Droplets, AlertCircle, CreditCard, Building2, LogOut, Pencil, KeyRound, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function InfoRow({ label, value, testId }: { label: string; value: string | null | undefined; testId?: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5" data-testid={testId}>{value}</p>
    </div>
  );
}

type EditableProfile = {
  contactNumber: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  bloodType: string;
  allergies: string;
  medicalAidName: string;
  medicalAidNumber: string;
};

export default function ProfilePage() {
  const { logout } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [editData, setEditData] = useState<EditableProfile | null>(null);
  const [passwords, setPasswords] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");

  const { data: profile, isLoading } = useGetPatientPortalMe({
    query: { queryKey: getGetPatientPortalMeQueryKey() },
  });

  const updateMutation = useUpdatePatientPortalProfile();
  const changePwMutation = usePatientPortalChangePassword();

  const patient = profile?.patient;
  const clinic = profile?.clinic;

  const startEdit = () => {
    if (!patient) return;
    setEditData({
      contactNumber: patient.contactNumber ?? "",
      address: patient.address ?? "",
      emergencyContactName: patient.emergencyContactName ?? "",
      emergencyContactPhone: patient.emergencyContactPhone ?? "",
      bloodType: patient.bloodType ?? "",
      allergies: patient.allergies ?? "",
      medicalAidName: patient.medicalAidName ?? "",
      medicalAidNumber: patient.medicalAidNumber ?? "",
    });
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditData(null);
  };

  const saveEdit = async () => {
    if (!editData) return;
    try {
      await updateMutation.mutateAsync({ data: editData as any });
      await queryClient.invalidateQueries({ queryKey: getGetPatientPortalMeQueryKey() });
      setEditMode(false);
      setEditData(null);
      toast({ title: "Profile updated", description: "Your information has been saved." });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update failed", description: err?.response?.data?.error ?? "Could not save changes." });
    }
  };

  const handleChangePassword = async () => {
    setPwError("");
    if (passwords.next !== passwords.confirm) {
      setPwError("New passwords do not match.");
      return;
    }
    if (passwords.next.length < 8) {
      setPwError("New password must be at least 8 characters.");
      return;
    }
    try {
      await changePwMutation.mutateAsync({ data: { currentPassword: passwords.current, newPassword: passwords.next } });
      setShowPasswordForm(false);
      setPasswords({ current: "", next: "", confirm: "" });
      toast({ title: "Password changed", description: "Your password has been updated successfully." });
    } catch (err: any) {
      setPwError(err?.response?.data?.error ?? "Could not change password.");
    }
  };

  const upd = (field: keyof EditableProfile, val: string) =>
    setEditData((prev) => prev ? { ...prev, [field]: val } : prev);

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-7 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Profile</h1>
            <p className="text-muted-foreground mt-0.5">Your personal and medical information on file.</p>
          </div>
          {!editMode && patient && (
            <Button variant="outline" size="sm" onClick={startEdit} data-testid="button-edit-profile">
              <Pencil className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          {editMode && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={cancelEdit}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-profile">
                <Check className="w-4 h-4 mr-1" />
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />)}
          </div>
        )}

        {!isLoading && patient && (
          <div className="space-y-4">
            {/* Identity */}
            <Card data-testid="card-identity">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Personal Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <InfoRow label="Full Name" value={`${patient.firstName} ${patient.lastName}`} testId="text-profile-name" />
                <InfoRow label="Patient Code" value={patient.patientCode} testId="text-profile-code" />
                <InfoRow label="Date of Birth" value={patient.dateOfBirth} testId="text-profile-dob" />
                <InfoRow label="Gender" value={patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : undefined} />
                <InfoRow label="Nationality" value={patient.nationality} />
                <InfoRow label="Status" value={patient.status ? patient.status.charAt(0).toUpperCase() + patient.status.slice(1) : undefined} />
              </CardContent>
            </Card>

            {/* Government ID */}
            {(patient.governmentIdType || patient.governmentIdNumber) && (
              <Card data-testid="card-gov-id">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Government ID
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <InfoRow label="ID Type" value={patient.governmentIdType === "SA_ID" ? "SA ID Number" : patient.governmentIdType === "PASSPORT" ? "Passport" : patient.governmentIdType} />
                  <InfoRow label="ID Number" value={patient.governmentIdNumber} testId="text-profile-id-number" />
                </CardContent>
              </Card>
            )}

            {/* Contact */}
            <Card data-testid="card-contact">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {editMode && editData ? (
                  <>
                    <div className="col-span-2 space-y-1.5">
                      <Label>Contact Number</Label>
                      <Input value={editData.contactNumber} onChange={(e) => upd("contactNumber", e.target.value)} data-testid="input-edit-contact" />
                    </div>
                    <div className="col-span-2 space-y-1.5">
                      <Label>Address</Label>
                      <Input value={editData.address} onChange={(e) => upd("address", e.target.value)} placeholder="Your address" data-testid="input-edit-address" />
                    </div>
                  </>
                ) : (
                  <>
                    <InfoRow label="Contact Number" value={patient.contactNumber} testId="text-profile-phone" />
                    <InfoRow label="Email" value={patient.email} testId="text-profile-email" />
                    <InfoRow label="Address" value={patient.address} />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Emergency contact */}
            <Card data-testid="card-emergency">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {editMode && editData ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>Contact Name</Label>
                      <Input value={editData.emergencyContactName} onChange={(e) => upd("emergencyContactName", e.target.value)} placeholder="Full name" data-testid="input-edit-emerg-name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Contact Phone</Label>
                      <Input value={editData.emergencyContactPhone} onChange={(e) => upd("emergencyContactPhone", e.target.value)} placeholder="+27 ..." data-testid="input-edit-emerg-phone" />
                    </div>
                  </>
                ) : (
                  <>
                    {patient.emergencyContactName || patient.emergencyContactPhone ? (
                      <>
                        <InfoRow label="Name" value={patient.emergencyContactName} />
                        <InfoRow label="Phone" value={patient.emergencyContactPhone} />
                      </>
                    ) : (
                      <p className="col-span-2 text-sm text-muted-foreground italic">No emergency contact on file.</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Medical */}
            <Card data-testid="card-medical">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Droplets className="w-4 h-4" />
                  Medical Information
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {editMode && editData ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>Blood Type</Label>
                      <Input value={editData.bloodType} onChange={(e) => upd("bloodType", e.target.value)} placeholder="e.g. O+" data-testid="input-edit-blood" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Known Allergies</Label>
                      <Input value={editData.allergies} onChange={(e) => upd("allergies", e.target.value)} placeholder="e.g. Penicillin" data-testid="input-edit-allergies" />
                    </div>
                  </>
                ) : (
                  <>
                    <InfoRow label="Blood Type" value={patient.bloodType} testId="text-profile-blood-type" />
                    <InfoRow label="Allergies" value={patient.allergies} testId="text-profile-allergies" />
                    <InfoRow label="Chronic Conditions" value={patient.chronicConditions} />
                    <InfoRow label="Medical History" value={patient.medicalHistory} />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Medical Aid */}
            <Card data-testid="card-medical-aid">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Medical Aid
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                {editMode && editData ? (
                  <>
                    <div className="space-y-1.5">
                      <Label>Scheme Name</Label>
                      <Input value={editData.medicalAidName} onChange={(e) => upd("medicalAidName", e.target.value)} placeholder="e.g. Discovery Health" data-testid="input-edit-aid-name" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Member Number</Label>
                      <Input value={editData.medicalAidNumber} onChange={(e) => upd("medicalAidNumber", e.target.value)} placeholder="Membership number" data-testid="input-edit-aid-number" />
                    </div>
                  </>
                ) : (
                  <>
                    {patient.medicalAidName || patient.medicalAidNumber ? (
                      <>
                        <InfoRow label="Scheme Name" value={patient.medicalAidName} testId="text-profile-aid-name" />
                        <InfoRow label="Member Number" value={patient.medicalAidNumber} testId="text-profile-aid-number" />
                      </>
                    ) : (
                      <p className="col-span-2 text-sm text-muted-foreground italic">No medical aid on file.</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Clinic */}
            {clinic && (
              <Card data-testid="card-clinic">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Registered Clinic
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <InfoRow label="Clinic Name" value={clinic.name} testId="text-profile-clinic-name" />
                  <InfoRow label="Join Code" value={clinic.code} />
                  <InfoRow label="Address" value={clinic.address} />
                  <InfoRow label="Phone" value={clinic.contactNumber} />
                </CardContent>
              </Card>
            )}

            {/* Password change */}
            <Card data-testid="card-password">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Password & Security
                  </CardTitle>
                  {!showPasswordForm && (
                    <Button variant="ghost" size="sm" onClick={() => setShowPasswordForm(true)} data-testid="button-change-password">
                      Change password
                    </Button>
                  )}
                </div>
              </CardHeader>
              {showPasswordForm && (
                <CardContent className="space-y-3">
                  {pwError && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> {pwError}
                    </p>
                  )}
                  <div className="space-y-1.5">
                    <Label>Current password</Label>
                    <Input type="password" value={passwords.current} onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))} data-testid="input-current-password" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>New password <span className="text-muted-foreground text-xs">(min. 8 characters)</span></Label>
                    <Input type="password" value={passwords.next} onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))} data-testid="input-new-password" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Confirm new password</Label>
                    <Input type="password" value={passwords.confirm} onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))} data-testid="input-confirm-password" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => { setShowPasswordForm(false); setPwError(""); setPasswords({ current: "", next: "", confirm: "" }); }}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleChangePassword} disabled={changePwMutation.isPending} data-testid="button-submit-password">
                      {changePwMutation.isPending ? "Updating..." : "Update password"}
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* Sign out */}
            <div className="pt-2">
              <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/5" onClick={logout} data-testid="button-profile-logout">
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </Button>
            </div>
          </div>
        )}

        {!isLoading && !patient && (
          <div className="flex items-center gap-2 p-4 rounded-xl bg-destructive/10 text-destructive text-sm">
            <AlertCircle className="w-4 h-4" />
            Could not load your profile. Please try logging in again.
          </div>
        )}
      </div>
    </Layout>
  );
}
