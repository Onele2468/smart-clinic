/**
 * Demo seed script for Smart Clinic
 * Run with: npm run seed-demo -w @workspace/scripts
 *
 * Creates a full demo clinic with realistic data for presentation.
 * Demo credentials: password is Demo@1234 for all accounts.
 */
import bcrypt from "bcrypt";
import { db } from "@workspace/db";
import {
  usersTable, clinicsTable, clinicMembersTable, patientsTable,
  appointmentsTable, queueEntriesTable, prescriptionsTable,
  labRequestsTable, consultationNotesTable, invoicesTable,
  invoiceItemsTable, paymentsTable, inventoryItemsTable,
  activityLogsTable, notificationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const DEMO_PASSWORD = "Demo@1234";
const DEMO_CLINIC_CODE = "SC-DEMO01";

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function hoursFromNow(h: number) {
  const d = new Date();
  d.setHours(d.getHours() + h);
  return d;
}

async function main() {
  console.log("🌱 Starting demo seed...\n");

  // ── 0. Clean existing demo data ──────────────────────────────────────────
  console.log("Cleaning existing demo data...");
  const [existingClinic] = await db.select().from(clinicsTable).where(eq(clinicsTable.code, DEMO_CLINIC_CODE));
  if (existingClinic) {
    // Delete in dependency order
    await db.delete(notificationsTable).where(eq(notificationsTable.clinicId, existingClinic.id));
    await db.delete(activityLogsTable).where(eq(activityLogsTable.clinicId, existingClinic.id));
    await db.delete(paymentsTable).where(eq(paymentsTable.clinicId, existingClinic.id));
    await db.delete(invoiceItemsTable);
    await db.delete(invoicesTable).where(eq(invoicesTable.clinicId, existingClinic.id));
    await db.delete(prescriptionsTable).where(eq(prescriptionsTable.clinicId, existingClinic.id));
    await db.delete(labRequestsTable).where(eq(labRequestsTable.clinicId, existingClinic.id));
    await db.delete(consultationNotesTable).where(eq(consultationNotesTable.clinicId, existingClinic.id));
    await db.delete(queueEntriesTable).where(eq(queueEntriesTable.clinicId, existingClinic.id));
    await db.delete(appointmentsTable).where(eq(appointmentsTable.clinicId, existingClinic.id));
    await db.delete(patientsTable).where(eq(patientsTable.clinicId, existingClinic.id));
    await db.delete(inventoryItemsTable).where(eq(inventoryItemsTable.clinicId, existingClinic.id));
    await db.delete(clinicMembersTable).where(eq(clinicMembersTable.clinicId, existingClinic.id));
    await db.delete(clinicsTable).where(eq(clinicsTable.id, existingClinic.id));
  }

  // ── 1. Create demo staff users (admin first — required as clinic owner) ───
  console.log("Creating demo staff accounts...");

  const staffDefs = [
    { name: "Dr. Sarah Johnson", email: "admin@democlinic.com", role: "clinic_admin" as const, staffCode: "CA-001", idNum: "8001015009087" },
    { name: "Dr. Michael Chen", email: "doctor@democlinic.com", role: "doctor" as const, staffCode: "DR-001", idNum: "7503025009083" },
    { name: "Nurse Amara Dlamini", email: "nurse@democlinic.com", role: "nurse" as const, staffCode: "NR-001", idNum: "9205065009087" },
    { name: "Reception Thandi Mokoena", email: "reception@democlinic.com", role: "receptionist" as const, staffCode: "RC-001", idNum: "9409125009089" },
    { name: "Pharmacist James Botha", email: "pharmacist@democlinic.com", role: "pharmacist" as const, staffCode: "PH-001", idNum: "8807145009083" },
    { name: "Lab Tech Priya Naidoo", email: "lab@democlinic.com", role: "lab_technician" as const, staffCode: "LB-001", idNum: "9103055009080" },
    { name: "Cashier Sipho Ndlovu", email: "cashier@democlinic.com", role: "cashier" as const, staffCode: "CS-001", idNum: "9612085009086" },
  ];

  const staffUsers: (typeof usersTable.$inferSelect)[] = [];
  for (const def of staffDefs) {
    // Delete if already exists
    await db.delete(usersTable).where(eq(usersTable.email, def.email));
    const [u] = await db.insert(usersTable).values({
      name: def.name,
      email: def.email,
      passwordHash: await hash(DEMO_PASSWORD),
      role: def.role,
      userType: "staff",
      staffCode: def.staffCode,
      governmentIdType: "SA_ID",
      governmentIdNumber: def.idNum,
      nationality: "South African",
      emailVerified: true,
    }).returning();
    staffUsers.push(u);
  }

  const [adminUser, doctorUser, nurseUser, , pharmacistUser, labUser] = staffUsers;

  // ── 2. Create demo clinic ─────────────────────────────────────────────────
  console.log("Creating demo clinic...");
  const [clinic] = await db.insert(clinicsTable).values({
    ownerUserId: adminUser.id,
    name: "MediCare Demo Clinic",
    code: DEMO_CLINIC_CODE,
    clinicType: "private",
    address: "123 Health Street, Sandton, Gauteng",
    city: "Sandton",
    province: "Gauteng",
    contactNumber: "+27 11 234 5678",
    email: "info@medicaredemo.co.za",
    isActive: true,
  }).returning();

  // Add all staff as clinic members
  for (let i = 0; i < staffUsers.length; i++) {
    await db.insert(clinicMembersTable).values({
      clinicId: clinic.id,
      userId: staffUsers[i].id,
      role: staffDefs[i].role,
      status: "active",
    });
  }
  // Create demo patient user linked to a clinical patient record.
  console.log("Creating demo patient account...");
  await db.delete(usersTable).where(eq(usersTable.email, "patient@democlinic.com"));
  const [patientUser] = await db.insert(usersTable).values({
    name: "Zanele Sithole",
    email: "patient@democlinic.com",
    passwordHash: await hash(DEMO_PASSWORD),
    role: "patient",
    userType: "patient",
    governmentIdType: "SA_ID",
    governmentIdNumber: "9502145009084",
    nationality: "South African",
    emailVerified: true,
  }).returning();

  // ── 4. Create patients ────────────────────────────────────────────────────
  console.log("Creating demo patients...");

  const patientDefs = [
    { firstName: "Zanele", lastName: "Sithole", dob: "1995-02-14", gender: "female", contact: "+27 72 111 2222", email: "patient@democlinic.com", blood: "A+", allergies: "Penicillin", code: "PT-00001", userId: patientUser.id, idType: "SA_ID", idNum: "9502145009084", nationality: "South African", medAid: "Discovery Health", medAidNum: "12345678" },
    { firstName: "Themba", lastName: "Khumalo", dob: "1988-07-22", gender: "male", contact: "+27 83 222 3333", email: "t.khumalo@email.com", blood: "O+", allergies: null, code: "PT-00002", userId: null, idType: "SA_ID", idNum: "8807225009080", nationality: "South African", medAid: "Bonitas", medAidNum: "87654321" },
    { firstName: "Lisa", lastName: "van der Merwe", dob: "1975-11-03", gender: "female", contact: "+27 61 333 4444", email: "lisa.vdm@email.com", blood: "B-", allergies: "Aspirin, Sulfa drugs", code: "PT-00003", userId: null, idType: "SA_ID", idNum: "7511035009087", nationality: "South African", medAid: null, medAidNum: null },
    { firstName: "Emmanuel", lastName: "Okafor", dob: "1990-04-18", gender: "male", contact: "+27 74 444 5555", email: "e.okafor@email.com", blood: "AB+", allergies: null, code: "PT-00004", userId: null, idType: "PASSPORT", idNum: "A12345678", nationality: "Nigerian", medAid: null, medAidNum: null },
    { firstName: "Nomsa", lastName: "Dube", dob: "2001-09-30", gender: "female", contact: "+27 65 555 6666", email: null, blood: "O-", allergies: "Latex", code: "PT-00005", userId: null, idType: "SA_ID", idNum: "0109305009083", nationality: "South African", medAid: "Medihelp", medAidNum: "11223344" },
    { firstName: "Pieter", lastName: "Steyn", dob: "1965-01-12", gender: "male", contact: "+27 82 666 7777", email: "p.steyn@email.com", blood: "A-", allergies: "Codeine", code: "PT-00006", userId: null, idType: "SA_ID", idNum: "6501125009082", nationality: "South African", medAid: "Momentum", medAidNum: "55667788" },
    { firstName: "Ayasha", lastName: "Reddy", dob: "1983-06-25", gender: "female", contact: "+27 79 777 8888", email: "a.reddy@email.com", blood: "B+", allergies: null, code: "PT-00007", userId: null, idType: "SA_ID", idNum: "8306255009085", nationality: "South African", medAid: null, medAidNum: null },
    { firstName: "David", lastName: "Molefe", dob: "1970-03-08", gender: "male", contact: "+27 71 888 9999", email: null, blood: "O+", allergies: "Ibuprofen", code: "PT-00008", userId: null, idType: "SA_ID", idNum: "7003085009088", nationality: "South African", medAid: "Discovery Health", medAidNum: "99887766" },
  ];

  const patients: (typeof patientsTable.$inferSelect)[] = [];
  for (const p of patientDefs) {
    const [pat] = await db.insert(patientsTable).values({
      clinicId: clinic.id,
      userId: p.userId,
      patientCode: p.code,
      firstName: p.firstName,
      lastName: p.lastName,
      dateOfBirth: p.dob,
      gender: p.gender,
      contactNumber: p.contact,
      email: p.email,
      bloodType: p.blood,
      allergies: p.allergies,
      governmentIdType: p.idType,
      governmentIdNumber: p.idNum,
      nationality: p.nationality,
      medicalAidName: p.medAid,
      medicalAidNumber: p.medAidNum,
      emergencyContactName: `Emergency Contact of ${p.firstName}`,
      emergencyContactPhone: "+27 81 000 1111",
      status: "active",
    }).returning();
    patients.push(pat);
  }

  // Add portal patient as clinic member
  await db.insert(clinicMembersTable).values({
    clinicId: clinic.id,
    userId: patientUser.id,
    role: "patient",
    status: "active",
  });

  const [zanele, themba, lisa, emmanuel, nomsa, pieter, ayasha, david] = patients;

  // ── 5. Create appointments ────────────────────────────────────────────────
  console.log("Creating demo appointments...");

  const todayAt = (h: number, m = 0) => {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  };

  const appointmentDefs = [
    { patientId: zanele.id, doctorId: doctorUser.id, scheduledAt: todayAt(8, 30), type: "general", status: "completed", visitReason: "Annual check-up", notes: "Patient in good health overall." },
    { patientId: themba.id, doctorId: doctorUser.id, scheduledAt: todayAt(9, 0), type: "general", status: "completed", visitReason: "Hypertension follow-up", notes: "Blood pressure improved with medication." },
    { patientId: lisa.id, doctorId: doctorUser.id, scheduledAt: todayAt(9, 30), type: "general", status: "confirmed", visitReason: "Chronic pain management" },
    { patientId: emmanuel.id, doctorId: doctorUser.id, scheduledAt: todayAt(10, 0), type: "general", status: "scheduled", visitReason: "Flu symptoms" },
    { patientId: nomsa.id, doctorId: doctorUser.id, scheduledAt: todayAt(10, 30), type: "general", status: "scheduled", visitReason: "Post-operative check" },
    { patientId: pieter.id, doctorId: doctorUser.id, scheduledAt: todayAt(11, 0), type: "specialist", status: "scheduled", visitReason: "Cardiology review" },
    { patientId: david.id, doctorId: doctorUser.id, scheduledAt: daysAgo(3), type: "general", status: "completed", visitReason: "Diabetes management" },
    { patientId: ayasha.id, doctorId: doctorUser.id, scheduledAt: daysAgo(5), type: "general", status: "completed", visitReason: "Skin rash consultation" },
    { patientId: zanele.id, doctorId: doctorUser.id, scheduledAt: daysFromNow(7), type: "general", status: "scheduled", visitReason: "Follow-up on blood results" },
    { patientId: themba.id, doctorId: doctorUser.id, scheduledAt: daysFromNow(14), type: "specialist", status: "scheduled", visitReason: "Cardiology referral" },
  ];

  const appointments: (typeof appointmentsTable.$inferSelect)[] = [];
  for (const a of appointmentDefs) {
    const [appt] = await db.insert(appointmentsTable).values({
      clinicId: clinic.id,
      patientId: a.patientId,
      doctorId: a.doctorId,
      scheduledAt: a.scheduledAt,
      type: a.type,
      status: a.status,
      visitReason: a.visitReason ?? null,
      notes: a.notes ?? null,
      durationMinutes: 30,
    }).returning();
    appointments.push(appt);
  }

  // ── 6. Create queue entries for today ─────────────────────────────────────
  console.log("Creating demo queue entries...");

  const queueDefs = [
    { patientId: zanele.id, status: "completed", type: "regular", ticket: "RG-001", completedAt: todayAt(9, 15) },
    { patientId: themba.id, status: "completed", type: "regular", ticket: "RG-002", completedAt: todayAt(9, 45) },
    { patientId: lisa.id, status: "doctor_consultation", type: "regular", ticket: "RG-003" },
    { patientId: emmanuel.id, status: "nurse_assessment", type: "regular", ticket: "RG-004" },
    { patientId: nomsa.id, status: "waiting", type: "regular", ticket: "RG-005" },
    { patientId: pieter.id, status: "waiting", type: "regular", ticket: "RG-006" },
  ];

  const queueEntries: (typeof queueEntriesTable.$inferSelect)[] = [];
  for (const q of queueDefs) {
    const [entry] = await db.insert(queueEntriesTable).values({
      clinicId: clinic.id,
      patientId: q.patientId,
      assignedDoctorId: doctorUser.id,
      status: q.status,
      type: q.type,
      ticketNumber: q.ticket,
      completedAt: q.completedAt ?? null,
      calledAt: q.status !== "waiting" ? todayAt(8, 0) : null,
      priority: q.status === "waiting" ? 1 : 0,
    }).returning();
    queueEntries.push(entry);
  }

  // ── 7. Create consultation notes ──────────────────────────────────────────
  console.log("Creating demo consultation notes...");

  await db.insert(consultationNotesTable).values([
    {
      clinicId: clinic.id,
      patientId: zanele.id,
      doctorId: doctorUser.id,
      queueEntryId: queueEntries[0].id,
      appointmentId: appointments[0].id,
      consultationCode: "CN-00001",
      status: "completed",
      chiefComplaint: "Annual check-up",
      symptoms: "No significant symptoms. Patient reports mild fatigue.",
      diagnosis: "Generally healthy. Mild iron deficiency anaemia suspected.",
      treatmentPlan: "Iron supplementation 200mg daily for 3 months. Repeat FBC in 6 weeks.",
      followUpInstructions: "Return in 6 weeks for blood retest. Increase dietary iron intake.",
      notes: "Patient compliant with medication. Good general health.",
    },
    {
      clinicId: clinic.id,
      patientId: themba.id,
      doctorId: doctorUser.id,
      queueEntryId: queueEntries[1].id,
      appointmentId: appointments[1].id,
      consultationCode: "CN-00002",
      status: "completed",
      chiefComplaint: "Hypertension follow-up",
      symptoms: "Occasional headaches, especially in the morning.",
      diagnosis: "Stage 1 hypertension, improving on Amlodipine 5mg.",
      treatmentPlan: "Continue Amlodipine 5mg daily. DASH diet counselling provided.",
      followUpInstructions: "Monthly BP monitoring. Return in 30 days.",
      notes: "BP reading today: 138/88. Improved from 155/95 last visit.",
    },
    {
      clinicId: clinic.id,
      patientId: lisa.id,
      doctorId: doctorUser.id,
      consultationCode: "CN-00003",
      status: "in_progress",
      chiefComplaint: "Chronic lower back pain",
      symptoms: "Persistent lower back pain, worse in the morning, radiating to left leg.",
      diagnosis: "Lumbar disc herniation L4-L5",
      treatmentPlan: "Physiotherapy referral, NSAIDs, and muscle relaxants.",
    },
  ]);

  // ── 8. Create prescriptions ───────────────────────────────────────────────
  console.log("Creating demo prescriptions...");

  await db.insert(prescriptionsTable).values([
    { clinicId: clinic.id, patientId: zanele.id, doctorId: doctorUser.id, prescriptionCode: "PR-00001", medicationName: "Ferrous Sulphate 200mg", dosage: "200mg", frequency: "Once daily", duration: "3 months", instructions: "Take with food. Avoid tea/coffee within 1 hour.", status: "active" },
    { clinicId: clinic.id, patientId: zanele.id, doctorId: doctorUser.id, prescriptionCode: "PR-00002", medicationName: "Vitamin C 500mg", dosage: "500mg", frequency: "Once daily", duration: "3 months", instructions: "Take with iron tablet to improve absorption.", status: "dispensed", dispensedAt: daysAgo(2), dispensedById: pharmacistUser.id },
    { clinicId: clinic.id, patientId: themba.id, doctorId: doctorUser.id, prescriptionCode: "PR-00003", medicationName: "Amlodipine 5mg", dosage: "5mg", frequency: "Once daily", duration: "Ongoing", instructions: "Take at the same time each day.", status: "active" },
    { clinicId: clinic.id, patientId: david.id, doctorId: doctorUser.id, prescriptionCode: "PR-00004", medicationName: "Metformin 850mg", dosage: "850mg", frequency: "Twice daily with meals", duration: "Ongoing", instructions: "Monitor blood glucose daily.", status: "dispensed", dispensedAt: daysAgo(3), dispensedById: pharmacistUser.id },
    { clinicId: clinic.id, patientId: ayasha.id, doctorId: doctorUser.id, prescriptionCode: "PR-00005", medicationName: "Hydrocortisone Cream 1%", dosage: "Apply thin layer", frequency: "Twice daily", duration: "2 weeks", instructions: "Apply to affected areas. Avoid eyes.", status: "collected", dispensedAt: daysAgo(5), collectedAt: daysAgo(4), dispensedById: pharmacistUser.id },
    { clinicId: clinic.id, patientId: nomsa.id, doctorId: doctorUser.id, prescriptionCode: "PR-00006", medicationName: "Ibuprofen 400mg", dosage: "400mg", frequency: "Three times daily", duration: "5 days", instructions: "Take with food. Do not exceed 3 doses per day.", status: "active" },
  ]);

  // ── 9. Create lab requests ────────────────────────────────────────────────
  console.log("Creating demo lab requests...");

  await db.insert(labRequestsTable).values([
    { clinicId: clinic.id, patientId: zanele.id, doctorId: doctorUser.id, requestCode: "LR-00001", testName: "Full Blood Count (FBC)", testCategory: "blood", urgency: "routine", status: "completed", notes: "Check for anaemia" },
    { clinicId: clinic.id, patientId: zanele.id, doctorId: doctorUser.id, requestCode: "LR-00002", testName: "Iron Studies", testCategory: "blood", urgency: "routine", status: "reported", notes: "Serum ferritin and transferrin" },
    { clinicId: clinic.id, patientId: themba.id, doctorId: doctorUser.id, requestCode: "LR-00003", testName: "Lipid Profile", testCategory: "blood", urgency: "routine", status: "pending", notes: "Cardiovascular risk assessment" },
    { clinicId: clinic.id, patientId: themba.id, doctorId: doctorUser.id, requestCode: "LR-00004", testName: "HbA1c", testCategory: "blood", urgency: "routine", status: "pending", notes: "3-month glucose control" },
    { clinicId: clinic.id, patientId: david.id, doctorId: doctorUser.id, requestCode: "LR-00005", testName: "Fasting Glucose", testCategory: "blood", urgency: "routine", status: "completed", notes: "Diabetes monitoring" },
    { clinicId: clinic.id, patientId: david.id, doctorId: doctorUser.id, requestCode: "LR-00006", testName: "Urine Dipstick", testCategory: "urine", urgency: "routine", status: "in_progress", notes: "Check for microalbuminuria" },
    { clinicId: clinic.id, patientId: pieter.id, doctorId: doctorUser.id, requestCode: "LR-00007", testName: "ECG", testCategory: "cardiac", urgency: "urgent", status: "pending", notes: "Chest pain evaluation" },
    { clinicId: clinic.id, patientId: nomsa.id, doctorId: doctorUser.id, requestCode: "LR-00008", testName: "CRP (Inflammation Marker)", testCategory: "blood", urgency: "routine", status: "pending", notes: "Post-op inflammation check" },
  ]);

  // ── 10. Create invoices + payments ────────────────────────────────────────
  console.log("Creating demo invoices and payments...");

  const invoiceData = [
    { patientId: zanele.id, code: "INV-00001", total: "850.00", paid: "850.00", balance: "0.00", status: "paid" as const, daysBack: 2 },
    { patientId: themba.id, code: "INV-00002", total: "1200.00", paid: "500.00", balance: "700.00", status: "partial" as const, daysBack: 5 },
    { patientId: lisa.id, code: "INV-00003", total: "950.00", paid: "0.00", balance: "950.00", status: "unpaid" as const, daysBack: 1 },
    { patientId: david.id, code: "INV-00004", total: "650.00", paid: "650.00", balance: "0.00", status: "paid" as const, daysBack: 3 },
    { patientId: ayasha.id, code: "INV-00005", total: "450.00", paid: "450.00", balance: "0.00", status: "paid" as const, daysBack: 7 },
    { patientId: nomsa.id, code: "INV-00006", total: "750.00", paid: "0.00", balance: "750.00", status: "unpaid" as const, daysBack: 0 },
    { patientId: pieter.id, code: "INV-00007", total: "1850.00", paid: "0.00", balance: "1850.00", status: "unpaid" as const, daysBack: 0 },
    { patientId: emmanuel.id, code: "INV-00008", total: "550.00", paid: "550.00", balance: "0.00", status: "paid" as const, daysBack: 10 },
  ];

  for (const inv of invoiceData) {
    const [invoice] = await db.insert(invoicesTable).values({
      clinicId: clinic.id,
      patientId: inv.patientId,
      doctorId: doctorUser.id,
      invoiceCode: inv.code,
      totalAmount: inv.total,
      paidAmount: inv.paid,
      balance: inv.balance,
      status: inv.status,
    }).returning();

    await db.insert(invoiceItemsTable).values([
      { invoiceId: invoice.id, type: "consultation", description: "GP Consultation", quantity: 1, unitPrice: "350.00", total: "350.00" },
      { invoiceId: invoice.id, type: "laboratory", description: "Laboratory Tests", quantity: 1, unitPrice: parseFloat(inv.total) > 500 ? "350.00" : "100.00", total: parseFloat(inv.total) > 500 ? "350.00" : "100.00" },
    ]);

    if (parseFloat(inv.paid) > 0) {
      await db.insert(paymentsTable).values({
        invoiceId: invoice.id,
        clinicId: clinic.id,
        amount: inv.paid,
        paymentMethod: "card",
        reference: `REF-${inv.code}`,
        paidAt: daysAgo(inv.daysBack),
      });
    }
  }

  // ── 11. Create inventory ──────────────────────────────────────────────────
  console.log("Creating demo inventory...");

  const inventoryItems = [
    { name: "Amoxicillin 500mg", genericName: "Amoxicillin", category: "medication", unit: "capsules", current: 250, minimum: 50, unitPrice: "2.50", selling: "8.00" },
    { name: "Paracetamol 500mg", genericName: "Paracetamol", category: "medication", unit: "tablets", current: 500, minimum: 100, unitPrice: "0.80", selling: "2.50" },
    { name: "Metformin 850mg", genericName: "Metformin", category: "medication", unit: "tablets", current: 180, minimum: 60, unitPrice: "1.20", selling: "4.00" },
    { name: "Amlodipine 5mg", genericName: "Amlodipine", category: "medication", unit: "tablets", current: 8, minimum: 30, unitPrice: "3.50", selling: "12.00" }, // LOW STOCK
    { name: "Ferrous Sulphate 200mg", genericName: "Ferrous Sulphate", category: "medication", unit: "tablets", current: 120, minimum: 40, unitPrice: "1.10", selling: "3.50" },
    { name: "Surgical Gloves (Box)", genericName: null, category: "consumable", unit: "box", current: 5, minimum: 10, unitPrice: "45.00", selling: "85.00" }, // LOW STOCK
    { name: "Disposable Syringes 5ml", genericName: null, category: "consumable", unit: "pack", current: 25, minimum: 20, unitPrice: "15.00", selling: "30.00" },
    { name: "Ibuprofen 400mg", genericName: "Ibuprofen", category: "medication", unit: "tablets", current: 4, minimum: 50, unitPrice: "1.50", selling: "5.00" }, // LOW STOCK
    { name: "Hydrocortisone Cream 1%", genericName: "Hydrocortisone", category: "medication", unit: "tube", current: 30, minimum: 10, unitPrice: "18.00", selling: "45.00" },
    { name: "Blood Glucose Test Strips", genericName: null, category: "consumable", unit: "box", current: 12, minimum: 15, unitPrice: "80.00", selling: "150.00" }, // LOW STOCK
    { name: "Stethoscope", genericName: null, category: "equipment", unit: "units", current: 3, minimum: 2, unitPrice: "850.00", selling: "0.00" },
    { name: "Bandages (5cm × 4m)", genericName: null, category: "consumable", unit: "roll", current: 40, minimum: 20, unitPrice: "12.00", selling: "25.00" },
  ];

  for (const item of inventoryItems) {
    await db.insert(inventoryItemsTable).values({
      clinicId: clinic.id,
      name: item.name,
      genericName: item.genericName,
      category: item.category,
      unit: item.unit,
      currentStock: item.current,
      minimumStock: item.minimum,
      unitPrice: item.unitPrice,
      sellingPrice: item.selling,
      isActive: true,
    });
  }

  // ── 12. Create activity logs ───────────────────────────────────────────────
  console.log("Creating demo activity logs...");

  await db.insert(activityLogsTable).values([
    { clinicId: clinic.id, userId: adminUser.id, type: "patient_registered", message: "New patient registered: Zanele Sithole (PT-00001)", entityId: zanele.id },
    { clinicId: clinic.id, userId: adminUser.id, type: "patient_registered", message: "New patient registered: Themba Khumalo (PT-00002)", entityId: themba.id },
    { clinicId: clinic.id, userId: adminUser.id, type: "appointment_booked", message: "Appointment booked for Lisa van der Merwe with Dr. Michael Chen", entityId: appointments[2].id },
    { clinicId: clinic.id, userId: nurseUser.id, type: "queue_update", message: "Zanele Sithole moved to completed", entityId: queueEntries[0].id },
    { clinicId: clinic.id, userId: nurseUser.id, type: "queue_update", message: "Lisa van der Merwe moved to doctor consultation", entityId: queueEntries[2].id },
    { clinicId: clinic.id, userId: doctorUser.id, type: "appointment_booked", message: "Appointment completed for Zanele Sithole", entityId: appointments[0].id },
  ]);

  // ── 13. Create notifications ───────────────────────────────────────────────
  console.log("Creating demo notifications...");

  for (const staff of staffUsers) {
    await db.insert(notificationsTable).values([
      { clinicId: clinic.id, userId: staff.id, type: "patient_registered", title: "New Patient Registered", message: "Zanele Sithole has been added to your patient registry.", isRead: false },
      { clinicId: clinic.id, userId: staff.id, type: "general", title: "Welcome to MediCare Demo Clinic", message: "Your demo environment is ready. All features are available for presentation.", isRead: true },
    ]);
  }

  // Appointment notification for doctor
  await db.insert(notificationsTable).values({
    clinicId: clinic.id,
    userId: doctorUser.id,
    type: "appointment",
    title: "Upcoming Appointment",
    message: "Emmanuel Okafor has a scheduled appointment at 10:00 today.",
    isRead: false,
  });

  // Low stock notification for pharmacist
  await db.insert(notificationsTable).values({
    clinicId: clinic.id,
    userId: pharmacistUser.id,
    type: "low_inventory",
    title: "Low Stock Alert",
    message: "Amlodipine 5mg is running low (8 units remaining, minimum: 30).",
    isRead: false,
  });

  // Lab notification
  await db.insert(notificationsTable).values({
    clinicId: clinic.id,
    userId: labUser.id,
    type: "lab_request",
    title: "Urgent Lab Request",
    message: "Pieter Steyn has an URGENT ECG request assigned to your lab.",
    isRead: false,
  });

  console.log("\n✅ Demo seed complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  🏥  Clinic: MediCare Demo Clinic");
  console.log(`  🔑  Join Code: ${DEMO_CLINIC_CODE}`);
  console.log("  🔐  Password for all accounts: Demo@1234");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  STAFF PORTAL (/):");
  console.log("  admin@democlinic.com        → Clinic Admin");
  console.log("  doctor@democlinic.com       → Doctor");
  console.log("  nurse@democlinic.com        → Nurse");
  console.log("  reception@democlinic.com    → Receptionist");
  console.log("  pharmacist@democlinic.com   → Pharmacist");
  console.log("  lab@democlinic.com          → Lab Technician");
  console.log("  cashier@democlinic.com      → Cashier");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
