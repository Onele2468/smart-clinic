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

The organisation type changes system behaviour through configuration.

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
- Patient registration
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

- One patient record.
- One appointment engine.
- One queue engine.
- One notification system.
- One billing engine.
- One AI platform.
- One configurable workflow.

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