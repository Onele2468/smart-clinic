# TABLE OF CONTENTS

## PART 1 — Engineering Handbook

1. Purpose

2. Vision

3. Mission

4. Non-Negotiable Principles

5. Engineering Principles

# Configuration Philosophy

Health Nexus maintains one codebase, one Workflow Engine and one AI platform.

Clinic behaviour is determined through configuration rather than duplicated implementations.

Examples of configurable behaviour include:

- Billing
- Appointment Rules
- Queue Rules
- Follow-up Rules
- Reporting
- Notifications
- AI Features
- Payment Providers
This approach reduces maintenance costs, simplifies upgrades and ensures consistent behaviour across all supported organisation types.

---

## PART 2 — System Overview

---

## PART 3 — AI Philosophy

---

## PART 4 — Patient Workflow

---

## PART 5 — AI Reception Assistant

---

## PART 6 — Smart Appointment Engine

---

## PART 7 — Reception Workflow

---

## PART 8 — Queue Management

---

## PART 9 — AI Nurse Assistant

---

## PART 10 — Doctor AI Assistant

---

## PART 11 — Laboratory AI Assistant

---

## PART 12 — Pharmacy AI Assistant

---

## PART 13 — Billing, Financial Responsibility & Payment Integration

---

## PART 14 — Follow-up AI

---

## PART 15 — Analytics & Reporting

---

## PART 16 — Existing System Integration

---

## PART 17 — Database & Supabase Architecture

---

## PART 18 — Ollama AI Architecture

---

## PART 19 — Security & Compliance

---

## PART 20 — API & Integration Standards

---

## PART 21 — Development & Testing Standards

---

## PART 22 — Codex Implementation Guide




# HEALTH NEXUS ENGINEERING HANDBOOK

Version: 2.0

Status: Active Development

---

# Purpose

This handbook defines the architecture, engineering principles, workflows, AI behaviour, security standards and implementation rules for the Health Nexus platform.

Every developer and every AI coding assistant must read this document before modifying the system.

This document is the single source of truth for Health Nexus.

If implementation conflicts with this handbook, the handbook takes precedence.

---

# Vision

Health Nexus is an AI-assisted healthcare platform that enables healthcare organisations to manage patients from the first interaction through to follow-up care.


Health Nexus supports:

Health Nexus supports multiple healthcare organisations through a single configurable platform.

Organisation types may include:

- Private Clinics
- Government Clinics
- NGO / Community Clinics
- Future Organisation Types

All organisations use the same Workflow Engine.

Differences between organisations are controlled through Clinic Configuration, Feature Flags, Role-Based Access Control (RBAC), and business rules rather than separate workflow implementations.

---

# Mission

Create an intelligent healthcare platform where Artificial Intelligence reduces administrative work while healthcare professionals remain responsible for all clinical decisions.

The system should improve:

- patient experience
- staff productivity
- communication
- scheduling
- reporting
- workflow efficiency
- clinical documentation

without replacing healthcare professionals.

---

# NON-NEGOTIABLE PRINCIPLES

These principles apply to every feature within Health Nexus.

1. AI assists. Humans decide.

2. Never break existing functionality.

3. Reuse before creating.

4. One Global Person Identity with separate clinic-owned medical records.

5. One appointment engine.

6. One queue engine.

7. One notification system.

8. Protect patient privacy.

9. Respect Row Level Security.

10. Every change must be auditable.

11. The patient journey always comes first.

12. Health Nexus is workflow-driven, not screen-driven.

13. A person may receive care at multiple clinics within Health Nexus.

14. Every clinic owns and protects its own medical records.

15. AI conversations are isolated per clinic by default.

16. Cross-clinic information sharing requires explicit patient consent.

17. The Workflow Engine, Capability Engine, Referral Engine, Context Engine and AI Engine work together to determine every patient journey.

18. Clinic behaviour is determined by configuration, not by creating separate systems.

# Core Philosophy

Health Nexus is built around one principle:

AI Assists.

Humans Decide.

Artificial Intelligence exists to improve healthcare workflows.

Artificial Intelligence never replaces healthcare professionals.

---

# Human Responsibilities

Reception Staff

- verify patients
- manage queues
- assist walk-in patients
- override appointments

Nurses

- perform assessments
- record vitals
- triage patients

Doctors

- diagnose
- prescribe
- refer
- approve treatment plans

Laboratory Staff

- perform tests
- validate results

Pharmacists

- dispense medication
- verify prescriptions

Administrators

- manage clinics
- configure settings
- manage users

---

# AI Responsibilities

Reception AI

Appointment AI

Queue AI

Nurse AI

Doctor AI Assistant

Laboratory AI Assistant

Pharmacy AI Assistant

Billing AI

Analytics AI

Notification AI

Every AI module assists staff.

None replace professional judgement.

---

# Engineering Principles

Never rewrite working functionality.

Extend existing modules.

Reuse existing database tables whenever possible.

Reuse existing APIs whenever possible.

Maintain backwards compatibility.

Protect patient information.

Respect Row Level Security.

Audit all sensitive operations.

Prefer modular services.

Prefer reusable components.

Keep business logic inside backend services.

Avoid duplicated logic.

Configuration Before Customization

Health Nexus should favour configuration over code duplication.

Features should be enabled or disabled through Clinic Settings rather than creating separate workflows.

The Workflow Engine must remain identical across all organisation types.

---

# Technology Stack

Frontend

React
TypeScript
Vite

Backend

Node.js

Express Services

Supabase Edge Functions (where applicable)

Workflow Engine

Service Layer

Database

Supabase
PostgreSQL

AI

Ollama

Messaging

WhatsApp Cloud API

Payments

Yoco

---

This handbook is supported by the chapter documents contained in the docs folder.

Each chapter expands one area of the platform in detail.

# CHAPTER 1 — SYSTEM OVERVIEW

Version: 2.0

---

# Introduction

Health Nexus is a comprehensive AI-assisted healthcare management platform designed to help healthcare organisations deliver efficient, secure and patient-centred care.

The platform manages the complete patient journey from the first interaction through WhatsApp, arrival at the clinic, consultation, laboratory services, pharmacy, billing and post-visit follow-up.

Health Nexus is designed to improve healthcare delivery by reducing administrative workload while ensuring healthcare professionals remain responsible for all clinical decisions.

---

# Supported Organisation Types

Health Nexus supports multiple healthcare organisation types through a single configurable platform.

Organisation types include:

- Private Clinics
- Government Clinics
- NGO Clinics

The organisation type loads a predefined Clinic Configuration Profile.

Clinic Configuration determines:

- Enabled modules
- Billing behaviour
- Payment providers
- Appointment policies
- Queue policies
- Reporting requirements
- AI behaviour
- Notification preferences

The underlying Workflow Engine remains identical for every organisation.

Health Nexus must never maintain separate codebases for different organisation types.

---

# Core Objectives

Health Nexus aims to:

- Improve patient experience.
- Reduce waiting times.
- Improve staff productivity.
- Reduce paperwork.
- Improve communication.
- Improve appointment scheduling.
- Improve reporting.
- Improve patient safety.
- Improve operational efficiency.

Artificial Intelligence is used to assist these objectives but never replaces healthcare professionals.

---

# Primary Users

Health Nexus supports the following users.

## Patients

Patients interact with the clinic using:

- WhatsApp
- Reception
- Follow-up notifications

Patients can:

- Register
- Verify identity
- Book appointments
- Cancel appointments
- Reschedule appointments
- Receive reminders
- Receive invoices
- Pay invoices
- Receive follow-up messages

---

## Reception Staff

Reception staff manage:

- Walk-in patients
- Patient 
## Transition to Adulthood

Patients registered as children remain within the same patient profile.

When a patient turns eighteen years old, Health Nexus should encourage updating the patient profile.

The AI may ask the patient to provide:

- South African ID Number
- Passport Number

The existing medical history must remain unchanged.

No duplicate patient profile should ever be created because the patient reached adulthood.
- Queue management
- Appointment verification
- Identity verification
- Human handover from AI
- Manual appointment overrides

---

## Nurses

Nurses perform:

- Patient triage
- Vital signs
- Clinical assessments
- Queue progression
- Escalation to doctors

Nurses remain responsible for all assessments.

---

## Doctors

Doctors perform:

- Consultations
- Diagnosis
- Treatment plans
- Prescriptions
- Laboratory requests
- Referrals
- Follow-up instructions

Doctor AI assists but never diagnoses independently.

---

## Laboratory Staff

Laboratory staff:

- Receive laboratory requests
- Process samples
- Validate results
- Publish results

Laboratory AI assists documentation and workflow only.

---

## Pharmacists

Pharmacists:

- Review prescriptions
- Dispense medication
- Verify medication availability
- Counsel patients

Pharmacy AI assists inventory checks and recommendations.

---

## Billing Staff (where applicable)

Billing staff manage:

- Invoices
- Outstanding balances
- Refunds
- Financial reporting

When Yoco is enabled, many payments can occur digitally, but staff retain the ability to manage payments manually if required.

---

## Clinic Administrators

Clinic administrators manage:

- Staff
- Roles
- Permissions
- Departments
- Clinic configuration
- AI settings
- Working hours
- Organisation settings
- Reporting

---

# Core Modules

Health Nexus consists of integrated modules rather than isolated systems.

Current modules include:

- Authentication
- Patient Management
- WhatsApp
- AI Reception
- Appointments
- Queue Management
- Nurse Workflow
- Doctor Workflow
- Laboratory
- Pharmacy
- Billing
- Notifications
- Analytics
- Reporting
- Administration

Each module communicates with the others through shared services and APIs.

---

# Platform Principles

Health Nexus follows these principles:

- One Global Person Identity with clinic-owned medical records.
- One appointment engine.
- One queue engine.
- One notification system.
- One billing engine.
- One AI platform.
- One Workflow Engine
-One Clinic Configuration System

Avoid duplicate implementations.

Reuse existing services whenever possible.

---

# High-Level Patient Journey

The standard patient journey is:

Patient

↓

WhatsApp AI Reception

↓

Patient Verification

↓

Smart Appointment Engine

↓

Reception

↓

Queue

↓

AI Nurse Assistant

↓

Human Nurse

↓

Doctor AI Assistant

↓

Human Doctor

↓

Laboratory (Optional)

↓

Doctor Review (If Required)

↓

Pharmacy (Optional)

↓

Invoice

↓

Yoco Payment

↓

AI Follow-up

↓

Journey Complete

Future chapters describe each stage in detail.

# CHAPTER 2 — AI PHILOSOPHY

Version: 2.0

---

# Introduction

Artificial Intelligence is a core component of Health Nexus.

Its purpose is to reduce administrative work, improve patient experience and assist healthcare professionals.

AI exists to support healthcare workers.

AI never replaces healthcare workers.

---

# Core Principle

Health Nexus follows one rule above all others:

## AI Assists. Humans Decide.

Every AI component must be designed around this philosophy.

Artificial Intelligence may:

- Recommend
- Analyse
- Predict
- Summarise
- Automate repetitive work
- Assist decision making

Artificial Intelligence must never replace qualified healthcare professionals.

---

# Human Authority

The following decisions always belong to humans.

## Reception Staff

Reception staff remain responsible for:

- Walk-in patients
- Identity disputes
- Appointment overrides
- Queue overrides
- Patient complaints
- Escalations

---

## Nurses

Nurses remain responsible for:

- Triage
- Vital signs
- Clinical observations
- Patient assessment

AI may suggest questions or highlight abnormal vitals but never performs the assessment itself.

---

## Doctors

Doctors remain responsible for:

- Diagnosis
- Prescriptions
- Referrals
- Medical certificates
- Treatment plans
- Follow-up decisions

Doctor AI provides clinical assistance only.

Every recommendation must be reviewed by the doctor.

---

## Laboratory Staff

Laboratory staff remain responsible for:

- Sample collection
- Sample validation
- Result verification
- Result publication

AI assists with workflow and interpretation support.

---

## Pharmacists

Pharmacists remain responsible for:

- Dispensing medication
- Checking prescriptions
- Patient counselling
- Medication verification

AI may identify interactions or shortages but never authorises dispensing.

---

# AI Modules

Health Nexus AI is divided into specialised assistants.

## Reception AI

Responsibilities:

- Natural conversation
- Patient verification
- Registration
- Appointment requests
- Clinic information
- FAQs
- Human handover
- Emergency detection

---

## Appointment AI

Responsibilities:

- Smart scheduling
- Doctor availability
- Queue prediction
- Appointment optimisation
- No-show prediction
- Wait time estimation

---

## Nurse AI

Responsibilities:

- Assessment assistance
- Vital sign analysis
- Risk alerts
- Clinical summaries
- Suggested documentation

---

## Doctor AI Assistant

Responsibilities:

- Consultation summaries
- Differential diagnosis suggestions
- Clinical guideline reminders
- Prescription assistance
- Referral suggestions
- Follow-up recommendations

Doctor AI never produces a final diagnosis independently.

---

## Laboratory AI

Responsibilities:

- Lab workflow assistance
- Result organisation
- Trend analysis
- Flag abnormal values
- Suggest repeat testing

---

## Pharmacy AI

Responsibilities:

- Drug interaction checks
- Allergy alerts
- Inventory recommendations
- Alternative medication suggestions

---

## Billing AI

Responsibilities:

- Invoice generation
- Payment reminders
- Outstanding balance tracking
- Financial insights

---

## Analytics AI

Responsibilities:

- Dashboard insights
- Operational reports
- Predictive analytics
- Queue forecasting
- Staff workload analysis

---

# AI Safety Rules

Artificial Intelligence must never:

- Diagnose independently
- Prescribe medication independently
- Dispense medication
- Ignore emergencies
- Expose patient data
- Override clinical decisions
- Ignore permissions
- Ignore Row Level Security

---

# Explainable AI

Every recommendation generated by AI should include an explanation where appropriate.

Healthcare professionals should understand why a recommendation was made.

---

# Confidence Levels

AI responses should internally support confidence scoring.

Example:

High Confidence

Medium Confidence

Low Confidence

Low confidence recommendations should encourage human review.

---

# Privacy

AI must follow all Health Nexus security rules.

Patient information must remain confidential.

Every AI interaction should respect:

- Clinic boundaries
- Organisation boundaries
- User permissions
- Role permissions
- Row Level Security
- Audit logging

---

# Continuous Learning

Health Nexus AI should improve through:

- Better prompts
- Workflow improvements
- Configuration updates

The AI must never train itself directly from patient data.

Patient information must never be used for uncontrolled model training.

---

This philosophy applies to every AI module implemented within Health Nexus.


---

# PART 4 — COMPLETE PATIENT WORKFLOW

## Overview

The patient workflow is the foundation of Health Nexus.

Every module within the platform exists to support this workflow.

Artificial Intelligence does not replace this workflow.

Artificial Intelligence enhances this workflow.

Every staff member continues performing their professional responsibilities while AI assists them throughout the patient's journey.

The Workflow Engine remains consistent across:

- Private Clinics
- Government Clinics
- NGO Clinics
- Other supported organisation types

The actual patient journey may vary according to:

- Clinic Configuration
- Clinic Capabilities
- Available Departments
- Service Availability
- Appointment Policies
- Queue Policies
- Financial Configuration
- Clinical Decisions
- Referral Requirements
- Organisation Policies

The Workflow Engine remains the central controller and uses configuration and capability information to determine the patient's valid next step.

Different clinics may therefore provide different patient journeys while using the same Workflow Engine and underlying platform architecture.

---

# Complete Patient Journey

```
Patient

↓

WhatsApp

↓

AI Reception Assistant

↓

Patient Verification

↓

Smart Appointment Engine

↓

Appointment Confirmed

↓

Reception Check-in

↓

Queue Management

↓

AI Nurse Assistant

↓

Human Nurse Assessment

↓

Doctor Queue

↓

Doctor AI Assistant

↓

Human Doctor Consultation

↓

Decision Point

────────────────────────────────

Does the patient require Laboratory?

YES

↓

Laboratory Queue

↓

Laboratory AI Assistant

↓

Human Laboratory Staff

↓

Results Available

↓

Automatically Return Patient
to Doctor Queue

↓

Doctor Reviews Results

────────────────────────────────

Does the patient require Medication?

YES

↓

Pharmacy Queue

↓

Pharmacy AI Assistant

↓

Human Pharmacist

↓

Medication Dispensed

────────────────────────────────

Financial Assessment
↓

Determine Financial Responsibility
↓

┌──────────────────────────────┐
│ Patient Payment              │
│ Medical Aid / Insurance      │
│ Patient Co-payment           │
│ Government Funding           │
│ NGO / Donor / Sponsor        │
│ Clinic-funded                │
│ Payment Arrangement          │
│ No Charge                    │
└──────────────────────────────┘

↓

Financial Processing
↓

Financial Requirement Resolved
↓

Workflow Engine

↓

Next Workflow Stage

↓

Follow-up AI

↓

Patient Journey Complete
```

---

# Workflow Principles

Health Nexus is workflow-driven.

The software controls patient movement through the clinic.

Staff should never manually remember the next department.

Instead the workflow engine determines the next step automatically.

Example:

Doctor requests Laboratory.

↓

Health Nexus automatically moves the patient into the Laboratory Queue.

↓

Laboratory completes testing.

↓

Health Nexus automatically returns the patient to the Doctor Queue.

↓

Doctor reviews laboratory results.

↓

Doctor decides whether:

- Discharge
- Pharmacy
- Referral
- Additional Laboratory

---

# Consultation Completion Rules

A consultation must NEVER be completed if:

- Laboratory work is still pending.

- Pharmacy dispensing is still pending.

- Required billing has not been completed (where applicable).

The "Complete Consultation" action must only become available when every required workflow has finished.

This prevents incomplete patient journeys.

---

# Optional Departments

Not every patient visits every department.

Health Nexus dynamically builds each patient's workflow.

Example:

Patient A

Reception

↓

Nurse

↓

Doctor

↓

Discharge

Patient B

Reception

↓

Nurse

↓

Doctor

↓

Laboratory

↓

Doctor Review

↓

Pharmacy

↓

Billing

↓

Complete

Each workflow is generated according to the doctor's clinical decisions.

---

# Workflow Ownership

Each stage has a responsible human professional.

AI assists only.

| Stage | Human Responsible | AI Assistant |
|--------|-------------------|-------------|
| Reception | Reception Staff | AI Reception Assistant |
| Registration | Reception Staff | AI Reception Assistant |
| Appointments | Reception Staff | Appointment AI |
| Queue | Reception Staff | Queue Intelligence |
| Nurse Assessment | Nurse | AI Nurse Assistant |
| Consultation | Doctor | Doctor AI Assistant |
| Laboratory | Laboratory Staff | Laboratory AI Assistant |
| Pharmacy | Pharmacist | Pharmacy AI Assistant |
| Billing | Billing Staff | Billing AI |
| Follow-up | Patient | Follow-up AI |

---

# Workflow Engine

Health Nexus contains one Workflow Engine.

Responsibilities include:

- Move patients between departments.
- Update queue status.
- Update patient status.
- Generate notifications.
- Notify staff.
- Notify patients.
- Prevent invalid workflow transitions.
- Audit every movement.

The Workflow Engine is the central controller of Health Nexus.

Every module communicates with the Workflow Engine rather than directly moving patients between departments.

---

# Workflow States

Every patient visit progresses through clearly defined workflow states.

Example:

Appointment Requested

↓

Appointment Confirmed

↓

Checked In

↓

Waiting For Nurse

↓

Nurse Assessment

↓

Waiting For Doctor

↓

Doctor Consultation

↓

Waiting For Laboratory

↓

Laboratory Processing

↓

Waiting For Doctor Review

↓

Waiting For Pharmacy

↓

Waiting For Payment

↓

Completed

↓

Follow-up

These workflow states must be auditable and traceable.

---

# Artificial Intelligence Within The Workflow

Artificial Intelligence participates throughout the workflow.

AI assists with:

- Conversations
- Verification
- Scheduling
- Queue prediction
- Triage support
- Clinical summaries
- Laboratory summaries
- Prescription safety checks
- Billing assistance
- Follow-up communication

AI never independently changes the clinical outcome.

Only authorised healthcare professionals make clinical decisions.

---

# End of Part 4

The following section defines the AI Reception Assistant in detail.


---

# PART 5 — AI RECEPTION ASSISTANT

## Overview

The AI Reception Assistant is the first point of contact between patients and Health Nexus.

It replaces the traditional menu-driven WhatsApp chatbot with a natural conversational assistant.

Patients should feel as though they are communicating with a professional receptionist rather than a computer.

The AI Reception Assistant operates twenty-four hours a day and assists patients before, during and after their visit.

The AI Reception Assistant never replaces Reception Staff.

Its purpose is to reduce administrative work while improving the patient experience.

---

# Objectives

The AI Reception Assistant must:

- Welcome patients.
- Understand natural language.
- Verify patient identity.
- Register new patients.
- Book appointments.
- Cancel appointments.
- Reschedule appointments.
- Answer clinic questions.
- Explain clinic services.
- Detect emergencies.
- Escalate conversations to Reception Staff.
- Maintain conversation memory.
- Send reminders.
- Assist patients after consultation.

---

# Responsibilities

The AI Reception Assistant is responsible for:

## Clinic Awareness

The AI Reception Assistant must always know which clinic it belongs to.

Health Nexus is a multi-clinic platform.

The AI must never use hardcoded information.

Every conversation must begin by identifying the clinic associated with the WhatsApp number or communication channel.

The AI must automatically load the clinic configuration before responding to the patient.

Clinic configuration includes:

- Clinic Name
- Organisation Type
- Clinic Address
- GPS Location
- Contact Numbers
- WhatsApp Number
- Email Address
- Working Days
- Opening Hours
- Closing Hours
- Public Holiday Schedule
- Departments Available
- Doctors
- Nurses
- Laboratory Availability
- Pharmacy Availability
- Billing Configuration
- Accepted Medical Aid Providers
- Consultation Fees
- Languages Supported
- Emergency Contact Information
- Appointment Rules
- Queue Configuration
- Yoco Payment Configuration
- Feature Flags
-Billing Enabled
-Laboratory Enabled
-Pharmacy Enabled
-Follow-up Enabled
-WhatsApp Enabled
-AI Enabled
-Appointment Enabled
-Queue Rules
-Reporting Rules

-Every answer given by the AI must use the clinic configuration.

Example:

Patient:

"What time do you close?"

The AI should respond using that clinic's configured operating hours rather than a hardcoded answer.

Patient:

"Do you have a pharmacy?"

The AI should check whether Pharmacy is enabled for the current clinic.

Patient:

"How much is a consultation?"

The AI should retrieve the consultation fee from the clinic configuration.

The AI Reception Assistant must always operate within the context of the current clinic.

## Patient Communication

Communicate professionally.

Use friendly language.

Avoid medical jargon.

Keep responses short.

Always guide the patient.

Never overwhelm the patient.

---

# Identity & Relationship Verification

## Supported Patient Types

Health Nexus supports multiple patient types.

### Adult Patient

Identity may be verified using:

- South African ID Number
- Passport Number

### Child Patient

Children may not have a South African ID.

Children may be registered using:

- Birth Certificate Number
- Hospital Record Number
- Temporary Patient Number

Every child must be linked to a responsible guardian.

### Newborn

Newborn patients may initially be registered using:

- Hospital Number
- Date of Birth
- Mother's Details

No South African ID is required.

### Foreign National

Identity may be verified using:

- Passport
- Refugee Documentation
- Permit Number

Health Nexus must support all patient types without changing the workflow.

Sensitive actions require identity verification.

Examples include:

- Booking appointments
- Cancelling appointments
- Rescheduling appointments
- Viewing appointments
- Viewing invoices
- Viewing prescriptions
- Viewing laboratory results

Verification Process

Step 1

Identify patient using WhatsApp number.

Step 2

Ask for ONE of the following:

• Last four digits of South African ID Number

OR

• South African ID Number

OR

• Last four digits of Passport Number

OR

Passport Number

If verification fails:

- Stop the workflow.
- Inform the patient.
- Log the failed verification.
- Do not expose patient information.

---

# New Patient Registration

If the phone number does not exist:

Collect:

- First Name
- Surname
- Date of Birth
- Gender
- South African ID Number
  OR
  Passport Number
- Phone Number
- Emergency Contact
- Email (optional)
- Address (optional)
- Preferred Language
- Medical Aid (optional)

After successful registration:

- Create patient profile.
- Link WhatsApp number.
- Generate Patient Number.
- Welcome patient.
- Offer appointment booking.

