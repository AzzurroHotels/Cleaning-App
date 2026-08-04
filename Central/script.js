const PROPERTY_KEY = 'central';
const CHECKLIST_KEY = 'central-cleaners-checklist-v1';
const ADDITIONAL_KEY = 'central-cleaners-additional-v1';
const RECEPTION_NOTES_KEY = 'central-reception-notes-v1';
const CLEANER_NOTES_KEY = 'central-cleaner-notes-v1';
const COMPLETED_TIMES_KEY = `${CHECKLIST_KEY}-completed-times`;

const checklistData = {
  ensuite: [
    { id: 'ensuite-room-101', title: 'Room 101', meta: '1st level · Private bathroom', bedCount: 4 },
    { id: 'ensuite-room-206', title: 'Room 206', meta: '2nd level · Private bathroom', bedCount: 6 },
    { id: 'ensuite-room-207', title: 'Room 207', meta: '2nd level · Private bathroom', bedCount: 2 }
  ],
  'shared-rooms': [
    { id: 'shared-room-102', title: 'Room 102', meta: '1st level', bedCount: 6 },
    { id: 'shared-room-103', title: 'Room 103', meta: '1st level', bedCount: 4 },
    { id: 'shared-room-104', title: 'Room 104', meta: '1st level', bedCount: 4 },
    { id: 'shared-room-201', title: 'Room 201', meta: '2nd level', bedCount: 6 },
    { id: 'shared-room-202', title: 'Room 202', meta: '2nd level', bedCount: 2 },
    { id: 'shared-room-203', title: 'Room 203', meta: '2nd level', bedCount: 2 },
    { id: 'shared-room-204', title: 'Room 204', meta: '2nd level', bedCount: 6 },
    { id: 'shared-room-205', title: 'Room 205', meta: '2nd level', bedCount: 6 }
  ],
  bathrooms: [
    { group: '1st Level', id: 'bath-bathroom-1', title: 'Bathroom 1', meta: 'Next to dining area · 1st level' },
    { group: '1st Level', id: 'bath-bathroom-2', title: 'Bathroom 2', meta: 'Next to dining area · 1st level' },
    { group: '1st Level', id: 'bath-bathroom-3', title: 'Bathroom 3', meta: 'Next to dining area · 1st level' },
    { group: '2nd Level', id: 'bath-bathroom-4', title: 'Bathroom 4', meta: 'Next to Room 207 · 2nd level' }
  ],
  'late-shift': [
    { group: '6:00 PM–6:30 PM', id: 'late-shift-01', title: 'Touch up the kitchen.', meta: '6:00 PM–6:30 PM', taskOnly: true },
    { group: '6:00 PM–6:30 PM', id: 'late-shift-02', title: 'Touch up the dining area.', meta: '6:00 PM–6:30 PM', taskOnly: true },
    { group: '6:00 PM–6:30 PM', id: 'late-shift-03', title: 'Touch up all shared bathrooms.', meta: '6:00 PM–6:30 PM', taskOnly: true },
    { group: '6:30 PM–7:15 PM', id: 'late-shift-04', title: 'Prepare and serve dinner.', meta: '6:30 PM–7:15 PM', taskOnly: true },
    { group: '6:30 PM–7:15 PM', id: 'late-shift-05', title: 'Keep the dining area clean while dinner is being served.', meta: '6:30 PM–7:15 PM', taskOnly: true },
    { group: '7:15 PM–8:30 PM', id: 'late-shift-06', title: 'Vacuum all corridors.', meta: '7:15 PM–8:30 PM', taskOnly: true },
    { group: '7:15 PM–8:30 PM', id: 'late-shift-07', title: 'Vacuum the reception area.', meta: '7:15 PM–8:30 PM', taskOnly: true },
    { group: '7:15 PM–8:30 PM', id: 'late-shift-08', title: 'Assist with guest or reception requests.', meta: '7:15 PM–8:30 PM', taskOnly: true },
    { group: '8:30 PM–9:00 PM', id: 'late-shift-09', title: 'Clean the kitchen and dining area after dinner.', meta: '8:30 PM–9:00 PM', taskOnly: true },
    { group: '8:30 PM–9:00 PM', id: 'late-shift-10', title: 'Put the rubbish bins outside.', meta: '8:30 PM–9:00 PM', taskOnly: true },
    { group: '8:30 PM–9:00 PM', id: 'late-shift-11', title: 'Check stickers, markers, containers, and guest supplies.', meta: '8:30 PM–9:00 PM', taskOnly: true },
    { group: '8:30 PM–9:00 PM', id: 'late-shift-12', title: 'Report low-stock items immediately.', meta: '8:30 PM–9:00 PM', taskOnly: true },
    { group: '8:30 PM–9:00 PM', id: 'late-shift-13', title: 'Conduct a final inspection.', meta: '8:30 PM–9:00 PM', taskOnly: true }
  ],
  'common-areas': [
    { id: 'area-reception', title: 'Reception', meta: 'Common area' },
    { id: 'area-hallway-1', title: 'Hallways — Level 1', meta: 'Common area' },
    { id: 'area-hallway-2', title: 'Hallways — Level 2', meta: 'Common area' },
    { id: 'area-dining', title: 'Dining Area', meta: 'Common area' },
    { id: 'area-kitchen', title: 'Kitchen', meta: 'Common area' },
    { id: 'area-laundry', title: 'Laundry Room', meta: '1st floor' },
    { id: 'area-outside', title: 'Outside the Building', meta: 'Entrance and surrounding area' }
  ]
};

