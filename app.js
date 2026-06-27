// ─── Config ───────────────────────────────────────────────────────────────────
const CLIENT_ID = '977999849446-j8u796jl68jk0hac49v26oisqs25160h.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
const API_KEY = ''; // optional, not needed for OAuth flow

const SUBJECT_COLORS = ['#FF6B6B','#4ECDC4','#FFD93D','#C77DFF','#74B3CE','#F4845F','#A8D8A8','#FF9A9E'];

// Titles containing any of these phrases (case-insensitive) are marked important
const IMPORTANT_KEYWORDS = ['assignment deadline'];

// ─── State ────────────────────────────────────────────────────────────────────
let accessToken = null;
let currentUser = null;
let allCalendars = [];
let allEvents = {}; // keyed by YYYY-MM-DD
let manualTasks = JSON.parse(localStorage.getItem('manualTasks') || '[]');
let calendarVisibility = JSON.parse(localStorage.getItem('calendarVisibility') || '{}');
let subjectColors = JSON.parse(localStorage.getItem('subjectColors') || '{}');
let completedTasks = JSON.parse(localStorage.getItem('completedTasks') || '[]');
let subjectColorIndex = 0;

let selectedDate = new Date();
let calViewDate = new Date();

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('load', () => {
  renderCalendar();
  selectDate(new Date());
  requestNotificationPermission();

  const savedToken = localStorage.getItem('gcal_token');
  if (savedToken) {
    accessToken = savedToken;
    fetchUserInfo().catch(() => {
      // Token may be expired — silently re-auth if user had signed in before
      if (localStorage.getItem('gcal_user_email')) {
        silentSignIn();
      } else {
        localStorage.removeItem('gcal_token');
      }
    });
  }
});

function silentSignIn() {
  try {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      prompt: '',
      hint: localStorage.getItem('gcal_user_email') || '',
      callback: (response) => {
        if (response.error) return;
        accessToken = response.access_token;
        localStorage.setItem('gcal_token', accessToken);
        fetchUserInfo();
      }
    });
    client.requestAccessToken();
  } catch (e) {
    console.log('Silent sign-in unavailable');
  }
}

// ─── Calendar UI ──────────────────────────────────────────────────────────────
function renderCalendar() {
  const year = calViewDate.getFullYear();
  const month = calViewDate.getMonth();

  const monthNames = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  document.getElementById('calMonth').textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const container = document.getElementById('calDays');
  container.innerHTML = '';

  const today = toDateStr(new Date());

  // Prev month padding
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const dateStr = toDateStr(new Date(year, month - 1, d));
    container.appendChild(makeDayEl(d, dateStr, 'other-month'));
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = toDateStr(new Date(year, month, d));
    const classes = [];
    if (dateStr === today) classes.push('today');
    if (dateStr === toDateStr(selectedDate)) classes.push('selected');
    container.appendChild(makeDayEl(d, dateStr, classes.join(' ')));
  }

  // Next month padding
  const total = firstDay + daysInMonth;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let d = 1; d <= remaining; d++) {
    const dateStr = toDateStr(new Date(year, month + 1, d));
    container.appendChild(makeDayEl(d, dateStr, 'other-month'));
  }
}

function makeDayEl(day, dateStr, extraClass) {
  const el = document.createElement('div');
  el.className = `cal-day ${extraClass}`;
  el.textContent = day;
  el.onclick = () => selectDate(new Date(dateStr + 'T12:00:00'));

  const events = getEventsForDate(dateStr);
  if (events.length > 0) {
    if (events.some(isImportantEvent)) el.classList.add('has-important');
    const dot = document.createElement('div');
    dot.className = `event-dot${events.some(isImportantEvent) ? ' important' : ''}`;
    el.appendChild(dot);
  }

  return el;
}

function prevMonth() {
  calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() - 1, 1);
  renderCalendar();
}

function nextMonth() {
  calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() + 1, 1);
  renderCalendar();
}

function selectDate(date) {
  selectedDate = date;
  updateDateHeader();
  renderCalendar();
  renderTasks();
}

function updateDateHeader() {
  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  document.getElementById('dayLabel').textContent = days[selectedDate.getDay()];
  document.getElementById('dateDisplay').textContent =
    `${months[selectedDate.getMonth()]} ${selectedDate.getDate()}, ${selectedDate.getFullYear()}`;

  const dateBlock = document.querySelector('.date-block');
  if (dateBlock) {
    dateBlock.classList.remove('date-change');
    void dateBlock.offsetWidth;
    dateBlock.classList.add('date-change');
  }
}