---

# Conversation Style

The AI Reception Assistant should sound professional, respectful and friendly.

Example:

Patient:

Hello

AI:

Hello 👋

Welcome to Health Nexus.

I'm your virtual clinic assistant.

How may I assist you today?

---

Patient:

I've had headaches for two days.

AI:

I'm sorry to hear that.

I'll ask a few questions so we can determine the most appropriate appointment for you.

---

Patient:

I want to cancel my appointment.

AI:

Certainly.

Before I continue, I need to verify your identity.

Please enter your South African ID Number or Passport Number. or the last four digits.

---

## Family Accounts

One verified guardian may manage multiple dependants.

Example

Guardian

↓

Onele

Dependants

↓

Siya

↓

Emma

↓

Ayanda

When booking appointments, the AI should first determine who requires medical care.

Example

AI:

"Who is this appointment for?"

- Yourself
- Siya
- Emma
- Ayanda

The selected patient becomes the active patient for the remainder of the conversation.

All bookings, prescriptions, laboratory requests and invoices should be associated with the selected patient rather than the guardian.

# Conversation Memory

The AI should remember information throughout the conversation.

Example

Patient:

I have a headache.

Later:

Also dizziness.

Later:

I've had symptoms for three days.

The AI should remember all previous information and avoid asking the same questions again.

Conversation memory should persist for the current patient interaction.

---

# Intent Detection

The AI should understand patient intent without requiring menu selections.

Supported intents include:

- Appointment Booking
- Appointment Cancellation
- Appointment Rescheduling
- General Clinic Questions
- Patient Registration
- Billing Questions
- Medication Questions
- Laboratory Questions
- Directions
- Opening Hours
- Doctor Availability
- Emergency Symptoms
- Follow-up Questions
- Human Assistance

Natural language should always be preferred over numbered menus.

---

# Frequently Asked Questions

The AI should answer common questions including:

- Clinic location
- Opening hours
- Consultation fees
- Medical Aid acceptance
- Available services
- Available doctors
- Contact information
- Parking information
- Required documents

Responses should use clinic configuration data where available.

---

# Human Handover

The AI must immediately transfer conversations when:

- The patient requests Reception Staff.
- The AI cannot confidently answer.
- The patient becomes frustrated.
- The patient reports a complaint.
- The conversation requires human judgement.

The patient should always be informed that they are being transferred.

---

# Emergency Detection

The AI must continuously monitor conversations for emergency symptoms.

Examples include:

- Chest pain
- Difficulty breathing
- Stroke symptoms
- Severe allergic reactions
- Heavy bleeding
- Loss of consciousness

If detected:

- Stop appointment booking.
- Advise the patient to seek immediate emergency care.
- Notify Reception if configured.
- Create an emergency audit log.

The AI must never attempt to diagnose emergency conditions.

---

# Appointment Requests

The AI Reception Assistant never creates appointments directly.

Instead it:

- Collects the reason for the visit.
- Determines urgency.
- Verifies patient identity.
- Sends the request to the Smart Appointment Engine.

The Appointment Engine determines the most appropriate appointment.

---

# AI Guardrails

The AI Reception Assistant must never:

- Diagnose illnesses.
- Prescribe medication.
- Promise appointment availability.
- Override clinic schedules.
- Expose patient information.
- Ignore permissions.
- Ignore Row Level Security.
- Ignore audit logging.

---

# Integration Requirements

The AI Reception Assistant must integrate with:

- WhatsApp Cloud API
- ConversationAI
- Existing Notification Service
- Existing Appointment Service
- Existing Authentication
- Existing Queue System
- Existing Patient Records
- Existing Audit Logs
- Existing Ollama Service

No existing functionality should be replaced.

Existing services should be extended where appropriate.

---

# Acceptance Criteria

The AI Reception Assistant is complete when:

✓ Patients can chat naturally.

✓ Identity verification works.

✓ New patient registration works.

✓ Returning patient verification works.

## Guardian Verification

The person communicating on WhatsApp is not always the patient.

The AI must determine:

- Who is sending the message?
- Who requires medical care?
- Does the sender have permission to act for the patient?

Examples include:

- Parent booking for child.
- Guardian booking for dependant.
- Caregiver assisting an elderly patient.

The AI must verify the guardian before performing sensitive actions.

The patient profile should remain linked to the guardian while preserving the patient's own medical history.

✓ Conversation memory works.

✓ Emergency detection works.

✓ Human handover works.

✓ Appointment requests are forwarded to the Appointment Engine.

✓ Existing WhatsApp functionality remains operational.

✓ No existing workflows are broken.

---

---

# PART 6 — SMART APPOINTMENT ENGINE

## Overview

The Smart Appointment Engine is responsible for intelligently managing all patient appointments across Health Nexus.

Unlike traditional booking systems that simply assign the next available time slot, the Smart Appointment Engine evaluates multiple factors before recommending or confirming an appointment.

Its purpose is to reduce waiting times, balance staff workload, improve patient experience and maximise clinic efficiency.

The Appointment Engine works together with:

- AI Reception Assistant
- Reception Staff
- Queue Management
- Nurse Workflow
- Doctor Workflow
- Billing
- Notifications
- Follow-up AI

The Appointment Engine does not replace Reception Staff.

It assists them.

---

# Objectives

The Appointment Engine must:

- Book appointments.
- Reschedule appointments.
- Cancel appointments.
- Predict waiting times.
- Balance doctor workload.
- Prevent overbooking.
- Prioritise emergency patients.
- Manage follow-up appointments.
- Recommend the most suitable appointment.
- Notify patients automatically.

---

# Appointment Sources

Appointments may originate from:

- WhatsApp AI
- Reception Staff
- Walk-in Patients
- Follow-up Visits
- Doctor Referrals
- Laboratory Follow-up
- Pharmacy Follow-up
- Administrator Booking

All appointment requests must pass through the Appointment Engine.

---

# Appointment Types

The Appointment Engine must support:

- New Consultation
- Follow-up Consultation
- Emergency Consultation
- Child Consultation
- Vaccination
- Chronic Medication Review
- Laboratory Review
- Pharmacy Review
- Specialist Referral
- Medical Certificate Review
- Virtual Consultation (future)

The appointment type influences scheduling priority.

---

# Scheduling Intelligence

---

# Doctor Availability

The Appointment Engine must always know which doctors are available.

Each doctor must have a configurable schedule.

Doctor schedules include:

- Working Days
- Working Hours
- Lunch Breaks
- Public Holidays
- Leave
- Training
- Sick Leave
- Emergency Unavailability

Example

Dr. Smith

Monday
08:00 - 16:00

Tuesday
08:00 - 16:00

Wednesday
OFF

Thursday
08:00 - 16:00

Friday
08:00 - 13:00

Saturday
OFF

Sunday
OFF

The AI must never book appointments outside the doctor's configured availability.

If the selected doctor is unavailable, the AI should explain why and recommend the next available appointment or another suitable doctor.

---

# Doctor Leave Management

Doctors may become unavailable because of:

- Annual Leave
- Sick Leave
- Training
- Public Holiday
- Emergency Leave

When a doctor becomes unavailable:

The Appointment Engine must:

- Cancel affected appointment slots.
- Notify Reception.
- Notify affected patients.
- Recommend alternative appointments.
- Recommend another doctor when appropriate.

Patients should never arrive at the clinic without knowing their doctor is unavailable.

The Appointment Engine must evaluate:

- Doctor availability.
- Doctor speciality.
- Working hours.
- Lunch breaks.
- Existing appointments.
- Queue length.
- Average consultation duration.
- Emergency appointments.
- Follow-up priority.
- Patient preferences.
- Clinic operating hours.

The Appointment Engine should recommend the most appropriate appointment rather than simply assigning the next available slot.

---



# Urgent Appointment Escalation

The Appointment Engine must recognise when a patient's symptoms suggest that waiting may not be appropriate.

Examples include:

- Chest pain
- Difficulty breathing
- Severe abdominal pain
- Heavy bleeding
- High fever in infants
- Stroke symptoms
- Loss of consciousness
- Severe allergic reactions
 Loss of consciousness
When an urgent case is detected:

1. Do not wait for the patient's Primary Doctor.
2. Check for another available qualified doctor within the clinic.
3. If another doctor is available, recommend the earliest emergency consultation.
4. Notify Reception and the clinical team.
5. If no doctor is available, advise the patient to seek immediate emergency medical care and provide the appropriate emergency contact information according to the clinic's configuration.

The AI must never delay urgent care because a preferred doctor is unavailable.

Patient safety always takes priority over doctor preference.


If a patient's symptoms suggest that immediate medical attention is required, the Appointment Engine must not delay treatment because a preferred doctor is unavailable.


The Appointment Engine should:

1. Check for another available qualified doctor.
2. Notify Reception.
3. Notify the clinical team.
4. Prioritise the patient according to emergency rules.
5. If no doctor is available, advise the patient to seek emergency medical care using the clinic's configured emergency information.

The AI must never encourage a patient with potentially serious symptoms to wait simply because their preferred doctor is unavailable.

# Queue Awareness

## Live Queue Prediction

The Appointment Engine should integrate with the live queue.

Every appointment should calculate:

- Current Queue Position
- Estimated Waiting Time
- Number of Patients Ahead
- Average Consultation Duration
- Doctor Delays

Example

Appointment Time

09:00

Current Queue Position

7

Patients Ahead

6

Estimated Consultation

09:35

The estimated consultation time should automatically update as the queue changes.

---

# Queue Position Notifications

Patients should always know their position in the queue.

Examples

"Your appointment has been confirmed."

"You are currently number 4 in today's queue."

"There are 3 patients ahead of you."

"Estimated consultation time: 10:20."

As the queue changes, the AI should automatically send updates when appropriate.

Examples

"You are now number 2."

"The doctor is running approximately 15 minutes behind schedule."

"Please make your way to Reception."

The system should avoid sending excessive notifications while still keeping patients informed.

---

# Smart Arrival Guidance

The Appointment Engine should help patients avoid unnecessary waiting at the clinic.

Using live queue information, consultation duration estimates and current workflow status, the AI should recommend the best time for the patient to arrive.

Example

Appointment Time

10:00

Current Queue Position

8

Estimated Consultation Time

10:45

AI Response

Your appointment has been confirmed.

Based on today's queue, we recommend arriving at the clinic around 10:30.

You are currently number 8 in the queue.

Estimated consultation time is approximately 10:45.

If the queue changes significantly, we will notify you automatically.

The AI should continuously update the estimated arrival time as the live queue changes.

# Queue Priority Rules

The Appointment Engine should normally follow a First Come, First Served approach.

Patients who book earlier receive earlier queue positions.

Exceptions include:

- Emergency Patients
- Doctor Approved Priority Cases
- Scheduled Follow-up Reviews
- Clinic Configured Priority Rules

Every priority adjustment must be recorded in the audit log.

The AI must never silently move patients ahead of others without an authorised reason.

Appointments should consider the current clinic queue.

Example

Doctor A

Current Queue

32 Patients

Doctor B

Current Queue

8 Patients

If clinically appropriate, the Appointment Engine should recommend Doctor B to reduce patient waiting time.

---

# Follow-up Appointments

Doctors may request follow-up appointments.

Examples:

- Review laboratory results.
- Monitor blood pressure.
- Repeat medication.
- Review chronic conditions.
- Pregnancy follow-up.

The Appointment Engine should prioritise doctor-requested follow-up appointments.

---

# Walk-in Patients

Reception Staff may register walk-in patients.

The Appointment Engine should:

- Determine whether the patient requires an appointment.
- Insert the patient into the appropriate queue.
- Predict expected waiting time.
- Notify Reception of queue impact.

---

# Emergency Appointments

Emergency patients always receive highest priority.

Emergency appointments bypass standard scheduling rules.

The Appointment Engine must:

- Notify Reception.
- Notify Nurses.
- Notify Doctors.
- Update Queue Priority.
- Create an Emergency Audit Log.

---

# Appointment Verification

Sensitive appointment actions require identity verification.

Examples:

- Cancellation
- Rescheduling
- Appointment Details

Verification should follow the Identity & Relationship Verification rules defined in Part 5.

---

# Appointment Statuses

Appointments move through defined states:

Requested

↓

Pending Verification

↓

Confirmed

↓

Reminder Sent

↓

Patient Checked In

↓

Waiting for Nurse

↓

Waiting for Doctor

↓

Completed

↓

Follow-up Required

or

Cancelled

Every state change must be recorded.

---

# Automatic Notifications

The Appointment Engine should automatically send notifications when:

- Appointment Confirmed.
- Appointment Cancelled.
- Appointment Rescheduled.
- Reminder Before Appointment.
- Patient Running Late.
- Doctor Running Late.
- Clinic Closed.
- Follow-up Required.



Notifications may be delivered through:

- WhatsApp
- SMS (future)
- Email (future)
- Push Notifications (future)

---

# Appointment Confirmation Message

When an appointment has been successfully booked, the Appointment Engine should generate a personalised confirmation message using real-time clinic information.

The confirmation should include:

- Patient Name
- Clinic Name
- Doctor Name
- Appointment Date
- Appointment Time
- Queue Position
- Estimated Consultation Time
- Recommended Arrival Time
- Documents Required
- Available Actions

Example

Hello Onele 👋

Your appointment has been confirmed.

Clinic

Joburg Clinic

Doctor

Dr Naidoo

Appointment Date

14 July 2026

Appointment Time

10:30

Current Queue Position

7

Estimated Consultation Time

11:05

Recommended Arrival Time

10:45

Please bring:

• South African ID or Passport
• Medical Aid Card (if applicable)
• Previous medication (if applicable)
• Previous laboratory results (if applicable)

We'll keep you updated if today's queue changes.

Reply:

CHECK QUEUE

RESCHEDULE

CANCEL

HELP

The message should always be generated dynamically from the current clinic configuration and workflow state.

No values should be hardcoded.

---

# Proactive Queue Updates

The Appointment Engine should automatically notify patients whenever significant workflow changes occur.

Examples include:

- Doctor running late.
- Doctor becomes unavailable.
- Queue moves faster than expected.
- Queue moves slower than expected.
- Emergency patient inserted into the queue.
- Appointment reassigned.
- Consultation time changes.

Example

Hello Onele 👋

Dr Naidoo is currently running approximately 40 minutes behind schedule.

Your new estimated consultation time is around 11:45.

You don't need to arrive immediately.

We'll notify you again when you're close to the front of the queue.

Thank you for your patience.

---

Example

Hello Onele 👋

Good news!

The queue is moving faster than expected.

You are now number 2 in today's queue.

Estimated consultation time:

10:25

We recommend making your way to the clinic now.

Safe travels.

---

Example

Hello Onele 👋

Dr Naidoo is unavailable today due to unexpected leave.

You may choose one of the following options:

• Wait for Dr Naidoo's next available appointment.

• See Dr Smith today at 11:15.

• Contact Reception for assistance.

Reply:

WAIT

BOOK DR SMITH

RECEPTION

The AI should always keep patients informed while avoiding unnecessary or repetitive notifications.

# AI Recommendations

---

# Doctor Preference

Patients may request:

- A specific doctor.
- A female doctor.
- A male doctor.
- Their previous doctor.
- The earliest available doctor.

The Appointment Engine should attempt to satisfy patient preferences while maintaining efficient clinic operations.

If the preferred doctor is unavailable, the AI should explain the reason and present available alternatives.

The patient should always have the opportunity to accept or decline the alternative.

---

# Primary Doctor

Patients may have a Primary Doctor.

A Primary Doctor is the healthcare professional responsible for managing the patient's long-term care whenever possible.

The Appointment Engine should first attempt to schedule appointments with the patient's Primary Doctor.

However, a Primary Doctor is not mandatory.

Examples where a patient may not have a Primary Doctor include:

- First-time patients.
- Walk-in patients.
- Visitors.
- Patients attending Government Clinics where the next available doctor is assigned.
- Patients who choose not to select a preferred doctor.

Private clinics may encourage continuity of care by assigning a Primary Doctor.

The Appointment Engine should follow the clinic's configured appointment policy.

Examples include:

- Primary Doctor Preferred

- Next Available Doctor

- Department Allocation

- Specialist Allocation

The appointment policy is defined within Clinic Settings.

If the Primary Doctor is unavailable, the AI should explain the reason and recommend:

- Waiting for the Primary Doctor.
- Booking another available doctor.
- Requesting assistance from Reception.

The patient always makes the final decision unless the situation is considered urgent.

# Smart Queue Optimisation

---

# Queue Authority

The Artificial Intelligence must never independently move patients within the queue.

The AI may:

- Predict waiting times.
- Recommend scheduling changes.
- Recommend priority changes.
- Notify patients.
- Notify staff.
- Estimate consultation times.

The Workflow Engine remains responsible for queue progression.

Queue changes may only occur through:

- Reception Staff
- Nurses
- Doctors
- Approved Emergency Rules
- Configured Workflow Rules

Every queue movement must be recorded in the audit log.

This ensures fairness, transparency and accountability.

The Appointment Engine should continuously optimise clinic efficiency.

Factors include:

- Doctor workload
- Queue length
- Consultation duration
- Emergency cases
- Follow-up appointments
- Late arrivals
- Walk-in patients

Optimisation should improve waiting times without creating unfair queue behaviour.

The Appointment Engine may recommend:

- Earlier appointment.
- Later appointment.
- Alternative doctor.
- Alternative clinic (future).
- Virtual consultation (future).

Recommendations must never bypass clinic rules.

---

# Integration Requirements

The Appointment Engine integrates with:

- AI Reception Assistant
- Queue Management
- Reception
- Nurse Workflow
- Doctor Workflow
- Notifications
- Billing
- Analytics
- Workflow Engine

No duplicate appointment logic should exist.

---

# Acceptance Criteria

The Smart Appointment Engine is complete when:

✓ Appointment booking works.

✓ Rescheduling works.

✓ Cancellation works.

✓ Follow-up appointments work.

✓ Queue-aware scheduling works.

✓ Emergency prioritisation works.

✓ Notifications work.

✓ Existing appointment functionality remains operational.

✓ No existing workflows are broken.

---

# AI Arrival Check-In

Patients should not always be required to stand in a Reception queue to announce their arrival.

Health Nexus should allow patients to check in using WhatsApp before entering the clinic or immediately upon arrival.

Supported messages include:

- CHECK IN
- I'VE ARRIVED
- I AM HERE
- ARRIVED
- HERE

The AI should verify that the patient has an appointment for the current day before checking them in.

If verification succeeds:

- Mark the patient as Checked In.
- Notify Reception.
- Notify the Queue Management System.
- Update the Workflow Engine.
- Calculate the patient's current queue position.
- Estimate the Nurse Assessment time.
- Begin live queue monitoring.

Example

Welcome back Onele 👋

You have successfully checked in at Joburg Clinic.

Current Queue Position:
4

Estimated Nurse Assessment:
10:15

There are currently 3 patients ahead of you.

Please take a seat in the waiting area.

We'll notify you as soon as it's your turn.

Thank you for choosing Health Nexus/clinic name.

If the patient attempts to check in without an appointment, the AI should explain the situation and guide the patient to Reception for assistance or offer to book an appointment if appropriate.

AI Arrival Check-In should integrate with:

- AI Reception Assistant
- Workflow Engine
- Queue Management
- Notifications
- Appointment Engine

The AI should never check in a patient who does not have a valid appointment unless the clinic's walk-in policy allows it.


---

# PART 7 — RECEPTION WORKFLOW

## Overview

The Reception Department is the operational entry point of the clinic.

Although the AI Reception Assistant performs many administrative tasks before the patient arrives, Reception Staff remain responsible for supervising patient flow within the clinic.

The Reception Workflow begins when a patient arrives at the clinic or when a walk-in patient requests assistance.

Reception Staff work together with the AI Reception Assistant.

The AI automates repetitive administrative tasks while Reception Staff manage exceptions, verify information and provide personal assistance where required.

The Reception Workflow must integrate with:

- AI Reception Assistant
- Smart Appointment Engine
- Queue Management
- Workflow Engine
- Notifications
- Billing
- Patient Records

---

# Reception Responsibilities

Reception Staff are responsible for:

- Patient check-in
- Walk-in patient registration
- Identity verification
- Appointment verification
- Updating patient details
- Queue supervision
- Human handover from AI
- Printing documents (where required)
- Escalating issues
- Assisting patients who cannot use WhatsApp

Reception Staff remain responsible for final administrative decisions.

---

# Reception Shift Management

Health Nexus must support multiple Reception shifts.

Examples include:

- Morning Shift
- Afternoon Shift
- Evening Shift
- Night Shift (where applicable)

Each Reception staff member should be assigned to a shift.

The Reception Dashboard should always display:

- Staff currently on duty
- Shift start time
- Shift end time
- Active workstation
- Current workload

When one shift ends and another begins, Health Nexus should support a structured staff handover.

The handover should include:

- Patients currently waiting
- Patients requiring assistance
- Outstanding verification requests
- Pending walk-in registrations
- Active complaints
- Emergency cases
- System alerts

Every shift handover should be recorded in the audit log.

# AI Reception Responsibilities

The AI Reception Assistant supports Reception by:

- Registering patients before arrival.
- Verifying identity.
- Answering common questions.
- Booking appointments.
- Cancelling appointments.
- Rescheduling appointments.
- Sending reminders.
- Providing queue updates.
- Performing AI Arrival Check-In.
- Directing patients to the correct department.

The AI never replaces Reception Staff.

---

# Patient Arrival

---

# Visitor Management

Patients may arrive with accompanying visitors.

Examples include:

- Parent accompanying a child.
- Family member.
- Legal guardian.
- Caregiver.
- Interpreter.
- Wheelchair assistant.
- Support person.

Reception Staff should be able to register accompanying visitors when required.

Visitor information may include:

- Full Name
- Relationship to Patient
- Contact Number
- Identification Number (optional according to clinic policy)

Visitor registration improves:

- Security
- Emergency evacuation procedures
- Patient safety
- Guardian verification
- Clinical communication

Visitor records should only be created when required and must comply with the clinic's privacy and security policies.

The Workflow Engine should recognise when an accompanying visitor has authority to act on behalf of the patient, according to the Identity & Relationship Verification rules defined earlier in this handbook.

Patients may arrive in three ways:

## Appointment Patient

Booked through:

- WhatsApp
- Reception
- Administrator

The patient checks in.

The Workflow Engine updates the patient's status.

The Queue Management system assigns the next position.

---

## Walk-in Patient

Patients without appointments should be assisted by Reception.

Reception may:

- Register the patient.
- Verify identity.
- Determine urgency.
- Request AI scheduling assistance.
- Insert patient into the queue according to clinic policy.

---

## Emergency Patient

Emergency patients bypass the normal reception workflow.

Reception should immediately:

- Notify Nurses.
- Notify Doctors.
- Notify the Workflow Engine.
- Update Queue Priority.
- Record the emergency event.

Patient safety always takes priority.

---

# Reception Dashboard

Reception Staff should have a live dashboard displaying:

Today's Appointments

Walk-in Patients

Checked-in Patients

Waiting Patients

Doctor Availability

Queue Status

Late Patients

Cancelled Appointments

Patients requiring verification

Emergency Patients

The dashboard should update in real time.

---

# Reception Workstations

Health Nexus should support multiple Reception workstations.

Examples

Reception Desk 1

Reception Desk 2

Reception Desk 3

Reception Supervisor

Future versions may support:

- Self-Service Check-in Kiosks
- Tablet Check-in
- Mobile Reception

Each workstation should display:

- Logged-in staff member
- Current patient
- Queue information
- Notifications
- Active clinic

Reception workstations should synchronise in real time.

# Identity Verification

Reception may perform manual identity verification if:

- AI verification failed.
- The patient changed phone numbers.
- Guardian verification is required.
- Documentation requires manual confirmation.

Manual verification must always be recorded.

---

# Updating Patient Information

Reception may update:

- Phone Number
- Address
- Medical Aid
- Emergency Contact
- Preferred Language

Changes to identity documents should require additional verification.

Every update must be recorded in the audit log.

---

# Digital Document Scanning

Reception should support digital document capture.

Documents may include:

- South African ID
- Passport
- Birth Certificate
- Medical Aid Card
- Referral Letter
- Laboratory Request Form
- Hospital Discharge Letter
- Driver's Licence (where permitted)

Scanned documents should be linked directly to the patient's record.

Artificial Intelligence may assist by:

- Reading document information.
- Suggesting captured fields.
- Detecting missing information.

Reception Staff remain responsible for confirming extracted information before saving it.

Every uploaded document should be stored securely and protected by clinic permissions.

# Human Handover

The AI Reception Assistant should transfer conversations to Reception when:

- Identity cannot be verified.
- The patient requests human assistance.
- Complaints are received.
- Technical issues occur.
- Payment issues require staff intervention.
- Exceptional circumstances arise.

The AI should transfer the conversation together with its conversation summary.

Reception Staff should not need to ask the patient to repeat information already collected by the AI.

---

# AI Patient Handover Summary

When the AI Reception Assistant transfers a patient to Reception Staff, it should automatically generate a structured Patient Handover Summary.

The purpose of the handover summary is to ensure that patients do not have to repeat information they have already provided through WhatsApp or previous conversations.

The summary should become part of the patient's workflow and remain available to authorised staff throughout the visit.

---

## Information Included

The AI Patient Handover Summary may include:

- Patient Name
- Patient Number
- Clinic Name
- Appointment Status
- Identity Verification Status
- Guardian Verification Status (if applicable)
- Appointment Type
- Reason for Visit
- Reported Symptoms
- Preferred Language
- Medical Aid Status
- Primary Doctor Preference (if available)
- Special Assistance Requirements
- AI Confidence Level
- Emergency Risk Assessment
- Conversation Date and Time

---

## Example

Patient

Onele

Patient Number

HN-000123

Clinic

Joburg Clinic

Appointment

Confirmed

Reason for Visit

Headache for three days.

Reported Symptoms

- Headache
- Mild dizziness
- No fever
- No vomiting

Identity Verification

Verified

Preferred Language

English

Medical Aid

Discovery Health

Primary Doctor

Dr Naidoo

Emergency Risk

Low

AI Confidence

High

---

## Workflow Integration

The AI Patient Handover Summary should automatically be available to:

- Reception
- Nurse
- Doctor
- Laboratory (if required)
- Pharmacy (if required)

Each department should only view the information relevant to their responsibilities.

The Workflow Engine should update the handover summary as the patient progresses through each department.

---

## Example Patient Journey Timeline

08:15

Patient starts a WhatsApp conversation with the AI Reception Assistant.

↓

08:18

Identity successfully verified.

↓

08:20

Appointment requested.

↓

08:22

Appointment confirmed.

↓

09:40

Patient arrives at the clinic.

↓

09:41

Patient checks in using WhatsApp.

↓

09:42

Reception receives automatic notification.

↓

09:50

Patient called to Nurse Assessment.

↓

10:05

Nurse records vital signs.

↓

10:20

Patient enters Doctor Consultation.

↓

10:45

Doctor requests Laboratory tests.

↓

11:15

Laboratory uploads results.

↓

11:20

Patient automatically returns to Doctor Review.

↓

11:35

Prescription created.

↓

11:40

Patient proceeds to Pharmacy.

↓

11:50

Medication dispensed.

↓

12:00

Invoice generated.

↓

12:02

Patient pays using Yoco.

↓

12:05

Consultation completed.

↓

3 Days Later

Follow-up AI checks on the patient's recovery through WhatsApp.

The Patient Journey Timeline should remain permanently attached to the patient's visit history.

## Staff Responsibilities

Healthcare professionals should:

- Review the handover summary.
- Confirm important information with the patient.
- Correct inaccurate information if necessary.
- Add professional notes.
- Continue the workflow without repeating unnecessary questions.

The AI summary assists staff but never replaces professional judgement.

---

## Privacy and Security

Only authorised users may access the AI Patient Handover Summary.

Access must respect:

- Clinic permissions
- User roles
- Row Level Security
- Audit Logging

Every access and modification must be recorded.

---

## Patient Timeline Permissions

The Patient Journey Timeline is shared across the Health Nexus platform, but every department may only modify the information they are responsible for.

Each department contributes to one complete patient journey while respecting role-based permissions.

### Reception

May View

✓ Entire Timeline

May Edit

- Reception Notes
- Patient Contact Information
- Appointment Details
- Arrival Status

---

### Nurse

May View

✓ Entire Timeline

May Edit

- Vital Signs
- Triage Notes
- Nurse Assessment
- Clinical Observations

---

### Doctor

May View

✓ Entire Timeline

May Edit

- Consultation Notes
- Diagnosis
- Treatment Plan
- Prescriptions
- Referrals
- Follow-up Instructions

---

### Laboratory

May View

Relevant Clinical Information

May Edit

- Laboratory Requests
- Laboratory Results
- Laboratory Notes

---

### Pharmacy

May View

Relevant Prescription Information

May Edit

- Dispensing Status
- Medication Dispensed
- Pharmacy Notes

---

### Billing

May View

Billing Information

May Edit

- Invoice
- Payment Status
- Payment Method
- Yoco Transaction Details

---

### Artificial Intelligence

The AI may:

- Read workflow progress.
- Generate summaries.
- Recommend actions.
- Predict waiting times.
- Send patient notifications.

The AI must never edit clinical records or make independent medical decisions.

---

The Workflow Engine is responsible for maintaining the complete Patient Journey Timeline while enforcing Role-Based Access Control, Row Level Security and Audit Logging.

---

## Acceptance Criteria

The AI Patient Handover Summary is complete when:

✓ Patients do not repeat information already shared with the AI.

✓ Reception automatically receives the summary.

✓ Nurses receive the updated summary.

✓ Doctors receive the updated summary.

✓ Laboratory and Pharmacy receive relevant workflow information.

✓ The summary becomes part of the patient's visit timeline.

✓ Existing workflows continue operating without interruption.

---

# Patient Journey Timeline

When the AI Reception Assistant transfers a patient to Reception Staff, it should generate a structured summary of the conversation.

The purpose of the summary is to reduce repetitive questioning, improve efficiency and ensure Reception Staff have the necessary information before speaking to the patient.

The AI Reception Summary should never replace the Reception Staff's judgement.

Reception Staff should review the summary before continuing with the patient's registration or check-in.

The summary may include:

- Patient Name
- Patient Number
- Clinic Name
- Appointment Status
- Identity Verification Status
- Guardian Verification Status (if applicable)
- Appointment Type
- Reason for Visit
- Reported Symptoms
- Preferred Language
- Medical Aid Status
- Primary Doctor Preference (if available)
- Special Assistance Requirements
- AI Confidence Level
- Emergency Risk Assessment
- Conversation Timestamp

---

## Example AI Reception Summary

Patient

Onele

Patient Number

HN-000123

Clinic

Joburg Clinic

Appointment

Confirmed

Identity Verification

Verified

Guardian Verification

Not Required

Reason for Visit

Headache for three days.

Reported Symptoms

- Headache
- Mild dizziness
- No fever
- No vomiting

Preferred Language

English

Medical Aid

Discovery Health

Primary Doctor

Dr Naidoo

AI Assessment

General Consultation Recommended

Emergency Risk

Low

AI Confidence

High

---

## Reception Responsibilities

Reception Staff should:

- Review the AI summary.
- Confirm important information with the patient.
- Correct any inaccurate information.
- Update patient details if required.
- Continue the workflow without asking unnecessary repeated questions.

The AI summary should be treated as an assistant, not as an official medical record.

---

## Workflow Integration

The Patient Journey Timeline becomes a living patient journey document.

Every authorised department contributes to the same timeline instead of creating isolated summaries.

Departments include:

- AI Reception
- Reception
- Nurse
- Doctor
- Laboratory
- Pharmacy
- Billing
- Follow-up AI

Each department may:

- Read previous workflow information.
- Add new workflow notes.
- Attach relevant documents.
- Update the patient's progress.

The Workflow Engine is responsible for maintaining the complete chronological patient journey.

Every department should only access information according to its assigned role and permissions.

The summary should also be available to authorised Nurses and Doctors so they understand the patient's initial concerns before beginning their assessment.

---

## Privacy and Security

Only authorised staff should be able to view the AI Reception Summary.

The summary must comply with:

- Clinic permissions
- User roles
- Row Level Security
- Audit Logging

Every access to the summary should be recorded for security and accountability.

---

## Acceptance Criteria

The AI Reception Summary is complete when:

✓ Reception Staff receive the summary automatically.

✓ Patients do not need to repeat information already provided to the AI.

✓ Reception Staff can edit or correct the information when necessary.

✓ The summary becomes part of the patient's visit timeline.

✓ Existing Reception workflows remain unchanged.

✓ No patient information is exposed to unauthorised users.



# Queue Supervision

Reception Staff supervise the queue but should not manually manage every movement.

The Workflow Engine automatically progresses patients through the workflow.

Reception may:

- Pause a patient.
- Mark a patient as arrived.
- Mark a patient as absent.
- Insert authorised walk-in patients.
- Escalate emergencies.

The Workflow Engine remains responsible for queue progression.

---

# Queue Display Integration

Health Nexus should support digital waiting room displays.

Example

NOW SERVING

Queue 024

Room 3

Dr Naidoo

The waiting room display should update automatically.

The following systems should always remain synchronised:

- Workflow Engine
- Queue Management
- Reception Dashboard
- Doctor Dashboard
- Nurse Dashboard
- AI Reception Assistant
- WhatsApp Notifications

Patients should receive WhatsApp updates at the same time the waiting room display changes.

Example

Hello Onele 👋

You are now next in the queue.

Please proceed to Room 3.

Doctor

Dr Naidoo

If the clinic does not have a digital display, the AI should continue notifying patients through WhatsApp.

---

# Smart Calling System

Health Nexus should provide an intelligent patient calling system that integrates with the Workflow Engine.

The system should eliminate the need for Reception Staff or Nurses to manually call patient names in the waiting area.

When a patient's turn arrives, Health Nexus should automatically perform the following actions:

1. Update the Waiting Room Display.
2. Send a WhatsApp notification to the patient.
3. Update the Reception Dashboard.
4. Update the Nurse Dashboard.
5. Update the Doctor Dashboard (where applicable).
6. Update the Workflow Engine.
7. Record the event in the Audit Log.

Example

Hello Onele 👋

The nurse is now ready for you.

Please proceed to:

Room 2

If you need assistance, reply:

HELP

If the patient does not respond or arrive within the configured waiting period, the Workflow Engine should notify Reception Staff for manual follow-up.

The Smart Calling System should remain synchronised across all connected systems to ensure every department has the same real-time patient status.

# No Show Management

If a patient fails to arrive:

The Appointment Engine should:

- Notify the patient.
- Allow a configurable grace period.
- Inform Reception.
- Mark the appointment as No Show if necessary.
- Release the appointment slot.

Clinic policies determine the grace period.

---

# Reception Notifications

Reception should receive notifications when:

- A patient checks in.
- A patient is running late.
- A patient changes appointments.
- An emergency patient arrives.
- A doctor becomes unavailable.
- AI requests human assistance.

Notifications should be clear and actionable.

---

# Reception Reports

Reception statistics should include:

- Daily patient arrivals
- Average waiting time
- No-show rate
- Walk-in volume
- AI handled conversations
- Human escalations
- Appointment conversion rate

Reports help improve clinic operations.

---

# Acceptance Criteria

The Reception Workflow is complete when:

✓ AI and Reception work together.

✓ Walk-in patients are supported.

✓ Appointment patients are supported.

✓ Emergency patients are prioritised.

✓ Manual identity verification works.

✓ Queue supervision works.

✓ Human handover works.

✓ Existing Reception functionality remains operational.

✓ No existing workflows are broken.

---

# PART 8 — QUEUE MANAGEMENT & WORKFLOW ENGINE

## Overview

The Queue Management & Workflow Engine is the central coordination system of Health Nexus.

Every patient movement between departments is controlled by the Workflow Engine.

The Workflow Engine ensures that patients move safely, efficiently and consistently through their healthcare journey without staff manually coordinating every step.

The Queue Management & Workflow Engine integrates with:

- AI Reception Assistant
- Smart Appointment Engine
- Reception
- Nurse Workflow
- Doctor Workflow
- Laboratory
- Pharmacy
- Billing
- Notifications
- WhatsApp
- Analytics

The Workflow Engine is the single source of truth for patient movement.

---

# Core Responsibilities

The Workflow Engine is responsible for:

- Creating patient workflows.
- Managing department queues.
- Moving patients between departments.
- Tracking workflow progress.
- Updating dashboards.
- Sending notifications.
- Recording audit events.
- Predicting waiting times.
- Preventing invalid workflow transitions.

The Workflow Engine never replaces healthcare professionals.

It coordinates the workflow between them.

---

# Workflow States

Every patient visit progresses through predefined workflow states.

Example

Appointment Requested

↓

Appointment Confirmed

↓

Checked In

↓

Waiting for Reception (if required)

↓

Waiting for Nurse

↓

Nurse Assessment

↓

Waiting for Doctor

↓

Doctor Consultation

↓

Decision Point

↓

Laboratory Required?

YES

↓

Waiting for Laboratory

↓

Laboratory Processing

↓

Results Available

↓

Return to Doctor

↓

Doctor Review

↓

Medication Required?

YES

↓

Waiting for Pharmacy

↓

Medication Dispensed

↓

Invoice Generated

↓

Payment Pending

↓

Payment Completed

↓

Consultation Complete

↓

Follow-up AI

↓

Visit Closed

Every workflow state must be timestamped and recorded.

---

# Queue Types

Health Nexus supports multiple independent queues.

These include:

- Reception Queue
- Nurse Queue
- Doctor Queue
- Laboratory Queue
- Pharmacy Queue
- Billing Queue
- Follow-up Queue

Each queue operates independently while remaining connected through the Workflow Engine.

---

# Automatic Workflow Movement

Patients should never be manually transferred between departments unless authorised.

Examples

Doctor requests Laboratory.

↓

Workflow Engine

↓

Moves patient into Laboratory Queue.

↓

Laboratory completes testing.

↓

Workflow Engine

↓

Returns patient to Doctor Queue.

↓

Doctor reviews results.

The Workflow Engine controls patient movement automatically.

---

# Live Queue Management

Health Nexus must maintain live queues for every department.

Queue information should update in real time without requiring users to refresh the system.

The Workflow Engine is responsible for synchronising all queues across the platform.

Each queue should display:

- Current Queue Number
- Patient Position
- Department
- Assigned Healthcare Professional
- Estimated Waiting Time
- Estimated Consultation Time
- Queue Status
- Priority Level

The following users should always see the latest queue information:

- Reception
- Nurses
- Doctors
- Laboratory Staff
- Pharmacists
- Billing Staff
- Clinic Administrators

Patients should only see information relating to their own visit.

---

# Queue Status

Every patient in a queue should have one of the following statuses:

- Waiting
- Called
- In Progress
- Completed
- Delayed
- Paused
- No Show
- Cancelled
- Referred
- Returned to Queue

Only the Workflow Engine may change queue status automatically.

Healthcare staff may update statuses according to their role permissions.

Every status change must be recorded in the audit log.

---

# Department Queues

Each department operates its own queue while remaining connected through the Workflow Engine.

Reception Queue

Handles:

- Walk-in patients
- Appointment verification
- Patient registration
- Identity verification

---

Nurse Queue

Handles:

- Vital signs
- Triage
- Initial assessment

---

Doctor Queue

Handles:

- Consultation
- Follow-up review
- Laboratory review
- Prescription approval

---

Laboratory Queue

Handles:

- Sample collection
- Laboratory testing
- Result verification

---

Pharmacy Queue

Handles:

- Prescription review
- Medication dispensing
- Patient counselling

---

Billing Queue

Handles:

- Invoice generation
- Payment processing
- Yoco transactions
- Receipt generation

The Workflow Engine automatically determines which queue a patient enters next.

---

# Queue Rules

The Workflow Engine should follow these rules:

Patients normally move using a First Come, First Served approach.

Exceptions include:

- Emergency Patients
- Doctor Approved Priority
- High Risk Patients
- Children requiring urgent care
- Configured Clinic Policies

The Workflow Engine must never allow a patient to skip the queue without recording the reason.

Every priority adjustment must be auditable.

---

# Queue Capacity

Each department may configure:

- Maximum Queue Size
- Maximum Daily Patients
- Maximum Doctor Consultations
- Maximum Laboratory Tests
- Maximum Pharmacy Dispensing Capacity

If a queue reaches capacity:

The Workflow Engine should:

- Notify Reception.
- Notify Clinic Administration.
- Inform patients.
- Recommend another appointment when appropriate.

Patients should never be booked into unavailable workflow capacity.

---

# Queue Synchronisation

Every queue update should immediately synchronise with:

- Reception Dashboard
- Nurse Dashboard
- Doctor Dashboard
- Laboratory Dashboard
- Pharmacy Dashboard
- Billing Dashboard
- AI Reception Assistant
- WhatsApp Notifications
- Waiting Room Display

There should only be one version of the queue across the platform.

The Workflow Engine is the single source of truth.

---

# Queue Recovery

Health Nexus must be able to recover every patient's workflow state after unexpected interruptions.

Examples include:

- Power outage
- Internet outage
- Server restart
- Browser refresh
- Application restart

The Workflow Engine should automatically restore:

- Current Department
- Current Queue
- Queue Position
- Assigned Healthcare Professional
- Workflow State
- Waiting Time
- Next Workflow Step

Example

Patient

Onele

Current Department

Laboratory

Workflow State

Waiting for Doctor Review

Queue Position

2

Recovery Status

Recovered Successfully

No patient should lose their workflow progress because of technical failures.

The Workflow Engine should automatically continue from the last successfully recorded workflow state.

Every recovery event must be recorded in the audit log.

---

# Workflow History

Every patient movement should be permanently recorded.

The Workflow History provides a complete chronological record of the patient's visit.

Each workflow event should include:

- Date
- Time
- Department
- Healthcare Professional
- Action Performed
- Workflow Status
- Notes (if applicable)

Example

09:10

Patient Checked In

↓

09:15

Reception Complete

↓

09:30

Nurse Assessment

↓

10:00

Doctor Consultation

↓

10:35

Laboratory Requested

↓

11:05

Laboratory Results Uploaded

↓

11:15

Doctor Review

↓

11:30

Medication Dispensed

↓

11:40

Invoice Generated

↓

11:42

Payment Completed

↓

11:45

Visit Closed

The Workflow History becomes part of the Patient Journey Timeline and should remain permanently attached to the patient's medical record.

Only authorised staff may view workflow history according to their assigned permissions.

Every workflow event must be protected by Row Level Security and Audit Logging.

---

# AI Queue Intelligence

The Workflow Engine should work together with Artificial Intelligence to continuously analyse every queue within the clinic.

The AI should assist staff by predicting workflow bottlenecks before they occur.

The AI may:

- Predict long waiting times.
- Detect overloaded departments.
- Recommend queue balancing.
- Predict consultation delays.
- Predict Laboratory delays.
- Predict Pharmacy delays.
- Recommend additional staffing.
- Recommend schedule adjustments.

Artificial Intelligence should never directly modify the queue.

The AI may only:

- Predict
- Recommend
- Notify

The Workflow Engine remains responsible for executing approved workflow changes.

---

# Queue Bottleneck Detection

The AI should continuously monitor:

- Reception Queue
- Nurse Queue
- Doctor Queue
- Laboratory Queue
- Pharmacy Queue
- Billing Queue

Examples of bottlenecks include:

- Doctor running behind schedule.
- Laboratory backlog.
- Pharmacy congestion.
- Reception delays.
- High patient arrival rate.

When a bottleneck is detected, the AI should notify authorised staff with recommendations.

Example

"Doctor Queue is currently running approximately 35 minutes behind schedule."

Recommendation

- Notify waiting patients.
- Delay new bookings.
- Open another consultation room if available.

Recommendations should always require human approval where operational changes are involved.

---

# Queue Predictions

The AI should continuously estimate:

- Estimated Waiting Time
- Estimated Consultation Time
- Estimated Completion Time
- Estimated Queue Length
- Department Capacity

Predictions should improve automatically as more real-time workflow information becomes available.

Patients should receive updated estimates through WhatsApp whenever significant changes occur.

---

# Queue Notifications

Health Nexus should automatically notify patients about important queue events.

Examples include:

- Queue position changed.
- Doctor delayed.
- Doctor available.
- Nurse ready.
- Laboratory ready.
- Pharmacy ready.
- Billing ready.
- Consultation completed.

Examples

Hello Onele 👋

You are now number 2 in the Doctor Queue.

Estimated consultation:

10:35

Please remain in the waiting area.

---

Hello Onele 👋

The Nurse is now ready for you.

Please proceed to Room 2.

---

Hello Onele 👋

Your laboratory results are now available.

Please return to the Doctor's consultation room.

Notifications should be clear, timely and relevant.

The system should avoid sending unnecessary or repetitive notifications.

---

# Department Queue Synchronisation

All departments should remain synchronised through the Workflow Engine.

Examples include:

Reception

↓

Nurse

↓

Doctor

↓

Laboratory

↓

Doctor Review

↓

Pharmacy

↓

Billing

↓

Follow-up AI

Every movement between departments should automatically:

- Update the Workflow Engine.
- Update the Patient Journey Timeline.
- Update Queue Dashboards.
- Update WhatsApp notifications.
- Update Analytics.
- Create an Audit Log.

Departments should never move patients directly.

Only the Workflow Engine may perform workflow transitions.

---

# Queue Suspension

There may be situations where a patient temporarily leaves the workflow without cancelling their visit.

Examples include:

- Patient goes to the restroom.
- Patient is completing payment.
- Patient requires additional documentation.
- Patient briefly leaves the waiting area with permission.

The Workflow Engine should support temporary queue suspension.

Queue suspension should record:

- Suspension Time
- Suspension Reason
- Current Department
- Original Queue Position
- Staff Member Authorising Suspension

When the patient returns, the Workflow Engine should restore the workflow according to the clinic's configured policy.

Every suspension and resume event must be recorded in the audit log.

---

# Department Transfers

The Workflow Engine should support authorised patient transfers between existing Health Nexus departments.

Supported departments include:

- Reception
- Nurse
- Doctor
- Laboratory
- Pharmacy
- Billing

Examples include:

Doctor

↓

Laboratory

↓

Doctor Review

↓

Pharmacy

or

Doctor

↓

Billing

↓

Consultation Complete

The Workflow Engine is responsible for validating every transfer.

Departments must never move patients directly.

Every transfer must:

- Update the Patient Journey Timeline.
- Update Queue Dashboards.
- Notify relevant staff.
- Notify the patient where appropriate.
- Create an Audit Log entry.

The Workflow Engine has been designed to support future expansion without requiring major architectural changes.

---

# Emergency Queue Management

Patient safety is the highest priority within Health Nexus.

When an emergency patient is identified, the Workflow Engine must immediately activate the Emergency Workflow.

Examples include:

- Chest Pain
- Difficulty Breathing
- Stroke Symptoms
- Heavy Bleeding
- Loss of Consciousness
- Severe Allergic Reaction

The Workflow Engine should automatically:

- Notify Reception.
- Notify the Nurse.
- Notify the Doctor.
- Assign Emergency Priority.
- Record the emergency event.
- Update the Patient Journey Timeline.
- Create an Audit Log.

The system must never move an emergency patient without healthcare staff confirming the emergency workflow.

AI may recommend emergency prioritisation but must never make the final clinical decision.

---

# Queue Permissions

Only authorised users may manage queues.

Reception may:

- Check patients in.
- Verify appointments.
- Pause a queue (where authorised).

Nurses may:

- Call the next patient.
- Complete Nurse Assessment.
- Return patients to Reception if required.

Doctors may:

- Begin Consultation.
- Request Laboratory.
- Refer to Pharmacy.
- Complete Consultation.

Laboratory Staff may:

- Begin Laboratory Workflow.
- Upload Results.
- Return the patient to the Doctor.

Pharmacists may:

- Dispense Medication.
- Complete Pharmacy Workflow.

Billing Staff may:

- Generate Invoices.
- Record Payments.
- Complete Billing.

Every queue action must respect:

- Role-Based Access Control (RBAC)
- Row Level Security (RLS)
- Audit Logging

---

# Queue Performance Reports

Health Nexus should provide operational reports to help clinic administrators improve workflow efficiency.

Reports may include:

- Average waiting time
- Average consultation duration
- Patients served per day
- Queue length by department
- No-show rate
- Appointment completion rate
- Emergency patient count
- Doctor workload
- Nurse workload
- Laboratory workload
- Pharmacy workload

Reports should be available by:

- Day
- Week
- Month
- Custom Date Range