let savedChecks = loadJson(CHECKLIST_KEY, {});
let additionalTasks = loadJson(ADDITIONAL_KEY, []);
let receptionNotes = loadJson(RECEPTION_NOTES_KEY, {});
let cleanerNotes = loadJson(CLEANER_NOTES_KEY, {});
let completedTimes = loadJson(COMPLETED_TIMES_KEY, {});
let cleanerNames = [];
let toastTimer;
const pendingRemoteSaves = new Map();

function scheduleRemoteSave(key, action) {
  const pending = pendingRemoteSaves.get(key);
  if (pending) clearTimeout(pending.timer);
  const entry = { action, timer: null };
  entry.timer = setTimeout(() => flushRemoteSave(key), 450);
  pendingRemoteSaves.set(key, entry);
}

async function flushRemoteSave(key) {
  const pending = pendingRemoteSaves.get(key);
  if (!pending) return;
  clearTimeout(pending.timer);
  pendingRemoteSaves.delete(key);
  try {
    await pending.action();
  } catch (error) {
    showBackendError(error);
  }
}


function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(CHECKLIST_KEY, JSON.stringify(savedChecks));
  localStorage.setItem(ADDITIONAL_KEY, JSON.stringify(additionalTasks));
  localStorage.setItem(RECEPTION_NOTES_KEY, JSON.stringify(receptionNotes));
  localStorage.setItem(CLEANER_NOTES_KEY, JSON.stringify(cleanerNotes));
  localStorage.setItem(COMPLETED_TIMES_KEY, JSON.stringify(completedTimes));
}



function getRoomBedCount(item) {
  return Number(item?.bedCount) > 0 ? Number(item.bedCount) : 0;
}

function getReceptionLineLabels(item) {
  if (item.id.startsWith('ensuite-room-')) return ['Check', 'Make'];
  if (item.id.startsWith('shared-room-')) return ['Check bed', 'Make bed'];
  return [];
}

function getBedSelections(noteText, label) {
  const lines = String(noteText || '').split('\n');
  const line = lines.find((entry) => entry.trim().toLowerCase().startsWith(`${label.toLowerCase()}:`));
  if (!line) return [];
  return Array.from(line.matchAll(/\[(\d+)\]/g), (match) => Number(match[1]));
}

function buildRoomReceptionNote(item, baseText, selectionsByLabel) {
  const labels = getReceptionLineLabels(item);
  if (!labels.length) return baseText || '';

  const existingLines = String(baseText || '').split('\n');
  const extraLines = existingLines.filter((line) => {
    const trimmed = line.trim().toLowerCase();
    return !labels.some((label) => trimmed.startsWith(`${label.toLowerCase()}:`));
  });

  const structuredLines = labels.map((label) => {
    const picks = (selectionsByLabel[label] || [])
      .filter((value, index, array) => array.indexOf(value) === index)
      .sort((a, b) => a - b)
      .map((value) => `[${value}]`)
      .join(' ');
    return `${label}:${picks ? ` ${picks}` : ''}`;
  });

  while (extraLines.length && extraLines[0].trim() === '') extraLines.shift();
  return [...structuredLines, ...extraLines].join('\n').trim();
}