// ─── Task Rendering ───────────────────────────────────────────────────────────
function renderTasks() {
  const dateStr = toDateStr(selectedDate);
  const events = getEventsForDate(dateStr);
  const area = document.getElementById('tasksArea');

  if (events.length === 0) {
    area.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">◎</div>
        <div>nothing scheduled</div>
      </div>`;
    return;
  }

  const today = toDateStr(new Date());
  const isPast = dateStr < today;

  area.innerHTML = '';
  const sorted = [...events].sort((a, b) => {
    const diff = (isImportantEvent(b) ? 1 : 0) - (isImportantEvent(a) ? 1 : 0);
    return diff !== 0 ? diff : a.title.localeCompare(b.title);
  });

  sorted.forEach((ev, i) => {
    const card = document.createElement('div');
    const isDone = completedTasks.includes(ev.id);
    const important = isImportantEvent(ev);
    card.className = `task-card${important ? ' important' : ''}${isPast ? ' past' : ''}${isDone ? ' done' : ''}`;
    card.style.animationDelay = `${i * 0.07}s`;

    const color = getSubjectColor(ev.subject);

    const bar = document.createElement('div');
    bar.className = 'task-color-bar';
    bar.style.background = color;

    const check = document.createElement('button');
    check.className = `task-check${isDone ? ' checked' : ''}`;
    check.onclick = () => toggleDone(ev.id);

    const body = document.createElement('div');
    body.className = 'task-body';
    body.innerHTML = `
      <div class="task-title">${escHtml(ev.title)}</div>
      <div class="task-meta">
        ${important ? '<span class="task-badge important-badge">deadline</span>' : ''}
        <span class="task-subject" style="color:${color}">${escHtml(ev.subject)}</span>
        ${ev.time ? `<span class="task-time">${ev.time}</span>` : ''}
      </div>`;

    card.appendChild(bar);
    card.appendChild(check);
    card.appendChild(body);

    if (important) {
      const ns = 'http://www.w3.org/2000/svg';
      const svgEl = document.createElementNS(ns, 'svg');
      svgEl.setAttribute('class', 'task-border-beam');
      svgEl.setAttribute('aria-hidden', 'true');
      svgEl.setAttribute('viewBox', '0 0 100 100');
      svgEl.setAttribute('preserveAspectRatio', 'none');

      // rect attrs shared by all layers
      const rAttrs = { x:'0.5', y:'0.5', width:'99', height:'99', rx:'11' };

      // 6 layers: stroke A (tail→body→head) + stroke B offset by 200 units
      // tail offset is +14 ahead (longer dash = visible earlier = tail of stroke)
      // body offset is +7 ahead
      // head offset is 0 (front of stroke)
      const layers = [
        { cls: 'task-stroke-a-tail',  extra: 14 },
        { cls: 'task-stroke-a-body',  extra:  7 },
        { cls: 'task-stroke-a-head',  extra:  0 },
        { cls: 'task-stroke-b-tail',  extra: 14 + 200 },
        { cls: 'task-stroke-b-body',  extra:  7 + 200 },
        { cls: 'task-stroke-b-head',  extra:      200 },
      ];

      const track = document.createElementNS(ns, 'rect');
      track.setAttribute('class', 'task-border-track');
      Object.entries(rAttrs).forEach(([k,v]) => track.setAttribute(k,v));
      svgEl.appendChild(track);

      layers.forEach(({ cls, extra }) => {
        const el = document.createElementNS(ns, 'rect');
        el.setAttribute('class', cls);
        el.dataset.extra = extra;
        Object.entries(rAttrs).forEach(([k,v]) => el.setAttribute(k,v));
        svgEl.appendChild(el);
      });

      card.appendChild(svgEl);
    }

    area.appendChild(card);
  });
}

function isImportantEvent(ev) {
  const title = (ev.title || '').toLowerCase();
  return IMPORTANT_KEYWORDS.some(kw => title.includes(kw.toLowerCase()));
}

function getEventsForDate(dateStr) {
  const gcal = (allEvents[dateStr] || []).filter(ev => {
    return calendarVisibility[ev.calendarId] !== false;
  });
  const manual = manualTasks.filter(t => t.date === dateStr);
  return [...gcal, ...manual];
}

function toggleDone(id) {
  if (completedTasks.includes(id)) {
    completedTasks = completedTasks.filter(x => x !== id);
  } else {
    completedTasks.push(id);
  }
  localStorage.setItem('completedTasks', JSON.stringify(completedTasks));
  renderTasks();
}

// ─── Subject Colors ───────────────────────────────────────────────────────────
function getSubjectColor(subject) {
  if (!subject) return SUBJECT_COLORS[0];
  if (!subjectColors[subject]) {
    subjectColors[subject] = SUBJECT_COLORS[subjectColorIndex % SUBJECT_COLORS.length];
    subjectColorIndex++;
    localStorage.setItem('subjectColors', JSON.stringify(subjectColors));
  }
  return subjectColors[subject];
}

function renderSubjectColors() {
  const list = document.getElementById('subjectColorList');
  const hint = document.getElementById('colorHint');
  const subjects = Object.keys(subjectColors);

  if (subjects.length === 0) {
    list.innerHTML = '';
    hint.style.display = 'block';
    return;
  }

  hint.style.display = 'none';
  list.innerHTML = '';

  subjects.forEach(subject => {
    const color = subjectColors[subject];
    const row = document.createElement('div');
    row.className = 'subject-color-row';

    const colorId = `color-${subject.replace(/\s/g,'_')}`;
    row.innerHTML = `
      <div class="color-dot" style="background:${color}" onclick="document.getElementById('${colorId}').click()"></div>
      <input type="color" id="${colorId}" class="color-input" value="${color}" onchange="updateSubjectColor('${subject}', this.value)">
      <span class="subject-name-label">${escHtml(subject)}</span>`;
    list.appendChild(row);
  });
}

function updateSubjectColor(subject, color) {
  subjectColors[subject] = color;
  localStorage.setItem('subjectColors', JSON.stringify(subjectColors));
  renderSubjectColors();
  renderTasks();
  renderCalendar();
}

// ─── Manual Tasks ─────────────────────────────────────────────────────────────
function openAddTask() {
  const overlay = document.getElementById('addTaskOverlay');
  overlay.classList.add('open');
  const dateStr = toDateStr(selectedDate);
  document.getElementById('taskDate').value = dateStr;
  document.getElementById('taskTitle').focus();
}

function closeAddTask(e) {
  if (e && e.target !== document.getElementById('addTaskOverlay')) return;
  document.getElementById('addTaskOverlay').classList.remove('open');
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskSubject').value = '';
}

function saveManualTask() {
  const title = document.getElementById('taskTitle').value.trim();
  const date = document.getElementById('taskDate').value;
  const subject = document.getElementById('taskSubject').value.trim() || 'general';

  if (!title || !date) return;

  const task = {
    id: `manual-${Date.now()}`,
    title,
    date,
    subject,
    source: 'manual',
    time: null,
    calendarId: 'manual'
  };

  getSubjectColor(subject);
  manualTasks.push(task);
  localStorage.setItem('manualTasks', JSON.stringify(manualTasks));

  document.getElementById('addTaskOverlay').classList.remove('open');
  document.getElementById('taskTitle').value = '';
  document.getElementById('taskSubject').value = '';

  renderTasks();
  renderCalendar();
  renderSubjectColors();
}

// ─── Settings Panel ───────────────────────────────────────────────────────────
function openSettings() {
  document.getElementById('settingsOverlay').classList.add('open');
  renderSubjectColors();
}

function closeSettings(e) {
  if (e && e.target !== document.getElementById('settingsOverlay')) return;
  document.getElementById('settingsOverlay').classList.remove('open');
}

function renderCalendarToggles() {
  const section = document.getElementById('calendarToggleSection');
  const list = document.getElementById('calendarList');

  if (allCalendars.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'flex';
  list.innerHTML = '';

  allCalendars.forEach(cal => {
    const isVisible = calendarVisibility[cal.id] !== false;
    const row = document.createElement('div');
    row.className = 'cal-toggle-row';

    const toggleId = `toggle-${cal.id.replace(/[^a-z0-9]/gi,'_')}`;
    row.innerHTML = `
      <span class="cal-toggle-name" title="${escHtml(cal.summary)}">${escHtml(cal.summary)}</span>
      <label class="toggle">
        <input type="checkbox" id="${toggleId}" ${isVisible ? 'checked' : ''} onchange="toggleCalendar('${cal.id}', this.checked)">
        <span class="toggle-slider"></span>
      </label>`;
    list.appendChild(row);
  });
}

function toggleCalendar(calId, visible) {
  calendarVisibility[calId] = visible;
  localStorage.setItem('calendarVisibility', JSON.stringify(calendarVisibility));
  renderTasks();
  renderCalendar();
}

// ─── Google OAuth ─────────────────────────────────────────────────────────────
function handleSignIn() {
  const client = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) { console.error(response); return; }
      accessToken = response.access_token;
      localStorage.setItem('gcal_token', accessToken);
      fetchUserInfo();
    }
  });
  client.requestAccessToken();
}

function handleSignOut() {
  accessToken = null;
  currentUser = null;
  allCalendars = [];
  allEvents = {};
  localStorage.removeItem('gcal_token');
  localStorage.removeItem('gcal_user_email');
  document.getElementById('signinBtn').style.display = 'flex';
  document.getElementById('signedInInfo').style.display = 'none';
  document.getElementById('calendarToggleSection').style.display = 'none';
  renderTasks();
  renderCalendar();
}

async function fetchUserInfo() {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) throw new Error('token_expired');
  const data = await res.json();
  currentUser = data;
  if (data.email) localStorage.setItem('gcal_user_email', data.email);

  document.getElementById('signinBtn').style.display = 'none';
  document.getElementById('signedInInfo').style.display = 'block';

  const initials = (data.name || data.email || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('userAvatar').textContent = initials;
  document.getElementById('userName').textContent = data.name || data.email;

  await fetchCalendars();
}

async function fetchCalendars() {
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();
    allCalendars = data.items || [];

    // Default all calendars visible if not set
    allCalendars.forEach(cal => {
      if (calendarVisibility[cal.id] === undefined) {
        calendarVisibility[cal.id] = true;
      }
    });
    localStorage.setItem('calendarVisibility', JSON.stringify(calendarVisibility));

    renderCalendarToggles();
    await fetchEventsForMonth(calViewDate);
  } catch (e) {
    console.error('Failed to fetch calendars', e);
  }
}

async function fetchEventsForMonth(date) {
  if (!accessToken) return;

  const year = date.getFullYear();
  const month = date.getMonth();
  const timeMin = new Date(year, month, 1).toISOString();
  const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString();

  allEvents = {};

  const visibleCals = allCalendars.filter(cal => calendarVisibility[cal.id] !== false);

  await Promise.all(visibleCals.map(async (cal) => {
    try {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=100`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      const items = data.items || [];

      items.forEach(ev => {
        const dateStr = ev.start.date || ev.start.dateTime?.split('T')[0];
        if (!dateStr) return;
        if (!allEvents[dateStr]) allEvents[dateStr] = [];

        let timeStr = null;
        if (ev.start.dateTime) {
          const d = new Date(ev.start.dateTime);
          timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        allEvents[dateStr].push({
          id: ev.id,
          title: ev.summary || '(no title)',
          subject: cal.summary,
          time: timeStr,
          source: 'gcal',
          calendarId: cal.id
        });
      });
    } catch (e) {
      console.error(`Failed to fetch events for ${cal.summary}`, e);
    }
  }));

  renderCalendar();
  renderTasks();
  scheduleNotifications();
}

