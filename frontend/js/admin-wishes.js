'use strict';
/* admin-wishes.js — admin.js から機能分割（自動生成）*/

  /* ===== 希望一覧 ===== */
  let allWishList = [];
  let wishListYear  = new Date().getFullYear();
  let wishListMonth = new Date().getMonth();

  function wishListPrevMonth() {
    wishListMonth--;
    if (wishListMonth < 0) { wishListMonth = 11; wishListYear--; }
    renderWishListScreen();
  }
  function wishListNextMonth() {
    wishListMonth++;
    if (wishListMonth > 11) { wishListMonth = 0; wishListYear++; }
    renderWishListScreen();
  }

  const DUMMY_WISHES = [
    {
      name: '山田 太郎', email: 'yamada@example.com',
      dates: ['2026-05-26','2026-05-27','2026-05-28'],
      startTime: '09:00', endTime: '17:00', note: '午前のみも可'
    },
    {
      name: '佐藤 花子', email: 'sato@example.com',
      dates: ['2026-05-25','2026-05-29','2026-05-30'],
      startTime: '13:00', endTime: '21:00', note: ''
    },
    {
      name: '田中 次郎', email: 'tanaka@example.com',
      dates: ['2026-05-26','2026-05-28'],
      startTime: '10:00', endTime: '18:00', note: '土日希望'
    },
    {
      name: '鈴木 あい', email: 'suzuki@example.com',
      dates: ['2026-05-27','2026-05-31'],
      startTime: '', endTime: '', note: '時間帯はお任せします'
    },
  ];

  async function renderWishListScreen() {
    const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    document.getElementById('wishListMonthLabel').textContent =
      `${wishListYear}年 ${MONTHS[wishListMonth]}`;
    const container = document.getElementById('wishListContainer');
    container.innerHTML = '<div class="center-state"><div class="big-spinner"></div><p class="state-sub">読み込み中...</p></div>';
    const ym = `${wishListYear}-${String(wishListMonth + 1).padStart(2,'0')}`;
    try {
      const res = await fetch(`${API_BASE}/admin/wishes?month=${ym}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.status === 401) { doLogout(); return; }
      if (res.status === 403) throw new Error('管理者権限が必要です');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // APIレスポンスのキー名を全パターン対応
      const raw = Array.isArray(data.wishes)   ? data.wishes
                : Array.isArray(data.requests) ? data.requests
                : Array.isArray(data.items)    ? data.items
                : Array.isArray(data)          ? data : [];

      // 各レコードのフィールド名を正規化
      // dates が配列でなく date（単一）で返ってくるケースにも対応
      allWishList = raw.map(w => {
        let dates = [];
        if (Array.isArray(w.preferredDates)) dates = w.preferredDates;
        else if (Array.isArray(w.dates))     dates = w.dates;
        else if (Array.isArray(w.wishDates)) dates = w.wishDates;
        else if (w.date)                    dates = [w.date];
        else if (w.wishDate)                dates = [w.wishDate];

        return {
          requestId: w.requestId || w.id || w.wishId || '',
          userId:    w.userId    || '',
          email:     w.email     || w.userEmail || '',
          name:      w.name      || w.userName  || w.displayName || '',
          dates,
          startTime: w.startTime || w.start || '',
          endTime:   w.endTime   || w.end   || '',
          note:      w.note      || w.memo  || w.comment || '',
        };
      });

      // スタッフ名をキャッシュから補完
      allWishList.forEach(w => {
        if (!w.name && w.email) {
          const hit = allStaffList.find(u => u.email === w.email || u.userId === w.userId);
          if (hit) w.name = hit.name || hit.displayName || '';
        }
      });

      renderWishList();
    } catch (err) {
      // APIが失敗した場合はlocalStorageのデータを使う
      const saved = JSON.parse(localStorage.getItem(WISH_KEY) || '[]');
      let local = saved.filter(w => w.dates && w.dates.some(d => d.startsWith(ym)));
      if (local.length === 0) local = saved;
      // localStorageデータも同じ正規化処理を適用
      allWishList = local.map(w => ({
        requestId: w.requestId || w.id || '',
        userId:    w.userId    || '',
        email:     w.email     || '',
        name:      w.name      || w.email || '',
        dates:     Array.isArray(w.dates) ? w.dates : (w.date ? [w.date] : []),
        startTime: w.startTime || '',
        endTime:   w.endTime   || '',
        note:      w.note      || '',
      }));
      if (allWishList.length === 0) {
        container.innerHTML = `<div class="center-state" style="padding:40px 0">
          <p class="state-title">希望提出がありません</p>
          <p class="state-sub" style="font-size:11px;margin-top:4px;color:var(--red)">${err.message}</p>
        </div>`;
        return;
      }
      renderWishList();
    }
  }

  /* 別タブでスタッフが希望提出したら管理者側に即反映 */
  window.addEventListener('storage', e => {
    if (e.key === WISH_KEY) {
      if (document.getElementById('adminWishesPanel')?.style.display !== 'none') {
        renderWishListScreen();
      }
    }
  });

  // 選択中の希望を管理
  let selectedWish = null; // { wishIndex, dateIndex, email, name, date, startTime, endTime, note, requestId }

  function renderWishList() {
    const q = (document.getElementById('wishListSearch').value || '').toLowerCase();
    const src = q
      ? allWishList.filter(w =>
          (w.email || '').toLowerCase().includes(q) ||
          (w.name  || '').toLowerCase().includes(q))
      : allWishList;

    const container = document.getElementById('wishListContainer');

    // 日付ごとに1件ずつ展開してフラット化
    const flat = [];
    src.forEach((w, wi) => {
      const dates = (w.dates || []).length > 0 ? w.dates : [''];
      dates.forEach((d, di) => {
        flat.push({ w, wi, di, date: d });
      });
    });

    // 日付昇順ソート（未設定は末尾）
    flat.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    });

    if (flat.length === 0) {
      container.innerHTML = '<div class="center-state" style="padding:40px 0"><p class="state-title">希望提出がありません</p></div>';
      selectedWish = null;
      renderWishActionBar();
      return;
    }

    container.innerHTML = flat.map((item, fi) => {
      const { w, wi, di, date } = item;
      const initial    = (w.name || w.email || '?')[0].toUpperCase();
      const isSelected = selectedWish && selectedWish.fi === fi;

      let dateLabel = '日付未設定';
      if (date) {
        const dt = new Date(date + 'T00:00:00');
        dateLabel = `${dt.getMonth()+1}月${dt.getDate()}日（${WEEKDAYS[dt.getDay()]}）`;
      }
      const timeStr = (w.startTime && w.endTime)
        ? `${w.startTime} 〜 ${w.endTime}` : '時間未定';

      return `
        <div onclick="selectWishCard(${fi},${wi},${di},'${date}')" style="
          background:${isSelected ? 'var(--primary-light)' : '#fff'};
          border:2px solid ${isSelected ? 'var(--primary)' : 'var(--border)'};
          border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer;
          transition:all .15s;
          box-shadow:${isSelected ? '0 2px 12px rgba(79,70,229,.15)' : '0 1px 4px rgba(0,0,0,.04)'}">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="
              width:38px;height:38px;border-radius:50%;flex-shrink:0;
              background:${isSelected ? 'var(--primary)' : '#EEF2FF'};
              display:flex;align-items:center;justify-content:center;
              font-size:15px;font-weight:800;
              color:${isSelected ? '#fff' : 'var(--primary)'}">
              ${initial}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:700;color:var(--text)">${escHtml(w.name || '—')}</div>
              <div style="font-size:11px;color:var(--muted)">${escHtml(w.email || '')}</div>
            </div>
            ${isSelected
              ? '<span style="font-size:16px;color:var(--primary);font-weight:800">✓</span>'
              : '<span style="font-size:20px;color:var(--border)">›</span>'}
          </div>
          <div style="margin-top:8px;padding-left:48px;display:flex;flex-direction:column;gap:2px">
            <div style="font-size:13px;font-weight:700;color:${isSelected ? 'var(--primary)' : 'var(--text)'}">
              ${dateLabel}
            </div>
            <div style="font-size:12px;color:var(--muted)">${timeStr}</div>
            ${w.note ? `<div style="font-size:12px;color:var(--muted)">「${escHtml(w.note)}」</div>` : ''}
          </div>
        </div>`;
    }).join('');

    renderWishActionBar();
  }

  function selectWishCard(fi, wi, di, date) {
    const w = allWishList[wi];
    if (!w) return;
    // 同じカードを再タップで解除
    if (selectedWish && selectedWish.fi === fi) {
      selectedWish = null;
      renderWishList();
      return;
    }
    selectedWish = {
      fi, wi, di,
      email:     w.email     || w.userId || '',
      name:      w.name      || '',
      date,
      startTime: w.startTime || '09:00',
      endTime:   w.endTime   || '17:00',
      note:      w.note      || '',
      requestId: w.requestId || w.id || '',
    };
    renderWishList();
  }

  function selectWishDay(wi, date) {
    if (!selectedWish || selectedWish.wi !== wi) return;
    selectedWish.date = date;
    renderWishList();
  }

  /* 選択中の希望に対するアクションバー */
  function renderWishActionBar() {
    let bar = document.getElementById('wishActionBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'wishActionBar';
      bar.style.cssText = `
        position:sticky;bottom:68px;left:0;right:0;
        background:#fff;border-top:1px solid var(--border);
        padding:12px 16px;display:flex;gap:10px;align-items:center;
        box-shadow:0 -4px 16px rgba(0,0,0,.08);z-index:50;
      `;
      document.getElementById('adminWishesPanel').appendChild(bar);
    }
    if (!selectedWish) {
      bar.style.display = 'none';
      return;
    }
    const { name, email, date, startTime, endTime } = selectedWish;
    let dateLabel = '日付未設定';
    if (date) {
      const dt = new Date(date + 'T00:00:00');
      dateLabel = `${dt.getMonth()+1}/${dt.getDate()}(${WEEKDAYS[dt.getDay()]})`;
    }
    bar.style.display = 'flex';
    bar.innerHTML = `
      <div style="flex:1;min-width:0">
        <div style="font-size:11px;color:var(--muted);margin-bottom:1px">選択中</div>
        <div style="font-size:13px;font-weight:700;color:var(--text);
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${name || email}　${dateLabel}　${startTime}〜${endTime}
        </div>
      </div>
      <button onclick="deleteWish()" style="
        flex-shrink:0;padding:10px 14px;
        background:var(--red-light);border:1.5px solid var(--red);
        border-radius:10px;font-size:12px;font-weight:700;color:var(--red);cursor:pointer">
        削除
      </button>
      <button id="wishConfirmBtn" onclick="confirmWishDirect()" style="
        flex-shrink:0;padding:10px 18px;
        background:var(--green);border:none;
        border-radius:10px;font-size:12px;font-weight:700;color:#fff;cursor:pointer;
        box-shadow:0 3px 10px rgba(16,185,129,.3)">
        ✓ 確定
      </button>`;
  }

  /* 確定ボタン即実行（モーダルなし）
   * selectedWish の日時をそのままAPIに送る */
  async function confirmWishDirect() {
    if (!selectedWish) return;
    const { wi, email, name, date, startTime, endTime, note, requestId } = selectedWish;
    if (!date)      { showToast('希望日が設定されていません', 'error'); return; }
    if (!startTime || !endTime) { showToast('希望時間が設定されていません', 'error'); return; }

    const btn = document.getElementById('wishConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = '登録中...'; }

    try {
      const res = await fetch(`${API_BASE}/admin/shifts`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, date, startTime, endTime, note: note || null, status: 'scheduled' }),
      });
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || b.message || `エラー (${res.status})`);
      }
      const created = await res.json().catch(() => ({}));

      // 管理者シフトキャッシュに追加
      const staffCache = allStaffList.find(u => u.email === email);
      adminAllShifts.push({
        shiftId:   created.shiftId || created.id || `local_${Date.now()}`,
        userId:    staffCache?.userId || staffCache?.id || '',
        email, name: staffCache?.name || name || '',
        date, startTime, endTime,
        status: 'scheduled',
        note: note || null,
      });
      adminAllShifts.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

      // 希望一覧から確定した日を削除
      removeWishDate(wi, date);
      selectedWish = null;

      showToast(`✓ ${name || email} ${date} のシフトを確定しました`, 'success');
      renderWishList();
      renderAdminList();
      updateAdminStats();

    } catch (err) {
      showToast(err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✓ 確定'; }
    }
  }

  /* 希望一覧から指定日を削除する共通処理 */
  function removeWishDate(wi, date) {
    const wish = allWishList[wi];
    if (!wish) return;
    wish.dates = (wish.dates || []).filter(d => d !== date);
    if (wish.dates.length === 0) allWishList.splice(wi, 1);
  }

  async function deleteWish() {
    if (!selectedWish) return;
    const { wi, date, requestId } = selectedWish;
    if (!confirm(`${selectedWish.name || selectedWish.email} の ${date || '希望'} を削除しますか？`)) return;
    if (requestId) {
      try {
        await fetch(`${API_BASE}/admin/wishes/${requestId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${idToken}` },
        });
      } catch {}
    }
    removeWishDate(wi, date);
    selectedWish = null;
    showToast('希望を削除しました', 'success');
    renderWishList();
    updateAdminStats();
  }