function createBedSelector(item, receptionInput) {
  const bedCount = getRoomBedCount(item);
  const labels = getReceptionLineLabels(item);
  if (!bedCount || !labels.length) return null;

  const selector = document.createElement('div');
  selector.className = 'bed-selector';
  const buttonMap = new Map();

  const syncButtons = () => {
    labels.forEach((label) => {
      const selected = new Set(getBedSelections(receptionInput.value, label));
      const rowButtons = buttonMap.get(label) || [];
      rowButtons.forEach((button) => {
        const value = Number(button.dataset.value);
        button.classList.toggle('active', selected.has(value));
        button.setAttribute('aria-pressed', selected.has(value) ? 'true' : 'false');
      });
    });
  };

  labels.forEach((label) => {
    const row = document.createElement('div');
    row.className = 'bed-selector-row';

    const heading = document.createElement('span');
    heading.className = 'bed-selector-label';
    heading.textContent = `${label}:`;
    row.append(heading);

    const options = document.createElement('div');
    options.className = 'bed-selector-options';
    const buttons = [];

    for (let bedNumber = 1; bedNumber <= bedCount; bedNumber += 1) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'bed-chip';
      option.dataset.value = String(bedNumber);
      option.textContent = String(bedNumber);
      option.disabled = !AppBackend.isReception || AppBackend.isHistorical;
      option.addEventListener('click', () => {
        if (!AppBackend.isReception || AppBackend.isHistorical) return;
        const selectionsByLabel = Object.fromEntries(
          labels.map((entryLabel) => [entryLabel, getBedSelections(receptionInput.value, entryLabel)])
        );
        const list = selectionsByLabel[label] || [];
        const index = list.indexOf(bedNumber);
        if (index >= 0) list.splice(index, 1);
        else list.push(bedNumber);
        selectionsByLabel[label] = list;
        receptionInput.value = buildRoomReceptionNote(item, receptionInput.value, selectionsByLabel);
        syncButtons();
        receptionNotes[item.id] = receptionInput.value;
        saveState();
        scheduleRemoteSave(`reception:${item.id}`, () => AppBackend.saveReceptionNote(item.id, receptionInput.value));
        renderAllTasksPreview();
      });
      buttons.push(option);
      options.append(option);
    }

    buttonMap.set(label, buttons);
    row.append(options);
    selector.append(row);
  });

  syncButtons();
  receptionInput.addEventListener('input', syncButtons);
  return selector;
}

function getReceptionTemplate(item) {
  const labels = getReceptionLineLabels(item);
  if (!labels.length) return '';
  return labels.map((label) => `${label}:`).join('\n');
}

function initialiseReceptionTemplates() {
  const oldTemplates = new Set([
    `Check bed:
Make bed:
[ ] Skip this room`,
    `Check bed:
Make bed:
SKIP THIS ROOM`,
    `Check bathroom:
Restock supplies:
[ ] Skip this area`,
    `Check area:
Special cleaning required:
[ ] Skip this area`,
    `Task details:
Priority:
[ ] Skip this task`
  ]);

  Object.values(checklistData).flat().forEach((item) => {
    const template = getReceptionTemplate(item);
    const hasSavedNote = Object.prototype.hasOwnProperty.call(receptionNotes, item.id);
    const savedNote = receptionNotes[item.id];

    if (template) {
      if (!hasSavedNote || oldTemplates.has(savedNote)) receptionNotes[item.id] = template;
    } else if (oldTemplates.has(savedNote)) {
      delete receptionNotes[item.id];
    }
  });

  additionalTasks.forEach((item) => {
    if (oldTemplates.has(receptionNotes[item.id])) delete receptionNotes[item.id];
  });

  saveState();
}


function formatFinishedTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }).format(date);
}

