'use strict';
/* admin-home.js — admin.js から機能分割（自動生成）*/

  /* ===== 管理者：店舗全員シフトのタイムライン（本日＋週確認） ===== */
  let adminWeekStart = new Date(); adminWeekStart.setHours(0, 0, 0, 0);
  let adminWeekCalYear  = new Date().getFullYear();
  let adminWeekCalMonth = new Date().getMonth();

  /* 管理者のグリッド用データ：実データ(adminAllShifts) 優先、無ければデモ */
  function adminGridShifts() {
    if (adminAllShifts && adminAllShifts.length) return adminAllShifts;
    if (!storeShiftsCache.length) {
      seedDemoStoreShifts();
      try { storeShiftsCache = JSON.parse(localStorage.getItem(STORE_SHIFTS_KEY) || '[]'); } catch {}
    }
    return storeShiftsCache;
  }

  /* 管理者ホーム：本日の全員シフト（既存リストの上に表示） */
  function renderAdminTodayGrid() {
    const el = document.getElementById('adminTodayGrid');
    if (!el) return;
    const today = fmtDate(new Date());
    el.innerHTML = `
      <div class="section-card" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div class="section-title" style="margin-bottom:0">本日のシフト</div>
          <span style="font-size:11px;color:var(--muted);font-weight:700">${new Date().toLocaleDateString('ja-JP',{month:'long',day:'numeric',weekday:'short'})}</span>
        </div>
        ${dayGridHTML(today, adminGridShifts(), { showHead: false })}
      </div>`;
  }

  /* 管理者シフト確認：週ナビ */
  function adminWeekPrev() { adminWeekStart.setDate(adminWeekStart.getDate() - 7); renderAdminWeekView(); }
  function adminWeekNext() { adminWeekStart.setDate(adminWeekStart.getDate() + 7); renderAdminWeekView(); }
  function renderAdminWeekView() {
    const WD = ['日','月','火','水','木','金','土'];
    const start = new Date(adminWeekStart);
    const end   = new Date(adminWeekStart); end.setDate(start.getDate() + 6);
    const lbl = document.getElementById('adminWeekRangeLabel');
    if (lbl) lbl.textContent =
      `${start.getMonth()+1}/${start.getDate()}(${WD[start.getDay()]}) - ${end.getMonth()+1}/${end.getDate()}(${WD[end.getDay()]})`;
    const shifts = adminGridShifts();
    let html = '';
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      html += dayGridHTML(fmtDate(d), shifts, { showHead: true });
    }
    const view = document.getElementById('adminWeekView');
    if (view) view.innerHTML = html;
  }

  /* 管理者シフト確認：カレンダーから週の起点日を選ぶ */
  function adminToggleWeekCal() {
    const pop = document.getElementById('adminWeekCalPop');
    if (!pop) return;
    const open = pop.style.display === 'none' || !pop.style.display;
    pop.style.display = open ? 'block' : 'none';
    if (open) {
      adminWeekCalYear  = adminWeekStart.getFullYear();
      adminWeekCalMonth = adminWeekStart.getMonth();
      renderAdminWeekCalPicker();
    }
  }
  function adminWeekCalPrevMonth() {
    adminWeekCalMonth--; if (adminWeekCalMonth < 0) { adminWeekCalMonth = 11; adminWeekCalYear--; }
    renderAdminWeekCalPicker();
  }
  function adminWeekCalNextMonth() {
    adminWeekCalMonth++; if (adminWeekCalMonth > 11) { adminWeekCalMonth = 0; adminWeekCalYear++; }
    renderAdminWeekCalPicker();
  }
  function renderAdminWeekCalPicker() {
    const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    document.getElementById('adminWeekCalLabel').textContent = `${adminWeekCalYear}年 ${MONTHS[adminWeekCalMonth]}`;
    const firstDow = new Date(adminWeekCalYear, adminWeekCalMonth, 1).getDay();
    const lastDay  = new Date(adminWeekCalYear, adminWeekCalMonth + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);
    const startStr = fmtDate(adminWeekStart);
    let html = '';
    for (let i = 0; i < firstDow; i++) html += '<div class="cal-day empty"></div>';
    for (let d = 1; d <= lastDay; d++) {
      const dt  = new Date(adminWeekCalYear, adminWeekCalMonth, d);
      const dow = dt.getDay();
      const ds  = fmtDate(dt);
      const isToday = dt.getTime() === today.getTime();
      const isSel   = ds === startStr;
      const col = dow === 0 ? 'sun-col' : dow === 6 ? 'sat-col' : '';
      html += `<div class="cal-day ${col} ${isToday ? 'today' : ''} ${isSel ? 'selected' : ''}" onclick="adminSelectWeekFrom('${ds}')">${d}</div>`;
    }
    document.getElementById('adminWeekCalGrid').innerHTML = html;
  }
  function adminSelectWeekFrom(dateStr) {
    adminWeekStart = new Date(dateStr + 'T00:00:00'); adminWeekStart.setHours(0,0,0,0);
    const pop = document.getElementById('adminWeekCalPop');
    if (pop) pop.style.display = 'none';
    renderAdminWeekView();
  }



  /* ===== 管理者ホーム内タブ切り替え ===== */
  function adminSwitchTab(tab, btn) {
    // admin-bodyは常に表示する
    document.querySelector('.admin-body').style.display = 'block';
    
    // 各要素を取得
    const statsRow = document.getElementById('adminStatsRow');
    const filterBar = document.querySelector('.admin-filter-bar');
    const searchInput = document.getElementById('adminSearch').parentElement;

    // 重要連絡はホームタブのみ表示
    const noticeCard = document.getElementById('adminNoticeCard');
    if (noticeCard) noticeCard.style.display = (tab === 'adminShifts') ? 'block' : 'none';
    // 本日タイムラインはホームタブのみ表示
    const todayGrid = document.getElementById('adminTodayGrid');
    if (todayGrid) todayGrid.style.display = (tab === 'adminShifts') ? 'block' : 'none';

    // 各パネルを非表示にする
    document.getElementById('adminShiftList').style.display = 'none';
    document.getElementById('adminWishesPanel').style.display = 'none';
    document.getElementById('adminCreatePanel').style.display = 'none';
    document.getElementById('adminStaffPanel').style.display = 'none';
    document.getElementById('adminSwapPanel').style.display = 'none';
    const adminWeekPanel = document.getElementById('adminWeekPanel');
    if (adminWeekPanel) adminWeekPanel.style.display = 'none';
    
    document.querySelectorAll('#adminScreen .nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    if (tab === 'adminShifts') {
      statsRow.style.display = 'grid';
      // 全スタッフのシフト一覧・検索・絞り込みは「シフト一覧」タブに集約（ホームでは非表示）
      filterBar.style.display = 'none';
      searchInput.style.display = 'none';
      document.getElementById('adminShiftList').style.display = 'none';
      renderAdminTodayGrid();
    } else if (tab === 'adminWeek') {
      statsRow.style.display = 'none';
      filterBar.style.display = 'none';
      searchInput.style.display = 'none';
      if (adminWeekPanel) adminWeekPanel.style.display = 'block';
      adminWeekStart = new Date(); adminWeekStart.setHours(0, 0, 0, 0);
      renderAdminWeekView();
    } else if (tab === 'adminWishes') {
      statsRow.style.display = 'none';
      filterBar.style.display = 'none';
      searchInput.style.display = 'none';
      document.getElementById('adminWishesPanel').style.display = 'block';
      selectedWish = null;
      renderWishListScreen();
    } else if (tab === 'adminCreate') {
      statsRow.style.display = 'none';
      filterBar.style.display = 'none';
      searchInput.style.display = 'none';
      document.getElementById('adminCreatePanel').style.display = 'block';
      renderAdminCal();
      loadAdminAllShifts();
    } else if (tab === 'adminStaff') {
      statsRow.style.display = 'none';
      filterBar.style.display = 'none';
      searchInput.style.display = 'none';
      document.getElementById('adminStaffPanel').style.display = 'block';
      loadStaffList();
    } else if (tab === 'adminSwap') {
      statsRow.style.display = 'none';
      filterBar.style.display = 'none';
      searchInput.style.display = 'none';
      document.getElementById('adminSwapPanel').style.display = 'block';
      loadAdminSwapList();
    }
}



  /* ========================================================
     ⑥ 管理者用シフト一覧画面
  ======================================================== */
  let adminAllShifts = [];
  let adminCurrentFilter = 'all';
  let adminPendingAction = null; // { shiftId, action }

  const ADMIN_STATUS_LABEL = { scheduled:'確定', pending:'申請中', cancelled:'キャンセル', swapped:'交換済み' };

  async function renderAdminScreen() {
    const listEl = document.getElementById('adminShiftList');
    listEl.innerHTML = '<div class="center-state"><div class="big-spinner"></div><p class="state-sub">読み込み中...</p></div>';
    ['statTotal','statPending','statToday','statSwapPending'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
    // 重要連絡を読み込む
    renderAdminNoticeList();
    // 交代申請バッジを非同期で取得
    fetch(`${API_BASE}/admin/swap-requests`, { headers: { Authorization: `Bearer ${idToken}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        allAdminSwaps = Array.isArray(data.swaps) ? data.swaps
                      : Array.isArray(data.requests) ? data.requests : [];
        updateAdminSwapBadge();
      })
      .catch(() => {});

    try {
      // シフト取得（メイン）
      const shiftsRes = await fetch(`${API_BASE}/admin/shifts`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (shiftsRes.status === 401) { doLogout(); return; }
      if (shiftsRes.status === 403) throw new Error('管理者権限が必要です');
      if (!shiftsRes.ok) {
        const body = await shiftsRes.json().catch(() => ({}));
        throw new Error(body.error || `エラー (${shiftsRes.status})`);
      }

      // スタッフ一覧取得（失敗しても名前が出ないだけでシフト表示は続ける）
      try {
        const staffRes = await fetch(`${API_BASE}/staff`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        if (staffRes.ok) {
          const sd = await staffRes.json().catch(() => ({}));
          const arr = Array.isArray(sd.staff)   ? sd.staff
                    : Array.isArray(sd.users)   ? sd.users
                    : Array.isArray(sd.items)   ? sd.items
                    : Array.isArray(sd.members) ? sd.members
                    : Array.isArray(sd.data)    ? sd.data
                    : Array.isArray(sd)         ? sd : [];
          if (arr.length > 0) allStaffList = arr;
        }
      } catch (_) { /* スタッフ取得失敗は無視 */ }

      const data = await shiftsRes.json();
      adminAllShifts = Array.isArray(data.shifts) ? data.shifts : [];
      adminAllShifts.sort((a,b) => (a.date||'').localeCompare(b.date||''));
      updateAdminStats();
      renderAdminList();
      renderAdminTodayGrid();
    } catch (err) {
      listEl.innerHTML = `
        <div class="center-state">
          <div class="state-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#EF4444" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>
          <p class="state-title">読み込みに失敗しました</p>
          <p class="state-sub">${err.message}</p>
          <button class="reload-btn" onclick="renderAdminScreen()">再試行</button>
        </div>`;
      // 一覧取得に失敗しても本日タイムラインはデモで表示
      renderAdminTodayGrid();
    }
  }

  function updateAdminStats() {
    const today = new Date().toISOString().slice(0, 10);

    // 全シフト: 今日以降の確定済みシフト件数
    const futureScheduled = adminAllShifts.filter(s =>
      s.status === 'scheduled' && s.date >= today
    ).length;
    document.getElementById('statTotal').textContent = futureScheduled;

    // 本日: 本日のシフト人数（status問わず）
    const todayCount = adminAllShifts.filter(s => s.date === today).length;
    document.getElementById('statToday').textContent = todayCount;

    // 申請中（希望）: GET /admin/wishes の件数を非同期で取得
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    fetch(`${API_BASE}/admin/wishes?month=${currentMonth}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    }).then(r => r.ok ? r.json() : null).then(data => {
      if (!data) return;
      const wishes = Array.isArray(data.wishes) ? data.wishes : [];
      document.getElementById('statPending').textContent = wishes.length;
    }).catch(() => {
      // 取得失敗時はシフトのpendingで代替
      document.getElementById('statPending').textContent =
        adminAllShifts.filter(s => s.status === 'pending').length;
    });
  }

  // 交代確認待ちバッジ更新（allAdminSwaps が更新されたら呼ぶ）

  function adminFilter(status, btn) {
    adminCurrentFilter = status;
    document.querySelectorAll('.admin-filter-bar .filter-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    renderAdminList();
  }

  function renderAdminList() {
    const q = (document.getElementById('adminSearch').value || '').toLowerCase();
    // ホーム一覧は今日以降のシフトのみ表示
    const today = new Date().toISOString().slice(0, 10);
    let list = adminAllShifts.filter(s => (s.date || '') >= today);

    if (adminCurrentFilter !== 'all') {
      list = list.filter(s => s.status === adminCurrentFilter);
    }
    if (q) {
      list = list.filter(s => {
        const r = resolveStaffName(s);
        return (s.email || r.email || '').toLowerCase().includes(q) ||
               (s.name  || r.name  || '').toLowerCase().includes(q);
      });
    }

    const listEl = document.getElementById('adminShiftList');
    if (list.length === 0) {
      listEl.innerHTML = '<div class="center-state" style="padding:40px 0"><p class="state-title">該当するシフトがありません</p></div>';
      return;
    }

    listEl.innerHTML = list.map(s => {
      const { month, day, wi } = parseDateParts(s.date);
      const wd  = WEEKDAYS[wi];
      const dur = calcDuration(s.startTime, s.endTime);
      const status = s.status || 'scheduled';
      const label  = ADMIN_STATUS_LABEL[status] || status;

      // ShiftsTable の userId で UsersTable の名前を解決
      const resolved     = resolveStaffName(s);
      const displayName  = s.name  || resolved.name  || '';
      const displayEmail = s.email || resolved.email || '';

      const initial = (displayName || displayEmail || '?')[0].toUpperCase();
      const actionBtns = status === 'pending' ? `
        <div class="admin-action-row">
          <button class="act-btn approve" onclick="openAdminModal('${s.shiftId}','approve')">承認</button>
          <button class="act-btn reject"  onclick="openAdminModal('${s.shiftId}','reject')">却下</button>
        </div>` : '';

      return `
        <div class="admin-shift-card s-${status}">
          <div class="admin-card-top">
            <div class="admin-card-avatar">${initial}</div>
            <div class="admin-card-name">
              ${displayName || displayEmail || '—'}
              <span>${displayEmail}</span>
            </div>
            <div class="admin-status-badge">${label}</div>
          </div>
          <div class="admin-card-bottom">
            <div class="admin-date-time">
              ${month}月${day}日（${wd}） ${s.startTime || '--:--'}〜${s.endTime || '--:--'}
              <span>${dur || ''}</span>
            </div>
            ${actionBtns}
          </div>
        </div>`;
    }).join('');
  }

  function openAdminModal(shiftId, action) {
    adminPendingAction = { shiftId, action };
    const shift = adminAllShifts.find(s => s.shiftId === shiftId);
    const isApprove = action === 'approve';
    const modal = document.getElementById('adminActionModal');
    document.getElementById('adminModalTitle').textContent = isApprove ? '申請を承認しますか？' : '申請を却下しますか？';
    const { month, day } = parseDateParts(shift.date);
    document.getElementById('adminModalSub').textContent =
      `${shift.name || shift.email} さんの ${month}月${day}日のシフト交代申請を${isApprove ? '承認' : '却下'}します。`;
    const confirmBtn = document.getElementById('adminModalConfirmBtn');
    confirmBtn.textContent  = isApprove ? '承認する' : '却下する';
    confirmBtn.className    = `modal-btn ${isApprove ? 'confirm' : 'confirm-danger'}`;
    modal.classList.add('show');
  }

  async function execAdminAction() {
    if (!adminPendingAction) return;
    closeModal('adminActionModal');

    const { shiftId, action } = adminPendingAction;
    adminPendingAction = null;

    try {
      const res = await fetch(`${API_BASE}/admin/shifts/${shiftId}/${action}`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
      });
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `エラー (${res.status})`);
      }
      // ローカル更新
      const idx = adminAllShifts.findIndex(s => s.shiftId === shiftId);
      if (idx >= 0) adminAllShifts[idx].status = action === 'approve' ? 'swapped' : 'cancelled';
      updateAdminStats();
      renderAdminList();
      showToast(action === 'approve' ? '申請を承認しました ✓' : '申請を却下しました', action === 'approve' ? 'success' : '');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
