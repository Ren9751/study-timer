// === Utility Classes ===

var DateUtils = {
  // 午前3時を日付の境界にする（habit-trackerと同じ）
  today: function() {
    var now = new Date();
    if (now.getHours() < 3) {
      now.setDate(now.getDate() - 1);
    }
    return this.format(now);
  },

  format: function(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  },

  parse: function(str) {
    var parts = str.split('-');
    return new Date(+parts[0], +parts[1] - 1, +parts[2]);
  },

  formatDisplay: function(str) {
    var d = this.parse(str);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  },

  getWeekStart: function(dateStr) {
    var d = this.parse(dateStr);
    var day = d.getDay();
    var diff = day === 0 ? 6 : day - 1; // 月曜始まり
    d.setDate(d.getDate() - diff);
    return this.format(d);
  },

  getMonthStart: function(dateStr) {
    return dateStr.substring(0, 8) + '01';
  },

  addDays: function(dateStr, n) {
    var d = this.parse(dateStr);
    d.setDate(d.getDate() + n);
    return this.format(d);
  }
};

var Store = {
  get: function(key) {
    try {
      var val = localStorage.getItem(key);
      return val ? JSON.parse(val) : null;
    } catch(e) {
      return null;
    }
  },
  set: function(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  remove: function(key) {
    localStorage.removeItem(key);
  }
};

// === Time formatting ===
function formatTime(seconds) {
  var h = Math.floor(seconds / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = seconds % 60;
  return String(h).padStart(2, '0') + ':' +
         String(m).padStart(2, '0') + ':' +
         String(s).padStart(2, '0');
}

function formatTimeShort(seconds) {
  var h = Math.floor(seconds / 3600);
  var m = Math.floor((seconds % 3600) / 60);
  var s = seconds % 60;
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

// === Main App ===

function StudyTimer() {
  // State
  this.subjects = Store.get('subjects') || [];
  this.timerRunning = false;
  this.timerPaused = false;
  this.timerStart = null;
  this.timerAccumulated = 0; // 一時停止前の累積秒数
  this.timerInterval = null;
  this.currentSubject = '';
  this.calendarYear = new Date().getFullYear();
  this.calendarMonth = new Date().getMonth();
  this.selectedDate = DateUtils.today();
  this.statsPeriod = 'day';
  this.statsOffset = 0; // 0=今、-1=前の期間...

  this.init();
}

StudyTimer.prototype.init = function() {
  this.bindEvents();
  this.restoreTimer();
  this.renderSubjectSelect();
  this.renderToday();
  this.renderCalendar();
  this.renderDayDetail();
  this.renderStats();
};

// === Event Binding ===

StudyTimer.prototype.bindEvents = function() {
  var self = this;

  // Tabs
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      self.switchTab(this.dataset.tab);
    });
  });

  // Timer
  document.getElementById('btn-start').addEventListener('click', function() {
    if (self.timerRunning) {
      self.pauseTimer();
    } else {
      self.startTimer();
    }
  });

  document.getElementById('btn-save').addEventListener('click', function() {
    self.saveAndReset();
  });

  document.getElementById('subject-select').addEventListener('change', function() {
    self.currentSubject = this.value;
    var btn = document.getElementById('btn-start');
    btn.disabled = !this.value && !self.timerRunning;
  });

  // Subject modal
  document.getElementById('btn-add-subject').addEventListener('click', function() {
    self.openModal('modal-subject');
    document.getElementById('input-subject').value = '';
    setTimeout(function() { document.getElementById('input-subject').focus(); }, 100);
  });

  document.getElementById('btn-save-subject').addEventListener('click', function() {
    self.addSubject();
  });

  document.getElementById('btn-cancel-subject').addEventListener('click', function() {
    self.closeModal('modal-subject');
  });

  document.getElementById('input-subject').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') self.addSubject();
  });

  // Settings modal
  document.getElementById('btn-settings').addEventListener('click', function() {
    self.renderSubjectList();
    self.openModal('modal-settings');
  });

  document.getElementById('btn-close-settings').addEventListener('click', function() {
    self.closeModal('modal-settings');
  });

  // Export / Import / Clear
  document.getElementById('btn-export').addEventListener('click', function() {
    self.exportData();
  });

  document.getElementById('btn-clear-demo').addEventListener('click', function() {
    if (!confirm('デモデータを消去しますか？')) return;
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.indexOf('log-') === 0) keys.push(key);
    }
    keys.forEach(function(key) { Store.remove(key); });
    self.subjects = [];
    Store.remove('subjects');
    Store.set('demoDataInserted', true); // 自動再投入を防ぐ
    self.renderSubjectSelect();
    self.renderToday();
    self.renderCalendar();
    self.renderDayDetail();
    self.renderStats();
    self.closeModal('modal-settings');
  });

  document.getElementById('btn-insert-demo').addEventListener('click', function() {
    if (!confirm('デモデータを入れますか？現在のデータは上書きされます。')) return;
    Store.remove('demoDataInserted');
    location.reload();
  });

  document.getElementById('btn-import').addEventListener('click', function() {
    document.getElementById('file-import').click();
  });

  document.getElementById('file-import').addEventListener('change', function(e) {
    self.importData(e);
  });

  // Calendar navigation
  document.getElementById('cal-prev').addEventListener('click', function() {
    self.calendarMonth--;
    if (self.calendarMonth < 0) {
      self.calendarMonth = 11;
      self.calendarYear--;
    }
    self.renderCalendar();
  });

  document.getElementById('cal-next').addEventListener('click', function() {
    self.calendarMonth++;
    if (self.calendarMonth > 11) {
      self.calendarMonth = 0;
      self.calendarYear++;
    }
    self.renderCalendar();
  });

  // Stats period buttons
  document.querySelectorAll('.btn-period').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.btn-period').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      self.statsPeriod = this.dataset.period;
      self.statsOffset = 0;
      self.renderStats();
    });
  });

  // Stats navigation
  document.getElementById('stats-prev').addEventListener('click', function() {
    self.statsOffset--;
    self.renderStats();
  });

  document.getElementById('stats-next').addEventListener('click', function() {
    if (self.statsOffset < 0) {
      self.statsOffset++;
      self.renderStats();
    }
  });

  // Modal backdrop close
  document.querySelectorAll('.modal-backdrop').forEach(function(backdrop) {
    backdrop.addEventListener('click', function() {
      this.parentElement.classList.remove('open');
    });
  });

  // ページ離脱時にタイマー状態を保存
  window.addEventListener('beforeunload', function() {
    self.saveTimerState();
  });

  // visibilitychangeでもタイマー表示を更新（スマホでバックグラウンドから戻った時）
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden && self.timerRunning) {
      self.updateTimerDisplay();
    }
  });
};