function updateFinishedTime(element, value) {
  element.textContent = value ? `Finished: ${formatFinishedTime(value)}` : '';
  element.hidden = !value;
}

function createChecklistItem(item, isAdditional = false) {
  const wrapper = document.createElement('div');
  wrapper.className = isAdditional ? 'additional-item' : 'check-item';
  wrapper.dataset.itemId = item.id;

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = item.id;
  checkbox.checked = Boolean(savedChecks[item.id]);
  checkbox.setAttribute('aria-label', `Mark ${item.title} as completed`);
  checkbox.disabled = AppBackend.isHistorical;

  const label = document.createElement('label');
  label.className = 'item-copy';
  label.htmlFor = item.id;

  const title = document.createElement('span');
  title.className = 'item-title';
  title.textContent = item.title;

  const meta = document.createElement('span');
  meta.className = 'item-meta';
  meta.textContent = item.meta || 'Additional task';

  const finishedTime = document.createElement('span');
  finishedTime.className = 'item-finished-time';
  updateFinishedTime(finishedTime, completedTimes[item.id]);

  label.append(title, meta, finishedTime);
  const notesGroup = document.createElement('div');
  notesGroup.className = 'notes-group';

  const receptionWrap = document.createElement('label');
  receptionWrap.className = 'note-field';
  const receptionLabel = document.createElement('span');
  receptionLabel.textContent = 'Reception note';
  const receptionInput = document.createElement('textarea');
  receptionInput.className = 'item-notes reception-note';
  receptionInput.rows = 3;
  receptionInput.maxLength = 300;
  receptionInput.placeholder = 'Issue reported by reception…';
  receptionInput.value = Object.prototype.hasOwnProperty.call(receptionNotes, item.id)
    ? receptionNotes[item.id]
    : getReceptionTemplate(item);
  receptionInput.setAttribute('aria-label', `Reception note for ${item.title}`);
  receptionInput.readOnly = !AppBackend.isReception || AppBackend.isHistorical;
  const bedSelector = createBedSelector(item, receptionInput);
  if (AppBackend.isReception && !AppBackend.isHistorical) {
    receptionInput.addEventListener('input', () => {
      receptionNotes[item.id] = receptionInput.value;
      saveState();
      scheduleRemoteSave(`reception:${item.id}`, () => AppBackend.saveReceptionNote(item.id, receptionInput.value));
      renderAllTasksPreview();
    });
    receptionInput.addEventListener('blur', () => flushRemoteSave(`reception:${item.id}`));
  }
  if (bedSelector) receptionWrap.append(receptionLabel, bedSelector, receptionInput);
  else receptionWrap.append(receptionLabel, receptionInput);

  const cleanerWrap = document.createElement('label');
  cleanerWrap.className = 'note-field';
  const cleanerLabel = document.createElement('span');
  cleanerLabel.textContent = 'Cleaner note';
  const cleanerInput = document.createElement('textarea');
  cleanerInput.className = 'item-notes cleaner-note';
  cleanerInput.rows = 2;
  cleanerInput.maxLength = 300;
  cleanerInput.placeholder = 'Cleaner update or issue…';
  cleanerInput.value = cleanerNotes[item.id] || '';
  cleanerInput.setAttribute('aria-label', `Cleaner note for ${item.title}`);
  cleanerInput.readOnly = AppBackend.isHistorical;
  if (!AppBackend.isHistorical) cleanerInput.addEventListener('input', () => {
    const value = cleanerInput.value.trim();
    if (value) cleanerNotes[item.id] = cleanerInput.value;
    else delete cleanerNotes[item.id];
    saveState();
    scheduleRemoteSave(`cleaner:${item.id}`, () => AppBackend.saveStatus(item.id, Boolean(savedChecks[item.id]), cleanerInput.value, completedTimes[item.id] || null));
    renderAllTasksPreview();
  });
  if (!AppBackend.isHistorical) cleanerInput.addEventListener('blur', () => flushRemoteSave(`cleaner:${item.id}`));
  cleanerWrap.append(cleanerLabel, cleanerInput);

  if (!item.taskOnly) notesGroup.append(receptionWrap);
  notesGroup.append(cleanerWrap);

  wrapper.append(checkbox, label, notesGroup);

  if (isAdditional) {
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-btn';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', () => deleteAdditionalTask(item.id));
    if (!AppBackend.isReception) deleteButton.classList.add('reception-only-hidden');
    wrapper.append(deleteButton);
  }

  updateCompletedStyle(wrapper, checkbox.checked);

  checkbox.addEventListener('change', () => {
    savedChecks[item.id] = checkbox.checked;
    if (checkbox.checked) completedTimes[item.id] = new Date().toISOString();
    else delete completedTimes[item.id];
    updateCompletedStyle(wrapper, checkbox.checked);
    updateFinishedTime(finishedTime, completedTimes[item.id]);
    saveState();
    flushRemoteSave(`cleaner:${item.id}`).finally(() => {
      AppBackend.saveStatus(
        item.id,
        checkbox.checked,
        cleanerNotes[item.id] || '',
        completedTimes[item.id] || null
      ).catch(showBackendError);
    });
    updateAllCounts();
  });

  return wrapper;
}