Reports should support filtering by:

- Clinic
- Department
- Healthcare Professional

---

# Acceptance Criteria

The Queue Management & Workflow Engine is complete when:

✓ Every patient follows a structured workflow.

✓ Department queues remain synchronised.

✓ Patients receive real-time WhatsApp updates.

✓ Queue predictions are available.

✓ Queue recovery works after interruptions.

✓ Workflow history is permanently recorded.

✓ Emergency workflow operates correctly.

✓ Role permissions are enforced.

✓ Audit logging records every workflow event.

✓ Existing Health Nexus functionality continues operating without interruption.

---

# PART 9 — AI NURSE ASSISTANT & HUMAN NURSE WORKFLOW

## Overview

The Nurse Department is the first clinical stage of the patient's healthcare journey.

After Reception completes the administrative workflow, the Workflow Engine automatically transfers the patient into the Nurse Queue.

The Nurse remains responsible for all clinical assessments.

The AI Nurse Assistant supports the Nurse by reducing administrative work, organising patient information and providing intelligent clinical assistance.

The AI Nurse Assistant never replaces the Nurse.

---

# Objectives

The Nurse Workflow should:

- Receive patients from Reception.
- Verify patient identity.
- Review the Patient Journey Timeline.
- Record vital signs.
- Record clinical observations.
- Assist triage.
- Identify clinical risks.
- Prepare information for the Doctor.
- Update the Workflow Engine.
- Notify the next department.

---

# Nurse Responsibilities

The Nurse remains responsible for:

- Patient assessment.
- Measuring vital signs.
- Triage.
- Recording symptoms.
- Clinical observations.
- Escalating emergencies.
- Preparing the patient for consultation.
- Updating clinical records.

Clinical judgement always belongs to the Nurse.

---

# AI Nurse Responsibilities

The AI Nurse Assistant assists by:

- Reviewing the Patient Journey Timeline.
- Displaying AI Reception Summary.
- Suggesting assessment questions.
- Detecting missing information.
- Identifying abnormal vital signs.
- Highlighting potential clinical risks.
- Generating structured Nurse summaries.
- Preparing information for the Doctor.

The AI never makes independent clinical decisions.

---

# Workflow

Patient

↓

Reception Complete

↓

Workflow Engine

↓

Nurse Queue

↓

AI Nurse Assistant prepares patient information

↓

Human Nurse Assessment

↓

Workflow Engine updates

↓

Doctor Queue

The Workflow Engine controls patient movement.

---

# Patient Identity Verification

Before beginning the clinical assessment, the Nurse should confirm the patient's identity.

Verification may include:

- Full Name
- Date of Birth
- Patient Number
- South African ID
- Passport
- Guardian Confirmation (for minors)

Identity verification protects patient safety.

---

# Patient Journey Timeline Review

Before assessing the patient, the AI Nurse Assistant should display:

- Appointment Reason
- AI Reception Summary
- Previous Visit Notes
- Chronic Conditions
- Allergies
- Current Medication
- Laboratory Results (if available)
- Previous Vital Signs

The Nurse should not need to ask questions that have already been answered unless confirmation is clinically necessary.

---

# Vital Signs

Health Nexus should support recording:

- Blood Pressure
- Pulse
- Temperature
- Respiratory Rate
- Oxygen Saturation
- Weight
- Height
- BMI
- Blood Glucose (where applicable)
- Pain Score

Every measurement should include:

- Value
- Unit
- Date
- Time
- Nurse


---

# Vital Sign Trend Analysis

The AI Nurse Assistant should compare today's vital signs with previous visits.

The purpose is to help the Nurse quickly identify meaningful changes.

Examples include:

- Increased Blood Pressure
- Weight Loss
- Weight Gain
- Fever
- Low Oxygen Saturation
- Elevated Heart Rate

The AI should highlight trends but never diagnose the patient.

The Nurse remains responsible for interpreting the results.

---

# Missing Assessment Detection

The AI Nurse Assistant should continuously check whether all required assessment information has been completed.

The purpose is to reduce incomplete patient assessments and improve documentation quality.

The AI may detect missing information such as:

- Blood Pressure
- Temperature
- Pulse
- Respiratory Rate
- Oxygen Saturation
- Weight
- Height
- Pain Score
- Blood Glucose (where applicable)
- Allergy Information
- Current Medication
- Pregnancy Status (where applicable)

Example

The AI may notify the Nurse:

"The patient's Oxygen Saturation has not yet been recorded."

or

"Pain Score has not been captured."

The AI should only remind the Nurse.

The AI must never automatically complete missing clinical information.

Only the Nurse may confirm or record clinical observations.

---

# Triage Assessment

The Nurse is responsible for performing the patient's triage assessment.

The triage assessment helps determine the urgency of medical attention.

The Nurse may record:

- Chief Complaint
- Presenting Symptoms
- Duration of Symptoms
- Pain Severity
- Mobility
- Consciousness
- General Appearance
- Pregnancy Status (where applicable)

The AI Nurse Assistant may suggest additional assessment questions based on the patient's reported symptoms.

The Nurse remains responsible for all clinical decisions.

---

# Clinical Risk Alerts

The AI Nurse Assistant should analyse assessment information and identify possible clinical risks.

Examples include:

- High Blood Pressure
- Low Oxygen Saturation
- High Fever
- Very Low Blood Glucose
- Extremely High Pain Score
- Abnormal Heart Rate

When a potential risk is detected, the AI should immediately notify the Nurse.

Example

"Blood Pressure is significantly higher than previous visits."

or

"Oxygen Saturation is below the clinic's configured safety threshold."

The AI provides alerts only.

The Nurse decides the appropriate clinical action.

---

# Nurse Clinical Notes

The Nurse should be able to record structured clinical notes.

Clinical notes may include:

- Patient Symptoms
- Clinical Observations
- Triage Findings
- Mobility Assessment
- Mental Status
- Skin Condition
- Additional Notes

The AI may help organise notes into a structured format.

The AI must never create clinical observations that were not entered by the Nurse.

---

# AI Nurse Summary

When the Nurse completes the assessment, the AI should generate a structured summary for the Doctor.

The summary should include:

- Chief Complaint
- Vital Signs
- Triage Assessment
- Clinical Observations
- Clinical Risk Alerts
- Allergies
- Current Medication
- Relevant Medical History

The Doctor should receive the summary before beginning the consultation.

The summary assists the Doctor but does not replace the Nurse's assessment.

---

# Workflow Completion

When the Nurse completes the assessment, the Workflow Engine should automatically:

- Save the assessment.
- Update the Patient Journey Timeline.
- Update the Workflow History.
- Notify the Doctor Queue.
- Notify the Doctor Dashboard.
- Update Queue Position.
- Create an Audit Log.

The patient should then be transferred to the Doctor Queue according to the Workflow Engine.

---

# Patient Reassessment

There may be situations where a patient's condition changes while waiting to see the Doctor.

The Workflow Engine should support Patient Reassessment before the consultation when clinically appropriate.

Examples include:

- Long waiting times.
- Patient reports worsening symptoms.
- New symptoms develop.
- Nurse observes a change in condition.
- Doctor requests updated vital signs.
- Emergency concerns arise.

The Nurse may perform a reassessment at any time before the Doctor consultation.

The reassessment may include:

- Blood Pressure
- Pulse
- Temperature
- Respiratory Rate
- Oxygen Saturation
- Pain Score
- Blood Glucose (where applicable)
- General Clinical Condition

The AI Nurse Assistant should compare the reassessment with the initial assessment and highlight significant changes.

Examples include:

- Increased Blood Pressure
- Increased Temperature
- Reduced Oxygen Saturation
- Increased Pain Score
- Deteriorating General Condition

The AI should notify the Nurse of clinically significant changes but must never diagnose the patient or recommend treatment.

When a reassessment is completed, the Workflow Engine should:

- Update the Patient Journey Timeline.
- Update the Workflow History.
- Notify the Doctor if significant changes are detected.
- Record the reassessment in the patient's medical record.
- Create an Audit Log entry.

The Doctor should always have access to both the initial assessment and any reassessments before beginning the consultation.

The Nurse remains responsible for deciding whether a reassessment is clinically necessary.

---

# Nurse Escalation

Patient safety is the Nurse's highest priority.

If the Nurse believes that a patient's condition requires immediate medical attention, the Nurse may activate an Emergency Escalation.

Examples include:

- Chest Pain
- Difficulty Breathing
- Stroke Symptoms
- Severe Allergic Reaction
- Loss of Consciousness
- Severe Bleeding
- Rapidly Deteriorating Patient

When Emergency Escalation is activated, the Workflow Engine should automatically:

- Notify the assigned Doctor.
- Notify Reception.
- Update the Patient Journey Timeline.
- Update the Workflow History.
- Mark the patient as High Priority.
- Update Queue Dashboards.
- Record an Audit Log.

The AI Nurse Assistant may recommend an escalation based on recorded clinical information.

The final decision to activate Emergency Escalation always belongs to the Nurse.

---

# Nurse Permissions

The Nurse may:

- Begin Nurse Assessment.
- Record Vital Signs.
- Record Clinical Notes.
- Perform Reassessment.
- Activate Emergency Escalation.
- Complete Nurse Workflow.
- Return the patient to Reception (when appropriate).

The Nurse may not:

- Diagnose medical conditions.
- Prescribe medication.
- Dispense medication.
- Finalise billing.

All Nurse actions must respect:

- Role-Based Access Control (RBAC)
- Row Level Security (RLS)
- Audit Logging

---

# Acceptance Criteria

The AI Nurse Assistant & Human Nurse Workflow is complete when:

✓ Nurse Assessment works.

✓ Vital Signs are recorded.

✓ AI detects missing assessment information.

✓ AI compares previous and current vital signs.

✓ AI generates a structured Nurse Summary.

✓ Patient Reassessment works.

✓ Emergency Escalation works.

✓ Workflow Engine updates automatically.

✓ Doctor receives complete patient information.

✓ Existing clinical workflows remain operational.

---

# PART 10 — DOCTOR AI ASSISTANT & HUMAN DOCTOR WORKFLOW

## Overview

The Doctor Consultation is the primary clinical decision-making stage of the patient journey.

Doctors remain fully responsible for diagnosis, treatment decisions and patient management.

The Doctor AI Assistant supports the Doctor by organising information, reducing administrative workload and providing clinical decision support.

The AI never replaces the Doctor.

---

# Objectives

The Doctor Workflow should:

- Receive patients from the Nurse.
- Review the Patient Journey Timeline.
- Review Nurse Assessment.
- Review Vital Signs.
- Review Medical History.
- Review Allergies.
- Review Current Medication.
- Conduct the consultation.
- Record diagnosis.
- Create treatment plans.
- Request Laboratory tests (when required).
- Create prescriptions (when required).
- Complete the consultation.

---

# Doctor Responsibilities

The Doctor remains responsible for:

- Clinical assessment.
- Diagnosis.
- Treatment planning.
- Ordering investigations.
- Prescribing medication.
- Referrals.
- Follow-up planning.
- Medical documentation.

Clinical judgement always belongs to the Doctor.

---

# Doctor AI Responsibilities

The Doctor AI Assistant assists by:

- Summarising the Patient Journey Timeline.
- Displaying previous consultations.
- Displaying allergies.
- Displaying chronic conditions.
- Displaying laboratory history.
- Highlighting abnormal vital signs.
- Organising consultation notes.
- Drafting structured consultation summaries.

The AI never diagnoses patients independently.

The AI never prescribes medication independently.

The AI never overrides the Doctor's decisions.

---

# Consultation Preparation

Before the Doctor begins the consultation, Health Nexus should automatically display:

- Patient Journey Timeline
- AI Reception Information
- Nurse Summary
- Vital Signs
- Clinical Risk Alerts
- Previous Diagnoses
- Previous Prescriptions
- Previous Laboratory Results
- Allergies
- Current Medication
- Chronic Conditions

The Doctor should never begin a consultation with a blank screen.

The Workflow Engine prepares all relevant information before the consultation begins.

---

# AI Consultation Summary

The Doctor AI Assistant should generate a structured consultation summary based only on information entered or confirmed by the Doctor during the consultation.

The purpose of the summary is to reduce documentation time while maintaining complete clinical control by the Doctor.

The AI must never invent, assume or infer medical information that has not been recorded.

The Doctor must review, edit and approve the summary before it becomes part of the patient's permanent medical record.

---

# AI Documentation Check

Before a consultation can be completed, the Doctor AI Assistant should automatically validate that all required clinical information has been recorded.

The purpose of this validation is to improve patient safety, reduce incomplete documentation and prevent accidental workflow errors.

The AI should verify that mandatory sections have been completed according to the clinic's consultation requirements.

Examples of required information include:

- Chief Complaint
- History of Present Illness
- Clinical Examination
- Assessment
- Diagnosis
- Treatment Plan
- Follow-up Plan (where applicable)

If medication is prescribed, the AI should also verify:

- Medication Name
- Dosage
- Frequency
- Duration
- Route of Administration

If Laboratory investigations are requested, the AI should verify:

- Requested Test
- Clinical Reason
- Priority Level

If a referral is created, the AI should verify:

- Referral Destination
- Referral Reason

---

## Missing Documentation Alerts

If required information is missing, the AI should clearly inform the Doctor before the consultation can be completed.

Example

The consultation cannot be completed because the following information is missing:

• Diagnosis

• Treatment Plan

• Follow-up Instructions

Please complete the required information before continuing.

---

## Workflow Validation

The Workflow Engine must not allow the consultation to be completed while mandatory information is missing.

The Doctor may save the consultation as a Draft and continue editing later.

However, the consultation cannot move to the next workflow stage until all required information has been completed or intentionally marked as "Not Applicable" where permitted by clinic policy.

---

## Doctor Authority

The AI may:

- Detect missing information.
- Highlight incomplete sections.
- Suggest documentation improvements.

The AI must never:

- Complete missing clinical information.
- Create diagnoses.
- Prescribe medication.
- Override the Doctor's clinical judgement.

Only the Doctor may complete and approve the consultation.

---

## Workflow Integration

Once all required documentation has been completed and approved by the Doctor, the Workflow Engine should:

- Save the consultation.
- Update the Patient Journey Timeline.
- Update the patient's medical history.
- Notify the next department if required.
- Generate an Audit Log entry.

---

# Consultation Completion Validation

Before a consultation can be completed, the Workflow Engine must require the Doctor to select the patient's next clinical outcome.

A consultation must never end without a defined workflow outcome.

The Doctor must choose one of the following outcomes:

- Consultation Complete
- Send to Laboratory
- Send to Pharmacy
- Send to Billing
- Schedule Follow-up Appointment
- Refer to another Healthcare Facility
- Refer to a Specialist

The Workflow Engine should automatically validate the selected outcome.

Examples

## Consultation Complete

The patient requires no further investigations, medication or follow-up.

The Workflow Engine should:

- Complete the consultation.
- Update the Patient Journey Timeline.
- Notify Billing (if applicable).
- Close the clinical workflow.

---

## Laboratory Required

The Workflow Engine should:

- Create the Laboratory Request.
- Move the patient to the Laboratory Queue.
- Notify the Laboratory Dashboard.
- Update the Patient Journey Timeline.

---

## Pharmacy Required

The Workflow Engine should:

- Create the Prescription.
- Move the patient to the Pharmacy Queue.
- Notify the Pharmacy Dashboard.
- Update the Patient Journey Timeline.

---

## Follow-up Required

The Workflow Engine should:

- Create the Follow-up Plan.
- Notify the Appointment Engine.
- Allow the AI Reception Assistant to assist with scheduling.

---

## Referral Required

The Workflow Engine should:

- Generate the Referral Letter.
- Record the Referral Reason.
- Update the Patient Journey Timeline.

---

# Workflow Protection

The Workflow Engine must never allow the consultation to close without one of the approved outcomes being selected.

If no outcome has been selected, the Doctor should receive a validation message.

Example

The consultation cannot be completed.

Please select the patient's next workflow outcome before continuing.

This validation prevents incomplete consultations and ensures every patient leaves the consultation with a clearly defined next step.

---

# Doctor Authority

Only the Doctor may select the consultation outcome.

The AI may recommend possible workflow outcomes based on the completed consultation but must never make the final decision.

Every consultation outcome must be recorded in the Audit Log and Patient Journey Timeline.


## Consultation Summary Structure

The AI may organise the consultation into the following sections:

- Chief Complaint
- History of Present Illness
- Relevant Medical History
- Current Medication
- Allergies
- Clinical Examination
- Assessment
- Diagnosis
- Treatment Plan
- Laboratory Requests
- Prescriptions
- Follow-up Instructions
- Doctor Notes

---

## Example AI Consultation Summary

Chief Complaint

Headache for three days.

---

History of Present Illness

Patient reports intermittent headaches beginning three days ago.

Pain is mainly frontal.

No vomiting reported.

No loss of consciousness.

---

Relevant Medical History

History of hypertension.

---

Clinical Examination

Blood Pressure

148/92 mmHg

Temperature

36.9°C

Pulse

84 bpm

---

Assessment

Patient clinically stable.

No immediate emergency findings documented.

---

Diagnosis

Migraine

---

Treatment Plan

Prescribe pain medication.

Advise adequate hydration.

Monitor symptoms.

---

Follow-up

Review after seven days if symptoms persist.

---

## Doctor Review

The Doctor may:

- Approve the summary.
- Edit any section.
- Remove sections.
- Add additional notes.
- Reject the generated summary completely.

Only the approved version becomes part of the patient's permanent medical record.

---

## AI Responsibilities

The AI may:

- Organise consultation notes.
- Improve formatting.
- Highlight missing documentation.
- Detect incomplete consultation records.
- Generate structured summaries.

The AI must never:

- Diagnose patients independently.
- Prescribe medication independently.
- Sign consultation notes.
- Submit consultation records without Doctor approval.

---

## Workflow Integration

After the Doctor approves the consultation summary, the Workflow Engine should automatically:

- Update the Patient Journey Timeline.
- Save the consultation record.
- Update the patient's medical history.
- Notify the next department if required.
- Create an Audit Log.


---

# Doctor Permissions

The Doctor may:

- Begin Consultation
- Record Clinical Notes
- Record Diagnosis
- Create Treatment Plans
- Request Laboratory Tests
- Create Prescriptions
- Create Referrals
- Schedule Follow-up
- Complete Consultation
- Activate Emergency Escalation

The Doctor may not:

- Modify another Doctor's completed consultation without appropriate permissions.
- Override audit logs.
- Remove completed workflow history.

All Doctor actions must respect:

- Role-Based Access Control (RBAC)
- Row Level Security (RLS)
- Audit Logging

---

# Acceptance Criteria

The Doctor AI Assistant & Human Doctor Workflow is complete when:

✓ Consultation preparation works.

✓ AI Consultation Summary works.

✓ AI Documentation Check works.

✓ Mandatory documentation validation works.

✓ Consultation Completion Validation works.

✓ Laboratory requests work.

✓ Prescriptions work.

✓ Referrals work.

✓ Follow-up planning works.

✓ Workflow Engine updates automatically.

✓ Patient Journey Timeline updates automatically.

✓ Existing clinical workflows continue operating without interruption.

---

# PART 11 — LABORATORY WORKFLOW & LABORATORY AI

## Overview

The Laboratory Department supports the Doctor by performing diagnostic investigations requested during the consultation.

Laboratory staff are responsible for collecting specimens, performing laboratory tests, verifying laboratory results and updating the patient's record.

The Laboratory AI Assistant supports laboratory staff by organising workflow, validating requests, tracking specimens and improving efficiency.

The Laboratory AI Assistant never diagnoses patients.

The Laboratory AI Assistant never releases clinical results directly to patients.

Only the Doctor is responsible for interpreting laboratory results and discussing them with the patient.

---

# Objectives

The Laboratory Workflow should:

- Receive laboratory requests from the Doctor.
- Verify the laboratory request.
- Prepare the patient.
- Collect specimens.
- Track specimens.
- Perform laboratory tests.
- Record laboratory results.
- Verify laboratory results.
- Return completed results to the Doctor.
- Update the Workflow Engine.

---

# Laboratory Responsibilities

Laboratory staff remain responsible for:

- Patient identification.
- Specimen collection.
- Specimen handling.
- Laboratory testing.
- Quality control.
- Verification of laboratory results.
- Uploading verified results.

Professional judgement always belongs to Laboratory staff.

---

# Laboratory AI Responsibilities

The Laboratory AI Assistant assists by:

- Reviewing laboratory requests.
- Checking patient identification.
- Tracking specimen status.
- Detecting incomplete requests.
- Organising laboratory workflows.
- Monitoring turnaround times.
- Generating laboratory workflow summaries.

The AI never interprets laboratory results.

The AI never diagnoses patients.

The AI never recommends treatment.

---

# Laboratory Workflow

Doctor Consultation

↓

Laboratory Request Created

↓

Workflow Engine

↓

Laboratory Queue

↓

Patient Called

↓

Specimen Collection

↓

Laboratory Processing

↓

Quality Verification

↓

Results Uploaded

↓

Workflow Engine

↓

Doctor Review Queue

↓

Doctor Reviews Results

↓

Workflow Continues

---

# Laboratory Request Validation

Every laboratory request should be validated before specimen collection begins.

The Laboratory AI Assistant should verify that the request contains:

- Patient Identity
- Requesting Doctor
- Requested Test
- Clinical Reason
- Priority Level
- Date and Time

If required information is missing, the request should not proceed until corrected.

The AI may highlight missing information but must never complete missing clinical details.

---

# Patient Identification

Before collecting any specimen, Laboratory staff must verify the patient's identity.

Verification may include:

- Patient Name
- Patient Number
- South African ID
- Passport
- Date of Birth
- Guardian Verification (where applicable)

Patient safety requires positive identification before every specimen collection.

---

# Specimen Collection

Health Nexus should support recording:

- Specimen Type
- Collection Time
- Collector
- Collection Site
- Collection Notes
- Specimen Status

Every specimen should receive a unique tracking identifier.

The Workflow Engine should monitor every specimen until the results have been verified.

---

# Specimen Tracking

Every laboratory specimen should receive a unique tracking record.

The Workflow Engine should monitor the specimen throughout the laboratory process.

Each specimen should move through predefined workflow states.

Example

Laboratory Request Created

↓

Specimen Collected

↓

Specimen Received

↓

Laboratory Processing

↓

Quality Verification

↓

Results Uploaded

↓

Doctor Review Pending

↓

Doctor Approved

↓

Results Released to Patient

↓

Workflow Complete

Every workflow state should include:

- Date
- Time
- Laboratory Staff Member
- Current Status
- Audit Log

The Workflow Engine should always know the current status of every specimen.

Patients should never see internal laboratory processing information.

Patients should only receive appropriate status updates.

---

# Patient Laboratory Result Access

Patients may access their laboratory results only after the results have been reviewed and released by the Doctor.

Before Doctor approval, the patient should receive a status update only.

Example

"Your laboratory tests have been completed and are awaiting review by your Doctor."

After Doctor approval, the patient may:

- View laboratory results.
- Download laboratory reports.
- Ask the AI questions about the released results.
- Review previous laboratory reports.

The AI should explain laboratory results using simple, patient-friendly language.

Examples

Patient:

"What does high cholesterol mean?"

AI:

"High cholesterol means there is more cholesterol in your blood than the recommended range. Your doctor will explain what this means for your health and whether any treatment or lifestyle changes are needed."

Patient:

"Is my blood sugar normal?"

AI:

"Your laboratory report shows your blood sugar result. Your doctor has reviewed the result. I can explain what the reported range means, but I cannot diagnose your condition or change your treatment plan."

The AI must always remind patients that the Doctor's advice takes priority over AI explanations.

The AI must never:

- Diagnose diseases.
- Recommend medication changes.
- Advise stopping medication.
- Interpret unreleased laboratory results.
- Override the Doctor's clinical opinion.

---

# AI Laboratory Follow-up

Once laboratory results have been reviewed and released by the Doctor, the AI may proactively assist the patient.

Example

Hello Thabo 👋

Your laboratory results have been reviewed by Dr Naidoo and are now available.

How may I help you today?

• View my laboratory report.

• Explain my laboratory results.

• View my doctor's notes.

• Book a follow-up appointment.

• Ask a question about my results.

The AI should always explain results using simple, patient-friendly language.

The AI should encourage patients to discuss any concerns with their Doctor.

If the Doctor has requested a follow-up appointment, the AI should immediately offer to schedule it.