// === Tab switching ===

StudyTimer.prototype.switchTab = function(tabName) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
  document.querySelector('.tab[data-tab="' + tabName + '"]').classList.add('active');
  document.getElementById('tab-' + tabName).classList.add('active');

  if (tabName === 'log') {
    this.renderCalendar();
    this.renderDayDetail();
  } else if (tabName === 'stats') {
    this.renderStats();
  }
};

// === Timer ===

StudyTimer.prototype.startTimer = function() {
  if (!this.currentSubject) return;
  this.timerRunning = true;
  this.timerPaused = false;
  this.timerStart = Date.now();

  var self = this;
  this.timerInterval = setInterval(function() {
    self.updateTimerDisplay();
  }, 1000);

  this.updateTimerUI();
  this.saveTimerState();
};

StudyTimer.prototype.pauseTimer = function() {
  if (!this.timerRunning) return;
  // 現在の区間の経過を累積に加算
  this.timerAccumulated += Math.floor((Date.now() - this.timerStart) / 1000);
  clearInterval(this.timerInterval);
  this.timerInterval = null;
  this.timerRunning = false;
  this.timerPaused = true;
  this.timerStart = null;

  this.updateTimerUI();
  this.saveTimerState();
};

StudyTimer.prototype.saveAndReset = function() {
  // 動作中なら現在区間も加算
  var total = this.timerAccumulated;
  if (this.timerRunning && this.timerStart) {
    total += Math.floor((Date.now() - this.timerStart) / 1000);
  }

  clearInterval(this.timerInterval);
  this.timerInterval = null;
  this.timerRunning = false;
  this.timerPaused = false;
  this.timerStart = null;
  this.timerAccumulated = 0;

  if (total >= 1) {
    this.saveEntry(this.currentSubject, total);
  }

  this.clearTimerState();
  this.updateTimerUI();
  this.renderToday();
};

