# Auth/User Reconciliation Runbook (Dry-Run First)

## 1) Backup Recommendation (before any writes)
1. Take a full database backup/snapshot from Supabase dashboard.
2. Export at minimum these tables as CSV (belt-and-suspenders): `users`, `clinics`, `clinic_members`, `join_requests`, `patients`, `appointments`, `consultation_notes`, `prescriptions`, `queue_entries`, `lab_requests`, `lab_results`, `invoices`, `payments`, `stock_movements`, `password_reset_tokens`, `staff_availability`, `activity_logs`, `notifications`.
3. Save backup timestamp and project ref in your change ticket.

## 2) Supabase SQL Editor Execution Order
1. Run: `scripts/sql/dry_run_auth_user_reconciliation.sql`
2. Validate:
   - mismatches are exactly the accounts you expect
   - FK impact counts are plausible
   - affected clinics list is expected
   - orphaned rows = `0` for all listed checks
3. Run: `scripts/sql/reconcile_auth_user_ids.sql`
4. Re-run: `scripts/sql/dry_run_auth_user_reconciliation.sql`
5. Confirm:
   - mismatch result set is empty
   - orphaned rows remain `0`
6. Run: `scripts/sql/supabase_auth_user_sync.sql`
7. Smoke-check trigger by creating a test auth user and verifying `public.users.id = auth.users.id`.

## 3) Rollback Strategy
1. If any write step fails mid-run, execute `ROLLBACK;` in that session (the reconciliation script is transactional).
2. If writes were committed but results are invalid, restore from the pre-run backup/snapshot.
3. After restore, re-run only the dry-run SQL and resolve data anomalies before retrying reconciliation.

## 4) Post-Execution App Steps
1. Restart backend service.
2. Restart frontend service.
3. Clear browser local storage/session for test accounts.
4. Perform end-to-end checks:
   - signup
   - login
   - clinic creation
   - join request
   - authenticated API calls
   - session persistence after refresh
   - cross-clinic isolation checks
