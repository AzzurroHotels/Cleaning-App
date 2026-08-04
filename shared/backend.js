(() => {
  const { createClient } = window.supabase || {};
  const cfg = window.APP_CONFIG || {};
  if (!createClient || !cfg.supabaseUrl || !cfg.supabaseAnonKey) {
    throw new Error('Application configuration is incomplete.');
  }

  const client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const CLEANER_NAME_KEY = 'azzurro-cleaner-name';
  let currentUser = null;
  let currentRole = null;
  let currentProperty = null;
  let currentChecklistDate = getSydneyDate();
  let realtimeChannel = null;
  let refreshTimer = null;
  let reconnectTimer = null;
  let realtimeGeneration = 0;
  let lastTextInputAt = 0;
  let lastRealtimeEventAt = 0;
  let fallbackSyncTimer = null;
  let localWriteUntil = 0;

  function getSydneyDate(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function getRequestedChecklistDate() {
    const requested = new URLSearchParams(window.location.search).get('date');
    return /^\d{4}-\d{2}-\d{2}$/.test(requested || '') ? requested : null;
  }

  function getEarliestAllowedDate() {
    const today = getSydneyDate();
    const [year, month, day] = today.split('-').map(Number);
    const cutoff = new Date(Date.UTC(year, month - 1, day - 13, 12));
    return cutoff.toISOString().slice(0, 10);
  }

  function isAllowedHistoryDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value || '')
      && value >= getEarliestAllowedDate()
      && value <= getSydneyDate();
  }

  function getCleanerName() {
    return (sessionStorage.getItem(CLEANER_NAME_KEY) || '').trim();
  }

  function setCleanerName(name) {
    const cleaned = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 100);
    if (cleaned) sessionStorage.setItem(CLEANER_NAME_KEY, cleaned);
    else sessionStorage.removeItem(CLEANER_NAME_KEY);
    return cleaned;
  }

  function markLocalWrite() {
    localWriteUntil = Date.now() + 1800;
  }

  function isTextEntryTarget(target) {
    if (!target) return false;
    if (target.tagName === 'TEXTAREA') return true;
    if (target.tagName !== 'INPUT') return false;
    const type = (target.type || 'text').toLowerCase();
    return ['text', 'search', 'email', 'tel', 'url', 'password', 'number'].includes(type);
  }

  document.addEventListener('input', event => {
    if (isTextEntryTarget(event.target)) lastTextInputAt = Date.now();
  }, true);

  function scheduleRemoteRefresh(delay = 180) {
    lastRealtimeEventAt = Date.now();
    if (refreshTimer) return;

    const refreshWhenQuiet = () => {
      const quietFor = Date.now() - lastTextInputAt;
      if (quietFor < 650) {
        refreshTimer = setTimeout(refreshWhenQuiet, 650 - quietFor);
        return;
      }

      refreshTimer = null;
      window.dispatchEvent(new CustomEvent('checklist:remote-change', {
        detail: { propertyKey: currentProperty, checklistDate: currentChecklistDate }
      }));
    };

    refreshTimer = setTimeout(refreshWhenQuiet, delay);
  }

  function startFallbackSync() {
    clearInterval(fallbackSyncTimer);
    fallbackSyncTimer = setInterval(() => {
      if (document.visibilityState !== 'visible' || !currentProperty) return;
      if (Date.now() - lastTextInputAt < 650) return;
      window.dispatchEvent(new CustomEvent('checklist:remote-change', {
        detail: { propertyKey: currentProperty, checklistDate: currentChecklistDate, fallback: true }
      }));
    }, 12000);
  }

  async function startRealtime(propertyKey) {
    const generation = ++realtimeGeneration;
    clearTimeout(reconnectTimer);

    if (realtimeChannel) {
      await client.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }

    const filter = `property_key=eq.${propertyKey}`;
    const handleChange = (payload) => {
      if (generation !== realtimeGeneration) return;
      const changedDate = payload?.new?.checklist_date || payload?.old?.checklist_date || null;
      if (changedDate && changedDate !== currentChecklistDate) return;
      scheduleRemoteRefresh();
    };

    const channel = client
      .channel(`cleaning-checklist:${propertyKey}:${currentChecklistDate}:${generation}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_task_status', filter }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reception_notes', filter }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'additional_tasks', filter }, handleChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaner_daily_names', filter }, handleChange);

    realtimeChannel = channel;
    channel.subscribe(status => {
      if (generation !== realtimeGeneration) return;
      if (status === 'SUBSCRIBED') {
        clearTimeout(reconnectTimer);
        scheduleRemoteRefresh(50);
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn('Realtime connection issue:', status);
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          if (generation === realtimeGeneration && currentProperty === propertyKey) {
            startRealtime(propertyKey).catch(error => console.warn('Realtime reconnect failed:', error));
          }
        }, 1500);
      }
    });

    startFallbackSync();
  }

  async function getProfile(userId) {
    const { data, error } = await client.from('app_profiles').select('id,email,role').eq('id', userId).single();
    if (error) throw error;
    return data;
  }

  async function registerCleanerName() {
    if (currentRole !== 'cleaning') return;
    const cleanerName = getCleanerName();
    if (!cleanerName) throw new Error('Enter your name before opening a checklist.');
    markLocalWrite();
    const { error } = await client.from('cleaner_daily_names').upsert({
      property_key: currentProperty,
      checklist_date: currentChecklistDate,
      cleaner_name: cleanerName,
      user_id: currentUser.id,
      registered_at: new Date().toISOString()
    }, {
      onConflict: 'property_key,checklist_date,cleaner_name',
      ignoreDuplicates: true
    });
    if (error) throw error;
  }

  async function requireAuth(propertyKey) {
    currentProperty = propertyKey;
    currentChecklistDate = getSydneyDate();
    const { data: { session }, error } = await client.auth.getSession();
    if (error || !session?.user) {
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.replace(`../index.html?returnTo=${returnTo}`);
      return null;
    }

    currentUser = session.user;
    try {
      const profile = await getProfile(currentUser.id);
      currentRole = profile.role;
      if (!['reception', 'cleaning'].includes(currentRole)) throw new Error('This account does not have checklist access.');
      const requestedDate = getRequestedChecklistDate();
      currentChecklistDate = currentRole === 'reception' && isAllowedHistoryDate(requestedDate)
        ? requestedDate
        : getSydneyDate();
      if (currentRole === 'cleaning' && !getCleanerName()) {
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace(`../index.html?returnTo=${returnTo}&nameRequired=1`);
        return null;
      }
      updateUserBar(profile);
      setupHistoryControls();
      if (currentRole === 'cleaning') await registerCleanerName();
      await startRealtime(propertyKey);
      return { user: currentUser, role: currentRole, checklistDate: currentChecklistDate, cleanerName: getCleanerName() };
    } catch (err) {
      alert(err.message || 'Unable to verify account access.');
      return null;
    }
  }

  function updateUserBar(profile) {
    const email = document.getElementById('signedInEmail');
    const badge = document.getElementById('roleBadge');
    if (email) email.textContent = profile.email || currentUser?.email || '';
    if (badge) {
      badge.textContent = profile.role === 'reception'
        ? 'Reception'
        : `Cleaning Team · ${getCleanerName()}`;
    }
  }

  function setupHistoryControls() {
    const control = document.getElementById('historyControls');
    const input = document.getElementById('historyDate');
    const label = document.getElementById('viewingDateLabel');
    if (label) label.textContent = currentChecklistDate === getSydneyDate() ? 'Today' : currentChecklistDate;
    if (!control || !input) return;
    if (currentRole !== 'reception') {
      control.hidden = true;
      return;
    }
    control.hidden = false;
    input.min = getEarliestAllowedDate();
    input.max = getSydneyDate();
    input.value = currentChecklistDate;
    input.addEventListener('change', () => {
      if (!isAllowedHistoryDate(input.value)) return;
      const url = new URL(window.location.href);
      if (input.value === getSydneyDate()) url.searchParams.delete('date');
      else url.searchParams.set('date', input.value);
      window.location.assign(url.toString());
    });
  }

  async function loadPropertyState(propertyKey) {
    const dateFilter = query => query.eq('property_key', propertyKey).eq('checklist_date', currentChecklistDate);
    const [statusResult, notesResult, tasksResult, namesResult] = await Promise.all([
      dateFilter(client.from('cleaning_task_status').select('item_id,completed,cleaner_note,completed_at')),
      dateFilter(client.from('reception_notes').select('item_id,note')),
      dateFilter(client.from('additional_tasks').select('id,title,meta,sort_order')).order('sort_order', { ascending: true }),
      dateFilter(client.from('cleaner_daily_names').select('cleaner_name')).order('registered_at', { ascending: true })
    ]);
    const error = statusResult.error || notesResult.error || tasksResult.error || namesResult.error;
    if (error) throw error;

    const checks = {};
    const cleanerNotes = {};
    const completedTimes = {};
    const receptionNotes = {};
    statusResult.data.forEach(row => {
      checks[row.item_id] = Boolean(row.completed);
      if (row.cleaner_note) cleanerNotes[row.item_id] = row.cleaner_note;
      if (row.completed_at) completedTimes[row.item_id] = row.completed_at;
    });
    notesResult.data.forEach(row => {
      if (row.note !== null) receptionNotes[row.item_id] = row.note;
    });
    const additionalTasks = tasksResult.data.map(row => ({ id: row.id, title: row.title, meta: row.meta || 'Special task' }));
    const cleanerNames = [...new Set(namesResult.data.map(row => row.cleaner_name).filter(Boolean))];
    return { checks, cleanerNotes, completedTimes, receptionNotes, additionalTasks, cleanerNames, checklistDate: currentChecklistDate };
  }

  function assertEditableDate() {
    if (currentChecklistDate !== getSydneyDate()) throw new Error('Previous-day records are read-only.');
  }

  async function saveStatus(itemId, completed, cleanerNote, completedAt = null) {
    assertEditableDate();
    if (currentRole === 'cleaning') await registerCleanerName();
    markLocalWrite();
    const payload = {
      property_key: currentProperty,
      checklist_date: currentChecklistDate,
      item_id: itemId,
      completed: Boolean(completed),
      cleaner_note: cleanerNote || '',
      completed_at: completed ? (completedAt || new Date().toISOString()) : null,
      updated_by: currentUser.id,
      updated_at: new Date().toISOString()
    };
    const { error } = await client.from('cleaning_task_status').upsert(payload, { onConflict: 'property_key,checklist_date,item_id' });
    if (error) throw error;
  }

  async function saveReceptionNote(itemId, note) {
    assertEditableDate();
    if (currentRole !== 'reception') throw new Error('Cleaning accounts cannot edit reception notes.');
    markLocalWrite();
    const { error } = await client.from('reception_notes').upsert({
      property_key: currentProperty,
      checklist_date: currentChecklistDate,
      item_id: itemId,
      note: note || '',
      updated_by: currentUser.id,
      updated_at: new Date().toISOString()
    }, { onConflict: 'property_key,checklist_date,item_id' });
    if (error) throw error;
  }

  async function addTask(task) {
    assertEditableDate();
    if (currentRole !== 'reception') throw new Error('Only reception can add tasks.');
    markLocalWrite();
    const { error } = await client.from('additional_tasks').insert({
      property_key: currentProperty,
      checklist_date: currentChecklistDate,
      id: task.id,
      title: task.title,
      meta: task.meta || 'Special task',
      sort_order: Date.now(),
      created_by: currentUser.id
    });
    if (error) throw error;
  }

  async function deleteTask(id) {
    assertEditableDate();
    if (currentRole !== 'reception') throw new Error('Only reception can delete tasks.');
    markLocalWrite();
    const match = query => query.eq('property_key', currentProperty).eq('checklist_date', currentChecklistDate).eq('item_id', id);
    const results = await Promise.all([
      match(client.from('cleaning_task_status').delete()),
      match(client.from('reception_notes').delete()),
      client.from('additional_tasks').delete().eq('property_key', currentProperty).eq('checklist_date', currentChecklistDate).eq('id', id)
    ]);
    const error = results.find(result => result.error)?.error;
    if (error) throw error;
  }

  async function resetProperty() {
    assertEditableDate();
    if (currentRole !== 'reception') throw new Error('Only reception can reset a checklist.');
    markLocalWrite();
    const filter = query => query.eq('property_key', currentProperty).eq('checklist_date', currentChecklistDate);
    const results = await Promise.all([
      filter(client.from('cleaning_task_status').delete()),
      filter(client.from('reception_notes').delete()),
      filter(client.from('cleaner_daily_names').delete())
    ]);
    const error = results.find(result => result.error)?.error;
    if (error) throw error;
  }

  async function signOut() {
    clearTimeout(refreshTimer);
    clearTimeout(reconnectTimer);
    clearInterval(fallbackSyncTimer);
    if (realtimeChannel) await client.removeChannel(realtimeChannel);
    sessionStorage.removeItem(CLEANER_NAME_KEY);
    await client.auth.signOut();
    window.location.replace('../index.html');
  }

  window.AppBackend = {
    client,
    requireAuth,
    loadPropertyState,
    saveStatus,
    saveReceptionNote,
    addTask,
    deleteTask,
    resetProperty,
    signOut,
    startRealtime,
    getCleanerName,
    setCleanerName,
    registerCleanerName,
    get checklistDate() { return currentChecklistDate; },
    get role() { return currentRole; },
    get isReception() { return currentRole === 'reception'; },
    get isHistorical() { return currentChecklistDate !== getSydneyDate(); },
    get canEdit() { return currentChecklistDate === getSydneyDate(); }
  };

  window.addEventListener('pagehide', () => {
    clearTimeout(refreshTimer);
    clearTimeout(reconnectTimer);
    clearInterval(fallbackSyncTimer);
    if (realtimeChannel) client.removeChannel(realtimeChannel);
  });
})();