StudyTimer.prototype.updateTimerDisplay = function() {
  var elapsed = this.timerAccumulated + Math.floor((Date.now() - this.timerStart) / 1000);
  document.getElementById('timer-time').textContent = formatTime(elapsed);
};

StudyTimer.prototype.updateTimerUI = function() {
  var btn = document.getElementById('btn-start');
  var btnSave = document.getElementById('btn-save');
  var display = document.getElementById('timer-time');
  var subjectLabel = document.getElementById('timer-subject-label');
  var select = document.getElementById('subject-select');

  // クラスをリセット
  btn.classList.remove('btn-primary', 'btn-pause', 'btn-stop');

  if (this.timerRunning) {
    // 計測中 → 一時停止ボタン + 保存ボタン
    btn.textContent = '一時停止';
    btn.classList.add('btn-pause');
    btn.disabled = false;
    btnSave.classList.remove('hidden');
    display.classList.add('running');
    subjectLabel.textContent = this.currentSubject;
    select.disabled = true;
  } else if (this.timerPaused) {
    // 一時停止中 → 再開ボタン + 保存ボタン
    btn.textContent = '再開';
    btn.classList.add('btn-stop');
    btn.disabled = false;
    btnSave.classList.remove('hidden');
    display.textContent = formatTime(this.timerAccumulated);
    display.classList.add('running'); // 一時停止中も色を残す
    subjectLabel.textContent = this.currentSubject;
    select.disabled = true;
  } else {
    // 停止中 → 開始ボタンのみ
    btn.textContent = '開始';
    btn.classList.add('btn-primary');
    btn.disabled = !this.currentSubject;
    btnSave.classList.add('hidden');
    display.textContent = '00:00:00';
    display.classList.remove('running');
    subjectLabel.textContent = '';
    select.disabled = false;
  }
};

// タイマー状態の保存・復元（ブラウザ閉じても継続）
StudyTimer.prototype.saveTimerState = function() {
  if (this.timerRunning || this.timerPaused) {
    Store.set('timerState', {
      subject: this.currentSubject,
      startTime: this.timerStart,
      accumulated: this.timerAccumulated,
      paused: this.timerPaused
    });
  }
};

StudyTimer.prototype.clearTimerState = function() {
  Store.remove('timerState');
};

StudyTimer.prototype.restoreTimer = function() {
  var state = Store.get('timerState');
  if (!state) return;

  this.currentSubject = state.subject;
  this.timerAccumulated = state.accumulated || 0;

  var select = document.getElementById('subject-select');
  select.value = this.currentSubject;

  if (state.paused) {
    // 一時停止中だった
    this.timerPaused = true;
    this.timerRunning = false;
    this.timerStart = null;
  } else {
    // 計測中だった
    this.timerStart = state.startTime;
    this.timerRunning = true;

    var self = this;
    this.timerInterval = setInterval(function() {
      self.updateTimerDisplay();
    }, 1000);

    this.updateTimerDisplay();
  }

  this.updateTimerUI();
};

// === Entries (ログ) ===

StudyTimer.prototype.saveEntry = function(subject, seconds) {
  var today = DateUtils.today();
  var key = 'log-' + today;
  var log = Store.get(key) || { date: today, entries: [] };

  log.entries.push({
    id: Date.now(),
    subject: subject,
    seconds: seconds,
    time: new Date().toTimeString().substring(0, 5)
  });

  Store.set(key, log);
};

StudyTimer.prototype.deleteEntry = function(dateStr, entryId) {
  var key = 'log-' + dateStr;
  var log = Store.get(key);
  if (!log) return;

  log.entries = log.entries.filter(function(e) { return e.id !== entryId; });

  if (log.entries.length === 0) {
    Store.remove(key);
  } else {
    Store.set(key, log);
  }
};

