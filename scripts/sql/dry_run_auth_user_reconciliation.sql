-- DRY-RUN ONLY (SELECT statements + catalog-driven temp materialization)
-- This script dynamically adapts to the REAL schema:
-- - discovers existing FK tables/columns that reference public.users(id)
-- - skips non-existing module tables automatically
-- - reports mismatches, impact counts, affected clinics, orphaned references

-- Build mismatch set once
DROP TABLE IF EXISTS user_id_mismatches;
CREATE TEMP TABLE user_id_mismatches AS
SELECT
  u.id AS old_user_id,
  au.id AS auth_user_id,
  u.email
FROM public.users u
JOIN auth.users au
  ON lower(u.email) = lower(au.email)
WHERE u.id <> au.id;

-- A) Mismatched users
SELECT
  old_user_id AS public_user_id,
  auth_user_id,
  email
FROM user_id_mismatches
ORDER BY email;

-- Build dynamic FK impact counts
DROP TABLE IF EXISTS fk_impact_counts;
CREATE TEMP TABLE fk_impact_counts (
  fk text NOT NULL,
  affected_rows bigint NOT NULL
);

DO $$
DECLARE
  fk_row RECORD;
BEGIN
  FOR fk_row IN
    SELECT
      n.nspname AS table_schema,
      c.relname AS table_name,
      a.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class c
      ON c.oid = con.conrelid
    JOIN pg_namespace n
      ON n.oid = c.relnamespace
    JOIN pg_attribute a
      ON a.attrelid = con.conrelid
     AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.users'::regclass
      AND array_length(con.conkey, 1) = 1
      AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'INSERT INTO fk_impact_counts (fk, affected_rows)
       SELECT %L, count(*)::bigint
       FROM %I.%I t
       JOIN user_id_mismatches m
         ON t.%I = m.old_user_id',
      fk_row.table_name || '.' || fk_row.column_name,
      fk_row.table_schema,
      fk_row.table_name,
      fk_row.column_name
    );
  END LOOP;
END $$;

-- B) FK impact counts per existing table/column only
SELECT fk, affected_rows
FROM fk_impact_counts
ORDER BY fk;

-- Build clinics affected (only if clinics.owner_user_id exists)
DROP TABLE IF EXISTS clinics_affected;
CREATE TEMP TABLE clinics_affected (
  clinic_id uuid,
  clinic_code text,
  clinic_name text,
  owner_public_user_id uuid,
  owner_auth_user_id uuid,
  owner_email text
);

DO $$
BEGIN
  IF to_regclass('public.clinics') IS NOT NULL
     AND EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'clinics'
         AND column_name = 'owner_user_id'
     )
  THEN
    EXECUTE $sql$
      INSERT INTO clinics_affected
      SELECT
        c.id,
        c.code,
        c.name,
        c.owner_user_id,
        m.auth_user_id,
        m.email
      FROM public.clinics c
      JOIN user_id_mismatches m
        ON c.owner_user_id = m.old_user_id
      ORDER BY c.created_at
    $sql$;
  END IF;
END $$;

-- C) Clinics affected
SELECT *
FROM clinics_affected
ORDER BY clinic_name NULLS LAST, clinic_id;

-- Build orphan checks for ALL existing FK refs to users
DROP TABLE IF EXISTS fk_orphan_counts;
CREATE TEMP TABLE fk_orphan_counts (
  fk text NOT NULL,
  orphaned_rows bigint NOT NULL
);

DO $$
DECLARE
  fk_row RECORD;
BEGIN
  FOR fk_row IN
    SELECT
      n.nspname AS table_schema,
      c.relname AS table_name,
      a.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class c
      ON c.oid = con.conrelid
    JOIN pg_namespace n
      ON n.oid = c.relnamespace
    JOIN pg_attribute a
      ON a.attrelid = con.conrelid
     AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.users'::regclass
      AND array_length(con.conkey, 1) = 1
      AND n.nspname = 'public'
  LOOP
    EXECUTE format(
      'INSERT INTO fk_orphan_counts (fk, orphaned_rows)
       SELECT %L, count(*)::bigint
       FROM %I.%I t
       LEFT JOIN public.users u
         ON u.id = t.%I
       WHERE t.%I IS NOT NULL
         AND u.id IS NULL',
      fk_row.table_name || '.' || fk_row.column_name,
      fk_row.table_schema,
      fk_row.table_name,
      fk_row.column_name,
      fk_row.column_name
    );
  END LOOP;
END $$;

-- D) Orphaned references (existing FK tables only)
SELECT fk, orphaned_rows
FROM fk_orphan_counts
ORDER BY fk;
