'use strict';

const STORAGE_KEY = 'poopooDiary.records.v1';

const BRISTOL = [
  { value: 1, label: '硬球', desc: '一颗颗硬球' },
  { value: 2, label: '凹凸香肠', desc: '表面凹凸' },
  { value: 3, label: '裂痕香肠', desc: '表面有裂痕' },
  { value: 4, label: '光滑柔软', desc: '理想形态' },
  { value: 5, label: '柔软块状', desc: '断边光滑' },
  { value: 6, label: '糊状', desc: '蓬松糊状' },
  { value: 7, label: '水状', desc: '无固体块' },
];

const BRISTOL_STYLES = {
  1: { bg: '#5d3a1a', fg: '#fff' },
  2: { bg: '#7c4a1e', fg: '#fff' },
  3: { bg: '#9a5f2a', fg: '#fff' },
  4: { bg: '#b97b3b', fg: '#fff' },
  5: { bg: '#d6a054', fg: '#3b2410' },
  6: { bg: '#e8c07a', fg: '#3b2410' },
  7: { bg: '#f2dda0', fg: '#3b2410' },
};

const BRISTOL_ICONS = {
  1: '🪨',
  2: '🥖',
  3: '🌭',
  4: '💩',
  5: '🍦',
  6: '🥣',
  7: '💦',
};

const COLORS = ['棕色', '深棕色', '黄色', '绿色', '黑色', '红色', '灰白色'];
const AMOUNTS = ['少', '正常', '多'];
const DISCOMFORTS = ['腹痛', '便血', '便秘', '腹泻', '肛门不适'];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const $ = (id) => document.getElementById(id);

let records = loadRecords();
let selected = startOfToday();
let pendingImport = null;
let view = 'day';
let monthCursor = new Date();

// ---------- helpers ----------
function pad(n) {
  return String(n).padStart(2, '0');
}