StudyTimer.prototype.getLog = function(dateStr) {
  return Store.get('log-' + dateStr);
};

StudyTimer.prototype.getDayTotal = function(dateStr) {
  var log = this.getLog(dateStr);
  if (!log) return 0;
  return log.entries.reduce(function(sum, e) { return sum + e.seconds; }, 0);
};

// === Subjects ===

StudyTimer.prototype.addSubject = function() {
  var input = document.getElementById('input-subject');
  var name = input.value.trim();
  if (!name) return;
  if (this.subjects.indexOf(name) !== -1) return;

  this.subjects.push(name);
  Store.set('subjects', this.subjects);
  this.closeModal('modal-subject');
  this.renderSubjectSelect();

  // 追加した科目を選択状態にする
  var select = document.getElementById('subject-select');
  select.value = name;
  this.currentSubject = name;
  document.getElementById('btn-start').disabled = false;
};

StudyTimer.prototype.removeSubject = function(name) {
  this.subjects = this.subjects.filter(function(s) { return s !== name; });
  Store.set('subjects', this.subjects);
  this.renderSubjectSelect();
  this.renderSubjectList();

  if (this.currentSubject === name) {
    this.currentSubject = '';
    document.getElementById('subject-select').value = '';
    document.getElementById('btn-start').disabled = true;
  }
};

StudyTimer.prototype.renderSubjectSelect = function() {
  var select = document.getElementById('subject-select');
  var options = '<option value="">科目を選択</option>';
  this.subjects.forEach(function(s) {
    options += '<option value="' + s + '">' + s + '</option>';
  });
  select.innerHTML = options;

  if (this.currentSubject) {
    select.value = this.currentSubject;
  }
};

StudyTimer.prototype.renderSubjectList = function() {
  var container = document.getElementById('subject-list');
  var self = this;

  if (this.subjects.length === 0) {
    container.innerHTML = '<p class="no-entries">科目がありません</p>';
    return;
  }

  container.innerHTML = '';
  this.subjects.forEach(function(s) {
    var item = document.createElement('div');
    item.className = 'subject-item';

    var name = document.createElement('span');
    name.className = 'subject-item-name';
    name.textContent = s;

    var actions = document.createElement('div');
    actions.className = 'subject-item-actions';

    var edit = document.createElement('button');
    edit.className = 'subject-item-edit';
    edit.textContent = '✎';
    edit.addEventListener('click', function() {
      // インライン編集に切り替え
      name.style.display = 'none';
      actions.style.display = 'none';

      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'subject-item-input';
      input.value = s;
      input.maxLength = 20;

      var saveBtn = document.createElement('button');
      saveBtn.className = 'subject-item-save';
      saveBtn.textContent = '✓';

      var doSave = function() {
        var newName = input.value.trim();
        if (!newName || newName === s) {
          // 変更なしなら元に戻す
          item.removeChild(input);
          item.removeChild(saveBtn);
          name.style.display = '';
          actions.style.display = '';
          return;
        }
        if (self.subjects.indexOf(newName) !== -1) {
          alert('その科目名は既に存在します');
          return;
        }
        self.renameSubject(s, newName);
      };

      saveBtn.addEventListener('click', doSave);
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') doSave();
        if (e.key === 'Escape') {
          item.removeChild(input);
          item.removeChild(saveBtn);
          name.style.display = '';
          actions.style.display = '';
        }
      });

      item.insertBefore(input, actions);
      item.insertBefore(saveBtn, actions);
      input.focus();
      input.select();
    });

    var del = document.createElement('button');
    del.className = 'subject-item-delete';
    del.textContent = '×';
    del.addEventListener('click', function() {
      if (confirm('"' + s + '" を削除しますか？')) {
        self.removeSubject(s);
      }
    });

    actions.appendChild(edit);
    actions.appendChild(del);
    item.appendChild(name);
    item.appendChild(actions);
    container.appendChild(item);
  });
};

