-- Reconcile public.users.id to auth.users.id by matching on email.
-- Dynamic schema-safe version:
-- - updates only existing FK tables/columns referencing public.users(id)
-- - skips non-existing module tables automatically
-- - preserves transactional safety (all-or-nothing)

BEGIN;

DROP TABLE IF EXISTS user_id_mismatches;
CREATE TEMP TABLE user_id_mismatches AS
SELECT
  u.id AS old_user_id,
  au.id AS auth_user_id,
  u.email
FROM public.users u
JOIN auth.users au
  ON lower(au.email) = lower(u.email)
WHERE u.id <> au.id;

-- 1) Free email uniqueness on legacy rows before creating target rows.
DO $$
DECLARE
  has_updated_at boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'updated_at'
  ) INTO has_updated_at;

  IF has_updated_at THEN
    EXECUTE $sql$
      UPDATE public.users u
      SET email = 'migrating+' || u.id::text || '@invalid.health-nexus.local',
          updated_at = now()
      FROM user_id_mismatches m
      WHERE u.id = m.old_user_id
    $sql$;
  ELSE
    EXECUTE $sql$
      UPDATE public.users u
      SET email = 'migrating+' || u.id::text || '@invalid.health-nexus.local'
      FROM user_id_mismatches m
      WHERE u.id = m.old_user_id
    $sql$;
  END IF;
END $$;

-- 2) Create target rows with auth ID, using only columns that actually exist.
DO $$
DECLARE
  col_rec RECORD;
  insert_cols text := '';
  select_exprs text := '';
BEGIN
  FOR col_rec IN
    SELECT c.column_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'users'
      AND c.column_name IN (
        'id','name','email','password_hash','user_type','role','staff_code',
        'government_id_type','government_id_number','nationality','email_verified',
        'otp_code','otp_expires_at','last_login_at','created_at','updated_at'
      )
    ORDER BY c.ordinal_position
  LOOP
    insert_cols := insert_cols || CASE WHEN insert_cols = '' THEN '' ELSE ', ' END || quote_ident(col_rec.column_name);

    select_exprs := select_exprs || CASE WHEN select_exprs = '' THEN '' ELSE ', ' END ||
      CASE col_rec.column_name
        WHEN 'id' THEN 'm.auth_user_id'
        WHEN 'email' THEN 'm.email'
        WHEN 'updated_at' THEN 'now()'
        ELSE 'old_u.' || quote_ident(col_rec.column_name)
      END;
  END LOOP;

  IF insert_cols = '' THEN
    RAISE EXCEPTION 'No compatible columns found on public.users';
  END IF;

  EXECUTE format(
    'INSERT INTO public.users (%s)
     SELECT %s
     FROM user_id_mismatches m
     JOIN public.users old_u
       ON old_u.id = m.old_user_id
     LEFT JOIN public.users target_u
       ON target_u.id = m.auth_user_id
     WHERE target_u.id IS NULL',
    insert_cols,
    select_exprs
  );
END $$;

-- 3) Repoint all existing FK references from old_user_id -> auth_user_id.
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
      'UPDATE %I.%I t
       SET %I = m.auth_user_id
       FROM user_id_mismatches m
       WHERE t.%I = m.old_user_id',
      fk_row.table_schema,
      fk_row.table_name,
      fk_row.column_name,
      fk_row.column_name
    );
  END LOOP;
END $$;

-- 4) Remove legacy user rows after FK rewiring.
DELETE FROM public.users u
USING user_id_mismatches m
WHERE u.id = m.old_user_id;

COMMIT;