function dateKey(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function parseKey(key) {
  const parts = String(key).split('-').map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function fmtDate(d) {
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
}

function weekday(d) {
  return WEEKDAYS[d.getDay()];
}

function nowTime() {
  const d = new Date();
  return pad(d.getHours()) + ':' + pad(d.getMinutes());
}

function uid() {
  return window.crypto && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now() + '-' + Math.random().toString(16).slice(2);
}

function h(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// ---------- storage ----------
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (e) {
    return {};
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    showToast('保存失败：浏览器存储不可用');
  }
}

// ---------- rendering ----------
function selectedKey() {
  return dateKey(selected);
}

function monthPrefix() {
  return selected.getFullYear() + '-' + pad(selected.getMonth() + 1);
}

function renderDay() {
  renderDate();
  renderStats();
  renderRecords();
}

function refresh() {
  if (view === 'month') {
    renderMonth();
    renderLegend();
  } else {
    renderDay();
  }
}

function setView(v) {
  view = v;
  $('dayView').hidden = v !== 'day';
  $('monthView').hidden = v !== 'month';
  $('addBtn').hidden = v !== 'day';
  $('dayViewBtn').classList.toggle('active', v === 'day');
  $('monthViewBtn').classList.toggle('active', v === 'month');
  if (v === 'month') {
    monthCursor = new Date(selected.getFullYear(), selected.getMonth(), 1);
    renderMonth();
    renderLegend();
  } else {
    renderDay();
  }
}

function renderMonth() {
  $('monthLabel').textContent =
    monthCursor.getFullYear() + '年' + (monthCursor.getMonth() + 1) + '月';

  const grid = $('calendarGrid');
  grid.innerHTML = '';

  const y = monthCursor.getFullYear();
  const m = monthCursor.getMonth();
  const firstDay = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const offset = (firstDay.getDay() + 6) % 7; // 周一作为一周开始

  for (let i = 0; i < offset; i++) {
    grid.appendChild(buildCalendarCell(null));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    grid.appendChild(buildCalendarCell(new Date(y, m, d)));
  }
  const trailing = (7 - ((offset + daysInMonth) % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    grid.appendChild(buildCalendarCell(null));
  }
}

function buildCalendarCell(date) {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'cal-cell';

  if (!date) {
    cell.classList.add('blank');
    cell.disabled = true;
    return cell;
  }

  const key = dateKey(date);
  const list = records[key] || [];
  if (key === dateKey(new Date())) cell.classList.add('today');
  if (list.length) cell.classList.add('has-records');

  const sorted = list.slice().sort(function (a, b) {
    return String(a.time).localeCompare(String(b.time));
  });
  const MAX = 3;
  const icons = sorted.slice(0, MAX).map(function (r) {
    return BRISTOL_ICONS[Number(r.bristol)] || '💩';
  });
  const more = sorted.length - MAX;

  const day = document.createElement('span');
  day.className = 'cal-day';
  day.textContent = date.getDate();

  const iconBox = document.createElement('span');
  iconBox.className = 'cal-icons';
  iconBox.textContent = icons.join('');
  if (more > 0) {
    const moreEl = document.createElement('span');
    moreEl.className = 'cal-more';
    moreEl.textContent = '+' + more;
    iconBox.appendChild(moreEl);
  }

  cell.appendChild(day);
  cell.appendChild(iconBox);

  cell.addEventListener('click', function () {
    selected = date;
    setView('day');
  });

  return cell;
}

function renderLegend() {
  const el = $('legend');
  el.innerHTML = '';
  BRISTOL.forEach(function (b) {
    const item = document.createElement('span');
    item.className = 'legend-item';
    item.innerHTML =
      '<span class="legend-icon">' +
      BRISTOL_ICONS[b.value] +
      '</span>' +
      b.value +
      ' ' +
      h(b.label);
    el.appendChild(item);
  });
}

function renderDate() {
  $('dateLabel').textContent = fmtDate(selected);
  $('weekdayLabel').textContent = '星期' + weekday(selected);
}

function renderStats() {
  const today = (records[selectedKey()] || []).length;
  let month = 0;
  Object.entries(records).forEach(function (entry) {
    if (entry[0].startsWith(monthPrefix())) {
      month += entry[1].length;
    }
  });
  $('todayCount').textContent = today;
  $('monthCount').textContent = month;
}

function renderRecords() {
  const list = records[selectedKey()] || [];
  const container = $('records');
  container.innerHTML = '';

  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.innerHTML =
      '<span class="big">🧻</span>这一天还没有记录<br/>点右下角的 ＋ 添加一条吧';
    container.appendChild(empty);
    return;
  }

  const sorted = list.slice().sort(function (a, b) {
    return String(a.time).localeCompare(String(b.time));
  });

  sorted.forEach(function (r) {
    container.appendChild(buildRecordCard(r));
  });
}

function buildRecordCard(r) {
  const card = document.createElement('article');
  card.className = 'record-card';

  const bristol = BRISTOL.find(function (b) {
    return b.value === Number(r.bristol);
  });
  const style = BRISTOL_STYLES[Number(r.bristol)] || BRISTOL_STYLES[4];

  let bristolHtml = '';
  if (bristol) {
    bristolHtml =
      '<span class="bristol-badge" style="background:' +
      style.bg +
      ';color:' +
      style.fg +
      ';"><span class="num">' +
      bristol.value +
      '</span> ' +
      h(bristol.label) +
      '</span>';
  }

  const discomfortHtml = (r.discomfort || [])
    .map(function (d) {
      return '<span class="tag">' + h(d) + '</span>';
    })
    .join('');

  const metaParts = [r.color, r.amount].filter(Boolean).map(h).join(' · ');

  card.innerHTML =
    '<div class="record-top">' +
    '<div class="record-main">' +
    '<span class="time-badge">' +
    h(r.time) +
    '</span>' +
    bristolHtml +
    '</div>' +
    '<div class="record-actions">' +
    '<button type="button" class="edit">编辑</button>' +
    '<button type="button" class="delete">删除</button>' +
    '</div>' +
    '</div>' +
    (metaParts ? '<div class="record-meta">' + metaParts + '</div>' : '') +
    (discomfortHtml
      ? '<div class="record-meta" style="margin-top:8px;">' + discomfortHtml + '</div>'
      : '') +
    (r.notes ? '<p class="record-notes">' + h(r.notes) + '</p>' : '');

  card.querySelector('.edit').addEventListener('click', function () {
    openForm(r);
  });
  card.querySelector('.delete').addEventListener('click', function () {
    if (window.confirm('确定删除这条记录吗？')) {
      deleteRecord(r.id);
    }
  });

  return card;
}

// ---------- record form ----------
function resetChips() {
  $('colorChips').querySelectorAll('.chip').forEach(function (el) {
    el.classList.remove('active');
  });
  $('amountChips').querySelectorAll('.chip').forEach(function (el) {
    el.classList.remove('active');
  });
  $('discomfortChips').querySelectorAll('.chip').forEach(function (el) {
    el.classList.remove('active');
  });
  $('bristolGrid').querySelectorAll('.bristol-option').forEach(function (el) {
    el.classList.remove('active');
  });
}

function openForm(record) {
  resetChips();
  $('recordId').value = record ? record.id : '';
  $('modalTitle').textContent = record ? '编辑记录' : '添加记录';
  $('fTime').value = record ? record.time : nowTime();
  $('fNotes').value = record ? record.notes || '' : '';

  if (record) {
    markChip($('colorChips'), record.color);
    markChip($('amountChips'), record.amount);
    markBristol(record.bristol);
    (record.discomfort || []).forEach(function (d) {
      markChip($('discomfortChips'), d);
    });
  }

  $('modal').hidden = false;
}

function markChip(container, value) {
  if (!value) return;
  container.querySelectorAll('.chip').forEach(function (el) {
    if (el.dataset.value === String(value)) {
      el.classList.add('active');
    }
  });
}

function markBristol(value) {
  $('bristolGrid').querySelectorAll('.bristol-option').forEach(function (el) {
    if (el.dataset.value === String(value)) {
      el.classList.add('active');
    }
  });
}

function activeValue(container) {
  const el = container.querySelector('.chip.active');
  return el ? el.dataset.value : null;
}

function activeBristol() {
  const el = $('bristolGrid').querySelector('.bristol-option.active');
  return el ? el.dataset.value : null;
}

function activeDiscomforts() {
  return Array.from($('discomfortChips').querySelectorAll('.chip.active')).map(function (
    el
  ) {
    return el.dataset.value;
  });
}

function saveRecord() {
  const time = $('fTime').value;
  const bristol = activeBristol();
  const color = activeValue($('colorChips'));
  const amount = activeValue($('amountChips'));
  const discomfort = activeDiscomforts();
  const notes = $('fNotes').value.trim();

  if (!time || !bristol || !color || !amount) {
    showToast('请填写时间、分类、颜色和量');
    return;
  }

  const id = $('recordId').value || uid();
  const record = {
    id: id,
    date: selectedKey(),
    time: time,
    bristol: Number(bristol),
    color: color,
    amount: amount,
    discomfort: discomfort,
    notes: notes,
    updatedAt: new Date().toISOString(),
  };

  const list = records[selectedKey()] || [];
  const idx = list.findIndex(function (r) {
    return r.id === id;
  });
  if (idx >= 0) {
    list[idx] = record;
  } else {
    list.push(record);
  }
  records[selectedKey()] = list;

  persist();
  refresh();
  closeModal($('modal'));
  showToast(idx >= 0 ? '已更新' : '已保存');
}

function deleteRecord(id) {
  const list = records[selectedKey()] || [];
  records[selectedKey()] = list.filter(function (r) {
    return r.id !== id;
  });
  if (!records[selectedKey()].length) {
    delete records[selectedKey()];
  }
  persist();
  refresh();
  showToast('已删除');
}

function closeModal(el) {
  el.hidden = true;
}

// ---------- export / import ----------
function exportData() {
  const payload = {
    app: 'poopooDiary',
    version: 1,
    exportedAt: new Date().toISOString(),
    records: records,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'poopooDiary-backup-' + dateKey(new Date()) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('已导出备份文件');
}

function normalizeRecords(input) {
  const out = {};
  Object.entries(input).forEach(function (entry) {
    const date = entry[0];
    const arr = entry[1];
    if (!Array.isArray(arr) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
    out[date] = arr
      .filter(function (r) {
        return r && r.id && r.time;
      })
      .map(function (r) {
        return {
          id: String(r.id),
          date: date,
          time: String(r.time),
          bristol: Number(r.bristol) || 4,
          color: String(r.color || ''),
          amount: String(r.amount || ''),
          discomfort: Array.isArray(r.discomfort) ? r.discomfort.map(String) : [],
          notes: String(r.notes || ''),
          updatedAt: r.updatedAt || new Date().toISOString(),
        };
      });
  });
  return out;
}

function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const data = JSON.parse(reader.result);
      const rawRecords = data && typeof data === 'object' && data.records ? data.records : data;
      if (!rawRecords || typeof rawRecords !== 'object' || Array.isArray(rawRecords)) {
        throw new Error('bad format');
      }
      pendingImport = normalizeRecords(rawRecords);
      $('importModal').hidden = false;
    } catch (e) {
      showToast('导入失败：文件格式不正确');
    }
  };
  reader.onerror = function () {
    showToast('导入失败：无法读取文件');
  };
  reader.readAsText(file);
}

function applyImport(mode) {
  if (!pendingImport) return;

  if (mode === 'replace') {
    records = pendingImport;
  } else {
    const merged = {};
    Object.keys(records).forEach(function (k) {
      merged[k] = records[k].slice();
    });
    Object.entries(pendingImport).forEach(function (entry) {
      const date = entry[0];
      const incoming = entry[1];
      const map = new Map((merged[date] || []).map(function (r) {
        return [r.id, r];
      }));
      incoming.forEach(function (r) {
        map.set(r.id, r);
      });
      merged[date] = Array.from(map.values());
    });
    records = merged;
  }

  pendingImport = null;
  persist();
  refresh();
  closeModal($('importModal'));
  showToast('导入完成');
}

// ---------- toast ----------
let toastTimer = null;
function showToast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(function () {
    el.hidden = true;
  }, 2400);
}