// ─── Notifications ────────────────────────────────────────────────────────────
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function scheduleNotifications() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const todayStr = toDateStr(new Date());
  const todayEvents = getEventsForDate(todayStr);

  todayEvents.forEach(ev => {
    const now = new Date();

    // 9am reminder
    const nineAm = new Date();
    nineAm.setHours(9, 0, 0, 0);
    const msUntil9am = nineAm - now;
    if (msUntil9am > 0) {
      setTimeout(() => {
        new Notification(`due today: ${ev.title}`, {
          body: ev.subject,
          icon: '/favicon.ico'
        });
      }, msUntil9am);
    }

    // 1 hour before if event has a time
    if (ev.time) {
      const [hours, minutes] = parseTime(ev.time);
      const eventTime = new Date();
      eventTime.setHours(hours, minutes, 0, 0);
      const oneHourBefore = new Date(eventTime - 60 * 60 * 1000);
      const msUntilReminder = oneHourBefore - now;
      if (msUntilReminder > 0) {
        setTimeout(() => {
          new Notification(`in 1 hour: ${ev.title}`, {
            body: `${ev.subject} · ${ev.time}`,
            icon: '/favicon.ico'
          });
        }, msUntilReminder);
      }
    }
  });
}

function parseTime(timeStr) {
  const [time, period] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return [hours, minutes];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ─── Synced border animation ───────────────────────────────────────────────────
// One rAF loop drives ALL important-card stroke offsets from a single clock,
// so every card is perfectly in sync regardless of when it was rendered.
;(function syncBorderStrokes() {
  const CYCLE   = 4000;   // ms for one full perimeter loop
  const PERIMETER = 400;  // must match dasharray total (90 + 310)

  function tick(ts) {
    const progress = (ts % CYCLE) / CYCLE;          // 0 → 1
    const base = -(progress * PERIMETER);            // 0 → -400

    document.querySelectorAll('.task-border-beam rect[data-extra]').forEach(el => {
      const extra = parseFloat(el.dataset.extra);
      el.style.strokeDashoffset = (base - extra) + 'px';
    });

    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
})();
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeSettings();
    document.getElementById('addTaskOverlay').classList.remove('open');
  }
  if (e.key === 'Enter' && document.getElementById('addTaskOverlay').classList.contains('open')) {
    saveManualTask();
  }
});