The AI should never provide a diagnosis or recommend changes to medication or treatment.

---

# Patient Health Records

Health Nexus should allow patients to securely view their own health information through WhatsApp and the patient portal after successful identity verification.

Patients may access:

- Upcoming Appointments
- Previous Appointments
- Prescriptions
- Laboratory Results (after Doctor approval)
- Doctor Instructions
- Medical Certificates (where applicable)
- Vaccination History (where applicable)
- Vital Signs History
- Consultation History

The AI may assist patients by explaining their health information in clear and simple language.

Examples

Patient

"Show me my blood pressure history."

AI

"Here are your recorded blood pressure readings."

Patient

"What was my temperature during my last visit?"

AI

"Your recorded temperature was 37.1°C."

Patient

"Show my weight history."

AI

"The following weight measurements have been recorded during your clinic visits."

The AI should never alter medical records.

Patients may only view information they are authorised to access after identity verification.

---

# Personal Health Insights

Health Nexus should help patients understand their own health information using Artificial Intelligence.

The purpose of Personal Health Insights is to educate patients by explaining trends within their own medical records.

The AI should only use verified information that already exists in the patient's Health Nexus record.

The AI must never diagnose diseases or replace professional medical advice.

---

## Available Health Insights

Patients may ask questions about:

- Blood Pressure History
- Weight History
- Body Mass Index (BMI)
- Temperature History
- Blood Glucose History
- Pulse History
- Oxygen Saturation History
- Laboratory Result Trends
- Medication History
- Appointment History

---

## Example Conversations

Patient

"Show me my blood pressure history."

AI

"Here are your recorded blood pressure readings from your previous visits."

---

Patient

"Has my blood pressure improved?"

AI

"Your recent blood pressure readings are lower than your earlier visits.

This may indicate improvement.

Your Doctor will continue monitoring your progress during future consultations."

---

Patient

"Show me my weight changes."

AI

"Your recorded weight has changed from:

82 kg

↓

79 kg

over the last four clinic visits."

---

Patient

"Show me my previous laboratory results."

AI

"Here are the laboratory results that have been reviewed and released by your Doctor."

---

Patient

"What medication have I been prescribed before?"

AI

"These are the medications previously prescribed during your consultations."

---

## Educational Assistance

The AI may explain:

- Medical terms
- Laboratory terminology
- Vital signs
- Medication purpose
- Lifestyle advice already provided by the Doctor
- Follow-up instructions

The AI should always use simple, patient-friendly language.

---

## AI Safety Rules

The AI must never:

- Diagnose illnesses.
- Predict diseases.
- Change medication.
- Recommend stopping medication.
- Override the Doctor's advice.
- Reveal information belonging to another patient.

Whenever appropriate, the AI should remind patients to contact their Doctor or clinic if they have concerns about their health or if their symptoms worsen.

---

## Privacy and Security

Patients may only access their own Personal Health Insights after successful identity verification.

All requests must respect:

- Role-Based Access Control (RBAC)
- Row Level Security (RLS)
- Audit Logging

Every access to Personal Health Insights should be recorded for security and accountability.

---

# Laboratory Results

Once laboratory testing has been completed, Laboratory staff should record the verified results in Health Nexus.

Each laboratory result should include:

- Test Name
- Result
- Reference Range
- Unit of Measurement
- Collection Date
- Result Date
- Laboratory Staff Member
- Verification Status

The Workflow Engine should immediately update the patient's workflow once verified results have been uploaded.

The AI may organise and display laboratory results but must never modify laboratory values.

---

# Quality Verification

Before laboratory results are released, Laboratory staff must verify their accuracy.

Health Nexus should support:

- Result Verification
- Repeat Testing (if required)
- Result Corrections
- Verification Notes

Only verified laboratory results may continue through the workflow.

If a result requires correction, the Workflow Engine should:

- Prevent release.
- Record the correction.
- Update the Audit Log.

The AI may detect incomplete laboratory documentation but must never approve laboratory results.

Only authorised Laboratory staff may verify laboratory results.

---

# Doctor Review of Laboratory Results

Laboratory results must always return to the requesting Doctor before being released to the patient.

The Workflow Engine should automatically:

- Notify the Doctor.
- Move the patient to the Doctor Review Queue.
- Update the Patient Journey Timeline.
- Record the workflow transition.

The Doctor should:

- Review the laboratory results.
- Discuss the findings with the patient.
- Decide whether additional treatment is required.
- Decide whether medication is required.
- Decide whether follow-up is required.

Patients must never receive laboratory results that require clinical interpretation before Doctor review unless clinic policy and applicable regulations explicitly allow direct release for specific tests.

The AI may explain released laboratory results in simple language after the Doctor has approved their release.

The AI must never provide a diagnosis based on laboratory results.

---

# Laboratory Workflow Completion

When the Doctor has completed the laboratory review, the Workflow Engine should determine the patient's next workflow step.

Possible outcomes include:

- Return to Doctor Consultation.
- Send to Pharmacy.
- Schedule Follow-up.
- Complete Consultation.
- Refer to another Healthcare Facility.

The Workflow Engine should automatically:

- Update the Patient Journey Timeline.
- Update Workflow History.
- Notify the next department.
- Update Queue Dashboards.
- Generate an Audit Log.

The workflow must never end without a valid clinical outcome selected by the Doctor.

---

# Laboratory Permissions

Laboratory staff may:

- Receive laboratory requests.
- Collect specimens.
- Record specimen information.
- Perform laboratory testing.
- Upload laboratory results.
- Verify laboratory results.

Laboratory staff may not:

- Diagnose patients.
- Prescribe medication.
- Modify Doctor consultation notes.
- Release clinically significant results without the required Doctor review where applicable.

All Laboratory actions must respect:

- Role-Based Access Control (RBAC)
- Row Level Security (RLS)
- Audit Logging

---

# Acceptance Criteria

The Laboratory Workflow & Laboratory AI is complete when:

✓ Laboratory requests work.

✓ Patient identification works.

✓ Specimen tracking works.

✓ Laboratory results are verified.

✓ Doctor review occurs before release when required.

✓ Patients can securely access released results.

✓ AI explains released results in simple language.

✓ Personal Health Insights work.

✓ Workflow Engine updates automatically.

✓ Existing laboratory workflows remain operational.

---

# PART 12 — PHARMACY WORKFLOW & PHARMACY AI

## Workflow Engine Rule

The Workflow Engine remains the only component responsible for moving patients between workflow stages.

Departments must never move patients directly.

The Workflow Engine coordinates all patient movement.

---

## Overview

The Pharmacy Department is responsible for safely dispensing medication prescribed by authorised Doctors.

Pharmacists remain responsible for reviewing prescriptions, dispensing medication, counselling patients and ensuring medication safety.

The Pharmacy AI Assistant supports pharmacy staff by improving workflow efficiency, validating prescriptions and organising medication records.

The AI Pharmacy Assistant never prescribes medication.

The AI Pharmacy Assistant never changes prescriptions.

Only authorised healthcare professionals may prescribe medication.

---

# Objectives

The Pharmacy Workflow should:

- Receive prescriptions from the Doctor.
- Validate prescriptions.
- Review medication history.
- Detect possible medication conflicts.
- Dispense medication.
- Record dispensing.
- Provide patient counselling.
- Update the Workflow Engine.

---

# Pharmacy Responsibilities

Pharmacists remain responsible for:

- Reviewing prescriptions.
- Preparing medication.
- Dispensing medication.
- Explaining medication usage.
- Recording dispensing.
- Escalating prescription concerns.

Professional judgement always belongs to the Pharmacist.

---

# Pharmacy AI Responsibilities

The Pharmacy AI Assistant assists by:

- Organising prescriptions.
- Reviewing medication history.
- Detecting duplicate prescriptions.
- Detecting possible drug interaction alerts.
- Identifying incomplete prescriptions.
- Generating dispensing summaries.

The AI never changes a prescription.

The AI never prescribes medication.

The AI never overrides the Pharmacist.

---

# Pharmacy Workflow

Doctor Consultation

↓

Prescription Created

↓

Workflow Engine

↓

Pharmacy Queue

↓

Prescription Validation

↓

Medication Preparation

↓

Medication Dispensing

↓

Patient Counselling

↓

Workflow Engine

↓

Billing (if required)

↓

Consultation Complete

---

# Prescription Validation

Before medication is dispensed, the Pharmacist should verify the prescription.

The Pharmacy AI Assistant should validate:

- Patient Identity
- Prescribing Doctor
- Medication Name
- Strength
- Dosage
- Frequency
- Duration
- Quantity

If required information is missing, medication must not be dispensed until the prescription has been corrected.

The AI may identify missing information but must never complete or modify a prescription.


---

# Medication History Review

Before dispensing medication, the Pharmacy AI Assistant should display:

- Current Medication
- Previous Prescriptions
- Allergies
- Previous Adverse Drug Reactions
- Chronic Medication

The purpose is to help the Pharmacist perform a safe medication review.

The AI may highlight possible concerns but never makes the final decision.

The Pharmacist remains responsible for reviewing all medication before dispensing.

---

# Medication Safety Alerts

The Pharmacy AI Assistant should continuously analyse prescriptions for potential medication safety concerns before medication is dispensed.

The purpose is to support the Pharmacist in identifying possible risks while ensuring that all clinical decisions remain under professional supervision.

The AI may analyse:

- Duplicate medications
- Potential drug interactions
- Allergy conflicts
- Duplicate active ingredients
- High-risk medications
- Dosage outside the normal prescribed range
- Contraindications based on recorded patient information
- Expired prescriptions
- Previously recorded adverse drug reactions

The AI should never automatically reject a prescription.

Instead, the AI should notify the Pharmacist of the identified concern.

---

## Example Safety Alert

Potential medication interaction detected.

Medication:

Warfarin

New Prescription:

Amoxicillin

Recommendation:

Please review this prescription before dispensing.

---

## Allergy Alert

Patient Allergy

Penicillin

Requested Medication

Amoxicillin

Alert

Potential allergy conflict detected.

Please verify the prescription before dispensing.

---

## Duplicate Medication Alert

The patient is already receiving medication with the same active ingredient.

Please review before dispensing.

---

## Pharmacist Authority

The Pharmacist remains responsible for:

- Reviewing every alert.
- Consulting the prescribing Doctor when required.
- Deciding whether medication may be dispensed.
- Recording the final outcome.

The AI may only identify possible concerns.

The AI must never cancel, modify or approve prescriptions.

---

## Workflow Integration

Every medication safety alert should:

- Be recorded in the Patient Journey Timeline.
- Be recorded in Workflow History.
- Create an Audit Log.
- Notify the Pharmacist.
- Notify the Doctor when clarification is required.

---

# Medication Counselling

After medication has been dispensed, the Pharmacist should provide counselling to the patient.

The purpose of medication counselling is to ensure that patients understand how to use their medication safely and correctly.

The Pharmacist may record counselling information including:

- Medication Purpose
- Dosage Instructions
- Frequency
- Duration
- Route of Administration
- Food Instructions
- Storage Instructions
- Common Side Effects
- Important Warnings
- Missed Dose Instructions
- Follow-up Advice

The counselling record should become part of the patient's permanent medical record.

---

## AI Medication Education

After the Pharmacist has completed counselling, the AI may assist the patient by explaining the approved counselling information in simple, patient-friendly language.

Examples

Patient

"How should I take my antibiotics?"

AI

"According to the instructions recorded by your Pharmacist, take one tablet three times a day after meals for seven days. Complete the full course unless your Doctor advises otherwise."

---

Patient

"What happens if I forget a dose?"

AI

"According to the counselling information recorded during your visit, take the missed dose as soon as you remember unless it is almost time for your next scheduled dose. If you are unsure, please contact your clinic or Pharmacist."

---

Patient

"What is this medicine for?"

AI

"The medication was prescribed by your Doctor and dispensed by your Pharmacist. According to your counselling record, it is intended to help manage your condition. If you would like more information about your diagnosis or treatment plan, please speak with your Doctor."

---

## AI Safety Rules

The AI may:

- Repeat approved counselling information.
- Explain medical terms using simple language.
- Remind patients how to take medication.
- Remind patients about storage instructions.
- Explain common side effects that were recorded during counselling.

The AI must never:

- Change the prescribed dosage.
- Recommend stopping medication.
- Recommend starting new medication.
- Replace the advice of the Doctor or Pharmacist.
- Create counselling information that was not recorded by the Pharmacist.

Whenever appropriate, the AI should advise patients to contact their Doctor or Pharmacist if they experience unexpected side effects, worsening symptoms or have concerns about their medication.

---

## Workflow Integration

When medication counselling has been completed, the Workflow Engine should:

- Save the counselling record.
- Update the Patient Journey Timeline.
- Update the Workflow History.
- Notify Billing (if required).
- Generate an Audit Log.

Medication counselling becomes part of the patient's permanent visit record.

---

# Pharmacy Permissions

Pharmacists may:

- Review Prescriptions
- Validate Prescriptions
- Dispense Medication
- Record Medication Counselling
- Record Dispensing Notes
- Contact the Doctor regarding prescription clarification

Pharmacists may not:

- Diagnose patients.
- Change diagnoses.
- Modify prescriptions without Doctor authorisation.
- Close the Doctor consultation.

All Pharmacy actions must respect:

- Role-Based Access Control (RBAC)
- Row Level Security (RLS)
- Audit Logging

---

# Acceptance Criteria

The Pharmacy Workflow & Pharmacy AI is complete when:

✓ Prescription validation works.

✓ Medication history review works.

✓ Medication safety alerts work.

✓ Medication dispensing works.

✓ Medication counselling is recorded.

✓ AI explains approved counselling information.

✓ Workflow Engine updates automatically.

✓ Patient Journey Timeline updates automatically.

✓ Existing pharmacy workflows continue operating without interruption.

---

# PART 13 — BILLING, FINANCIAL RESPONSIBILITY & PAYMENT INTEGRATION

## Workflow Engine Rule

The Workflow Engine remains the only component responsible for moving patients between workflow stages.

Departments must never move patients directly.

The Workflow Engine coordinates all billing and payment workflows.

---

# Overview

The Billing Department is responsible for generating invoices, processing payments and issuing receipts.

Health Nexus supports multiple organisation types using the same Billing module.

Billing behaviour is determined by clinic configuration.

Supported organisation types include:

- Private Clinics
- Government Clinics
- NGO Clinics

The Billing AI Assistant supports administrative staff by organising invoices, validating billing information and tracking payment status.

The AI never creates invoices without workflow approval.

The AI never processes payments independently.

---

# Billing Objectives

The Billing Workflow should:

- Receive completed consultations.
- Generate invoices.
- Apply clinic pricing rules.
- Apply discounts where authorised.
- Determine payment requirements.
- Process payments.
- Generate receipts.
- Update the Workflow Engine.
- Complete the patient visit.

---

# Billing Responsibilities

Billing staff remain responsible for:

- Reviewing invoices.
- Applying authorised discounts.
- Confirming payments.
- Issuing receipts.
- Resolving billing disputes.

Professional judgement always belongs to Billing Staff.

---

# Billing AI Responsibilities

The Billing AI Assistant assists by:

- Preparing invoices.
- Detecting incomplete invoices.
- Checking billing accuracy.
- Calculating totals.
- Tracking payment status.
- Generating billing summaries.

The AI never changes billing policies.

The AI never authorises refunds.

The AI never processes payments independently.

---

# Payments & Billing Workflow

The Workflow Engine controls when billing and financial processing occur during the patient journey.

Payment timing is determined by clinic configuration and financial policy.

A clinic may require payment:

- Before a service.
- During a workflow stage.
- After a service.
- At the end of a visit.
- Through a medical aid or insurance process.
- Through a sponsored or donor-funded arrangement.
- Through an approved payment arrangement.

The Workflow Engine must never assume that every patient must make a direct payment.

The financial workflow is:

Patient
↓
Appointment / Consultation / Service
↓
Patient Checked In
↓
Service Determined
↓
Financial Assessment
↓
Invoice / Charge Generated (if applicable)
↓
Determine Financial Responsibility
↓
Financial Processing
↓
Financial Requirement Resolved
↓
Workflow Engine
↓
Next Patient Workflow Stage

## Financial Responsibility

Health Nexus must determine who is financially responsible for each service.

Possible financial responsibility types include:

- Patient
- Medical Aid / Insurance
- Patient + Medical Aid / Insurance
- Government / Public Funding
- NGO / Donor / Sponsor
- Clinic-funded Service
- Other configured funding source

Financial responsibility must be determined from:

- Clinic configuration
- Service configuration
- Patient information
- Medical Aid information
- Applicable funding rules
- Authorised billing rules

The Billing AI Assistant may assist staff by organising and presenting this information, but it must never independently determine or change financial policy.


# Billing Configuration

Billing behaviour is determined by clinic configuration.

Organisation type must never be used as a hard-coded assumption about whether a patient must pay.

For example:

- A private clinic may require payment.
- A government clinic may provide some services free of charge and charge for other services according to applicable rules.
- An NGO clinic may provide sponsored services while charging for other services.
- A clinic may accept Medical Aid for some services but not others.
- A clinic may have different financial rules for different patient categories.

The Workflow Engine must use the configured financial rules for the specific clinic, service and patient.

Clinic configuration may include:

- Billing enabled
- Accepted payment methods
- Accepted Medical Aid providers
- Medical Aid processing enabled
- Patient co-payment rules
- Sponsored services
- Donor-funded services
- Government-funded services
- Payment arrangement support
- Payment timing
- Service pricing
- Discounts
- Tax configuration where applicable
- Yoco enabled
- EFT enabled
- Cash enabled
- Card payment enabled

---

# Invoice Generation

After the Doctor completes the consultation, the Workflow Engine should automatically prepare an invoice.

The invoice may include:

- Consultation Fee
- Laboratory Charges
- Medication Charges
- Additional Services
- Discounts
- Taxes (where applicable)

The Billing Officer should review the invoice before payment when required by clinic policy.

Every invoice should receive a unique invoice number.

An invoice may contain multiple financial responsibility components.

For example:

Service Total: R850

Medical Aid Responsibility: R650

Patient Responsibility: R200

The invoice must clearly distinguish:

- Total Service Amount
- Amount Covered by Medical Aid / Insurance
- Patient Responsibility
- Sponsored / Funded Amount
- Amount Paid
- Outstanding Amount
---

# Financial Assessment Decision

Before a patient proceeds through a financially controlled workflow stage, the Workflow Engine must determine the financial state of the relevant service.

The decision must not be based only on organisation type.

The Workflow Engine should evaluate:

1. Is billing enabled for this clinic?
2. Is the service billable?
3. What is the configured service price?
4. Does the patient have Medical Aid / Insurance?
5. Is the Medical Aid provider accepted by the clinic?
6. Does the service qualify for Medical Aid / Insurance?
7. Is authorisation required?
8. Is there a patient co-payment?
9. Is the service sponsored or donor-funded?
10. Is the service government-funded?
11. Is a payment arrangement permitted?
12. Is direct patient payment required?

The result must produce a financial state.

Possible states include:

- NO_CHARGE
- PATIENT_PAYMENT_REQUIRED
- MEDICAL_AID_PENDING
- MEDICAL_AID_APPROVED
- MEDICAL_AID_REJECTED
- PATIENT_COPAYMENT_REQUIRED
- SPONSORED
- GOVERNMENT_FUNDED
- PAYMENT_PENDING
- PAYMENT_FAILED
- PAYMENT_COMPLETED
- PAYMENT_ARRANGEMENT_APPROVED
- FINANCIAL_REQUIREMENT_RESOLVED

The Workflow Engine determines the next workflow step from the resulting financial state.

---

# Medical Aid / Insurance Workflow

Health Nexus must support patients whose services are partially or fully funded through Medical Aid / Insurance.

The workflow is:

Patient
↓
Medical Aid Information Identified
↓
Check Accepted Provider
↓
Verify Patient / Membership Information
↓
Determine Service Coverage
↓
Authorisation Required?
↓
Financial Responsibility Calculated
↓
Medical Aid Responsibility
+
Patient Responsibility
↓
Medical Aid Processing / Claim
+
Patient Co-payment (if applicable)
↓
Financial Requirement Resolved
↓
Workflow Engine
↓
Continue Patient Journey

Medical Aid must never be treated as an automatic guarantee of payment.

The system must distinguish between:

- Medical Aid information captured
- Medical Aid verified
- Coverage confirmed
- Authorisation pending
- Authorisation approved
- Authorisation rejected
- Claim submitted
- Claim paid
- Patient co-payment required
- Patient payment completed


# Payment Timing

Payment timing is configurable per clinic and may vary by service.

Supported models include:

### Payment Before Service

Patient
↓
Financial Assessment
↓
Payment
↓
Service

### Payment During Workflow

Service
↓
Financial Assessment
↓
Payment
↓
Next Workflow Stage

### Payment After Service

Service
↓
Invoice
↓
Payment
↓
Next Workflow Stage

### Final Visit Payment

Multiple Services
↓
Final Invoice
↓
Financial Assessment
↓
Payment / Funding
↓
Visit Completion

The Workflow Engine must use the clinic's configured payment timing rules.

No single payment timing model should be hard-coded for every organisation.


# Payment Methods

Health Nexus should support multiple payment methods.

Supported payment methods include:

- Cash
- Bank Card
- Yoco Terminal
- Yoco Payment Link
- EFT (where enabled)
Additional financial processing methods may include:

- Medical Aid / Insurance Claim
- Patient Co-payment
- Sponsored Payment
- Donor Funding
- Government Funding
- Approved Payment Arrangement


The Workflow Engine should automatically record:

- Payment Method
- Payment Time
- Payment Status
- Transaction Reference
- Amount Paid

When payment is completed successfully:

- Invoice Status becomes Paid.
- Receipt is generated automatically.
- Patient Journey Timeline is updated.
- Workflow History is updated.
- Audit Log is created.

---

# AI Payment & Financial Assistant

The AI Billing Assistant may communicate with patients through WhatsApp after an invoice has been generated.

The AI Payment & Financial Assistant must first determine the patient's financial state before presenting payment options.

The AI may communicate:

- Amount owed by the patient
- Medical Aid status
- Patient co-payment
- Sponsored status
- Payment options
- Payment arrangement options
- Payment confirmation
- Receipt availability

The AI must never claim that a Medical Aid claim has been approved or paid unless that status has been confirmed by the appropriate system or authorised billing workflow.

Example

Hello Onele 👋

Your consultation has been completed.

Invoice Total

R850.00

How would you like to pay?

• Pay Securely Now

• Pay at the Clinic

• Request Invoice by Email

If the patient selects "Pay Securely Now", the Workflow Engine should initiate the configured Yoco payment process.

After successful payment:

- Send payment confirmation.
- Generate the receipt.
- Email the receipt if requested.
- Mark the invoice as Paid.
- Complete the visit workflow.

The AI Billing Assistant must never process payments directly.

All payment confirmations must come from the payment provider and the Workflow Engine.

---

## Example WhatsApp Payment Confirmation

Once the Workflow Engine receives successful payment confirmation from Yoco, the AI Payment Assistant should immediately notify the patient.

Example

Hello Onele 👋

Your payment has been received successfully.

Receipt Number

INV-2026-001245

Amount Paid

R850.00

Your visit has now been completed.

Your receipt is now available.

If you need help with:

• Your medication

• Laboratory results

• Doctor instructions

• Follow-up appointment

Simply send me a message at any time.

Thank you for choosing Health Nexus.

We wish you a speedy recovery.

Health Nexus



# Yoco Payment Integration

Health Nexus integrates with Yoco to provide secure payment processing for private clinics.

The Workflow Engine remains responsible for the billing workflow.

Yoco is responsible only for processing payments.

The Workflow Engine must never assume that a payment has been completed.

Payment completion may only occur after receiving successful confirmation from Yoco.

Supported Yoco payment methods include:

- Card Payments
- Contactless Payments
- Payment Links
- QR Code Payments (where supported)

Every successful payment should record:

- Transaction ID
- Transaction Reference
- Payment Method
- Amount
- Currency
- Payment Date
- Payment Time
- Payment Status

If payment fails, the Workflow Engine should:

- Keep the invoice as Unpaid.
- Record the failed payment.
- Notify the patient.
- Notify Billing Staff (if applicable).
- Allow another payment attempt.
- Allow another payment method.

After every successful or failed payment, the Workflow Engine should automatically:

- Update the Patient Journey Timeline.
- Update Workflow History.
- Update the Invoice Status.
- Generate an Audit Log.
- Notify the patient.