function updateCompletedStyle(element, isCompleted) {
  element.classList.toggle('completed', isCompleted);
}

function renderStandardLists() {
  Object.entries(checklistData).forEach(([pageId, items]) => {
    const container = document.querySelector(`[data-list="${pageId}"]`);
    if (!container) return;

    container.innerHTML = '';
    let currentGroup = null;

    items.forEach((item) => {
      if (item.group && item.group !== currentGroup) {
        currentGroup = item.group;
        const heading = document.createElement('div');
        heading.className = 'group-title';
        heading.textContent = currentGroup;
        container.append(heading);
      }
      container.append(createChecklistItem(item));
    });
  });
}

function renderAdditionalTasks() {
  const container = document.getElementById('additionalTasks');
  const emptyState = document.getElementById('emptyState');
  container.innerHTML = '';

  additionalTasks.forEach((task) => container.append(createChecklistItem(task, true)));
  emptyState.hidden = additionalTasks.length > 0;
  updateAllCounts();
}

async function deleteAdditionalTask(id) {
  if (!AppBackend.isReception) return;
  try { await AppBackend.deleteTask(id); } catch (error) { showBackendError(error); return; }
  additionalTasks = additionalTasks.filter((task) => task.id !== id);
  delete savedChecks[id];
  delete receptionNotes[id];
  delete cleanerNotes[id];
  delete completedTimes[id];
  saveState();
  renderAdditionalTasks();
  showToast('Task deleted');
}

