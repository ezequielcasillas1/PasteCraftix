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
    if (supabase) {
      const user = await getAuthenticatedUser(supabase).catch(() => null);
      if (!user) {
        console.warn('⚠️ User not logged in - cloud activity log unavailable, showing local deletes only');
      }
    } else {
      console.warn('⚠️ Supabase client not available - showing local deletes only');
    }

    await fetchActivityPage(app);
  } catch (error) {
    console.error('❌ Failed to load activity log:', error);
  }
}

export async function fetchActivityPage(app, append = false) {
  try {
    const supabase = getSupabaseClient();
    let data = [];
    
    if (supabase) {
      const query = buildActivityQuery(supabase, app);
      const { data: remoteData, error } = await query;
      
      if (error) {
        console.error('❌ Activity query error:', error);
      } else {
        data = remoteData || [];
      }
    }

    // Always fetch local deletes and merge them if on the first page
    if (app.activityOffset === 0 && app.idb && typeof app.idb.getAllRecords === 'function') {
      try {
        const localDeletes = await app.idb.getAllRecords('deleted_items');
        if (localDeletes && localDeletes.length > 0) {
          const formattedLocalDeletes = localDeletes.map(record => ({
            id: `local_del_${record.id}`,
            occurred_at: new Date(record.deleted_at).toISOString(),
            table_name: record.table_name,
            operation: 'DELETE',
            row_old: record.payload,
            row_new: null,
            is_local_delete: true
          }));
          
          // Filter by date if needed
          const filters = readDateFilters();
          let filteredDeletes = formattedLocalDeletes;
          if (filters.from) {
            filteredDeletes = filteredDeletes.filter(d => d.occurred_at >= filters.from);
          }
          if (filters.to) {
            const toDate = filters.to + 'T23:59:59';
            filteredDeletes = filteredDeletes.filter(d => d.occurred_at <= toDate);
          }
          
          // Filter by operation if needed
          if (app.activityFilter && app.activityFilter !== ACTIVITY_FILTERS.ALL && app.activityFilter !== 'DELETE') {
            filteredDeletes = [];
          } else if (app.activityFilter === 'DELETE') {
            // Keep them
          }
          
          // Merge and deduplicate
          const existingIds = new Set(data.map(d => `${d.table_name}:${d.row_old?.id}`));
          const uniqueDeletes = filteredDeletes.filter(d => !existingIds.has(`${d.table_name}:${d.row_old?.id}`));
          
          data = [...data, ...uniqueDeletes];
          data.sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at));
        }
      } catch (e) {
        console.error('Failed to fetch local deletes:', e);
      }
    }

    mergeActivityEntries(app, data, append);
  } catch (error) {
    console.error('❌ Failed to fetch activity page:', error);
  }
}
