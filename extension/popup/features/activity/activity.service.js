import { ACTIVITY_PAGE_SIZE, ACTIVITY_FILTERS, ACTIVITY_SELECTORS } from './activity.constants.js';

function getSupabaseClient() {
  if (typeof pasteCraftSupabase === 'undefined' || !pasteCraftSupabase?.client) return null;
  return pasteCraftSupabase.client;
}

async function getAuthenticatedUser(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  return user || null;
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
}

export async function loadActivityLog(app) {
  try {
    app.activityEntries = [];
    app.activityOffset = 0;
    app.activityFilter = ACTIVITY_FILTERS.ALL;
    app.activityHasMore = true;

    const supabase = getSupabaseClient();
    if (!supabase) {
      console.warn('⚠️ Supabase client not available for activity log');
      return;
    }

    const user = await getAuthenticatedUser(supabase);
    if (!user) {
      console.warn('⚠️ User not logged in - activity log unavailable');
      return;
    }

    await fetchActivityPage(app);
  } catch (error) {
    console.error('❌ Failed to load activity log:', error);
  }
}

export async function fetchActivityPage(app, append = false) {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    const query = buildActivityQuery(supabase, app);
    const { data, error } = await query;

    if (error) {
      console.error('❌ Activity query error:', error);
      return;
    }

    mergeActivityEntries(app, data, append);
  } catch (error) {
    console.error('❌ Failed to fetch activity page:', error);
  }
}