---

# Receipt Generation

Every successful payment should automatically generate an official receipt.

Each receipt should include:

- Receipt Number
- Invoice Number
- Patient Name
- Clinic Name
- Organisation Name
- Consultation Date
- Services Provided
- Laboratory Charges (if applicable)
- Medication Charges (if applicable)
- Total Amount
- Payment Method
- Payment Reference
- Payment Date and Time

The Workflow Engine should automatically:

- Save the receipt.
- Link it to the patient's visit.
- Make it available to authorised staff.
- Make it available to the patient after identity verification.

Receipts should never be edited after payment has been confirmed.

If corrections are required, a credit note or reversal process must be followed according to clinic policy.

---

# Payment Failures

Health Nexus should safely manage unsuccessful payments.

Examples include:

- Card Declined
- Insufficient Funds
- Network Timeout
- Cancelled Payment
- Payment Gateway Error

If payment fails:

The Workflow Engine should:

- Keep the invoice unpaid.
- Record the failure.
- Notify the patient.
- Notify Billing Staff (if applicable).
- Allow another payment attempt.
- Allow another payment method.

No clinical records should be affected by a failed payment.

---

# Refund Management

Refunds should only be processed by authorised Billing Staff.

Every refund should include:

- Refund Reason
- Original Invoice
- Original Payment Reference
- Refund Amount
- Authorising Staff Member
- Date and Time

The Workflow Engine should:

- Update the invoice.
- Update the receipt history.
- Record the refund.
- Create an Audit Log.

The AI Billing Assistant must never authorise refunds.

---

# Financial Audit Trail

Every financial transaction should be permanently recorded.

Examples include:

- Invoice Created
- Invoice Updated
- Payment Attempted
- Payment Successful
- Payment Failed
- Refund Processed
- Receipt Generated

Every event should include:

- Date
- Time
- User
- Clinic
- Organisation
- Amount
- Payment Method
- Transaction Reference

Financial records must never be deleted.

Corrections should always be recorded as new financial events.

---

# Billing Permissions

Billing Staff may:

- Review invoices.
- Confirm payments.
- Process authorised refunds.
- Generate receipts.
- View payment history.

Billing Staff may not:

- Modify Doctor consultations.
- Modify Laboratory results.
- Modify Prescriptions.
- Change Patient Records.

All Billing actions must respect:

- Role-Based Access Control (RBAC)
- Row Level Security (RLS)
- Audit Logging




The AI Payment Assistant should also provide options to:

- View Receipt
- Download Receipt (PDF)
- Email Receipt
- View Medication Instructions
- View Laboratory Results (if released)
- Book a Follow-up Appointment
- Chat with the AI Assistant

The Workflow Engine should record:

- Payment Completed
- Receipt Generated
- Patient Notified
- Patient Journey Timeline Updated
- Workflow History Updated
- Audit Log Created


---

# Acceptance Criteria

The Payments & Billing Workflow is complete when:

✓ Billing configuration works.

✓ Payment requirement decision works.

✓ Multiple payment methods are supported.

✓ Yoco integration works.

✓ Payment links work.

✓ Automatic receipts are generated.

✓ Payment failures are handled safely.

✓ Refund management works.

✓ Financial audit history is complete.

✓ Workflow Engine updates automatically.

✓ Existing billing workflows continue operating without interruption.



---

# Visit Completion

Once all required workflow stages have been completed, the Workflow Engine should officially close the patient's visit.

Before a visit may be closed, the Workflow Engine should verify:

- Consultation Completed
- Laboratory Workflow Completed (if applicable)
- Pharmacy Workflow Completed (if applicable)
- Financial Requirement Resolved (if applicable)
- Receipt Generated (if applicable)

Once verified, the Workflow Engine should:

- Close the visit.
- Update the Patient Journey Timeline.
- Update Workflow History.
- Create an Audit Log.
- Notify the Follow-up AI Assistant.

The Follow-up AI Assistant becomes responsible for all post-visit patient communication.



---

# PART 14 — FOLLOW-UP AI & PATIENT CARE

## Workflow Engine Rule

The Workflow Engine remains the only component responsible for moving patients between workflow stages.

The Follow-up AI Assistant never starts follow-up conversations unless a patient's visit has been officially completed by the Workflow Engine.

---

# Overview

The Follow-up AI Assistant continues supporting patients after they leave the clinic.

Its purpose is to improve recovery, encourage treatment adherence and maintain communication between the patient and the clinic.

The AI Follow-up Assistant never replaces the Doctor, Nurse or Pharmacist.

The AI provides education, reminders and support using information already approved during the patient's visit.

---

# Objectives

The Follow-up AI should:

- Send Visit Summaries.
- Send Medication Reminders.
- Send Follow-up Appointment Reminders.
- Check on patient recovery.
- Answer questions about approved treatment instructions.
- Encourage patients to return when necessary.
- Escalate concerns back to the clinic when appropriate.


---

# Visit Summary

Immediately after the Workflow Engine closes the visit, the AI should send the patient a Visit Summary.

Example

Hello Onele 👋

Your visit at Joburg Clinic has been completed successfully.

--------------------------------

TODAY'S VISIT SUMMARY

Clinic

Joburg Clinic

Doctor

Dr Naidoo

Reason for Visit

Headache

Doctor's Assessment

Migraine

Medication

Paracetamol

Laboratory

Completed

Follow-up Appointment

14 July 2026

Payment Status

Paid ✅

Receipt

Available

--------------------------------

Need help?

You can ask me about:

• My medication

• My laboratory results

• My doctor's instructions

• My follow-up appointment

• My previous visits

Would you like to?

1️⃣ View Receipt

2️⃣ View Prescription

3️⃣ View Laboratory Results

4️⃣ Book Follow-up

5️⃣ Chat with AI Assistant

Simply send me a message at any time.

Thank you for choosing Health Nexus.

We wish you a speedy recovery.

The Visit Summary becomes part of the patient's permanent visit history.


---

# Recovery Check-in

The Follow-up AI Assistant should check on the patient's recovery according to the Doctor's follow-up plan.

Example

Hello Onele 👋

I hope you're feeling better today.

During your last visit, Dr Naidoo asked you to take Paracetamol.

How have you been feeling since your appointment?

Patients may respond naturally.

Examples include:

- I feel much better.
- The headache is gone.
- I'm still in pain.
- The medication is not helping.
- I have a new symptom.

The AI should understand natural language while remaining within its approved role.

The AI must never diagnose new medical conditions or change the Doctor's treatment plan.


---

# Medication Reminders

The Follow-up AI Assistant should remind patients to take medication according to the instructions approved by the Doctor and Pharmacist.

Reminder schedules should be generated from the prescribed medication instructions.

Examples

Hello Onele 👋

This is your medication reminder.

Medication

Paracetamol

Instruction

Take one tablet after breakfast.

Remember to follow the instructions provided by your Doctor and Pharmacist.

Have you taken today's dose?

Patients may respond naturally.

Examples

- Yes
- Not yet
- I forgot
- I have finished the medication

The AI may encourage medication adherence but must never change the prescribed dosage or treatment plan.


---

# Follow-up Appointment Reminders

The Follow-up AI Assistant should automatically remind patients about upcoming appointments.

Example

Hello Onele 👋

This is a reminder about your upcoming follow-up appointment.

Clinic

Joburg Clinic

Doctor

Dr Naidoo

Date

14 July 2026

Time

10:30

If you need to reschedule your appointment, simply send me a message.

The Workflow Engine should update the Appointment Engine whenever appointments are confirmed, cancelled or rescheduled.


---

# Patient Questions

Patients should be able to ask questions naturally after their visit.

Examples

- Show my prescription.
- Explain my medication.
- Show my laboratory results.
- What did my Doctor say?
- When is my next appointment?
- Show my receipt.
- Show my previous visits.

If a patient asks about information from another clinic, the AI should explain that it can only access records for the current clinic unless the patient has shared information through the Referral Engine.

The AI should answer using only information already recorded in Health Nexus.

The AI must never invent information or provide clinical advice beyond the approved medical record.


---

# Escalation to the Clinic

The Follow-up AI Assistant should recognise when a patient's response requires further attention.

Examples include:

- My pain is getting worse.
- I cannot breathe.
- I am bleeding.
- The medication is making me very sick.
- I have developed new symptoms.

When a potentially urgent situation is detected, the AI should:

- Advise the patient to seek urgent medical care.
- Recommend contacting the clinic immediately.
- Notify the clinic if emergency notifications are enabled.
- Record the conversation in the Patient Journey Timeline.
- Create an Audit Log.

The AI must never attempt to manage medical emergencies through chat alone.


---

# Follow-up Completion

Once the Doctor's follow-up plan has been completed, the Workflow Engine should close the Follow-up Workflow.

The Workflow Engine should:

- Mark the Follow-up Plan as Complete.
- Update the Patient Journey Timeline.
- Update Workflow History.
- Generate an Audit Log.

The patient's permanent medical history should continue to be available for future visits.

Future consultations should build upon previous medical history instead of creating isolated records.

---

# Follow-up AI Permissions

The Follow-up AI Assistant may:

- Send Visit Summaries.
- Send Medication Reminders.
- Send Appointment Reminders.
- Explain approved medical information.
- Answer patient questions using recorded information.
- Encourage patients to contact the clinic when appropriate.

The Follow-up AI Assistant must never:

- Diagnose illnesses.
- Change treatment plans.
- Prescribe medication.
- Cancel prescriptions.
- Replace the Doctor, Nurse or Pharmacist.

All Follow-up AI actions must respect:

- Role-Based Access Control (RBAC)
- Row Level Security (RLS)
- Audit Logging

---

# Acceptance Criteria

The Payments & Billing Workflow is complete when:

✓ Billing configuration works.

✓ Financial assessment works.

✓ Financial responsibility can be determined.

✓ Patient payment is supported.

✓ Medical Aid / Insurance workflows are supported.

✓ Patient co-payments are supported.

✓ Sponsored and donor-funded services are supported.

✓ Government-funded or subsidised services can be configured.

✓ Payment timing can be configured.

✓ Multiple payment methods are supported.

✓ Yoco integration works.

✓ Payment links work.

✓ Payment confirmations are verified.

✓ Automatic receipts are generated where applicable.

✓ Payment failures are handled safely.

✓ Medical Aid / Insurance status is tracked.

✓ Refund management works.

✓ Financial audit history is complete.

✓ Workflow Engine updates automatically.

✓ Existing billing workflows continue operating without interruption.




PART 15 — ANALYTICS & REPORTING
# 15.1 Purpose

Health Nexus is more than an Electronic Medical Record (EMR).

It is a healthcare operations platform.

Every workflow generates operational data that can improve:

patient care
clinic efficiency
staffing
medicine planning
financial reporting
laboratory utilization
pharmacy performance
AI quality
government reporting
private reporting
management decisions

Analytics must be generated from existing workflows rather than introducing duplicate data collection.

The Workflow Engine remains the source of truth.

## 15.2 Engineering Philosophy

Analytics must never interrupt clinical workflows.

Reporting is read-only.

No analytics feature should modify patient records.

Reports should be generated from existing data already captured by:

Reception
Queue
Nurse
Doctor
Laboratory
Pharmacy
Billing
Notifications
WhatsApp
Workflow Timeline
Audit Logs


## 15.3 Reporting Architecture

Patient Workflow

        │
        ▼

Workflow Engine

        │
        ▼

Workflow Timeline

        │
        ├───────────────► Dashboard
        │
        ├───────────────► Reports
        │
        ├───────────────► AI Insights
        │
        ├───────────────► Government Statistics
        │
        ├───────────────► Operational Metrics
        │
        ▼

Audit Logs

Analytics consumes existing workflow events.

It never creates workflow events.

## 15.4 Existing Data Sources

The analytics module reuses:

Patient

Appointments

Queues

Consultations

Vitals

Diagnoses

Prescriptions

Laboratory Requests

Laboratory Results

Medicine Inventory

Billing

Payments

Workflow History

Notifications

WhatsApp Conversations

Audit Logs

No duplicate storage.


# 15.5 Executive Dashboard

Clinic administrators require an operational overview.

Dashboard widgets include:

Today's Patients

Current Queue Length

Average Waiting Time

Patients Seen

Appointments Completed

Appointments Missed

Laboratory Tests Requested

Laboratory Tests Completed

Prescriptions Issued

Medicines Dispensed

Outstanding Bills

Revenue Today

Revenue This Month

Low Stock Medicines

Critical Alerts

AI Recommendation Count


## 15.6 Reception Metrics

Collected automatically.

Metrics:

Patients Registered

Walk-ins

Appointments

Late Arrivals

No Shows

Average Check-in Time

Average Registration Time

Reception Workload

Peak Hours


# 15.7 Queue Analytics

Workflow Engine already records queue events.

Metrics include:

Average Queue Time

Maximum Queue Time

Current Queue

Queue by Doctor

Queue by Nurse

Emergency Queue

Priority Queue

Cancelled Queue

Transferred Queue

Completed Queue


# 15.8 Nurse Metrics

Collected automatically.

Examples:

Patients Triaged

Vitals Recorded

Average Consultation Preparation Time

High-Risk Patients

Emergency Patients

Vital Alerts

Escalations


## 15.9 Doctor Analytics

Doctor reports include:

Patients Seen

Average Consultation Time

Diagnoses by Category

Referrals

Prescriptions

Follow-up Appointments

Admission Recommendations

Laboratory Requests

AI Suggestions Accepted

AI Suggestions Rejected


## 15.10 Laboratory Analytics

Metrics include:

Tests Requested

Tests Completed

Average Processing Time

Pending Results

Abnormal Results

Rejected Samples

Machine Downtime

Workload by Technician


## 15.11 Pharmacy Analytics

Reports include:

Medicines Dispensed

Prescription Volume

Average Dispensing Time

Controlled Medicines

Out-of-Stock Medicines

Expired Medicines

Inventory Value

Medicine Consumption Trends

Reorder Recommendations


## 15.12 Billing Analytics

Financial dashboard includes:

Invoices Generated

Invoices Paid

Outstanding Balance

Revenue Today

Revenue Weekly

Revenue Monthly

Payment Method Distribution

Yoco Transactions

Cash Payments

Medical Aid Claims

Refunds


## 15.13 AI Analytics

AI should measure its own performance.

Metrics:

AI Conversations

Conversation Success Rate

Human Escalations

Intent Detection Accuracy

Average AI Response Time

Doctor AI Usage

Nurse AI Usage

Laboratory AI Usage

Pharmacy AI Usage

Follow-up AI Completion

Recommendation Acceptance Rate

### AI Context Analytics

The AI platform should also provide operational analytics about clinic-specific AI usage.

Examples include:

- AI conversations by clinic
- AI conversations by department
- Most common patient requests
- Referral recommendations generated
- Capability-based referral trends
- AI escalation frequency
- AI language usage
- Average patient satisfaction with AI interactions

These analytics should assist organisations in improving patient communication without exposing information from other organisations.


## 15.14 WhatsApp Analytics

Existing WhatsApp services remain unchanged.

ConversationAI adds reporting only.

Metrics:

Messages Received

Messages Sent

Conversation Duration

Average Response Time

Appointment Bookings

Appointment Cancellations

Reminder Success

Delivery Success

Read Rate

Conversation Completion Rate



## 15.15 Population Health Analytics

Health Nexus can provide clinic-level trends without exposing personal information.

Examples:

Common Diagnoses

Disease Trends

Age Distribution

Gender Distribution

Seasonal Illnesses

Vaccination Coverage

Chronic Disease Statistics

Maternal Health

Child Health

Mental Health

Hypertension

Diabetes

Tuberculosis

HIV Follow-up Statistics

These reports should aggregate data and avoid exposing individual patient identities unless the user's role explicitly permits it.

# 15.16 Inventory Intelligence

Existing Pharmacy workflow provides inventory information.

Analytics derives:

Fast Moving Medicines

Slow Moving Medicines

Expiry Forecast

Supplier Performance

Medicine Usage by Disease

Projected Stock Requirements

Emergency Stock Levels


## 15.17 Operational KPIs

Each clinic should have standard KPIs.

Examples:

Average Patient Journey

Average Waiting Time

Doctor Utilization

Nurse Utilization

Laboratory Turnaround

Pharmacy Turnaround

Appointment Utilization

Patient Satisfaction

Billing Collection Rate

AI Automation Rate

# 15.18 AI Predictive Analytics

Once sufficient historical data exists, AI can generate operational predictions such as:

Expected patient volume

Expected queue length

Medicine demand forecasts

Likely no-show appointments

Staffing requirements

Laboratory workload

Pharmacy workload

These predictions are advisory only and do not alter workflow execution automatically.


## 15.19 Report Export

Supported exports:

PDF

Excel

CSV

Scheduled Email Reports

Clinic administrators should be able to schedule recurring reports without impacting transactional workloads.



# 15.20 Row Level Security

Every report must obey RLS.

Users can only view data belonging to:

their clinic

their organization

their assigned permissions

No report may bypass existing authorization.



## 15.21 Performance Requirements

Analytics must never slow operational workflows.

Recommendations:

Prefer read replicas or reporting views where appropriate.
Use materialized views or cached aggregates for expensive historical reports.
Generate large reports asynchronously.
Schedule heavy aggregation during off-peak hours.
Cache dashboard metrics with sensible refresh intervals.
Avoid long-running queries against live transactional tables during busy clinic hours.


## 15.22 Existing Service Integration

This module integrates with existing services only.

No replacements are made.

Workflow Engine
        │
        ▼

Workflow Timeline

        │
        ▼

Analytics

        │
        ├── Dashboard
        ├── Reports
        ├── AI Insights
        ├── Government Reports
        ├── Operational KPIs
        ├── WhatsApp Metrics
        └── Financial Reports

All analytics remain consumers of existing events rather than producers of new workflow actions.

## 15.23 Implementation Rules

The Analytics module must:

- Reuse existing Workflow Engine events.
- Never create duplicate business data.
- Never modify patient records.
- Respect Role-Based Access Control (RBAC).
- Enforce Row Level Security (RLS) on all queries.
- Record report generation in Audit Logs where required.
- Integrate with the Notification System for scheduled reports.
- Use asynchronous processing for large reports.
- Support future AI-driven analytics without changing the existing reporting architecture.

End of Part 15

PART 16 — EXISTING SYSTEM INTEGRATION
16.1 Purpose

Health Nexus is an existing production healthcare platform with working clinical and operational workflows.

The objective of this phase is integration, not replacement.

All new AI capabilities must integrate with the existing platform while preserving current functionality, user experience, security, and data integrity.

The AI layer enhances decision support, automation, and communication, but it must never replace the Workflow Engine or the authority of healthcare professionals.

16.2 Integration Philosophy

Every implementation must follow these principles:

Inspect existing code before creating new functionality.
Reuse existing services whenever possible.
Extend existing APIs instead of replacing them.
Preserve existing workflows.
Avoid unnecessary database changes.
Maintain backward compatibility.
Keep the Workflow Engine as the source of truth.
Ensure AI operates as an assistant, not a controller.
Minimize disruption to existing users during deployment.
16.3 Existing Platform Overview

The current Health Nexus platform already includes:

Authentication
Multi-Clinic Support
Patient Registration
Reception Workflow
Queue Management
Appointment Engine
Nurse Workflow
Doctor Workflow
Laboratory Workflow
Pharmacy Workflow
Billing
Notifications
WhatsApp Integration
Workflow Engine
Audit Logs
Role-Based Access Control (RBAC)
Row Level Security (RLS)

These components remain the operational foundation of the platform.

16.4 High-Level Architecture
                  Patients
                      │
                      ▼
              WhatsApp / Web / Staff
                      │
                      ▼
             Existing Application Layer
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
 Workflow Engine   Existing APIs   Existing Services
        │             │             │
        └─────────────┼─────────────┘
                      │
                      ▼
                ConversationAI
                      │
                      ▼
                 Ollama AI Layer
                      │
                      ▼
            AI Suggestions & Insights
                      │
                      ▼
               Human Decision Maker

The Workflow Engine continues to control all patient movement and business processes.

16.5 Existing Service Reuse

The following services must remain in place and be extended where necessary:

services/

notifications/

whatsapp/

workflow-notifications/

clinic-settings.service.ts

scheduling.service.ts

whatsapp.incoming.ts

whatsapp.delivery.ts

whatsapp.service.ts

whatsapp.conversation.ts

whatsapp.templates.ts

whatsapp.monitoring.ts

These services should not be removed or rewritten unless there is a critical engineering justification.

16.6 WhatsApp Integration

The existing WhatsApp infrastructure remains unchanged.

Current responsibilities continue to include:

Message delivery
Incoming webhook processing
Template messages
Delivery tracking
Monitoring
Notification integration

Only the conversation handling logic is upgraded.

Current flow:

Patient
   │
   ▼
WhatsApp Cloud API
   │
   ▼
whatsapp.incoming.ts
   │
   ▼
ConversationAI
   │
   ▼
Workflow Engine
   │
   ▼
Existing Services

This preserves the investment in the current WhatsApp integration.

16.6.1 Clinic AI Context

Each organisation may operate its own WhatsApp Business number.

Although all organisations share the same Health Nexus AI Engine, every AI conversation must operate within the context of the receiving organisation.

The Context Engine should identify:

- Organisation
- Clinic
- WhatsApp Number
- Clinic Configuration
- Capability Profile
- Active Workflow

The AI Assistant should always identify itself as belonging to the current clinic.

No AI conversation may access another organisation's information unless authorised through the Referral Workflow and patient consent.

16.7 Conversation Layer Upgrade

The existing conversation logic should evolve into a dedicated ConversationAI component.

AI Conversation Service responsibilities include:

Intent detection
Context management
Multi-turn conversations
Language understanding
Conversation memory
Escalation to staff
Workflow initiation
AI response generation

AI Conversation Service must not bypass workflow validation or authorization.

16.8 Workflow Engine Integration

The Workflow Engine remains responsible for:

Patient state transitions
Queue movement
Appointment status
Clinical workflow progression
Notification triggers
Audit events
Timeline updates

AI can recommend actions but cannot directly change workflow states without invoking the existing workflow processes.

16.9 Notification System Integration

The Notification System continues to handle:

Appointment reminders
Queue notifications
Billing notifications
Laboratory result notifications
Pharmacy notifications
Follow-up reminders
Internal staff notifications

AI may request notifications, but delivery must continue through the existing notification services.

16.10 Patient Journey Timeline

Every AI interaction must become part of the existing Patient Journey Timeline where appropriate.

Examples:

AI appointment booking
AI symptom collection
AI follow-up conversation
AI education provided
AI escalation to nurse
AI escalation to doctor

This maintains a complete chronological record of patient interactions.

16.11 Audit Log Integration

AI activity must be auditable.

Examples of events:

AI conversation started
AI recommendation generated
AI recommendation accepted
AI recommendation rejected
AI escalation performed
AI summary created

Audit records should include:

Timestamp
User or patient identifier
Clinic identifier
AI module
Event type
Outcome
16.12 Existing API Reuse

Existing APIs should be reused wherever possible.

Preferred approach:

ConversationAI
        │
        ▼
 Existing API
        │
        ▼
 Existing Service
        │
        ▼
 Database

Avoid introducing duplicate endpoints that perform the same business function.

16.13 Database Integration

Before creating new tables:

Inspect existing schema.
Reuse existing tables where appropriate.
Extend schemas only when necessary.
Preserve existing relationships.
Maintain referential integrity.

New tables should be introduced only when there is no suitable existing structure.

16.14 Multi-Clinic Compatibility

Every integration must remain clinic-aware.

All operations must continue to respect:

clinic_id
Organization boundaries
Tenant isolation
Clinic settings
Clinic-specific workflows

No AI process may expose data across clinics.

16.14.1 Staff Membership Context

A staff member may belong to multiple organisations through independent memberships.

Before granting access, the Context Engine must determine the staff member's active organisation and clinic.

Every request must execute within the selected membership context.

Memberships determine:

- Organisation
- Clinic
- Role
- Permissions
- Workflow Visibility
- AI Context

Changing organisations should reload the operational context without requiring multiple user accounts.

16.15 Role-Based Access Control (RBAC)

Existing RBAC remains authoritative.

AI responses must respect user permissions.

Examples:

Receptionists cannot access laboratory results unless already permitted.

Pharmacists cannot view billing information unless authorized.

Clinic Administrators retain management-level visibility according to existing roles.

AI must never disclose information beyond the permissions of the requesting user.

