'use strict';
/* core.js — index.html から機能分割（自動生成）*/

  /* ===== 設定 ===== */
  const COGNITO_URL   = 'https://cognito-idp.ap-northeast-1.amazonaws.com/';
  const CLIENT_ID     = '4c506lmmhb9eh8hg0h5oesj11u';
  const API_BASE      = 'https://xcum14jnu2.execute-api.ap-northeast-1.amazonaws.com/v1';

  const WEEKDAYS = ['日','月','火','水','木','金','土'];
  const STATUS_LABEL = { scheduled:'確定', cancelled:'キャンセル', swapped:'交換済み' };


  /* ===== HTMLエスケープ（XSS対策）: ユーザー入力をinnerHTMLに入れる前に必ず通す ===== */
  const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));


  /* ===== 状態 ===== */
  let idToken   = localStorage.getItem('idToken');
  let userEmail = localStorage.getItem('userEmail') || '';
  let userName  = localStorage.getItem('userName')  || '';


  /* ===== JWTペイロードのデコード ===== */
  function decodeJwtPayload(token) {
    try {
      return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    } catch { return {}; }
  }


  /* ===== 画面切り替え ===== */
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }


  /* ===== 補助関数 ===== */
  function calcDuration(start, end) {
    if (!start || !end) return '';
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) return '';
    const h = Math.floor(mins / 60), m = mins % 60;
    return m ? `${h}時間${m}分` : `${h}時間`;
  }

  function parseDateParts(dateStr) {
    // "2025-06-15" → { month, day, weekdayIndex }
    const d = new Date(dateStr + 'T00:00:00');
    return {
      month: d.getMonth() + 1,
      day:   d.getDate(),
      wi:    d.getDay(),   // 0=日 6=土
    };
  }

  function shiftCardHTML(shift) {
    const { month, day, wi } = parseDateParts(shift.date);
    const wd = WEEKDAYS[wi];
    const isWeekend = wi === 0 ? 'sun' : wi === 6 ? 'sat' : '';
    const status = shift.status || 'scheduled';
    const label  = STATUS_LABEL[status] || status;
    const dur    = calcDuration(shift.startTime, shift.endTime);

    return `
      <div class="shift-card s-${status}">
        <div class="shift-date-col">
          <div class="s-day ${isWeekend}">${month}/${day}</div>
          <div class="s-weekday ${isWeekend}">(${wd})</div>

        </div>
        <div class="v-divider"></div>
        <div class="shift-info">
          <div class="s-time">
            ${shift.startTime || '--:--'}
            <span class="s-arrow">→</span>
            ${shift.endTime   || '--:--'}
          </div>
          ${dur ? `<div class="s-duration">${dur}</div>` : ''}
        </div>
        <div class="s-badge">${label}</div>
      </div>`;
  }


  /* ========================================================
     ① ボトムナビ・タブ切り替え
  ======================================================== */
  function switchTab(tab) {
    if (tab === 'shifts') {
      renderShiftsScreen();
    } else if (tab === 'wish') {
      showScreen('wishScreen');
      renderWishCalendar();
    } else if (tab === 'swap') {
      showScreen('swapScreen');
      renderSwapShiftPicker();
      loadIncomingSwapList();
    } else if (tab === 'talk') {
      showScreen('talkScreen');
      renderTalkList();
    } else if (tab === 'shiftConfirm') {
      showScreen('shiftConfirmScreen');
      weekStart = new Date(); weekStart.setHours(0, 0, 0, 0);
      renderWeekView();
    } else if (tab === 'admin') {
      showScreen('adminScreen');
      renderAdminScreen();
    }
  }


  /* ===== 名前解決ヘルパー =====
   * ShiftsTable は userId を持つ。UsersTable も userId がキー。
   * GET /staff レスポンスの各ユーザーオブジェクトから name を引く。
   * userId / email / sub など複数フィールドで突き合わせる。
  ============================= */
  function resolveStaffName(shiftOrId) {
    // 引数がオブジェクト(shift)の場合は userId / email を取り出す
    const userId = typeof shiftOrId === 'object'
      ? (shiftOrId.userId || shiftOrId.sub || shiftOrId.id || '')
      : shiftOrId;
    const email  = typeof shiftOrId === 'object' ? (shiftOrId.email || '') : '';

    const hit = allStaffList.find(u =>
      (userId && (u.userId === userId || u.sub === userId || u.id === userId)) ||
      (email  && u.email === email)
    );
    if (!hit) return { name: '', email };
    return {
      name:  hit.name || hit.displayName || hit.preferred_username || '',
      email: hit.email || email,
    };
  }


  /* ========================================================
     ② トースト
  ======================================================== */
  function showToast(msg, type = '') {
    const t = document.getElementById('globalToast');
    t.textContent = msg;
    t.className = `toast ${type} show`;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 3000);
  }


  /* ========================================================
     ③ モーダル
  ======================================================== */
  function closeModal(id) {
    document.getElementById(id).classList.remove('show');
  }
  // オーバーレイクリックで閉じる
  document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if (e.target === el) el.classList.remove('show'); });
  });

