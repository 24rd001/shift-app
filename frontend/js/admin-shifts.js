'use strict';
/* admin-shifts.js — admin.js から機能分割（自動生成）*/

  /* ===== シフト一覧タブ: カレンダー ===== */
  let adminCalYear  = new Date().getFullYear();
  let adminCalMonth = new Date().getMonth();
  let adminCalSelectedDate = null;

  function adminCalPrevMonth() {
    adminCalMonth--;
    if (adminCalMonth < 0) { adminCalMonth = 11; adminCalYear--; }
    renderAdminCal();
  }
  function adminCalNextMonth() {
    adminCalMonth++;
    if (adminCalMonth > 11) { adminCalMonth = 0; adminCalYear++; }
    renderAdminCal();
  }

  function renderAdminCal() {
    const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    document.getElementById('adminCalMonthLabel').textContent = `${adminCalYear}年 ${MONTHS[adminCalMonth]}`;
    const today    = new Date(); today.setHours(0,0,0,0);
    const firstDow = new Date(adminCalYear, adminCalMonth, 1).getDay();
    const lastDay  = new Date(adminCalYear, adminCalMonth + 1, 0).getDate();
    // シフトがある日を集める
    const shiftDates = new Set((window._adminAllShifts || []).map(s => s.date));
    let html = '';
    for (let i = 0; i < firstDow; i++) html += '<div class="cal-day empty"></div>';
    for (let d = 1; d <= lastDay; d++) {
      const dt      = new Date(adminCalYear, adminCalMonth, d);
      const dow     = dt.getDay();
      const dateStr = `${adminCalYear}-${String(adminCalMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = dt.getTime() === today.getTime();
      const hasSh   = shiftDates.has(dateStr);
      const isSel   = dateStr === adminCalSelectedDate;
      const colCls  = dow === 0 ? 'sun-col' : dow === 6 ? 'sat-col' : '';
      html += `<div class="cal-day ${colCls} ${isToday?'today':''} ${hasSh?'has-shift':''} ${isSel?'selected':''}"
        onclick="adminCalSelectDate('${dateStr}')">${d}</div>`;
    }
    document.getElementById('adminCalGrid').innerHTML = html;
  }

  function adminCalSelectDate(dateStr) {
    adminCalSelectedDate = adminCalSelectedDate === dateStr ? null : dateStr;
    // createShiftDateにも反映
    const inp = document.getElementById('createShiftDate');
    if (inp) inp.value = adminCalSelectedDate || '';
    renderAdminCal();
    renderAdminAllShiftList();
  }


  /* ===== シフト一覧タブ: フォーム開閉 ===== */
  function toggleAdminCreateForm() {
    const form  = document.getElementById('adminCreateForm');
    const label = document.getElementById('adminCreateFormBtnLabel');
    const open  = form.style.display === 'none';
    form.style.display = open ? 'block' : 'none';
    label.textContent  = open ? '✕ 閉じる' : 'シフトを作成する';
    // フォームを開いた際にスタッフドロップダウンが空なら補完
    if (open) populateCreateStaffDropdown();
  }


  /* ===== シフト一覧タブ: 全スタッフシフト取得・表示 ===== */
  async function loadAdminAllShifts() {
    document.getElementById('adminAllShiftList').innerHTML =
      '<div class="center-state"><div class="big-spinner"></div><p class="state-sub">読み込み中...</p></div>';
    try {
      const res = await fetch(`${API_BASE}/admin/shifts`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) throw new Error('API未実装');
      const data = await res.json();
      window._adminAllShifts = Array.isArray(data.shifts) ? data.shifts : [];
    } catch {
      // ダミーデータ
      window._adminAllShifts = [
        { id:1, name:'山田 太郎', email:'yamada@example.com', date:'2026-05-26', startTime:'09:00', endTime:'17:00', status:'scheduled' },
        { id:2, name:'佐藤 花子', email:'sato@example.com',   date:'2026-05-26', startTime:'13:00', endTime:'21:00', status:'pending'   },
        { id:3, name:'田中 次郎', email:'tanaka@example.com', date:'2026-05-27', startTime:'10:00', endTime:'18:00', status:'scheduled' },
        { id:4, name:'鈴木 あい', email:'suzuki@example.com', date:'2026-05-28', startTime:'09:00', endTime:'15:00', status:'scheduled' },
        { id:5, name:'山田 太郎', email:'yamada@example.com', date:'2026-05-29', startTime:'09:00', endTime:'17:00', status:'scheduled' },
      ];
    }
    // 日付・時間順にソート
    window._adminAllShifts.sort((a,b) =>
      (a.date+a.startTime).localeCompare(b.date+b.startTime));
    renderAdminCal();
    renderAdminAllShiftList();
  }

  function renderAdminAllShiftList() {
    const q   = (document.getElementById('adminAllShiftSearch')?.value || '').toLowerCase();
    const sel = adminCalSelectedDate;
    let list  = window._adminAllShifts || [];
    if (sel)  list = list.filter(s => s.date === sel);
    if (q)    list = list.filter(s => {
      // s.name / s.email が空の場合は allStaffList から名前解決して検索する
      const resolved = resolveStaffName(s);
      const name  = (s.name  || resolved.name  || '').toLowerCase();
      const email = (s.email || resolved.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });

    document.getElementById('adminAllShiftCount').textContent = `${list.length}件`;
    const el = document.getElementById('adminAllShiftList');
    if (list.length === 0) {
      el.innerHTML = '<div class="center-state" style="padding:30px 0"><p class="state-title">シフトがありません</p></div>';
      return;
    }
    const STATUS_LABEL = { scheduled:'確定', pending:'申請中', cancelled:'キャンセル', swapped:'交換済み' };
    const STATUS_CLASS = { scheduled:'s-scheduled', pending:'s-pending', cancelled:'s-cancelled', swapped:'s-swapped' };
    const WEEKDAYS = ['日','月','火','水','木','金','土'];
    el.innerHTML = list.map(s => {
      const dt      = new Date(s.date + 'T00:00:00');
      const wday    = WEEKDAYS[dt.getDay()];
      const resolved     = resolveStaffName(s);
      const displayName  = s.name  || resolved.name  || '';
      const displayEmail = s.email || resolved.email || '';
      const initial = (displayName || displayEmail || '?')[0].toUpperCase();
      const stCls   = STATUS_CLASS[s.status] || 's-scheduled';
      const stLabel = STATUS_LABEL[s.status] || '確定';
      const shiftId = s.shiftId || s.id || '';
      return `
        <div class="admin-shift-card ${stCls}">
          <div class="admin-card-top">
            <div class="admin-card-avatar">${initial}</div>
            <div class="admin-card-name">${displayName || displayEmail || '—'}<span>${displayEmail}</span></div>
            <span class="admin-status-badge">${stLabel}</span>
          </div>
          <div class="admin-card-bottom">
            <div class="admin-date-time">
              ${dt.getMonth()+1}/${dt.getDate()}(${wday})
              <span>${s.startTime} 〜 ${s.endTime}</span>
            </div>
          </div>
        </div>`;
    }).join('');
  }



  /* ===== シフト作成: スタッフ選択ドロップダウン同期 ===== */
  function onCreateStaffSelect(email) {
    const inp = document.getElementById('createStaffEmail');
    if (inp) inp.value = email;
  }

  function populateCreateStaffDropdown() {
    const sel = document.getElementById('createStaffSelect');
    if (!sel || !allStaffList.length) return;
    // 既存optionをリセット
    while (sel.options.length > 1) sel.remove(1);
    allStaffList.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.email;
      opt.textContent = `${u.name || '（名前未設定）'} <${u.email}>`;
      sel.appendChild(opt);
    });
  }


  /* ===== シフト削除（管理者用） ===== */
  async function deleteAdminShift(shiftId, btn) {
    if (!confirm('このシフトをキャンセルしますか？')) return;
    btn.disabled = true;
    try {
      // 正しいエンドポイント: POST /admin/shifts/{id}/{action}
      const res = await fetch(`${API_BASE}/admin/shifts/${shiftId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || `HTTP ${res.status}`);
      }
      showToast('シフトをキャンセルしました', 'success');
      [window._adminAllShifts, adminAllShifts].forEach(arr => {
        if (!arr) return;
        const s = arr.find(s => (s.shiftId || s.id) === shiftId);
        if (s) s.status = 'cancelled';
      });
      renderAdminCal();
      renderAdminAllShiftList();
      updateAdminStats();
      renderAdminList();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
    }
  }

  /* ===== シフト作成 ===== */
  async function submitCreateShift() {
    const email     = document.getElementById('createStaffEmail').value.trim();
    const date      = document.getElementById('createShiftDate').value;
    const startTime = document.getElementById('createStartTime').value;
    const endTime   = document.getElementById('createEndTime').value;
    if (!email)              { showToast('スタッフのメールアドレスを入力してください', 'error'); return; }
    if (!date)               { showToast('シフト日を選択してください', 'error'); return; }
    if (!startTime || !endTime) { showToast('時間帯を入力してください', 'error'); return; }
    const btn = document.getElementById('createShiftBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spin"></div> 登録中...';
    try {
      const res = await fetch(`${API_BASE}/admin/shifts`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, date, startTime, endTime,
          note: document.getElementById('createNote').value.trim() || null,
        }),
      });
      if (res.status === 401) { doLogout(); return; }
      if (res.status === 403) throw new Error('管理者権限が必要です');
      if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error(body.error || `エラー (${res.status})`); }
      showToast('シフトを確定しました ✓', 'success');
      document.getElementById('createStaffEmail').value = '';
      document.getElementById('createShiftDate').value  = '';
      document.getElementById('createNote').value       = '';
      document.getElementById('createStartTime').value  = '09:00';
      document.getElementById('createEndTime').value    = '17:00';
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> シフトを確定する';
    }
  }


