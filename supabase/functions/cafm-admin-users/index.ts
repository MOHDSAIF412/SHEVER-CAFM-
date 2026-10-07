// OCS CAFM - admin user management.
//
// The browser only ever holds the public (anon) key, which cannot create
// sign-in accounts or set passwords. This function holds the service-role key
// server-side and does those jobs, but only for a caller whose own CAFM
// profile is an active admin.
//
// Actions (POST JSON):
//   { action: 'create_user',  profile: {...}, password }
//   { action: 'set_password', profile_id, password }
//   { action: 'delete_user',  profile_id }
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const PROFILE_FIELDS = ['id', 'employee_id', 'email', 'full_name', 'phone', 'role_id', 'department', 'is_active', 'trade_code', 'grade'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  // --- who is calling? -------------------------------------------------------
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: caller } = await admin.auth.getUser(token);
  if (!caller?.user) return json({ error: 'Not signed in.' }, 401);

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('role_id, is_active')
    .eq('auth_user_id', caller.user.id)
    .maybeSingle();
  if (!callerProfile || callerProfile.role_id !== 'admin' || callerProfile.is_active === false) {
    return json({ error: 'Only an administrator can manage users.' }, 403);
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const checkPassword = (p: unknown) => {
    if (typeof p !== 'string' || p.length < 8) throw new Error('Password must be at least 8 characters long.');
    return p;
  };

  try {
    // --- create a user: auth account + profile, linked -----------------------
    if (body.action === 'create_user') {
      const input = body.profile || {};
      const email = String(input.email || '').trim().toLowerCase();
      if (!email) throw new Error('Email is required.');
      const password = checkPassword(body.password);

      const { data: created, error: authErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authErr) throw authErr;

      const row: Record<string, unknown> = { auth_user_id: created.user.id, email };
      for (const k of PROFILE_FIELDS) if (k in input && k !== 'email') row[k] = input[k];
      if (!row.id) row.id = crypto.randomUUID();

      const { data: profile, error: profErr } = await admin.from('profiles').insert(row).select().single();
      if (profErr) {
        await admin.auth.admin.deleteUser(created.user.id); // don't leave an orphan login
        throw profErr;
      }
      return json({ profile });
    }

    // --- set / reset a password ----------------------------------------------
    if (body.action === 'set_password') {
      const password = checkPassword(body.password);
      const { data: profile, error } = await admin
        .from('profiles')
        .select('id, email, auth_user_id')
        .eq('id', body.profile_id)
        .single();
      if (error) throw error;

      if (profile.auth_user_id) {
        const { error: updErr } = await admin.auth.admin.updateUserById(profile.auth_user_id, { password });
        if (updErr) throw updErr;
      } else {
        // First password for a profile that has no sign-in account yet.
        const { data: created, error: authErr } = await admin.auth.admin.createUser({
          email: profile.email,
          password,
          email_confirm: true,
        });
        if (authErr) throw authErr;
        await admin.from('profiles').update({ auth_user_id: created.user.id }).eq('id', profile.id);
      }
      return json({ ok: true });
    }

    // --- delete a user ---------------------------------------------------------
    if (body.action === 'delete_user') {
      const { data: profile, error } = await admin
        .from('profiles')
        .select('id, auth_user_id')
        .eq('id', body.profile_id)
        .single();
      if (error) throw error;
      if (profile.auth_user_id === caller.user.id) throw new Error('You cannot delete your own account.');

      const { error: delErr } = await admin.from('profiles').delete().eq('id', profile.id);
      if (delErr) throw delErr;
      // The sign-in account itself is kept: this Supabase project also hosts the
      // FM Condition Survey app, which may use the same login. Without a CAFM
      // profile the account has no access to any CAFM data.
      return json({ ok: true });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || 'Request failed.' }, 400);
  }
});
