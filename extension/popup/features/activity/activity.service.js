import {
  ACTIVITY_AUTH_TIMEOUT_MS,
  ACTIVITY_PAGE_SIZE,
  ACTIVITY_FILTERS,
  ACTIVITY_SELECTORS,
  ACTIVITY_STATUS,
} from './activity.constants.js';

function getSupabaseClient() {
  if (typeof pasteCraftSupabase === 'undefined' || !pasteCraftSupabase?.client) return null;
  return pasteCraftSupabase.client;
}

function getPasteCraftSupabase() {
  if (typeof pasteCraftSupabase === 'undefined') return null;
  return pasteCraftSupabase;
}

function withTimeout(promise, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ACTIVITY_AUTH_TIMEOUT_MS)),
  ]);
}

function setActivityStatus(app, type) {
  app.activityStatus = { type };
}

function clearActivityForStatus(app, type) {
  app.activityEntries = [];
  app.activityHasMore = false;
  setActivityStatus(app, type);
  return false;
}

function getAuthClient(supabase) {
  const auth = supabase?.auth;
  return typeof auth?.getSession === 'function' ? auth : null;
}

function hasSessionIdentity(session) {
  return !!(session?.access_token && session?.user?.id);
}

async function readClientSession(auth) {
  const fallback = { data: { session: null }, error: new Error('activity auth session timeout') };
  const { data } = await withTimeout(auth.getSession(), fallback);
  return data?.session || null;
}

async function hasClientAuthSession(supabase) {
  const auth = getAuthClient(supabase);
  if (!auth) return false;

  try {
    return hasSessionIdentity(await readClientSession(auth));
  } catch (_) {
    return false;
  }
}

async function restoreSessionFromBridge(app) {
  if (typeof app?.restoreSupabaseSessionFromBridge !== 'function') return false;
  return !!(await app.restoreSupabaseSessionFromBridge('activity-log'));
}

async function ensureAuthenticatedActivityClient(app, supabase) {
  const pcSupabase = getPasteCraftSupabase();
  if (!pcSupabase || typeof pcSupabase.getCurrentUser !== 'function') {
    return { ok: false, status: ACTIVITY_STATUS.CLIENT_UNAVAILABLE };
  }

  const restored = await restoreSessionFromBridge(app);
  const user = await pcSupabase.getCurrentUser();
  if (!user?.id) {
    return { ok: false, status: ACTIVITY_STATUS.NOT_SIGNED_IN };
  }

  const sessionReady = restored || await hasClientAuthSession(supabase);
  if (!sessionReady) {
    return { ok: false, status: ACTIVITY_STATUS.SESSION_UNAVAILABLE };
  }

  return { ok: true, user };
}

function readDateFilters() {
  return {
    from: document.getElementById(ACTIVITY_SELECTORS.DATE_FROM)?.value || null,
    to: document.getElementById(ACTIVITY_SELECTORS.DATE_TO)?.value || null,
  };
}

function buildActivityQuery(supabase, app) {
  let query = supabase
    .from('change_audit_log')
    .select('id, occurred_at, table_name, operation, row_old, row_new')
    .order('occurred_at', { ascending: false })
    .range(app.activityOffset, app.activityOffset + ACTIVITY_PAGE_SIZE - 1);

  if (app.activityFilter && app.activityFilter !== ACTIVITY_FILTERS.ALL) {
    query = query.eq('operation', app.activityFilter);
  }

  return applyDateFilters(query, readDateFilters());
}

function applyDateFilters(query, { from, to }) {
  if (from) query = query.gte('occurred_at', from);
  if (to) query = query.lte('occurred_at', to + 'T23:59:59');
  return query;
}

function mergeActivityEntries(app, data, append) {
  const entries = data || [];
  app.activityEntries = append
    ? [...app.activityEntries, ...entries]
    : entries;
  app.activityHasMore = entries.length >= ACTIVITY_PAGE_SIZE;
  app.activityOffset += entries.length;
  setActivityStatus(app, app.activityEntries.length ? ACTIVITY_STATUS.READY : ACTIVITY_STATUS.EMPTY);
}

export async function loadActivityLog(app) {
  try {
    app.activityEntries = [];
    app.activityOffset = 0;
    app.activityFilter = ACTIVITY_FILTERS.ALL;
    app.activityHasMore = true;
    setActivityStatus(app, ACTIVITY_STATUS.EMPTY);

    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn('⚠️ Supabase client not available for activity log');
      return clearActivityForStatus(app, ACTIVITY_STATUS.CLIENT_UNAVAILABLE);
    }

    return await fetchActivityPage(app);
  } catch (error) {
    console.error('❌ Failed to load activity log:', error);
    return clearActivityForStatus(app, ACTIVITY_STATUS.QUERY_ERROR);
  }
}

export async function fetchActivityPage(app, append = false) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return clearActivityForStatus(app, ACTIVITY_STATUS.CLIENT_UNAVAILABLE);
    }

    const auth = await ensureAuthenticatedActivityClient(app, supabase);
    if (!auth.ok) {
      return clearActivityForStatus(app, auth.status);
    }

    const query = buildActivityQuery(supabase, app);
    const { data, error } = await query;

    if (error) {
      console.error('❌ Activity query error:', error);
      return clearActivityForStatus(app, ACTIVITY_STATUS.QUERY_ERROR);
    }

    mergeActivityEntries(app, data, append);
    return true;
  } catch (error) {
    console.error('❌ Failed to fetch activity page:', error);
    return clearActivityForStatus(app, ACTIVITY_STATUS.QUERY_ERROR);
  }
}