// ---------- controls ----------
function buildBristolGrid() {
  const grid = $('bristolGrid');
  BRISTOL.forEach(function (b) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bristol-option';
    btn.dataset.value = b.value;
    btn.innerHTML =
      '<span class="type">' + b.value + '</span><span class="type-label">' + h(b.label) + '</span>';
    btn.title = b.desc;
    btn.addEventListener('click', function () {
      grid.querySelectorAll('.bristol-option').forEach(function (el) {
        el.classList.remove('active');
      });
      btn.classList.add('active');
    });
    grid.appendChild(btn);
  });
}

function buildChips(container, options) {
  options.forEach(function (opt) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip';
    btn.dataset.value = opt;
    btn.textContent = opt;
    btn.addEventListener('click', function () {
      if (container.id === 'discomfortChips') {
        btn.classList.toggle('active');
      } else {
        container.querySelectorAll('.chip').forEach(function (el) {
          el.classList.remove('active');
        });
        btn.classList.add('active');
      }
    });
    container.appendChild(btn);
  });
}

// ---------- init ----------
function bindEvents() {
  $('prevDay').addEventListener('click', function () {
    selected = addDays(selected, -1);
    refresh();
  });
  $('nextDay').addEventListener('click', function () {
    selected = addDays(selected, 1);
    refresh();
  });
  $('todayBtn').addEventListener('click', function () {
    selected = startOfToday();
    refresh();
  });

  $('dayViewBtn').addEventListener('click', function () {
    setView('day');
  });
  $('monthViewBtn').addEventListener('click', function () {
    setView('month');
  });
  $('prevMonth').addEventListener('click', function () {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1);
    renderMonth();
  });
  $('nextMonth').addEventListener('click', function () {
    monthCursor = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1);
    renderMonth();
  });
  $('thisMonthBtn').addEventListener('click', function () {
    const now = new Date();
    monthCursor = new Date(now.getFullYear(), now.getMonth(), 1);
    renderMonth();
  });

  $('addBtn').addEventListener('click', function () {
    openForm(null);
  });

  $('recordForm').addEventListener('submit', function (e) {
    e.preventDefault();
    saveRecord();
  });
  $('cancelBtn').addEventListener('click', function () {
    closeModal($('modal'));
  });

  $('exportBtn').addEventListener('click', exportData);
  $('importBtn').addEventListener('click', function () {
    $('importFile').click();
  });
  $('importFile').addEventListener('change', function (e) {
    importFile(e.target.files[0]);
    e.target.value = '';
  });

  $('mergeImport').addEventListener('click', function () {
    applyImport('merge');
  });
  $('replaceImport').addEventListener('click', function () {
    applyImport('replace');
  });
  $('cancelImport').addEventListener('click', function () {
    pendingImport = null;
    closeModal($('importModal'));
  });

  [$('modal'), $('importModal')].forEach(function (backdrop) {
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) {
        if (backdrop.id === 'importModal') pendingImport = null;
        closeModal(backdrop);
      }
    });
  });
}

function init() {
  buildBristolGrid();
  buildChips($('colorChips'), COLORS);
  buildChips($('amountChips'), AMOUNTS);
  buildChips($('discomfortChips'), DISCOMFORTS);
  bindEvents();
  renderDay();
}

init();