StudyTimer.prototype.renameSubject = function(oldName, newName) {
  // 科目リストを更新
  var idx = this.subjects.indexOf(oldName);
  if (idx === -1) return;
  this.subjects[idx] = newName;
  Store.set('subjects', this.subjects);

  // 全ログの科目名を更新
  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key && key.indexOf('log-') === 0) {
      var log = Store.get(key);
      if (log && log.entries) {
        var changed = false;
        log.entries.forEach(function(entry) {
          if (entry.subject === oldName) {
            entry.subject = newName;
            changed = true;
          }
        });
        if (changed) Store.set(key, log);
      }
    }
  }

  // 現在選択中の科目も更新
  if (this.currentSubject === oldName) {
    this.currentSubject = newName;
  }

  this.renderSubjectSelect();
  this.renderSubjectList();
  this.renderToday();
};

// === Today ===

StudyTimer.prototype.renderToday = function() {
  var today = DateUtils.today();
  var log = this.getLog(today);
  var entries = log ? log.entries : [];
  var total = entries.reduce(function(sum, e) { return sum + e.seconds; }, 0);

  document.getElementById('today-total').textContent = formatTimeShort(total);

  var container = document.getElementById('today-entries');
  var self = this;

  if (entries.length === 0) {
    container.innerHTML = '<p class="no-entries">まだ記録がないよ</p>';
    return;
  }

  container.innerHTML = '';
  // 新しい順
  entries.slice().reverse().forEach(function(entry) {
    var item = document.createElement('div');
    item.className = 'entry-item';

    var subject = document.createElement('span');
    subject.className = 'entry-subject';
    subject.textContent = entry.subject;

    var time = document.createElement('span');
    time.className = 'entry-time';
    time.textContent = formatTimeShort(entry.seconds);

    var actions = document.createElement('div');
    actions.className = 'entry-actions';

    var del = document.createElement('button');
    del.className = 'btn-delete-entry';
    del.textContent = '×';
    del.addEventListener('click', function() {
      if (confirm('この記録を削除しますか？')) {
        self.deleteEntry(today, entry.id);
        self.renderToday();
      }
    });

    actions.appendChild(del);
    item.appendChild(subject);
    item.appendChild(time);
    item.appendChild(actions);
    container.appendChild(item);
  });
};

// === Calendar ===

StudyTimer.prototype.renderCalendar = function() {
  var year = this.calendarYear;
  var month = this.calendarMonth;

  document.getElementById('cal-month').textContent = year + '年' + (month + 1) + '月';

  var firstDay = new Date(year, month, 1);
  var lastDay = new Date(year, month + 1, 0);
  var startWeekday = firstDay.getDay();
  startWeekday = startWeekday === 0 ? 6 : startWeekday - 1; // 月曜始まり

  var container = document.getElementById('cal-days');
  container.innerHTML = '';
  var self = this;

  // 空白セル
  for (var i = 0; i < startWeekday; i++) {
    var empty = document.createElement('div');
    empty.className = 'cal-day empty';
    container.appendChild(empty);
  }

  var today = DateUtils.today();

  for (var d = 1; d <= lastDay.getDate(); d++) {
    var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    var cell = document.createElement('div');
    cell.className = 'cal-day';
    cell.textContent = d;

    if (dateStr === today) cell.classList.add('today');
    if (dateStr === this.selectedDate) cell.classList.add('selected');

    // ログの有無でヒートマップ
    var total = this.getDayTotal(dateStr);
    if (total > 0) {
      var hours = total / 3600;
      if (hours >= 4) cell.classList.add('has-log--4');
      else if (hours >= 2) cell.classList.add('has-log--3');
      else if (hours >= 1) cell.classList.add('has-log--2');
      else cell.classList.add('has-log--1');
    }

    cell.dataset.date = dateStr;
    cell.addEventListener('click', function() {
      self.selectedDate = this.dataset.date;
      self.renderCalendar();
      self.renderDayDetail();
    });

    container.appendChild(cell);
  }
};

// === Day Detail ===