16.16 Row Level Security (RLS)

Every database query initiated by AI must comply with existing RLS policies.

AI services must never bypass:

Clinic isolation
Organization isolation
User permissions
Existing security policies

No direct database access should circumvent Supabase security controls.

16.17 Error Handling

Integration failures should degrade gracefully.

Examples:

AI unavailable → continue with standard workflow.
Ollama offline → existing conversation logic or predefined responses.
AI timeout → notify user and continue manually.
External API unavailable → queue request for retry where appropriate.

Clinical operations must continue even when AI services are unavailable.

16.18 Backward Compatibility

All existing user interfaces, APIs, workflows, and integrations should continue functioning after AI integration.

Any new functionality must be additive rather than disruptive.

Versioning should be used where API changes are unavoidable.

16.19 Performance Considerations

AI processing must not introduce unacceptable delays.

Recommendations:

Execute long-running AI tasks asynchronously.
Cache reusable AI context where appropriate.
Apply request timeouts.
Monitor AI latency.
Avoid blocking user interfaces while waiting for AI responses.

Critical workflows such as patient check-in and emergency triage should remain responsive regardless of AI availability.

16.20 Deployment Strategy

Adopt a phased rollout.

Recommended sequence:

Deploy AI infrastructure.
Enable internal testing.
Pilot at a single clinic.
Monitor performance and audit logs.
Expand to additional clinics.
Enable production-wide after validation.

Feature flags should be used to control activation of new AI capabilities.

16.21 Integration Validation Checklist

Before enabling any new AI feature, confirm:

Existing workflows remain operational.
Existing APIs are reused where possible.
Existing services are preserved.
Workflow Engine remains authoritative.
Patient Journey Timeline is updated correctly.
Audit Logs capture AI activity.
Notifications continue through existing services.
RBAC permissions are enforced.
RLS policies are respected.
Multi-clinic isolation is maintained.
Performance remains within acceptable limits.
Clinical staff can override AI recommendations at any time.
16.22 Implementation Rules

Every implementation under this handbook must follow these rules:

Inspect before modifying.
Reuse before creating.
Extend before replacing.
Preserve backward compatibility.
Never bypass the Workflow Engine.
Never bypass RBAC or RLS.
Never allow AI to make autonomous clinical decisions.
Keep AI modular so it can be upgraded independently.
Ensure every integration is fully auditable.
Prioritize patient safety and system reliability over automation.
End of Part 16

This chapter establishes the integration contract for the entire Health Nexus platform. Every subsequent implementation—database architecture, Ollama integration, APIs, security, and development standards—must conform to these principles to ensure the platform evolves safely without compromising the stability of the existing production system.


---

# PART 17 — DATABASE & PLATFORM ARCHITECTURE

## Overview

Health Nexus is a multi-tenant healthcare platform.

The platform supports multiple independent healthcare organisations while maintaining strict separation of patient records, workflows and AI conversations.

Every organisation operates independently while sharing the same Health Nexus platform.

The platform must remain scalable, secure and configurable without requiring separate applications for different clinic types.

---

# Core Platform Principles

Health Nexus follows the following architectural principles.

- One Platform
- One Codebase
- One Database
- Multi-Tenant Architecture
- Workflow Driven
- Configuration Driven
- AI Assisted
- Human Controlled
- Privacy First
- Security by Default

Every new feature must respect these principles.

---

# Core Platform Engines

Health Nexus is built around five core platform engines.

## Workflow Engine

The Workflow Engine is responsible for controlling every patient journey.

Responsibilities include:

- Patient movement
- Queue Management
- Workflow transitions
- Appointment workflow
- Patient Journey Timeline
- Workflow History
- Department communication
- Notification triggering

The Workflow Engine is the only component allowed to move patients between workflow stages.

Departments must never move patients directly.

---

## AI Engine

The AI Engine provides conversational and workflow assistance throughout Health Nexus.

Modules include:

- AI Reception
- Appointment AI
- Nurse AI
- Doctor AI
- Laboratory AI
- Pharmacy AI
- Billing AI
- Follow-up AI

The AI assists.

Healthcare professionals remain responsible for all clinical decisions.

---

## Capability Engine

Every clinic has its own Capability Profile.

Examples include:

- General Consultation
- Nurse Services
- Pharmacy
- Laboratory
- Dental
- Radiology
- Mental Health
- Physiotherapy
- Vaccination

The Capability Engine determines whether a requested service is available at the current clinic.

The Workflow Engine must consult the Capability Engine before creating workflows.

If a capability is unavailable, the Referral Engine should be used.

---

## Referral Engine

The Referral Engine manages:

- Internal Referrals
- External Referrals
- Referral Tracking
- Referral Documents
- Referral Status
- Patient Consent

The Referral Engine never shares medical information without explicit patient consent unless required by law or authorised emergency procedures.

---

## Context Engine

Before every AI interaction, the Context Engine loads the operational context.

The Context Engine determines:

- Organisation
- Clinic
- Department
- WhatsApp Number
- Patient
- User
- User Role
- Permissions
- Clinic Capabilities
- Active Workflow
- Conversation Context

Every AI response is generated using this context.

# Multi-Clinic Architecture

Health Nexus distinguishes between a Person and a Clinic Medical Record.

Person

↓

Clinic Registration

↓

Clinic Medical Record

A person may receive healthcare from multiple organisations using Health Nexus.

Each organisation owns its own medical records.

Each clinic remains responsible for its own patient records.

Medical records are never automatically shared between organisations.

---

# Global Person Identity

Health Nexus maintains a Global Person Identity.

The Global Person Identity stores only demographic information required to identify an individual.

Examples include:

- Full Name
- Date of Birth
- South African ID Number
- Passport Number
- Contact Information

The Global Person Identity does NOT store:

- Diagnoses
- Prescriptions
- Laboratory Results
- Clinical Notes
- Consultations

These remain inside each clinic's medical record.

The Global Person Identity exists solely to identify that the same individual may receive care at multiple organisations.


# Clinic Medical Records

Each clinic maintains its own independent medical record.

Example

Person

↓

Joburg Clinic

↓

Medical Record

↓

Consultations

↓

Laboratory

↓

Prescriptions

↓

Billing

Another clinic receives a completely separate medical record.

Person

↓

Cape Town Clinic

↓

Medical Record

↓

Consultations

↓

Laboratory

↓

Prescriptions

↓

Billing

Each organisation controls access to its own records.

No organisation may directly access another organisation's medical records.

# AI Clinic Context

Every clinic has its own AI Assistant identity.

The AI Assistant always operates within the context of the clinic that owns the active session.

Before responding, the AI loads:

- Clinic Configuration
- Clinic Capability Profile
- Clinic Hours
- Clinic Staff
- Clinic WhatsApp Number
- Active Queues
- Current Workflow
- Patient Context

The AI only accesses information belonging to the current organisation.

The AI must never retrieve another organisation's information without explicit patient consent through the Referral Engine.

# WhatsApp AI Architecture

Each organisation may operate its own WhatsApp Business number.

Example

Joburg Clinic

↓

WhatsApp Number A

↓

Joburg AI Assistant

Cape Town Clinic

↓

WhatsApp Number B

↓

Cape Town AI Assistant

Durban Clinic

↓

WhatsApp Number C

↓

Durban AI Assistant

All AI Assistants use the same Health Nexus AI Engine.

The difference is the operational context loaded by the Context Engine.

The AI Assistant should identify itself using the clinic's name when greeting patients.

Example

Hello Onele 👋

Welcome to Cape Town Clinic.

I'm the Cape Town Clinic AI Assistant.

How may I assist you today?

# Internal and External Referrals

Health Nexus supports two referral models.

## Internal Referral

Between organisations using Health Nexus.

The receiving organisation only receives information that the patient has explicitly consented to share.

Examples include:

- Referral Letter
- Consultation Summary
- Medication Summary
- Laboratory Summary

The receiving Doctor reviews the shared information before continuing care.

---

## External Referral

For organisations not using Health Nexus.

The Workflow Engine generates:

- Referral Letter
- Consultation Summary
- Medication Summary
- Laboratory Summary
- Supporting Documents

The patient remains responsible for presenting the referral to the external organisation.

Health Nexus records the referral for audit purposes.

---

# Configuration Engine

The Configuration Engine is responsible for making every organisation operate according to its own policies, services and operational requirements.

Health Nexus must never assume that every clinic operates the same way.

Instead, the Configuration Engine provides operational rules that are used by the Workflow Engine, AI Engine and other platform components.

Examples of configurable settings include:

## Organisation Configuration

- Organisation Type
- Private Clinic
- Government Clinic
- NGO Clinic

---

## Clinic Configuration

- Clinic Name
- Operating Hours
- Time Zone
- Departments
- Consultation Types
- Queue Rules
- Appointment Rules
- Emergency Workflow Rules

---

## Capability Configuration

The services available at each clinic.

Examples include:

- General Consultation
- Laboratory
- Pharmacy
- Dental
- Radiology
- Mental Health
- Physiotherapy
- Vaccination

The Capability Engine reads this configuration before creating workflows.

---

## Staff Configuration

- Doctors
- Nurses
- Reception Staff
- Laboratory Staff
- Pharmacists
- Billing Staff

Each staff member may have:

- Working Days
- Working Hours
- Leave Periods
- Consultation Capacity
- Assigned Departments

---

## Billing Configuration

Examples include:

- Automatic Billing
- Manual Billing
- Hybrid Billing

Payment Providers

- Yoco
- Cash
- EFT
- Card

Pricing Rules

- Consultation Fees
- Medication Charges
- Laboratory Charges
- Discounts
- Sponsored Services

---

## AI Configuration

Each organisation may configure:

- AI Greeting
- Supported Languages
- Clinic Information
- WhatsApp Behaviour
- Follow-up Rules
- Appointment Rules
- Emergency Escalation Rules

The AI Engine should always load the organisation's configuration before beginning a conversation.

---

## Notification Configuration

Examples include:

- Appointment Reminders
- Medication Reminders
- Payment Notifications
- Laboratory Notifications
- Follow-up Messages
- Emergency Notifications

Each organisation controls which notifications are enabled.

---

## Workflow Integration

The Workflow Engine should always consult the Configuration Engine before making workflow decisions.

Examples include:

- Can this clinic perform laboratory tests?
- Does this clinic require payment?
- Which appointment rules apply?
- Which AI behaviour applies?
- Which queue rules apply?

The Configuration Engine allows one Health Nexus platform to support many different organisations without creating separate systems.

---

# Staff Identity & Organisation Membership

Health Nexus maintains a single identity for each staff member.

Staff members may belong to multiple organisations or clinics through independent memberships.

Each membership contains:

- Organisation
- Clinic
- Role
- Permissions
- Start Date
- End Date (optional)
- Status

Joining a clinic creates a membership rather than a new user account.

The active clinic determines:

- Accessible patients
- Available workflows
- AI context
- Notifications
- Permissions

A staff member may switch between authorised clinic memberships without creating multiple accounts.

Clinic administrators remain responsible for approving or rejecting membership requests.

Temporary memberships may be created for locum doctors, agency nurses, visiting specialists and temporary staff.


# PART 18 — OLLAMA AI ARCHITECTURE

## Overview

Health Nexus uses Ollama as its local Artificial Intelligence platform.

The AI is responsible for assisting patients and staff through natural language conversations, workflow support and intelligent summarisation.

The AI is an assistant.

It never replaces healthcare professionals.

Clinical decisions always remain the responsibility of authorised healthcare professionals.

---

# AI Principles

Every AI interaction must follow these principles.

1. AI assists.
2. Humans decide.
3. AI explains.
4. Humans diagnose.
5. AI organises.
6. Humans approve.
7. AI never invents medical information.
8. AI only uses authorised Health Nexus data.
9. AI respects patient privacy.
10. Every AI action must be auditable.

These principles apply to every AI module within Health Nexus.

---

# AI Responsibilities

The AI Engine is responsible for:

- Natural language conversations.
- Intent recognition.
- Patient verification assistance.
- Appointment assistance.
- Queue assistance.
- Workflow assistance.
- Documentation summaries.
- Follow-up communication.
- Patient education.
- Health information explanations.
- Administrative assistance.

The AI must never:

- Diagnose patients independently.
- Prescribe medication.
- Change treatment plans.
- Approve laboratory results.
- Override healthcare professionals.
- Access unauthorised clinic information.

# AI Modules

Health Nexus contains specialised AI modules.

Examples include:

- Conversation AI
- Reception AI
- Appointment AI
- Queue AI
- Nurse AI
- Doctor AI
- Laboratory AI
- Pharmacy AI
- Billing AI
- Follow-up AI

Each AI module specialises in one workflow while sharing the same AI Engine.

The Context Engine determines which AI module is active based on the current workflow.

---

# PART 18 — HEALTH NEXUS AI ARCHITECTURE

## Overview

Health Nexus uses Artificial Intelligence to assist patients and healthcare professionals throughout the patient journey.

The AI platform is powered by Ollama and operates entirely within the Health Nexus platform.

Artificial Intelligence exists to improve communication, workflow efficiency and patient experience.

The AI never replaces healthcare professionals.

Clinical responsibility always remains with authorised healthcare professionals.

---

# AI Vision

Health Nexus AI has one purpose:

To assist every patient and every healthcare professional without replacing human judgement.

The AI should:

- Understand natural language.
- Assist patients.
- Assist healthcare staff.
- Reduce administrative work.
- Improve workflow efficiency.
- Improve patient communication.
- Improve documentation.
- Improve patient education.

The AI must never replace Doctors, Nurses, Pharmacists or Laboratory Professionals.

---

# AI Principles

Every AI interaction must follow these principles.

1. AI assists.

2. Humans decide.

3. AI explains.

4. Humans diagnose.

5. AI organises.

6. Humans approve.

7. AI never invents clinical information.

8. AI only uses authorised Health Nexus data.

9. AI respects patient privacy.

10. Every AI action is auditable.

11. AI follows the Patient Journey Workflow.

12. AI always respects the current clinic context.

---

# Health Nexus AI Engine

Health Nexus contains one AI Engine.

There are not multiple AI systems.

Instead, one AI Engine serves every organisation using operational context.

The AI Engine provides:

- Conversation AI
- Reception AI
- Appointment AI
- Queue AI
- Nurse AI
- Doctor AI
- Laboratory AI
- Pharmacy AI
- Billing AI
- Follow-up AI

Each module specialises in a workflow while sharing the same AI Engine.

---

# AI Request Pipeline

Every AI request follows the same processing pipeline.

Patient Message

↓

WhatsApp Webhook

↓

Conversation Service

↓

Context Engine

↓

Configuration Engine

↓

Capability Engine

↓

Prompt Engine

↓

Prompt Builder

↓

Ollama

↓

AI Response

↓

Workflow Engine

↓

Notification Service

↓

WhatsApp Reply

The AI never communicates directly with WhatsApp.

All responses return through the Workflow Engine and Notification Services.

---

# Context Engine

Before responding, the AI must determine its operational context.

The Context Engine identifies:

- Organisation
- Clinic
- WhatsApp Number
- Department
- Patient
- Staff Member
- User Role
- Current Workflow
- Queue Status
- Clinic Capabilities
- Permissions
- Conversation History

Every AI response depends on this context.

---

# Configuration Engine

The Configuration Engine loads the organisation's operational configuration.

Examples include:

- Organisation Type
- Clinic Settings
- Appointment Rules
- Queue Rules
- Payment Rules
- AI Behaviour
- Languages
- Notification Rules
- Operating Hours

The AI should never assume that every clinic operates in the same way.

---

# Capability Engine

Every clinic has a Capability Profile.

Examples include:

- Consultation
- Pharmacy
- Laboratory
- Dental
- Radiology
- Physiotherapy
- Mental Health

Before creating any workflow, the AI checks whether the requested service is available.

If unavailable, the Referral Engine is activated.

---

# Prompt Engine

The Prompt Engine manages every AI prompt used within Health Nexus.

Prompts are not hard-coded inside application logic.

Every AI module loads its behaviour from managed prompts.

Examples include:

- Reception Prompt
- Appointment Prompt
- Queue Prompt
- Nurse Prompt
- Doctor Prompt
- Laboratory Prompt
- Pharmacy Prompt
- Billing Prompt
- Follow-up Prompt

The Prompt Engine allows Health Nexus to improve AI behaviour without changing application code.

---

# Prompt Builder

Before Ollama receives a request, the Prompt Builder assembles the final prompt.

The Prompt Builder combines:

- Base Health Nexus Prompt
- AI Module Prompt
- Organisation Configuration
- Clinic Configuration
- Capability Profile
- User Role
- Current Workflow
- Conversation History
- Patient Context
- Safety Rules

The completed prompt is then sent to Ollama.

---

# Prompt Versioning

Every prompt supports version control.

Each prompt contains:

- Prompt Name
- Version
- Status
- Created By
- Last Updated
- Change History

Prompt history must remain available for auditing.

---

# AI Clinic Context

Each clinic has its own AI Assistant identity.

Example

Patient messages

Cape Town Clinic WhatsApp

↓

AI loads

Cape Town Clinic Context

↓

The AI becomes

Cape Town Clinic AI Assistant

The AI should introduce itself using the clinic's identity.

Example

Hello Onele 👋

Welcome to Cape Town Clinic.

I'm the Cape Town Clinic AI Assistant.

How may I help you today?

---

# Multi-Clinic Privacy

A patient may receive care from multiple organisations.

However, every organisation owns its own medical records.

The AI must never access another organisation's information automatically.

Cross-organisation information sharing requires:

- Patient Consent
- Referral Workflow
- Appropriate Permissions

---

# AI Responsibilities

The AI may:

- Chat naturally.
- Book appointments.
- Explain released laboratory results.
- Explain medication instructions.
- Answer workflow questions.
- Generate summaries.
- Organise documentation.
- Assist staff.
- Educate patients.

The AI must never:

- Diagnose patients.
- Prescribe medication.
- Change treatment plans.
- Override healthcare professionals.
- Access unauthorised records.

---

# AI Audit

Every AI interaction should record:

- Date
- Time
- Organisation
- Clinic
- Patient
- User
- AI Module
- Prompt Version
- Workflow
- Outcome

Every AI interaction must be auditable.

---

# Clinic Capabilities

The Configuration Engine maintains a structured list of services available at each clinic.

Examples include:

- General Consultation
- Chronic Medication
- Pharmacy
- Laboratory
- Women's Health
- Family Planning
- Vaccinations
- Dental
- X-Ray
- Ultrasound
- Mental Health
- Physiotherapy
- HIV Care
- TB Care
- Minor Procedures

Clinic capabilities determine:

- Appointment availability.
- AI responses.
- Referral recommendations.
- Patient self-service options.
- Workflow availability.

If a requested service is unavailable, the AI Assistant should recommend an appropriate referral rather than allowing an invalid booking.

---

# AI Configuration

Each clinic maintains its own AI Assistant configuration.

The Configuration Engine manages:

- AI Enabled or Disabled
- AI Provider
- Default Language
- Conversation Tone
- Supported Services
- Referral Behaviour
- Escalation Rules
- Conversation Memory Retention
- Clinic-specific Knowledge

These settings ensure that every clinic's AI Assistant behaves according to that clinic's operational policies while continuing to use the shared Health Nexus AI platform.

---

# Doctor Availability Configuration

Doctor availability is configured independently from the clinic's general operating hours.

Each doctor may have:

- Working Days
- Working Hours
- Break Times
- Lunch Periods
- Leave Periods
- Training Sessions
- Temporary Unavailability
- Emergency Leave

The Configuration Engine stores every doctor's availability schedule.

The Appointment Engine must only offer appointments during a doctor's available schedule.

The AI Assistant, Reception Dashboard and Appointment Engine must always use the same availability data.

If a patient's preferred doctor is unavailable, the AI Assistant should:

