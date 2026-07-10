'use strict';
/* shifts.js — index.html から機能分割（自動生成）*/

  /* ===== API: シフト取得 ===== */
  async function fetchMyShifts() {
    const res = await fetch(`${API_BASE}/shifts/me`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (res.status === 401) {
      doLogout();
      throw new Error('セッションが切れました。再ログインしてください。');
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `サーバーエラー (${res.status})`);
    }

    const data = await res.json();
    return Array.isArray(data.shifts) ? data.shifts : [];
  }


  /* ===== シフト画面の描画 ===== */
  async function renderShiftsScreen() {
    // ユーザー情報
    const displayName = userName || userEmail;
    const initial = displayName ? displayName[0].toUpperCase() : '?';
    document.getElementById('userAvatar').textContent = initial;
    document.getElementById('userEmailDisplay').textContent = userName
      ? `${userName}（${userEmail}）`
      : userEmail;

    showScreen('shiftsScreen');
    // ボトムナビ アクティブ状態
    ['navShifts'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
    });

    // ローディング表示（本日のシフト）
    const todayEl = document.getElementById('todayShiftList');
    if (todayEl) todayEl.innerHTML =
      '<div class="center-state" style="padding:12px 0"><div class="big-spinner"></div></div>';

    fetchNotices();
    try {
      storeShiftsCache = await fetchStoreShifts();
    } catch (_) {
      storeShiftsCache = [];
    }

    // ホーム＝本日1日分の全体シフト表（週は「シフト確認」タブへ）
    renderTodayStoreGrid();
    ensureStaffList().then(() => renderTodayStoreGrid());

    // 今後のシフト（自分の予定リスト）。カレンダーの印にも使うので保持
    try {
      const myShifts = await fetchMyShifts();
      window._cachedShifts = myShifts;
      renderUpcomingMyShifts(myShifts);
    } catch (_) {
      window._cachedShifts = [];
      renderUpcomingMyShifts([]);
    }
  }



  /* ===== 店舗全員シフト（タイムライン表示） ===== */
  const GRID_START_HOUR = 6;
  const GRID_END_HOUR   = 24;
  const GRID_COL_W      = 54;   // 1時間あたりの幅(px)
  const STORE_SHIFTS_KEY = 'demoStoreShifts_v2';
  let storeShiftsCache = [];
  let weekStart = new Date(); weekStart.setHours(0, 0, 0, 0);

  const timeToMin = t => {
    const [h, m] = String(t || '0:0').split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const fmtDate = d =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  /* シフトの表示名を解決：name → スタッフ一覧から解決 → メール頭 → 未設定 */
  function shiftDisplayName(s) {
    if (s.name) return s.name;
    const r = resolveStaffName(s);
    if (r.name) return r.name;
    if (s.email)  return String(s.email).split('@')[0];
    if (r.email)  return String(r.email).split('@')[0];
    return '（名前未設定）';
  }

  /* 名前解決用にスタッフ一覧を確保（未取得なら /staff を試行） */
  async function ensureStaffList() {
    if (Array.isArray(allStaffList) && allStaffList.length) return;
    try {
      const res = await fetch(`${API_BASE}/staff`, { headers: { Authorization: `Bearer ${idToken}` } });
      if (!res.ok) return;
      const d = await res.json();
      const arr = Array.isArray(d.staff)   ? d.staff
                : Array.isArray(d.users)   ? d.users
                : Array.isArray(d.items)   ? d.items
                : Array.isArray(d.members) ? d.members
                : Array.isArray(d.data)    ? d.data
                : Array.isArray(d)         ? d : [];
      if (arr.length) allStaffList = arr;
    } catch (_) { /* 取得失敗時は名前未設定のまま */ }
  }

  /* デモ用：店舗全員シフトを生成（店舗全体取得APIが未実装のため。実APIが来たら差し替え） */
  function seedDemoStoreShifts() {
    try { if (JSON.parse(localStorage.getItem(STORE_SHIFTS_KEY) || '[]').length) return; } catch {}
    const base = [
      { email: 'watakari@example.com', name: '渡嘉敷 登明' },
      { email: 'miyazaki@example.com', name: '宮崎 清美' },
      { email: 'yamada@example.com',   name: '山田 友紀' },
      { email: 'kurihara@example.com', name: '栗原 幸喜' },
      { email: 'masuda@example.com',   name: '増田 絢美' },
      { email: 'asok@example.com',     name: 'ドゥンガナ アソク' },
    ];
    // ログイン中のユーザーが固定スタッフと重複しないようにする（重複すると自分のシフトが二重に入る）
    const meEmail = userEmail || 'me@example.com';
    const team = base.some(t => t.email === meEmail)
      ? base
      : [{ email: meEmail, name: userName || 'あなた' }, ...base];
    const slots = [['06:00','09:00'],['09:00','13:00'],['13:00','17:00'],['17:00','22:00'],['08:00','12:00'],['12:00','18:00']];
    const start = new Date(); start.setHours(0,0,0,0); start.setDate(start.getDate() - 14);
    const out = []; let id = 1;
    for (let i = 0; i < 70; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const dateStr = fmtDate(d);
      // 各スタッフは週3日程度だけ出勤（決定的に散らす）→ カレンダーの印が自然に疎になる
      team.forEach((c, si) => {
        if (((i + si * 3) % 7) < 3) {
          const s = slots[(i + si) % slots.length];
          out.push({ shiftId:`demo-${id++}`, email:c.email, name:c.name, date:dateStr, startTime:s[0], endTime:s[1], status:'scheduled' });
        }
      });
    }
    localStorage.setItem(STORE_SHIFTS_KEY, JSON.stringify(out));
  }

  /* 店舗全員のシフトを取得（API試行→デモ用サンプル） */
  async function fetchStoreShifts() {
    try {
      const res = await fetch(`${API_BASE}/shifts?scope=store`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const arr = Array.isArray(data.shifts) ? data.shifts : [];
        if (arr.length) return arr;
      }
    } catch (_) { /* 未実装時はデモへ */ }
    seedDemoStoreShifts();
    try { return JSON.parse(localStorage.getItem(STORE_SHIFTS_KEY) || '[]'); }
    catch { return []; }
  }

  /* 1日分のタイムライングリッド（横=時間軸、縦=スタッフ、緑バー=勤務帯） */
  function dayGridHTML(dateStr, shifts, opts = {}) {
    const WD = ['日','月','火','水','木','金','土'];
    const d  = new Date(dateStr + 'T00:00:00');
    const wdCls = d.getDay() === 0 ? 'sun' : d.getDay() === 6 ? 'sat' : '';
    const day = (shifts || [])
      .filter(s => s.date === dateStr)
      .sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));

    const hours = [];
    for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) hours.push(h);
    const totalW = hours.length * GRID_COL_W;
    const axis = hours.map(h => `<div class="tl-hour">${h}時</div>`).join('');

    let rows;
    if (!day.length) {
      rows = `<div class="tl-empty">この日の出勤予定はありません</div>`;
    } else {
      rows = day.map(s => {
        const st = timeToMin(s.startTime);
        const en = Math.max(timeToMin(s.endTime), st + 30);
        const left  = Math.max(0, (st / 60 - GRID_START_HOUR) * GRID_COL_W);
        let   width = ((en - st) / 60) * GRID_COL_W;
        width = Math.max(44, Math.min(width, totalW - left));
        const mine = s.email && s.email === userEmail;
        return `
          <div class="tl-row">
            <div class="tl-bar ${mine ? 'mine' : ''}" style="left:${left}px;width:${width}px">
              <span class="tl-check">✓</span>
              <span class="tl-name">${shiftDisplayName(s)}</span>
              <span class="tl-time">${s.startTime}-${s.endTime}</span>
            </div>
          </div>`;
      }).join('');
    }

    const head = opts.showHead === false ? '' :
      `<div class="day-block-head"><span class="dbh-date">${d.getMonth()+1}/${d.getDate()}</span><span class="dbh-wd ${wdCls}">(${WD[d.getDay()]})</span></div>`;

    return `
      <div class="day-block">
        ${head}
        <div class="tl-scroll">
          <div class="tl-inner" style="width:${totalW}px">
            <div class="tl-axis">${axis}</div>
            <div class="tl-rows">${rows}</div>
          </div>
        </div>
      </div>`;
  }

  /* ホーム：本日1日分の店舗シフト表 */
  function renderTodayStoreGrid() {
    const el = document.getElementById('todayShiftList');
    if (!el) return;
    const today = fmtDate(new Date());
    const dateEl = document.getElementById('todayShiftDate');
    if (dateEl) dateEl.textContent =
      new Date().toLocaleDateString('ja-JP', { month:'long', day:'numeric', weekday:'short' });
    el.innerHTML = dayGridHTML(today, storeShiftsCache, { showHead: false });
  }

  /* ホーム：今後のシフト（自分の予定を日付順にリスト表示） */
  function renderUpcomingMyShifts(shifts) {
    const container = document.getElementById('shiftsContainer');
    const countEl = document.getElementById('shiftCount');
    if (!container) return;
    const todayStr = new Date().toISOString().slice(0, 10);
    const upcoming = (shifts || [])
      .filter(s => (s.date || '') >= todayStr)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    if (countEl) countEl.textContent = `${upcoming.length}件`;
    container.innerHTML = upcoming.length
      ? upcoming.map(shiftCardHTML).join('')
      : '<div class="ss-empty">今後のシフトはありません</div>';
  }

  /* シフト確認：週単位ナビゲーション */
  function weekPrev() { weekStart.setDate(weekStart.getDate() - 7); renderWeekView(); }
  function weekNext() { weekStart.setDate(weekStart.getDate() + 7); renderWeekView(); }

  function renderWeekView() {
    const WD = ['日','月','火','水','木','金','土'];
    const start = new Date(weekStart);
    const end   = new Date(weekStart); end.setDate(start.getDate() + 6);
    const lbl = document.getElementById('weekRangeLabel');
    if (lbl) lbl.textContent =
      `${start.getMonth()+1}/${start.getDate()}(${WD[start.getDay()]}) - ${end.getMonth()+1}/${end.getDate()}(${WD[end.getDay()]})`;
    let html = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      html += dayGridHTML(fmtDate(d), storeShiftsCache, { showHead: true });
    }
    const view = document.getElementById('weekView');
    if (view) view.innerHTML = html;
  }

  /* シフト確認：カレンダーから週の起点日を選ぶ */
  let weekCalYear  = new Date().getFullYear();
  let weekCalMonth = new Date().getMonth();

  function toggleWeekCal() {
    const pop = document.getElementById('weekCalPop');
    if (!pop) return;
    const open = pop.style.display === 'none' || !pop.style.display;
    pop.style.display = open ? 'block' : 'none';
    if (open) {
      weekCalYear  = weekStart.getFullYear();
      weekCalMonth = weekStart.getMonth();
      renderWeekCalPicker();
    }
  }
  function weekCalPrevMonth() {
    weekCalMonth--; if (weekCalMonth < 0) { weekCalMonth = 11; weekCalYear--; }
    renderWeekCalPicker();
  }
  function weekCalNextMonth() {
    weekCalMonth++; if (weekCalMonth > 11) { weekCalMonth = 0; weekCalYear++; }
    renderWeekCalPicker();
  }
  function renderWeekCalPicker() {
    const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    document.getElementById('weekCalLabel').textContent = `${weekCalYear}年 ${MONTHS[weekCalMonth]}`;
    const firstDow = new Date(weekCalYear, weekCalMonth, 1).getDay();
    const lastDay  = new Date(weekCalYear, weekCalMonth + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    const startStr = fmtDate(weekStart);
    // 自分のシフトが入っている日（fetchMyShifts優先、無ければ店舗データから自分=メール一致を抽出）
    const mySrc = (window._cachedShifts && window._cachedShifts.length)
      ? window._cachedShifts
      : storeShiftsCache.filter(s => s.email && s.email === userEmail);
    const myDates = new Set(mySrc.map(s => s.date));
    let html = '';
    for (let i = 0; i < firstDow; i++) html += '<div class="cal-day empty"></div>';
    for (let d = 1; d <= lastDay; d++) {
      const dt  = new Date(weekCalYear, weekCalMonth, d);
      const dow = dt.getDay();
      const ds  = fmtDate(dt);
      const isToday  = dt.getTime() === today.getTime();
      const isSel    = ds === startStr;
      const hasShift = myDates.has(ds);
      const col = dow === 0 ? 'sun-col' : dow === 6 ? 'sat-col' : '';
      html += `<div class="cal-day ${col} ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''} ${hasShift ? 'has-shift' : ''}" onclick="selectWeekFrom('${ds}')">${d}</div>`;
    }
    document.getElementById('weekCalGrid').innerHTML = html;
  }
  function selectWeekFrom(dateStr) {
    weekStart = new Date(dateStr + 'T00:00:00'); weekStart.setHours(0,0,0,0);
    const pop = document.getElementById('weekCalPop');
    if (pop) pop.style.display = 'none';
    renderWeekView();
  }