async function addAdditionalTask(title) {
  const task = {
    id: `additional-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title,
    meta: 'Special task'
  };
  if (!AppBackend.isReception) return;
  try { await AppBackend.addTask(task); } catch (error) { showBackendError(error); return; }
  additionalTasks.unshift(task);
  saveState();
  renderAdditionalTasks();
  showToast('Special task added');
}

function getAllItems() {
  return [...Object.values(checklistData).flat(), ...additionalTasks];
}

function getSectionDefinitions() {
  return [
    ['Ensuite Rooms', checklistData.ensuite],
    ['Rooms with Shared Bathrooms', checklistData['shared-rooms']],
    ['Common Bathrooms', checklistData.bathrooms],
    ['Common Areas', checklistData['common-areas']],
    ['Night Shift', checklistData['late-shift']],
    ['Additional Tasks', additionalTasks]
  ];
}

function formatChecklistDate() {
  const value = AppBackend.checklistDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '';
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney', day: '2-digit', month: 'short', year: 'numeric'
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function appendCleanerNames(lines) {
  if (cleanerNames.length) {
    const label = cleanerNames.length === 1 ? '*Cleaner on Duty:*' : '*Cleaners on Duty:*';
    lines.push(`${label} ${cleanerNames.join(', ')}`, '');
  }
}

function buildFullChecklistText() {
  const date = formatChecklistDate();
  const lines = [`*Central – Cleaning Checklist*`, `Date: ${date}`, ''];
  appendCleanerNames(lines);

  getSectionDefinitions().forEach(([sectionName, items]) => {
    lines.push(`*${sectionName}*`);
    if (!items.length) {
      lines.push('No tasks added.');
    } else {
      items.forEach((item) => {
        const status = savedChecks[item.id] ? '✅' : '⬜';
        const location = item.meta ? ` – ${item.meta}` : '';
        lines.push(`${status} ${item.title}${location}`);
        if (savedChecks[item.id] && completedTimes[item.id]) {
          lines.push(`   *Finished:* ${formatFinishedTime(completedTimes[item.id])}`);
        }
        const receptionNote = (receptionNotes[item.id] || '').trim();
        const cleanerNote = (cleanerNotes[item.id] || '').trim();
        if (receptionNote) {
          lines.push('   *Reception note:*');
          receptionNote.split('\n').forEach((line) => lines.push(`   ${line}`));
        }
        if (cleanerNote) {
          lines.push('   *Cleaner note:*');
          cleanerNote.split('\n').forEach((line) => lines.push(`   ${line}`));
        }
        lines.push('');
      });
    }
    lines.push('');
  });

  return lines.join('\n').trim();
}

function buildRoomsOnlyText() {
  const propertyName = document.querySelector('.eyebrow')?.textContent?.trim() || 'Property';
  const date = formatChecklistDate();
  const lines = [`*${propertyName} – Rooms Checklist*`, `Date: ${date}`, ''];
  appendCleanerNames(lines);

  const roomSections = [
    [document.querySelector('#ensuite')?.dataset.title || 'Ensuite Rooms', checklistData.ensuite],
    [document.querySelector('#shared-rooms')?.dataset.title || 'Rooms with Shared Bathrooms', checklistData['shared-rooms']]
  ];

  roomSections.forEach(([sectionName, items]) => {
    if (!items?.length) return;
    lines.push(`*${sectionName}*`);
    items.forEach((item) => {
      const isCompleted = Boolean(savedChecks[item.id]);
      const location = item.meta ? ` – ${item.meta}` : '';
      lines.push(`${isCompleted ? '✅' : '⬜'} ${item.title}${location}`);

      if (isCompleted && completedTimes[item.id]) {
        lines.push(`   *Finished:* ${formatFinishedTime(completedTimes[item.id])}`);
      }

      const receptionNote = (receptionNotes[item.id] || '').trim();
      const cleanerNote = (cleanerNotes[item.id] || '').trim();

      if (receptionNote) {
        lines.push('   *Reception note:*');
        receptionNote.split('\n').forEach((line) => lines.push(`   ${line}`));
      }

      if (cleanerNote) {
        lines.push('   *Cleaner note:*');
        cleanerNote.split('\n').forEach((line) => lines.push(`   ${line}`));
      }

      lines.push('');
    });
    lines.push('');
  });

  return lines.join('\n').trim();
}

function buildReportText() {
  const lines = [];
  appendCleanerNames(lines);

  getAllItems().forEach((item) => {
    const isCompleted = Boolean(savedChecks[item.id]);
    const location = item.meta ? ` – ${item.meta}` : '';
    const cleanerNote = (cleanerNotes[item.id] || '').trim();

    lines.push(`${isCompleted ? '✅' : '⬜'} ${item.title}${location}`);

    if (isCompleted) {
      const finishedTime = completedTimes[item.id]
        ? formatFinishedTime(completedTimes[item.id])
        : 'Not recorded';
      lines.push(`   *Finished:* ${finishedTime}`);
    }

    lines.push('   *Cleaner note:*');
    if (cleanerNote) {
      cleanerNote.split('\n').forEach((line) => lines.push(`   ${line}`));
    }
    lines.push('');
  });

  return lines.join('\n').trim();
}

function buildLateShiftText() {
  const propertyName = document.querySelector('.eyebrow')?.textContent?.trim() || 'Property';
  const shiftTitle = document.querySelector('#late-shift h2')?.textContent?.trim() || 'Shift Checklist';
  const date = formatChecklistDate();
  const lines = [`*${propertyName} – ${shiftTitle}*`, `Date: ${date}`, ''];
  appendCleanerNames(lines);
  let currentGroup = null;

  checklistData['late-shift'].forEach((item) => {
    if (item.group && item.group !== currentGroup) {
      if (currentGroup !== null) lines.push('');
      currentGroup = item.group;
      lines.push(`*${currentGroup}*`);
    }

    const isCompleted = Boolean(savedChecks[item.id]);
    lines.push(`${isCompleted ? '✅' : '⬜'} ${item.title}`);

    if (isCompleted && completedTimes[item.id]) {
      lines.push(`   *Finished:* ${formatFinishedTime(completedTimes[item.id])}`);
    }

    const cleanerNote = (cleanerNotes[item.id] || '').trim();
    if (cleanerNote) {
      lines.push('   *Cleaner note:*');
      cleanerNote.split('\n').forEach((line) => lines.push(`   ${line}`));
    }
  });

  return lines.join('\n').trim();
}

async function copyLateShift() {
  await copyText(buildLateShiftText(), 'Shift task list copied');
}

function renderAllTasksPreview() {
  const preview = document.getElementById('whatsappPreview');
  if (preview) {
    preview.textContent = AppBackend.isReception
      ? buildFullChecklistText()
      : buildReportText();
  }
  const badge = document.querySelector('[data-count-for="all-tasks"]');
  if (badge) {
    const allItems = getAllItems();
    const completed = allItems.filter((item) => savedChecks[item.id]).length;
    badge.textContent = `${completed}/${allItems.length}`;
  }
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const helper = document.createElement('textarea');
    helper.value = text;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.append(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
  }
  showToast(successMessage);
}

async function copyToCleaners() {
  if (!AppBackend.isReception) return;
  await copyText(buildFullChecklistText(), 'Full checklist copied');
}

async function copyRoomsOnly() {
  if (!AppBackend.isReception) return;
  await copyText(buildRoomsOnlyText(), 'Rooms checklist copied');
}

async function copyReport() {
  await copyText(buildReportText(), 'Report copied');
}

function updateAllCounts() {
  Object.keys(checklistData).forEach((pageId) => {
    const items = checklistData[pageId];
    const done = items.filter((item) => savedChecks[item.id]).length;
    const badge = document.querySelector(`[data-count-for="${pageId}"]`);
    if (badge) badge.textContent = `${done}/${items.length}`;
  });

  const additionalDone = additionalTasks.filter((item) => savedChecks[item.id]).length;
  const additionalBadge = document.querySelector('[data-count-for="additional"]');
  additionalBadge.textContent = `${additionalDone}/${additionalTasks.length}`;

  const allItems = getAllItems();
  const totalDone = allItems.filter((item) => savedChecks[item.id]).length;
  const percent = allItems.length ? Math.round((totalDone / allItems.length) * 100) : 0;

  document.getElementById('progressText').textContent = `${totalDone} of ${allItems.length} completed`;
  document.getElementById('progressPercent').textContent = `${percent}%`;
  document.getElementById('progressBar').style.width = `${percent}%`;
  renderAllTasksPreview();
}

function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((tab) => tab.classList.remove('active'));
      document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));

      button.classList.add('active');
      document.getElementById(button.dataset.page).classList.add('active');
      if (button.dataset.page === 'all-tasks') renderAllTasksPreview();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

async function resetAll() {
  const confirmed = window.confirm('Reset all checked items and clear all notes? Additional tasks will stay in the list.');
  if (!confirmed) return;
  if (!AppBackend.isReception) return;
  try { await AppBackend.resetProperty(); } catch (error) { showBackendError(error); return; }

  savedChecks = {};
  receptionNotes = {};
  cleanerNotes = {};
  completedTimes = {};
  initialiseReceptionTemplates();
  saveState();
  renderStandardLists();
  renderAdditionalTasks();
  showToast('Checklist reset');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
}

function init() {
  initialiseReceptionTemplates();
  renderStandardLists();
  renderAdditionalTasks();
  setupTabs();
  updateAllCounts();

  if (!AppBackend.isReception) {
    document.getElementById('taskForm').classList.add('reception-only-hidden');
    document.getElementById('resetTodayBtn').classList.add('reception-only-hidden');
    document.getElementById('copyToCleanersBtn').classList.add('reception-only-hidden');
    document.getElementById('copyRoomsBtn').classList.add('reception-only-hidden');
    document.getElementById('copyOptionsHelp').textContent = 'Copies the report with checked and unchecked tasks, finish times and cleaner notes.';
  }
  if (AppBackend.isHistorical) {
    document.getElementById('taskForm')?.classList.add('reception-only-hidden');
    document.getElementById('resetTodayBtn')?.classList.add('reception-only-hidden');
    document.querySelectorAll('.delete-btn').forEach((button) => button.classList.add('reception-only-hidden'));
    document.getElementById('copyOptionsHelp').textContent = 'Historical record. You can review and copy this date; editing is disabled.';
  }

  document.getElementById('signOutBtn').addEventListener('click', () => AppBackend.signOut());

  document.getElementById('taskForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('taskInput');
    const title = input.value.trim();
    if (!title) return;
    await addAdditionalTask(title);
    input.value = '';
    input.focus();
  });

  document.getElementById('resetTodayBtn').addEventListener('click', resetAll);
  document.getElementById('copyToCleanersBtn').addEventListener('click', copyToCleaners);
  document.getElementById('copyRoomsBtn').addEventListener('click', copyRoomsOnly);
  document.getElementById('copyReportBtn').addEventListener('click', copyReport);
  document.getElementById('copyLateShiftBtn').addEventListener('click', copyLateShift);
}



function showBackendError(error) {
  console.error(error);
  showToast(error?.message || 'Unable to save. Check your connection.');
}

let realtimeRefreshRunning = false;
let realtimeRefreshQueued = false;
let realtimeRefreshTimer = null;

function refreshFromRealtime() {
  realtimeRefreshQueued = true;
  if (realtimeRefreshRunning || realtimeRefreshTimer) return;
  realtimeRefreshTimer = setTimeout(runRealtimeRefresh, 300);
}

async function runRealtimeRefresh() {
  realtimeRefreshTimer = null;
  if (realtimeRefreshRunning || !realtimeRefreshQueued) return;
  realtimeRefreshRunning = true;
  realtimeRefreshQueued = false;

  const active = document.activeElement;
  const activeItemId = active?.closest?.('[data-item-id]')?.dataset?.itemId || null;
  const activeClass = active?.classList?.contains('cleaner-note')
    ? 'cleaner-note'
    : active?.classList?.contains('reception-note')
      ? 'reception-note'
      : null;
  const selectionStart = activeClass ? active.selectionStart : null;
  const selectionEnd = activeClass ? active.selectionEnd : null;

  try {
    const remote = await AppBackend.loadPropertyState(PROPERTY_KEY);
    savedChecks = remote.checks;
    cleanerNotes = remote.cleanerNotes;
    completedTimes = remote.completedTimes;
    receptionNotes = remote.receptionNotes;
    additionalTasks = remote.additionalTasks;
    cleanerNames = remote.cleanerNames || [];
    saveState();
    renderStandardLists();
    renderAdditionalTasks();
    updateAllCounts();

    if (activeItemId && activeClass) {
      const selector = `[data-item-id="${CSS.escape(activeItemId)}"] .${activeClass}`;
      const restored = document.querySelector(selector);
      if (restored) {
        restored.focus({ preventScroll: true });
        if (selectionStart !== null && selectionEnd !== null) {
          const max = restored.value.length;
          restored.setSelectionRange(Math.min(selectionStart, max), Math.min(selectionEnd, max));
        }
      }
    }
  } catch (error) {
    showBackendError(error);
  } finally {
    realtimeRefreshRunning = false;
    if (realtimeRefreshQueued && !realtimeRefreshTimer) {
      realtimeRefreshTimer = setTimeout(runRealtimeRefresh, 350);
    }
  }
}

async function bootstrap() {
  const auth = await AppBackend.requireAuth(PROPERTY_KEY);
  if (!auth) return;
  try {
    const remote = await AppBackend.loadPropertyState(PROPERTY_KEY);
    savedChecks = remote.checks;
    cleanerNotes = remote.cleanerNotes;
    completedTimes = remote.completedTimes;
    receptionNotes = remote.receptionNotes;
    additionalTasks = remote.additionalTasks;
    cleanerNames = remote.cleanerNames || [];
  } catch (error) {
    showBackendError(error);
  }
  init();
  window.addEventListener('checklist:remote-change', refreshFromRealtime);
}

bootstrap();