- Offer the next available appointment.
- Recommend another suitable doctor (if permitted by the clinic's configuration).
- Inform the patient if no suitable appointment is currently available.

Doctor schedules override the clinic's general operating hours whenever there is a conflict.


# Acceptance Criteria

The AI Architecture is complete when:

✓ One AI Engine supports multiple organisations.

✓ Context Engine determines operational context.

✓ Configuration Engine loads clinic configuration.

✓ Capability Engine validates clinic services.

✓ Prompt Engine manages prompts.

✓ Prompt Builder generates final prompts.

✓ Ollama processes AI requests.

✓ Workflow Engine controls workflow transitions.

✓ Notification Service delivers responses.

✓ AI actions remain fully auditable.

✓ Patient privacy is maintained across organisations.


---

# PART 19 — SECURITY, PRIVACY & COMPLIANCE

## Overview

Health Nexus is designed to protect patient privacy, maintain data confidentiality and support secure healthcare operations.

Security is a platform-wide responsibility.

Every module within Health Nexus must follow the same security standards.

Health Nexus must always prioritise patient privacy while ensuring authorised healthcare professionals have the information they need to provide safe clinical care.

---

# Security Principles

Health Nexus follows these security principles:

- Privacy by Design
- Security by Default
- Least Privilege Access
- Defence in Depth
- Zero Trust Architecture
- Multi-Tenant Isolation
- Audit Everything
- Patient Consent First
- Human Accountability
- AI Transparency

Every feature developed for Health Nexus must comply with these principles.

---

# Authentication

Every user must authenticate before accessing Health Nexus.

Supported authentication methods include:

- Email and Password
- Multi-Factor Authentication (Future)
- Single Sign-On (Future)

Passwords must never be stored in plain text.

Authentication is managed through Supabase Authentication.

---

# Authorisation

Every authenticated user must have an assigned role.

Examples include:

- Clinic Administrator
- Receptionist
- Nurse
- Doctor
- Laboratory Staff
- Pharmacist
- Billing Staff
- Patient

Permissions must always be enforced using:

- Role-Based Access Control (RBAC)
- Row Level Security (RLS)

Users may only access information required for their role.

---

# Multi-Tenant Security

Each organisation operates independently.

Every database query must be scoped to the active organisation.

Organisation A must never access Organisation B's data.

This rule applies to:

- Patients
- Staff
- Appointments
- Laboratory Results
- Prescriptions
- Billing
- AI Conversations
- Audit Logs

Multi-tenant isolation is mandatory.

---

# Patient Privacy

Patients own their personal healthcare information.

Health Nexus must protect patient information at every stage of the patient journey.

Patient information may only be shared:

- With authorised healthcare professionals.
- With patient consent.
- Where required by applicable law.
- During approved emergency procedures.

---

# AI Privacy

The AI Engine must always operate within the current clinic context.

The AI must never:

- Access another clinic's records.
- Reveal another patient's information.
- Share information without patient consent.
- Ignore Role-Based Access Control.
- Ignore Row Level Security.

Every AI request must respect:

- Organisation
- Clinic
- User Role
- Workflow
- Permissions

---

# Referral Privacy

Internal referrals require explicit patient consent before information is shared between organisations.

External referrals generate referral documentation without exposing unrelated medical information.

Only information necessary for continuity of care should be included.

---

# Audit Logging

Every sensitive action must generate an Audit Log.

Examples include:

- Login
- Logout
- Patient Registration
- Appointment Booking
- Medical Record Access
- Laboratory Result Review
- Prescription Creation
- Payment Processing
- AI Interaction
- Referral Creation
- Patient Consent

Audit Logs must never be deleted.

---

# Patient Consent

Health Nexus must record patient consent whenever information is shared.

Consent records should include:

- Patient
- Organisation
- Shared Information
- Purpose
- Date
- Time
- Staff Member
- Expiry (where applicable)

Patients may withdraw consent according to organisational policy and applicable regulations.

---

# Emergency Access (Break-Glass)

Health Nexus may support emergency access for authorised healthcare professionals.

Emergency access should only be used when immediate access to information is necessary to protect a patient's life or prevent serious harm.

Every emergency access event must:

- Require a documented reason.
- Be limited to authorised users.
- Be fully audited.
- Notify Clinic Administration (where configured).

Emergency access must never become normal practice.

---

# Encryption

Health Nexus should protect sensitive information using modern encryption.

Examples include:

- Data in Transit
- Data at Rest
- API Communication
- Authentication Tokens

Encryption should follow industry best practices.

---

# WhatsApp Security

The WhatsApp integration must never expose confidential patient information without successful patient verification.

Sensitive workflow actions require identity verification before proceeding.

Examples include:

- Appointment Changes
- Laboratory Results
- Prescriptions
- Billing Information
- Medical Records

---

# API Security

Every API endpoint must validate:

- Authentication
- Organisation
- User Role
- Permissions
- Request Validation

Unauthorised requests must be rejected.

---

# Session Security

User sessions should:

- Expire automatically after inactivity.
- Support secure logout.
- Prevent session hijacking.
- Validate active permissions.

---

# Compliance

Health Nexus should be designed to support healthcare privacy and security requirements, including applicable South African laws and organisational policies.

The platform should be designed to evolve with future interoperability standards without requiring major architectural changes.

---

# Security Monitoring

Health Nexus should continuously monitor:

- Failed Logins
- Unusual Access Patterns
- Permission Violations
- Suspicious AI Requests
- Failed API Requests
- Failed Payment Attempts

Significant security events should be recorded and, where appropriate, administrators should be notified.

---

# Acceptance Criteria

The Security & Compliance Architecture is complete when:

✓ Authentication is secure.

✓ Authorisation uses RBAC.

✓ Multi-tenant isolation is enforced.

✓ Patient privacy is protected.

✓ AI respects organisation boundaries.

✓ Referral consent is recorded.

✓ Audit logging is complete.

✓ Emergency access is controlled.

✓ API security is enforced.

✓ WhatsApp verification protects sensitive actions.

✓ Security events are monitored.

✓ Health Nexus remains compliant with applicable organisational and legal requirements.


---

# PART 20 — API & INTEGRATION ARCHITECTURE

## Overview

Health Nexus is designed as an API-first healthcare platform.

Every module should communicate through well-defined services and APIs rather than directly accessing unrelated business logic.

The Integration Layer allows Health Nexus to communicate with both internal platform services and trusted external systems while maintaining security, auditability and patient privacy.

The Integration Layer must always respect:

- Authentication
- Authorisation
- Organisation Context
- Clinic Context
- Patient Consent
- Audit Logging

---

# Integration Principles

Every integration must follow these principles.

1. API First

2. Secure by Default

3. Reuse Existing Services

4. Never Duplicate Business Logic

5. Respect Workflow Engine

6. Respect Context Engine

7. Respect Configuration Engine

8. Respect Capability Engine

9. Respect Patient Privacy

10. Every Integration Must Be Auditable

# Internal Platform APIs

The Health Nexus platform consists of independent services that communicate through clearly defined APIs.

Examples include:

- Authentication Service
- Patient Service
- Appointment Service
- Queue Service
- Reception Service
- Nurse Service
- Doctor Service
- Laboratory Service
- Pharmacy Service
- Billing Service
- Workflow Service
- Notification Service
- AI Service
- Referral Service
- Reporting Service

Business logic should remain inside the owning service.

Other modules should communicate through APIs rather than directly modifying another module's data.

# External Integrations

Health Nexus supports trusted external integrations.

Current integrations include:

- WhatsApp Cloud API
- Ollama
- Yoco
- SMTP Email

Future integrations may include:

- SMS Providers
- Medical Aid Providers
- Government Health Services
- National Health Systems
- External Laboratories
- External Pharmacies
- Smart Supply

# WhatsApp Integration

The WhatsApp Cloud API provides secure communication between patients and Health Nexus.

Responsibilities include:

- Receiving Messages
- Sending Messages
- Appointment Notifications
- Queue Updates
- Follow-up Messages
- Verification Requests
- AI Conversations

The WhatsApp Integration should never contain business logic.

Business decisions remain inside the Workflow Engine.

# Ollama Integration

Ollama provides Artificial Intelligence capabilities.

Health Nexus remains responsible for:

- Context
- Permissions
- Workflow
- Patient Safety

Ollama only receives the prompt assembled by the Prompt Builder.

Ollama never communicates directly with the database.

Ollama never accesses Supabase directly.

Every AI request passes through the AI Engine.

# Yoco Integration

Yoco provides secure payment processing.

Health Nexus remains responsible for:

- Invoice Generation
- Payment Status
- Receipt Generation
- Workflow Updates

Yoco only confirms payment status.

Health Nexus remains the source of truth for billing workflows.

# Smart Supply Integration

Health Nexus should support future integration with Smart Supply.

Smart Supply remains an independent platform.

Health Nexus should never contain procurement business logic.

Examples of future integrations include:

- Medication Availability
- Purchase Orders
- Stock Requests
- Supplier Deliveries
- Inventory Synchronisation

Communication should occur through secure APIs.

Both platforms remain independently deployable.


# API Versioning

Every public API should include versioning.

Examples:

/api/v1/

/api/v2/

Breaking changes should never be introduced without creating a new API version.

Older API versions should remain supported according to platform policy.

# Webhooks

Health Nexus supports secure webhook communication.

Examples include:

- WhatsApp
- Yoco
- Smart Supply (Future)
- External Laboratories (Future)

Webhook requests should always:

- Verify signatures.
- Validate payloads.
- Create Audit Logs.
- Retry failed processing where appropriate.

# API Documentation

Every public API should include documentation.

Documentation should include:

- Endpoint
- Method
- Authentication
- Required Permissions
- Request Example
- Response Example
- Error Codes

Documentation should remain synchronised with implementation.

# Acceptance Criteria

The API & Integration Architecture is complete when:

✓ Internal services communicate through APIs.

✓ External integrations remain isolated.

✓ WhatsApp uses the Integration Layer.

✓ Ollama uses the AI Engine.

✓ Yoco uses the Billing Workflow.

✓ Smart Supply can integrate in the future.

✓ APIs are versioned.

✓ Webhooks are secure.

✓ API documentation remains current.

✓ Every integration respects security, privacy and audit requirements.



---

# PART 21 — DEVELOPMENT, TESTING & DEPLOYMENT STANDARDS

## Overview

Health Nexus is a long-term healthcare platform.

Every contribution must prioritise stability, maintainability, security and patient safety.

Developers should improve the platform without disrupting existing workflows or compromising patient care.

---

# Engineering Principles

Every developer contributing to Health Nexus must follow these principles.

1. Inspect before modifying.

2. Reuse before creating.

3. Never rewrite working functionality unnecessarily.

4. Prefer configuration over hard-coded logic.

5. Keep one source of truth for every business process.

6. Make small, incremental changes.

7. Maintain backward compatibility.

8. Test before deployment.

9. Document every significant change.

10. Patient safety always comes first.


---

# Project Structure

Health Nexus should maintain a consistent and organised project structure.

Business logic should remain separated by responsibility.

Examples include:

- API
- AI
- Workflow
- Authentication
- Notifications
- Billing
- Laboratory
- Pharmacy
- Queue
- Appointments
- Shared Utilities

Every module should have a clearly defined responsibility.

Modules should communicate through services rather than directly modifying unrelated modules.

---

# Database Standards

Database changes should always use controlled migrations.

Developers must:

- Create migrations instead of modifying production tables directly.
- Preserve existing data whenever possible.
- Reuse existing tables before creating new ones.
- Maintain referential integrity.
- Respect Row Level Security policies.

Database changes must be reversible where practical.

---

# Coding Standards

Health Nexus should maintain consistent coding standards.

Examples include:

- TypeScript throughout the platform.
- Clear naming conventions.
- Small, focused functions.
- Strong typing.
- Meaningful comments where necessary.
- Avoid duplicated logic.
- Prefer reusable services.

Every pull request should improve readability rather than increase complexity.


---

# Testing Standards

Every significant feature should be tested before deployment.

Testing should include:

- Unit Testing
- Integration Testing
- Workflow Testing
- API Testing
- AI Workflow Testing
- Security Testing
- Regression Testing

Existing workflows must continue working after every change.

---

# Error Handling

Every module should fail safely.

Errors should:

- Be logged.
- Provide meaningful information to developers.
- Avoid exposing sensitive information.
- Never expose patient data.
- Never leave workflows in an inconsistent state.

Where possible, users should receive clear and understandable error messages.

---

# Logging Standards

Health Nexus should maintain structured application logs.

Logs should include:

- Timestamp
- Service
- Module
- Workflow
- Organisation
- Clinic
- Severity
- Correlation ID

Sensitive patient information should never be written to application logs.

---

# Deployment Standards

Every deployment should follow a controlled release process.

Before deployment:

- Run automated tests.
- Verify database migrations.
- Verify API compatibility.
- Verify AI functionality.
- Verify WhatsApp integration.
- Verify payment integration.
- Verify notification services.

Deployments should minimise disruption to clinic operations.

---

# Documentation Standards

Every significant feature should include updated documentation.

Documentation should describe:

- Purpose
- Architecture
- Configuration
- API changes
- Database changes
- Security considerations
- Testing performed

Documentation should remain synchronised with implementation.

---

# Acceptance Criteria

The Development, Testing & Deployment Standards are complete when:

✓ Engineering principles are followed.

✓ Project structure remains organised.

✓ Database changes use migrations.

✓ Coding standards remain consistent.

✓ Testing is completed before deployment.

✓ Error handling is consistent.

✓ Logging is structured.

✓ Deployments follow a controlled process.

✓ Documentation is updated alongside implementation.

# PART 22 — AI DEVELOPMENT & IMPLEMENTATION GUIDE

## 22.1 Purpose

This chapter defines how AI development assistants must contribute to the Health Nexus platform.

Examples include:

- OpenAI Codex
- Claude Code
- Cursor
- Windsurf
- GitHub Copilot
- Future AI development assistants

Regardless of the tool used, every AI assistant must follow the engineering principles defined in this handbook.

The objective is not to rewrite Health Nexus.

The objective is to safely extend Health Nexus while preserving existing functionality.

---

# 22.2 Guiding Principles

Every implementation must follow these principles:

1. Preserve existing functionality.
2. Reuse existing architecture whenever possible.
3. Never duplicate existing functionality.
4. Prefer extension over replacement.
5. Every change must be explainable.
6. Every change must be reversible.
7. Every database modification must use version-controlled migrations.
8. Human approval is required before implementation.

---

# 22.3 Required Development Workflow

Every AI assistant must complete the following workflow before writing any code.

STEP 1

Read the entire Engineering Handbook.

↓

STEP 2

Inspect the complete project.

↓

STEP 3

Inspect the existing database schema.

↓

STEP 4

Inspect current API endpoints.

↓

STEP 5

Inspect Workflow Engine.

↓

STEP 6

Inspect AI implementation.

↓

STEP 7

Generate an Inspection Report.

↓

WAIT FOR HUMAN APPROVAL

↓

STEP 8

Generate migration plan.

↓

WAIT FOR HUMAN APPROVAL

↓

STEP 9

Implement backend.

↓

STEP 10

Implement frontend.

↓

STEP 11

Execute tests.

↓

STEP 12

Generate implementation summary.

No implementation should begin before the inspection report has been reviewed.

---

# 22.4 Project Inspection Rules

Before creating new functionality, the AI assistant must inspect:

Frontend

Backend

Supabase

Database Schema

Authentication

Row Level Security Policies

Storage

Functions

Triggers

Views

Workflow Engine

Queue Management

Appointments

Consultations

Laboratory

Pharmacy

Inventory

Billing

Analytics

Notifications

WhatsApp Integration

AI Services

Configuration Engine

Context Engine

Membership System

Referral Engine

No assumptions may be made about existing functionality.

---

# 22.5 Database Rules

The database is the most valuable asset of Health Nexus.

The AI assistant must never directly modify the production database.

Before proposing any database changes, the assistant must inspect:

Existing tables

Relationships

Foreign Keys

Indexes

Views

Triggers

Stored Procedures

Functions

Enums

Policies

Storage Buckets

Realtime Configuration

Only after inspection may database modifications be proposed.

---

# 22.6 Database Migrations

Every database change must be delivered as a version-controlled SQL migration.

Examples include:

- Create Table
- Alter Table
- Create Index
- Create Function
- Create Trigger
- Create Policy
- Create View

Database modifications must never be executed automatically.

The developer must review and approve every migration before execution.

---

# 22.7 Existing Tables

Health Nexus already contains a significant production-ready database.

Whenever possible the AI assistant must reuse:

Patients

Appointments

Queue

Consultations

Doctors

Nurses

Laboratory

Prescriptions

Pharmacy

Inventory

Billing

Notifications

Activity Logs

Organizations

Clinics

Staff

Profiles

WhatsApp Conversations

WhatsApp Messages

Audit Logs

The AI assistant should only introduce new tables when absolutely necessary.

---

# 22.8 Existing Modules

The following modules already exist.

They must be extended instead of replaced.

Dashboard

Patients

Appointments

Queue

Reception

Nursing

Doctor Consultation

Laboratory

Pharmacy

Inventory

Billing

Notifications

Analytics

Activity Logs

Authentication

Staff Management

Settings

The AI assistant should integrate with these modules instead of creating alternative implementations.

---

# 22.9 API Rules

The existing API architecture must be preserved.

The AI assistant must:

Reuse existing endpoints.

Reuse existing services.

Reuse existing middleware.

Reuse existing authentication.

Reuse existing validation.

Reuse existing audit logging.

Reuse existing notification services.

Only create new endpoints when existing endpoints cannot safely support the required functionality.

---

# 22.10 AI Integration Rules

Health Nexus already contains operational workflows.

The AI assistant must not replace:

Reception workflow

Queue workflow

Clinical workflow

Laboratory workflow

Pharmacy workflow

Billing workflow

Notification workflow

Audit workflow

The AI should enhance decision support and communication while preserving the existing Workflow Engine.

---

# 22.11 WhatsApp Rules

Existing WhatsApp infrastructure must remain operational.

Reuse:

Webhook

Conversation storage

Authentication

Notification system

Appointment integration

Patient verification

Conversation history

The AI assistant should replace only the conversation intelligence layer.

---

# 22.12 Payment Rules

Health Nexus supports payment integrations.

Payment providers such as Yoco must be implemented as modular services.

Payment integration must never be tightly coupled to Billing.

Billing remains the source of truth.

Payment providers simply process payment requests.

Future providers should be interchangeable without redesigning Billing.

---

# 22.13 Configuration Rules

Every configurable behaviour should be controlled through the Configuration Engine.

Avoid hard-coded values.

Examples include:

Clinic hours

Languages

Referral policies

AI behaviour

Appointment rules

Emergency thresholds

Payment providers

Feature availability

Notification preferences

---

# 22.14 Security Rules

The AI assistant must preserve:

Authentication

Authorization

Row Level Security

Audit Logging

Encryption

Permission validation

Organization isolation

Clinic isolation

No implementation may reduce existing security.

---

# 22.15 Testing Requirements

Before implementation is considered complete, the AI assistant should verify:

Database migrations

API endpoints

Workflow transitions

Authentication

Authorization

Queue operations

Appointment booking

Consultation workflow

Laboratory workflow

Prescription workflow

Pharmacy workflow

Notifications

WhatsApp messaging

Payment integration

Analytics

Regression testing

No feature should break existing functionality.

---

# 22.16 Documentation Requirements

Every completed feature should include:

Architecture summary

Database changes

Migration files

API changes

Frontend changes

Backend changes

Configuration changes

Testing results

Known limitations

Future improvements

Documentation should always remain synchronized with implementation.

---

# 22.17 Completion Criteria

A feature is considered complete only when:

✓ Handbook requirements are satisfied.

✓ Database migrations have been approved.

✓ Backend implementation is complete.

✓ Frontend implementation is complete.

✓ Existing workflows remain functional.

✓ Tests pass successfully.

✓ Documentation has been updated.

✓ Human approval has been received.

Only then may the feature be considered production ready.

---

# 22.18 Final Engineering Principle

Health Nexus is a long-term healthcare platform.

Every implementation should prioritize:

Patient safety

Clinical reliability

Maintainability

Scalability

Security

Performance

Developer experience

AI should accelerate development while respecting the architecture defined in this handbook.

The Engineering Handbook is the authoritative source of truth.

If implementation conflicts with this handbook, the handbook takes precedence.


# PAYMENT GATEWAY & YOCO TECHNICAL NOTES — TO BE CONSOLIDATED INTO PART 20

> **Consolidation Note**
>
> This technical payment gateway material is retained temporarily and will be incorporated into Part 20 — API & Integration Standards.
>
> Part 13 remains the authoritative source for Billing, Financial Responsibility and Payment Workflow rules.

## Purpose

Health Nexus includes a centralized Payment Gateway responsible for managing all financial transactions across the platform.

The payment system supports:

- Consultation payments
- Medication payments
- Laboratory payments
- Radiology payments
- Procedure payments
- Outstanding balances
- Deposits
- Refunds
- Multiple payment providers

The first supported payment provider is **Yoco**.

The payment architecture is designed so additional providers (PayFast, Ozow, Peach Payments, EFT, Medical Aid gateways, etc.) can be integrated without modifying the Billing module or clinical workflows.

---

# Core Principle

Health Nexus modules must **never communicate directly** with a payment provider.

Every payment request passes through the centralized Payment Gateway.

```
Reception
      │
Doctor
      │
Laboratory
      │
Radiology
      │
Pharmacy
      │
Cashier
      │
AI Reception
      │
      ▼
Health Nexus Payment Gateway
      │
      ▼
Yoco API
```

This architecture centralizes payment logic, improves security, simplifies maintenance, and allows future payment providers to be added with minimal effort.

---

# Philosophy

The Payment Gateway is responsible for:

- Creating payment requests
- Generating secure payment links
- Receiving webhook notifications
- Verifying completed payments
- Updating invoice status
- Recording financial transactions
- Processing refunds
- Recording audit logs
- Notifying internal systems

The Payment Gateway never performs clinical decisions.

Clinical workflows remain under the Workflow Engine.

---

# Cashier Responsibilities

The Cashier remains the financial authority within Health Nexus.

Cashier responsibilities include:

- Creating invoices
- Managing invoices
- Accepting walk-in payments
- Recording cash payments
- Recording EFT payments
- Processing card payments
- Printing receipts
- Issuing refunds
- Cancelling invoices
- Daily reconciliation
- Closing cashier shifts
- Viewing payment history

Yoco processes electronic payments only.

The Cashier role is never replaced.

---

# AI Reception Responsibilities

The AI Reception Assistant may:

- Inform patients of consultation fees
- Explain outstanding balances
- Generate secure payment links
- Confirm payment status
- Answer payment-related questions
- Remind patients of unpaid invoices
- Notify patients after successful payment

The AI Reception Assistant may never:

- Issue refunds
- Cancel invoices
- Modify invoice amounts
- Apply discounts
- Override completed payments
- Waive balances

Financial authorization always belongs to authorized staff.

---

# Reception Staff Responsibilities

Reception staff may:

- Create invoices
- Request payments
- Send payment links
- View payment status
- Confirm payment completion

Reception staff may not:

- Issue refunds
- Void payments
- Modify paid invoices

---

# Doctor Responsibilities

Doctors never process payments.

Doctors complete clinical consultations.

After completing a consultation they simply generate billable services.

```
Consultation Completed

↓

Generate Billing Items

↓

Cashier
```

---

# Pharmacy Responsibilities

Pharmacy receives:

```
Prescription

↓

Medication Dispensed

↓

Generate Pharmacy Charges

↓

Cashier
```

---

# Laboratory Responsibilities

Laboratory receives:

```
Lab Request

↓

Sample Collected

↓

Results Completed

↓

Generate Laboratory Charges

↓

Cashier
```

---

# Radiology Responsibilities

Radiology receives:

```
Imaging Request

↓

Imaging Completed

↓

Generate Imaging Charges

↓

Cashier
```

---

# Invoice Lifecycle

```
Draft

↓

Pending Payment

↓

Payment Requested

↓

Payment Processing

↓

Paid

↓

Completed
```

Alternative outcomes:

```
Pending

↓

Failed

↓

Expired

↓

Cancelled

↓

Refunded

↓

Partially Refunded
```

Once an invoice is marked **Paid**, invoice totals become immutable.

Adjustments require:

- Credit Note
- Refund
- New Invoice

---

# Online Payment Workflow

```
Invoice Created

↓

Payment Gateway

↓

Yoco Checkout

↓

Customer Bank

↓

Payment Approved

↓

Yoco Webhook

↓

Health Nexus

↓

Invoice Paid
```

---

# Walk-In Payment Workflow

```
Patient Arrives

↓

Cashier Opens Invoice

↓

Card Machine / EFT / Cash

↓

Payment Successful

↓

Invoice Paid

↓

Receipt Printed
```

---

# WhatsApp Payment Workflow

The AI Reception Assistant may send secure payment links.

Example:

```
Hello Onele.

Your consultation invoice is ready.

Amount:
R350.00

Click below to complete your payment securely.

https://payments.yoco.com/...

Thank you.
```

After payment:

```
Payment Completed

↓

Webhook Received

↓

Invoice Updated

↓

Workflow Continues

↓

Patient Notified
```

AI Response:

```
Your payment has been received successfully.

Thank you.

Your appointment has now been confirmed.
```

---

# Payment Statuses

Supported payment states include:

- Draft
- Pending
- Requested
- Processing
- Paid
- Failed
- Cancelled
- Expired
- Refunded
- Partially Refunded

---

# Webhook Processing

Health Nexus listens for payment events from Yoco.

Supported events include:

```
payment.completed

payment.failed

refund.completed

refund.failed
```

Every webhook must verify:

- Signature
- Event authenticity
- Invoice reference
- Patient
- Clinic
- Amount
- Currency

Only verified webhook events may update invoices.

---

# Payment Verification

Before marking an invoice as paid, Health Nexus verifies:

- Invoice exists
- Clinic exists
- Patient exists
- Amount matches
- Currency matches
- Invoice not already paid
- Transaction not previously processed

Duplicate webhook events must be ignored through idempotency protection.

---

# Audit Logging

Every payment action creates an immutable audit record.

Examples:

```
Invoice Created

Payment Requested

Payment Link Generated

Payment Link Sent

Payment Completed

Webhook Received

Invoice Updated

Receipt Generated

Refund Issued

Refund Completed
```

Audit records can never be modified.

---

# Database Design

New tables:

```
payments

payment_methods

payment_transactions

payment_webhooks

payment_refunds

payment_audit_logs
```

Existing tables extended:

```
billing_invoices

patients

appointments

notifications
```

---

# Security

Health Nexus follows strict payment security principles.

- API keys are stored only on the backend.
- Frontend applications never access Yoco credentials.
- Payment amounts are calculated server-side.
- Every webhook signature must be verified.
- HTTPS is mandatory.
- Sensitive information is never logged.

---

# Multi-Clinic Architecture

Every financial record belongs to exactly one clinic.

Required field:

```
clinic_id
```

Every payment query respects:

- Row Level Security (RLS)
- Tenant Isolation
- Clinic Authorization

No clinic may access another clinic's financial information.

---

# AI Payment Capabilities

The AI Assistant has read-only financial access.

Patients may ask:

```
How much do I owe?

Have I paid?

Can you send my payment link?

Was my payment successful?

What invoices are outstanding?
```

The AI Assistant may not:

- Refund payments
- Edit invoices
- Void transactions
- Change billing amounts
- Override completed payments

Financial authorization always belongs to authorized staff.

---

# Future Payment Providers

The architecture is provider-independent.

Supported future integrations include:

- Yoco
- PayFast
- Ozow
- Peach Payments
- EFT
- Medical Aid Gateways
- Government Payment Platforms

Adding a new provider requires implementing only a new Payment Adapter.

Billing, Cashier, Reception, Pharmacy, Laboratory, AI Reception, and Workflow Engine remain unchanged.

---

# Engineering Rules

1. UI components never communicate directly with payment providers.
2. Every payment flows through the Payment Gateway.
3. API keys remain server-side only.
4. Every webhook must be validated.
5. Idempotency prevents duplicate processing.
6. Every payment action creates an audit record.
7. All financial records include `clinic_id`.
8. Billing remains the source of truth for invoices.
9. Workflow Engine remains the source of truth for patient progression.
10. AI may assist patients but never authorize financial changes.
11. Payment providers must remain interchangeable without changing business logic.

---

# Expected Result

After implementation:

- Patients can securely pay online using Yoco.
- Cashiers continue managing financial operations.
- Reception staff can create invoices and monitor payments.
- AI Reception can send payment links and confirm payment status.
- Doctors never manage payments.
- Pharmacy and Laboratory automatically generate billable services.
- Yoco webhooks automatically update invoices after successful payment.
- Patients receive immediate payment confirmations.
- Workflow Engine automatically continues patient progression after verified payment.
- Future payment providers can be integrated without modifying the rest of Health Nexus.

This architecture establishes a secure, scalable, multi-tenant, and provider-independent payment system that aligns with the overall modular architecture of Health Nexus.