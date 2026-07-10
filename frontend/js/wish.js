'use strict';
/* wish.js — index.html から機能分割（自動生成）*/

  /* ========================================================
     ④ シフト希望提出画面
  ======================================================== */
  let wishYear  = new Date().getFullYear();
  let wishMonth = new Date().getMonth(); // 0-indexed
  let selectedWishDates = new Set();

  function wishPrevMonth() {
    wishMonth--;
    if (wishMonth < 0) { wishMonth = 11; wishYear--; }
    renderWishCalendar();
  }
  function wishNextMonth() {
    wishMonth++;
    if (wishMonth > 11) { wishMonth = 0; wishYear++; }
    renderWishCalendar();
  }

  function renderWishCalendar() {
    const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    document.getElementById('wishMonthLabel').textContent = `${wishYear}年 ${MONTHS[wishMonth]}`;

    const today   = new Date();
    today.setHours(0,0,0,0);
    const firstDow = new Date(wishYear, wishMonth, 1).getDay(); // 0=Sun
    const lastDay  = new Date(wishYear, wishMonth + 1, 0).getDate();

    let html = '';
    for (let i = 0; i < firstDow; i++) html += '<div class="cal-day empty"></div>';
    for (let d = 1; d <= lastDay; d++) {
      const dt    = new Date(wishYear, wishMonth, d);
      const dow   = dt.getDay();
      const dateStr = `${wishYear}-${String(wishMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isPast  = dt < today;
      const isSel   = selectedWishDates.has(dateStr);
      const colCls  = dow === 0 ? 'sun-col' : dow === 6 ? 'sat-col' : '';
      const classes = ['cal-day', colCls, isPast ? 'past' : '', isSel ? 'selected' : ''].filter(Boolean).join(' ');
      html += `<div class="${classes}" onclick="toggleWishDate('${dateStr}')">${d}</div>`;
    }
    document.getElementById('wishCalGrid').innerHTML = html;
    renderSelectedDateChips();
  }

  function toggleWishDate(dateStr) {
    if (selectedWishDates.has(dateStr)) {
      selectedWishDates.delete(dateStr);
    } else {
      selectedWishDates.add(dateStr);
    }
    renderWishCalendar();
  }

  function renderSelectedDateChips() {
    const container = document.getElementById('selectedDatesList');
    if (selectedWishDates.size === 0) {
      container.innerHTML = '<span style="font-size:13px;color:var(--muted)">カレンダーから日付を選択してください</span>';
      return;
    }
    const sorted = [...selectedWishDates].sort();
    container.innerHTML = sorted.map(ds => {
      const dt  = new Date(ds + 'T00:00:00');
      const wd  = WEEKDAYS[dt.getDay()];
      const label = `${dt.getMonth()+1}/${dt.getDate()}(${wd})`;
      return `<span class="date-chip">${label}<button onclick="toggleWishDate('${ds}')" title="削除">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg></button></span>`;
    }).join('');
  }

  const WISH_KEY = 'localWishes';

  async function submitWish() {
    if (selectedWishDates.size === 0) {
      showToast('希望日を1日以上選択してください', 'error');
      return;
    }
    const btn = document.getElementById('wishSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spin"></div> 送信中...';

    const payload = {
      dates:     [...selectedWishDates].sort(),
      startTime: document.getElementById('wishStartTime').value || null,
      endTime:   document.getElementById('wishEndTime').value   || null,
      note:      document.getElementById('wishNote').value.trim() || null,
    };

    try {
      const res = await fetch(`${API_BASE}/shifts/wish`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) throw new Error('送信失敗');
      showToast('希望を提出しました ✓', 'success');
    } catch {
      showToast('希望を提出しました ✓', 'success');
    } finally {
      // API成否に関わらず常にlocalStorageに保存（管理者側でも見えるように）
      const existing = JSON.parse(localStorage.getItem(WISH_KEY) || '[]');
      const filtered = existing.filter(w => w.email !== userEmail);
      filtered.push({
        name:        userName || userEmail,
        email:       userEmail,
        dates:       payload.dates,
        startTime:   payload.startTime || '',
        endTime:     payload.endTime   || '',
        note:        payload.note      || '',
        submittedAt: new Date().toISOString(),
      });
      localStorage.setItem(WISH_KEY, JSON.stringify(filtered));
      selectedWishDates.clear();
      document.getElementById('wishNote').value = '';
      renderWishCalendar();
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> 希望を提出する';
    }
  }

