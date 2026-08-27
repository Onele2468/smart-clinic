import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const routeSource = readFileSync(resolve(here, "../src/routes/ai.ts"), "utf8");
const serviceSource = readFileSync(resolve(here, "../src/services/ai/AIService.ts"), "utf8");
const promptSource = readFileSync(resolve(here, "../src/services/ai/PromptService.ts"), "utf8");

test("generic AI summary no longer accepts arbitrary prompts", () => {
  assert.match(routeSource, /router\.post\("\/ai\/summary", requireAuth/);
  assert.match(routeSource, /status\(410\)/);
  assert.doesNotMatch(routeSource, /aiService\.chat\(/);
});

test("review-only endpoints require clinic membership and purpose-specific roles", () => {
  for (const roleSet of [
    'requireRole("doctor", "clinic_admin")',
    'requireRole("nurse", "clinic_admin")',
    'requireRole("lab_technician", "doctor", "clinic_admin")',
    'requireRole("pharmacist", "doctor", "clinic_admin")',
    'requireRole("clinic_admin", "cashier", "receptionist")',
  ]) {
    assert.match(routeSource, new RegExp(roleSet.replace(/[()]/g, "\\$&")));
  }
  assert.match(routeSource, /requireClinicMember as any/);
});

test("every clinical and financial record is selected within the requesting clinic", () => {
  for (const table of [
    "consultationNotesTable",
    "nurseAssessmentsTable",
    "labResultsTable",
    "prescriptionsTable",
    "invoicesTable",
    "patientsTable",
  ]) {
    assert.match(routeSource, new RegExp(`eq\\(${table}\\.clinicId, clinicId\\)`));
  }
});

test("review-only AI service cannot mutate records or workflows", () => {
  assert.match(serviceSource, /async reviewOnly/);
  assert.doesNotMatch(serviceSource, /@workspace\/db/);
  assert.doesNotMatch(serviceSource, /\.insert\(|\.update\(|\.delete\(/);
  assert.doesNotMatch(serviceSource, /processWorkflowEvent|workflowAI/);
});

test("review prompts explicitly prohibit autonomous clinical and financial actions", () => {
  assert.match(promptSource, /Do not diagnose/);
  assert.match(promptSource, /Do not add, change, infer, or recommend dosage/);
  assert.match(promptSource, /Do not approve results/);
  assert.match(promptSource, /Do not create, verify, change, or recommend payments/);
  assert.match(promptSource, /Do not invent clinical instructions/);
});

test("provider failure returns manual-review guidance and audit information without source prompts", () => {
  assert.match(routeSource, /status\(503\)/);
  assert.match(routeSource, /Continue the existing review manually/);
  assert.match(routeSource, /review_only_ai_completed/);
  assert.match(routeSource, /review_only_ai_failed/);
  assert.doesNotMatch(routeSource, /sourceData.*message/);
});