StudyTimer.prototype.renderDayDetail = function() {
  var dateStr = this.selectedDate;
  document.getElementById('day-detail-date').textContent = DateUtils.formatDisplay(dateStr);

  var log = this.getLog(dateStr);
  var entries = log ? log.entries : [];
  var total = entries.reduce(function(sum, e) { return sum + e.seconds; }, 0);

  document.getElementById('day-detail-total').textContent = formatTimeShort(total);

  var container = document.getElementById('day-detail-entries');

  if (entries.length === 0) {
    container.innerHTML = '<p class="no-entries">記録なし</p>';
    return;
  }

  container.innerHTML = '';
  entries.forEach(function(entry) {
    var item = document.createElement('div');
    item.className = 'entry-item';

    var subject = document.createElement('span');
    subject.className = 'entry-subject';
    subject.textContent = entry.subject + (entry.time ? ' (' + entry.time + ')' : '');

    var time = document.createElement('span');
    time.className = 'entry-time';
    time.textContent = formatTimeShort(entry.seconds);

    var actions = document.createElement('div');
    actions.className = 'entry-actions';

    var del = document.createElement('button');
    del.className = 'btn-delete-entry';
    del.textContent = '×';
    del.addEventListener('click', function() {
      if (confirm('この記録を削除しますか？')) {
        self.deleteEntry(dateStr, entry.id);
        self.renderCalendar();
        self.renderDayDetail();
      }
    });

    actions.appendChild(del);
    item.appendChild(subject);
    item.appendChild(time);
    item.appendChild(actions);
    container.appendChild(item);
  });
};

// === Stats ===

StudyTimer.prototype.DONUT_COLORS = [
  '#4a9', '#e6a23c', '#f56c6c', '#409eff', '#9b59b6',
  '#1abc9c', '#e74c3c', '#3498db', '#f39c12', '#2ecc71'
];

StudyTimer.prototype.renderStats = function() {
  var today = DateUtils.today();
  var period = this.statsPeriod;
  var offset = this.statsOffset;
  var DAYS = ['日', '月', '火', '水', '木', '金', '土'];
  var DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // 期間の起点と終点を計算
  var range = this.getStatsRange(period, offset, today);
  var label = range.label;
  var barData = range.barData; // [{label, dateKeys}]

  // ナビラベル
  document.getElementById('stats-nav-label').textContent = label;

  // データ収集
  var grandTotal = 0;
  var subjectTotals = {};

  barData.forEach(function(bar) {
    bar.seconds = 0;
    bar.dateKeys.forEach(function(dateStr) {
      var log = Store.get('log-' + dateStr);
      if (log && log.entries) {
        log.entries.forEach(function(entry) {
          bar.seconds += entry.seconds;
          grandTotal += entry.seconds;
          subjectTotals[entry.subject] = (subjectTotals[entry.subject] || 0) + entry.seconds;
        });
      }
    });
  });

  document.getElementById('stats-total-time').textContent = formatTimeShort(grandTotal);

  // 棒グラフ描画
  var labels = barData.map(function(b) { return b.label; });
  var values = barData.map(function(b) { return b.seconds / 3600; }); // 時間に変換
  this.drawBarChart(labels, values);

  // ドーナツチャート描画
  var subjectEntries = Object.keys(subjectTotals).map(function(s) {
    return { name: s, seconds: subjectTotals[s] };
  }).sort(function(a, b) { return b.seconds - a.seconds; });

  this.drawDonutChart(subjectEntries, grandTotal);
};

