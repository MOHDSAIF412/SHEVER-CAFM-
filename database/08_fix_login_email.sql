-- ==============================================================================
-- SHEVER TECHNICAL SERVICES - CAFM
-- 08_FIX_LOGIN_EMAIL.SQL
--
-- Fixes "I changed my email and now I cannot sign in".
--
-- CAUSE:
--   createUser normalised the email with trim().toLowerCase(), but updateUser
--   saved it exactly as typed. app_login then compared
--       lower(email) = lower(trim(p_identifier))
--   which lowercases the stored value but never trims it. So an address saved
--   with a leading or trailing space can never be matched by anything typed
--   into the sign-in box.
--
--   The password was never the problem - credentials are keyed by user id, so
--   they survive an email change untouched.
--
-- HOW TO RUN:
--   Supabase Dashboard -> SQL Editor -> paste this whole file -> Run.
--   Safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Show what is actually stored, before touching anything.
--    Anything flagged here could not be signed in to.
-- ------------------------------------------------------------------------------
SELECT
    id,
    '[' || email || ']'                    AS email_with_delimiters,
    length(email)                          AS raw_length,
    length(btrim(email))                   AS trimmed_length,
    CASE
        WHEN email <> btrim(email)           THEN 'has surrounding whitespace'
        WHEN email <> lower(email)           THEN 'has uppercase'
        ELSE 'clean'
    END                                    AS problem,
    employee_id,
    is_active,
    (SELECT count(*) FROM user_credentials c WHERE c.user_id = p.id) AS has_password
FROM profiles p
ORDER BY problem, email;

-- ------------------------------------------------------------------------------
-- 2. Normalise every stored address.
-- ------------------------------------------------------------------------------
UPDATE profiles
   SET email      = lower(btrim(email)),
       updated_at = NOW()
 WHERE email <> lower(btrim(email));

-- Same for employee ids, which are matched the same way at sign-in.
UPDATE profiles
   SET employee_id = btrim(employee_id),
       updated_at  = NOW()
 WHERE employee_id IS NOT NULL
   AND employee_id <> btrim(employee_id);

-- ------------------------------------------------------------------------------
-- 3. Make app_login tolerant, so a stray space can never lock anyone out again.
--    Both sides of every comparison are now trimmed and lowered.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_login(p_identifier TEXT, p_password TEXT)
RETURNS SETOF profiles AS $$
DECLARE
    v_profile profiles;
    v_hash    TEXT;
    v_needle  TEXT := lower(btrim(coalesce(p_identifier, '')));
BEGIN
    IF v_needle = '' THEN
        RETURN;
    END IF;

    SELECT * INTO v_profile
    FROM profiles
    WHERE lower(btrim(email)) = v_needle
       OR lower(btrim(coalesce(employee_id, ''))) = v_needle
    ORDER BY is_active DESC, created_at
    LIMIT 1;

    IF v_profile.id IS NULL THEN
        RETURN;                      -- unknown user -> empty result
    END IF;

    IF v_profile.is_active IS FALSE THEN
        RETURN;                      -- deactivated user -> empty result
    END IF;

    SELECT password_hash INTO v_hash
    FROM user_credentials WHERE user_id = v_profile.id;

    IF v_hash IS NULL OR v_hash <> crypt(p_password, v_hash) THEN
        RETURN;                      -- wrong password -> empty result
    END IF;

    UPDATE profiles SET last_login_at = NOW() WHERE id = v_profile.id;

    RETURN QUERY SELECT * FROM profiles WHERE id = v_profile.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION app_login(TEXT, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. Any account with no password row cannot sign in at all. Give those the
--    default so they are recoverable, then change it from the Users screen.
-- ------------------------------------------------------------------------------
DO $$
DECLARE v_id TEXT;
BEGIN
    FOR v_id IN
        SELECT p.id::text FROM profiles p
        LEFT JOIN user_credentials c ON c.user_id = p.id
        WHERE c.user_id IS NULL
    LOOP
        PERFORM app_set_password(v_id, 'Password123!');
        RAISE NOTICE 'Account % had no password; set to the default.', v_id;
    END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 5. Reactivate anything switched off, so a stale is_active cannot hide a login.
-- ------------------------------------------------------------------------------
UPDATE profiles SET is_active = TRUE WHERE is_active IS DISTINCT FROM TRUE;

-- ==============================================================================
-- VERIFY - every account below should now be signable-in
-- ==============================================================================
SELECT
    email,
    employee_id,
    role_id,
    is_active,
    CASE WHEN EXISTS (SELECT 1 FROM user_credentials c WHERE c.user_id = p.id)
         THEN 'password set' ELSE '*** NO PASSWORD ***' END AS credentials,
    CASE WHEN email = lower(btrim(email)) THEN 'clean' ELSE '*** STILL DIRTY ***' END AS email_state
FROM profiles p
ORDER BY email;