StudyTimer.prototype.getStatsRange = function(period, offset, today) {
  var DAYS = ['日', '月', '火', '水', '木', '金', '土'];
  var result = { label: '', barData: [] };

  if (period === 'day') {
    var d = DateUtils.parse(DateUtils.addDays(today, offset));
    var dateStr = DateUtils.format(d);
    var dayName = DAYS[d.getDay()];
    result.label = (d.getMonth() + 1) + '/' + d.getDate() + '(' + dayName + ')';
    result.barData = [{ label: dayName, dateKeys: [dateStr] }];

  } else if (period === 'week') {
    // 今週の月曜を基準に offset 週ずらす
    var weekStart = DateUtils.parse(DateUtils.getWeekStart(today));
    weekStart.setDate(weekStart.getDate() + offset * 7);
    var weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    result.label = (weekStart.getMonth() + 1) + '/' + weekStart.getDate() +
                   ' - ' + (weekEnd.getMonth() + 1) + '/' + weekEnd.getDate();

    var SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    for (var i = 0; i < 7; i++) {
      var day = new Date(weekStart);
      day.setDate(day.getDate() + i);
      result.barData.push({
        label: SHORT[i],
        dateKeys: [DateUtils.format(day)]
      });
    }

  } else if (period === 'month') {
    var now = DateUtils.parse(today);
    var monthDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    var year = monthDate.getFullYear();
    var month = monthDate.getMonth();
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    result.label = year + '年' + (month + 1) + '月';

    for (var i = 1; i <= daysInMonth; i++) {
      var dateStr = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(i).padStart(2, '0');
      // 5日おきにラベル表示、それ以外は空
      var lbl = (i % 5 === 0 || i === 1) ? String(i) : '';
      result.barData.push({ label: lbl, dateKeys: [dateStr] });
    }

  } else if (period === 'year') {
    var now = DateUtils.parse(today);
    var year = now.getFullYear() + offset;
    result.label = year + '年';

    for (var m = 0; m < 12; m++) {
      var daysInMonth = new Date(year, m + 1, 0).getDate();
      var dateKeys = [];
      for (var d = 1; d <= daysInMonth; d++) {
        dateKeys.push(year + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0'));
      }
      result.barData.push({ label: (m + 1) + '月', dateKeys: dateKeys });
    }
  }

  return result;
};

StudyTimer.prototype.drawBarChart = function(labels, values) {
  var canvas = document.getElementById('stats-bar-chart');
  var dpr = window.devicePixelRatio || 1;
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var W = rect.width;
  var H = rect.height;
  var padLeft = 36;
  var padRight = 8;
  var padTop = 12;
  var padBottom = 28;
  var chartW = W - padLeft - padRight;
  var chartH = H - padTop - padBottom;
  var maxVal = 12; // Y軸は固定12h

  // 背景クリア
  ctx.clearRect(0, 0, W, H);

  // グリッド線 + Y軸ラベル
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#555';
  ctx.font = '11px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  var ySteps = [0, 3, 6, 9, 12];
  ySteps.forEach(function(v) {
    var y = padTop + chartH - (v / maxVal) * chartH;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(W - padRight, y);
    ctx.stroke();
    ctx.fillText(v + 'h', padLeft - 6, y);
  });

  // 棒グラフ
  var barCount = labels.length;
  var gap = Math.max(2, Math.min(6, chartW / barCount * 0.2));
  var barW = (chartW - gap * (barCount + 1)) / barCount;
  barW = Math.max(2, barW);

  ctx.fillStyle = '#4a9';
  for (var i = 0; i < barCount; i++) {
    var x = padLeft + gap + i * (barW + gap);
    var barH = (Math.min(values[i], maxVal) / maxVal) * chartH;
    if (barH > 0) {
      var radius = Math.min(3, barW / 2);
      var y = padTop + chartH - barH;
      // 丸角の棒
      ctx.beginPath();
      ctx.moveTo(x, padTop + chartH);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.lineTo(x + barW - radius, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
      ctx.lineTo(x + barW, padTop + chartH);
      ctx.closePath();
      ctx.fill();
    }
  }

  // X軸ラベル
  ctx.fillStyle = '#666';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (var i = 0; i < barCount; i++) {
    if (labels[i]) {
      var x = padLeft + gap + i * (barW + gap) + barW / 2;
      ctx.fillText(labels[i], x, padTop + chartH + 6);
    }
  }
};

StudyTimer.prototype.drawDonutChart = function(subjectEntries, grandTotal) {
  var canvas = document.getElementById('stats-donut-chart');
  var dpr = window.devicePixelRatio || 1;
  canvas.width = 140 * dpr;
  canvas.height = 140 * dpr;
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var cx = 70, cy = 70, r = 58, thickness = 20;
  var colors = this.DONUT_COLORS;

  ctx.clearRect(0, 0, 140, 140);

  if (grandTotal === 0 || subjectEntries.length === 0) {
    // データなし → グレーのリング
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.arc(cx, cy, r - thickness, 0, Math.PI * 2, true);
    ctx.fillStyle = '#222';
    ctx.fill();

    // 凡例クリア
    document.getElementById('stats-donut-legend').innerHTML =
      '<p class="no-entries" style="font-size:13px">データなし</p>';
    return;
  }

  // 描画
  var startAngle = -Math.PI / 2;
  subjectEntries.forEach(function(entry, idx) {
    var slice = (entry.seconds / grandTotal) * Math.PI * 2;
    var endAngle = startAngle + slice;
    var color = colors[idx % colors.length];

    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.arc(cx, cy, r - thickness, endAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();

    startAngle = endAngle;
  });

  // 凡例
  var legend = document.getElementById('stats-donut-legend');
  legend.innerHTML = '';
  subjectEntries.forEach(function(entry, idx) {
    var item = document.createElement('div');
    item.className = 'legend-item';

    var dot = document.createElement('span');
    dot.className = 'legend-color';
    dot.style.background = colors[idx % colors.length];

    var name = document.createElement('span');
    name.className = 'legend-label';
    name.textContent = entry.name;

    var time = document.createElement('span');
    time.className = 'legend-time';
    time.textContent = formatTimeShort(entry.seconds);

    item.appendChild(dot);
    item.appendChild(name);
    item.appendChild(time);
    legend.appendChild(item);
  });
};

// === Modal ===

StudyTimer.prototype.openModal = function(id) {
  document.getElementById(id).classList.add('open');
};

StudyTimer.prototype.closeModal = function(id) {
  document.getElementById(id).classList.remove('open');
};

// === Export / Import ===

StudyTimer.prototype.exportData = function() {
  var data = {
    subjects: this.subjects,
    logs: {}
  };

  for (var i = 0; i < localStorage.length; i++) {
    var key = localStorage.key(i);
    if (key && key.indexOf('log-') === 0) {
      data.logs[key] = Store.get(key);
    }
  }

  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'study-timer-backup-' + DateUtils.today() + '.json';
  a.click();
  URL.revokeObjectURL(url);
};

StudyTimer.prototype.importData = function(event) {
  var file = event.target.files[0];
  if (!file) return;

  var self = this;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);

      if (data.subjects) {
        self.subjects = data.subjects;
        Store.set('subjects', self.subjects);
      }

      if (data.logs) {
        Object.keys(data.logs).forEach(function(key) {
          Store.set(key, data.logs[key]);
        });
      }

      self.renderSubjectSelect();
      self.renderToday();
      self.renderCalendar();
      self.renderDayDetail();
      self.renderStats();
      self.closeModal('modal-settings');
      alert('インポート完了');
    } catch(err) {
      alert('インポートに失敗しました');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

// === Demo Data (統計確認用) ===
StudyTimer.prototype.insertDemoData = function() {
  // 既にデモデータが入っていたらスキップ
  if (Store.get('demoDataInserted')) return;

  var subjects = ['数学', '英語', '物理', '国語', '化学'];
  this.subjects = subjects;
  Store.set('subjects', subjects);

  var today = DateUtils.today();
  var todayDate = DateUtils.parse(today);

  // 過去21日分のデータを生成
  for (var i = 1; i <= 21; i++) {
    var dateStr = DateUtils.addDays(today, -i);
    var entries = [];
    // 1日に1〜3科目の記録をランダムに
    var numEntries = 1 + Math.floor(Math.random() * 3);
    for (var j = 0; j < numEntries; j++) {
      var subjectIdx = Math.floor(Math.random() * subjects.length);
      var seconds = 1200 + Math.floor(Math.random() * 5400); // 20分〜110分
      var hour = 9 + Math.floor(Math.random() * 12);
      var minute = Math.floor(Math.random() * 60);
      entries.push({
        id: Date.now() - i * 100000 - j * 1000,
        subject: subjects[subjectIdx],
        seconds: seconds,
        time: String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0')
      });
    }
    var key = 'log-' + dateStr;
    Store.set(key, { date: dateStr, entries: entries });
  }

  Store.set('demoDataInserted', true);
  this.renderSubjectSelect();
  this.renderToday();
  this.renderCalendar();
  this.renderDayDetail();
  this.renderStats();
};

// === Init ===
window.app = new StudyTimer();
window.app.insertDemoData();
