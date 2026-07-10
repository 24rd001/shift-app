'use strict';
/* swap.js — index.html から機能分割（自動生成）*/

  /* ===== スタッフ：自分宛の交代申請一覧 ===== */
  async function loadIncomingSwapList() {
    const el = document.getElementById('incomingSwapList');
    if (!el) return;
    el.innerHTML = '<div class="center-state" style="padding:16px 0"><div class="big-spinner"></div></div>';
    try {
      const res = await fetch(`${API_BASE}/swap-requests/me`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) throw new Error(`エラー (${res.status})`);
      const data = await res.json();
      // APIは "shifts" キーで返す
      const list = Array.isArray(data.swaps) ? data.swaps : [];
      renderIncomingSwapList(list);
    } catch (err) {
      el.innerHTML = `<p style="font-size:12px;color:var(--red);text-align:center;padding:12px 0">${err.message}</p>`;
    }
  }

  function renderIncomingSwapList(list) {
    const el = document.getElementById('incomingSwapList');
    const pending = list.filter(r => {
      // ステータスフィルター
      if (r.status !== 'pending' && r.status !== 'swap_requested' && r.status !== 'scheduled') return false;
      // 自分が申請者（requester）のものは除外
      // APIが返すフィールド名が揺れる可能性があるため複数チェック
      const requesterEmail = r.requesterEmail || r.fromEmail || r.senderEmail || '';
      if (requesterEmail && requesterEmail === userEmail) return false;
      const requesterId = r.requesterId || r.userId || r.fromUserId || '';
      if (requesterId && requesterId === userEmail) return false;
      return true;
    });
    if (pending.length === 0) {
      el.innerHTML = '<p style="font-size:13px;color:var(--muted);text-align:center;padding:12px 0">自分宛の申請はありません</p>';
      return;
    }
    el.innerHTML = pending.map((r, i) => {
      const dateStr   = r.date || r.shiftDate || '';
      const dt        = new Date(dateStr + 'T00:00:00');
      const dateLabel = dateStr
        ? `${dt.getMonth()+1}/${dt.getDate()}(${['日','月','火','水','木','金','土'][dt.getDay()]})`
        : '—';
      const name    = r.userName || r.requesterName || r.requesterEmail || '—';
      const initial = name[0].toUpperCase();
      const swapId  = r.swapId || r.shiftId;
      return `
        <div class="swap-history-item" style="padding:12px 0" id="swapItem-${i}">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <div class="staff-avatar" style="width:34px;height:34px;font-size:13px">${escHtml(initial)}</div>
            <div>
              <div class="swap-history-name">${escHtml(name)}</div>
              <div class="swap-history-reason">${dateLabel}　${r.startTime||''}〜${r.endTime||''}</div>
              ${r.note   ? `<div class="swap-history-reason" style="margin-top:2px">「${escHtml(r.note)}」</div>`   : ''}
              ${r.reason ? `<div class="swap-history-reason" style="margin-top:2px">「${escHtml(r.reason)}」</div>` : ''}
            </div>
          </div>

          <div class="swap-3btn-row">
            <button class="swap-reply-btn green" onclick="respondSwap3('${swapId}', 'accept', ${i}, this)">
              ○ 代われる
            </button>
            <button class="swap-reply-btn pink" onclick="respondSwap3('${swapId}', 'reject', ${i}, this)">
              ✕ 無理
            </button>
            <button class="swap-reply-btn yellow" onclick="showConsultInput(${i})">
              💬 相談する
            </button>
          </div>

          <!-- 相談コメント入力欄（初期非表示） -->
          <div class="consult-input-wrap" id="consultWrap-${i}">
            <textarea id="consultText-${i}" rows="2" placeholder="コメントを入力…"></textarea>
            <button class="consult-send-btn" onclick="respondSwap3('${swapId}', 'consult', ${i}, this)">
              💬 コメントを送る
            </button>
          </div>
        </div>`;
    }).join('');
  }

  function showConsultInput(idx) {
    const wrap = document.getElementById(`consultWrap-${idx}`);
    if (!wrap) return;
    wrap.classList.toggle('show');
  }

  async function respondSwap3(swapId, type, idx, btn) {
    const labelMap = { accept:'代われる', reject:'無理', consult:'相談する' };
    const label    = labelMap[type] || type;
    const comment  = type === 'consult'
      ? (document.getElementById(`consultText-${idx}`)?.value.trim() || '')
      : '';
    if (type === 'consult' && !comment) {
      showToast('コメントを入力してください', 'error'); return;
    }
    if (!confirm(`「${label}」で回答しますか？`)) return;
    btn.disabled = true;

    try {
      const accept = type === 'accept' ? true : type === 'reject' ? false : null;
      const body   = accept !== null
        ? { accept }
        : { accept: null, comment };

      const res = await fetch(`${API_BASE}/swap-requests/${swapId}/respond`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) throw new Error(`エラー (${res.status})`);
      showToast(
        type === 'accept' ? '✓ 代われると回答しました' :
        type === 'reject' ? '断りました' :
        '💬 相談コメントを送りました', 'success'
      );
      // 回答済みの項目をグレーアウト
      const item = document.getElementById(`swapItem-${idx}`);
      if (item) {
        item.style.opacity = '0.5';
        item.querySelectorAll('button').forEach(b => b.disabled = true);
      }
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
    }
  }


  /* ===== 管理者：交代申請一覧 ===== */
  let allAdminSwaps  = [];
  let adminSwapFilter = 'all';

  async function loadAdminSwapList() {
    const el = document.getElementById('adminSwapList');
    el.innerHTML = '<div class="center-state"><div class="big-spinner"></div></div>';
    // 名前解決のためスタッフ一覧が未取得なら先に取得
    if (allStaffList.length === 0) {
      try {
        const sr = await fetch(`${API_BASE}/staff`, { headers: { Authorization: `Bearer ${idToken}` } });
        if (sr.ok) {
          const sd = await sr.json();
          allStaffList = Array.isArray(sd.staff) ? sd.staff : Array.isArray(sd.users) ? sd.users : [];
        }
      } catch {}
    }
    try {
      const res = await fetch(`${API_BASE}/admin/swap-requests`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) throw new Error(`エラー (${res.status})`);
      const data = await res.json();
      allAdminSwaps = Array.isArray(data.swaps)    ? data.swaps
                   : Array.isArray(data.requests)  ? data.requests
                   : [];
      // デバッグ：実際のAPIレスポンス構造をコンソールに出力
      if (allAdminSwaps.length > 0) {
        console.log('[swap-requests] sample record:', JSON.stringify(allAdminSwaps[0], null, 2));
        const sample = allAdminSwaps[0];
        if (sample.responses && sample.responses.length > 0) {
          console.log('[swap-requests] sample response keys:', Object.keys(sample.responses[0]));
        }
      }
      updateAdminSwapBadge();
      renderAdminSwapList();
    } catch (err) {
      el.innerHTML = `<p style="font-size:13px;color:var(--red);text-align:center;padding:16px 0">${err.message}</p>`;
    }
  }

  function updateAdminSwapBadge() {
    // 交代確認待ち = 管理者がまだ確定/拒否していない全申請（pending + responded）
    const waitingCount = allAdminSwaps.filter(r =>
      r.status === 'pending' || r.status === 'responded'
    ).length;
    const badge = document.getElementById('adminSwapBadge');
    const statEl = document.getElementById('statSwapPending');
    if (badge) {
      if (waitingCount > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = waitingCount;
      } else {
        badge.style.display = 'none';
      }
    }
    if (statEl) statEl.textContent = waitingCount;
  }

  function filterAdminSwap(filter, btn) {
    adminSwapFilter = filter;
    document.querySelectorAll('#adminSwapPanel .filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderAdminSwapList();
  }

  function renderAdminSwapList() {
    const el = document.getElementById('adminSwapList');
    // ステータス表示ラベル
    const STATUS_LABEL = {
      pending:   '承認待ち',
      responded: '承認待ち',  // respondedも管理者未確定なので「承認待ち」に統一
      approved:  '承認済み',
      rejected:  '却下',
    };
    const STATUS_COLOR = {
      pending:   'color:var(--yellow);background:var(--yellow-light)',
      responded: 'color:var(--yellow);background:var(--yellow-light)',
      approved:  'color:#065F46;background:var(--green-light)',
      rejected:  'color:var(--red);background:var(--red-light)',
    };

    // フィルタリング
    // 「承認待ち」= pending / responded（管理者がまだ確定していない）
    // 「承認済み」= approved
    // 「却下」    = rejected
    // 「すべて」  = 全件
    let list = allAdminSwaps;
    if (adminSwapFilter === 'pending') {
      list = list.filter(r => r.status === 'pending' || r.status === 'responded');
    } else if (adminSwapFilter === 'approved') {
      list = list.filter(r => r.status === 'approved');
    } else if (adminSwapFilter === 'rejected') {
      list = list.filter(r => r.status === 'rejected');
    }
    // 'all' はそのまま全件

    if (list.length === 0) {
      el.innerHTML = '<p style="font-size:13px;color:var(--muted);text-align:center;padding:20px 0">申請はありません</p>';
      return;
    }
    const WEEKDAYS = ['日','月','火','水','木','金','土'];
    el.innerHTML = list.map(r => {
      const swapId    = r.swapId || r.id || r.requestId || r.swap_id || r.swapRequestId || '';
      const dateStr   = r.date || r.shiftDate || '';
      const dt        = new Date(dateStr + 'T00:00:00');
      const dateLabel = dateStr ? `${dt.getMonth()+1}/${dt.getDate()}(${WEEKDAYS[dt.getDay()]})` : '—';
      const stLabel   = STATUS_LABEL[r.status] || r.status;
      const stStyle   = STATUS_COLOR[r.status] || '';

      // 「代われる」回答者を取得
      const acceptedRes = (r.responses || []).filter(res => res.accept === true);
      const consultRes  = (r.responses || []).filter(res => res.accept === null && res.comment);
      // 管理者がまだ確定/拒否していない = pending or responded
      const canDecide   = r.status === 'pending' || r.status === 'responded';

      // 名前解決ヘルパー
      function resolveName(name, emailOrId) {
        if (name && !/^[0-9a-f-]{32,}$/i.test(name)) return name;
        const hit = allStaffList.find(u =>
          emailOrId && (u.userId === emailOrId || u.sub === emailOrId || u.id === emailOrId || u.email === emailOrId)
        );
        return hit ? (hit.name || hit.displayName || hit.email || emailOrId || '—')
                   : (emailOrId && !/^[0-9a-f-]{32,}$/i.test(emailOrId) ? emailOrId : '—');
      }
      const resolveResName = res => {
        if (res.userName && !/^[0-9a-f-]{32,}$/i.test(res.userName)) return res.userName;
        const key = res.userEmail || res.userId || '';
        const hit = allStaffList.find(u =>
          key && (u.userId === key || u.sub === key || u.id === key || u.email === key)
        );
        return hit ? (hit.name || hit.email || key) : (key && !/^[0-9a-f-]{32,}$/i.test(key) ? key : 'スタッフ');
      };

      const requesterLabel  = resolveName(r.requesterName, r.requesterEmail || r.requesterId);
      const targetLabel     = resolveName(r.targetName,    r.targetEmail    || r.targetId);
      const acceptedNames   = acceptedRes.map(resolveResName).filter(Boolean).join('、');

      const consultBlock = consultRes.length > 0 ? `
        <div style="margin-top:8px;padding:8px 10px;background:#FEF3C7;border-radius:8px;border:1px solid #FCD34D">
          <div style="font-size:11px;font-weight:700;color:#92400E;margin-bottom:4px">💬 相談コメント</div>
          ${consultRes.map(res => `
            <div style="font-size:11px;color:var(--text);padding:4px 0;border-bottom:1px solid #FDE68A">
              <span style="font-weight:700">${escHtml(resolveResName(res))}</span>：${escHtml(res.comment || '')}
            </div>`).join('')}
        </div>` : '';

      return `
        <div style="padding:14px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:13px;font-weight:700;color:var(--text)">
              ${escHtml(requesterLabel)}<span style="color:var(--muted);font-weight:400"> → </span>${escHtml(targetLabel)}
            </div>
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;${stStyle}">${stLabel}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:4px">${dateLabel}　${r.startTime||''}〜${r.endTime||''}</div>
          ${r.reason ? `<div style="font-size:12px;color:var(--muted)">「${escHtml(r.reason)}」</div>` : ''}
          ${consultBlock}
          ${canDecide && acceptedRes.length > 0 ? `
            <div style="margin-top:10px;padding:10px;background:var(--primary-light);border-radius:10px;border:1px solid var(--primary)">
              <div style="font-size:12px;font-weight:700;color:var(--primary);margin-bottom:4px">
                ✓ ${acceptedNames} が「代われる」と回答しました
              </div>
              <div style="font-size:11px;color:var(--text);margin-bottom:10px">
                ${requesterLabel} → ${acceptedNames} への交代を確定しますか？
              </div>
              <div style="display:flex;gap:8px">
                <button class="act-btn approve" style="flex:2" onclick="decideSwap('${swapId}',true,this)">✓ 確定する</button>
                <button class="act-btn reject"  style="flex:1" onclick="decideSwap('${swapId}',false,this)">✕ 拒否</button>
              </div>
            </div>` : canDecide ? `
            <div style="margin-top:8px;padding:8px 10px;background:var(--yellow-light);border-radius:8px;font-size:12px;color:#92400E">
              ⏳ スタッフの回答待ちです
            </div>` : ''}
          ${r.status === 'approved' ? `<div style="margin-top:8px;font-size:11px;color:#065F46;font-weight:700">✓ 交代が確定しました</div>` : ''}
          ${r.status === 'rejected' ? `<div style="margin-top:8px;font-size:11px;color:var(--red);font-weight:700">✕ 申請が拒否されました</div>` : ''}
        </div>`;
    }).join('');
  }

  async function decideSwap(swapId, approve, btn) {
    const label = approve ? '確定' : '拒否';
    if (!swapId || swapId === 'undefined' || swapId === 'null') {
      showToast('申請IDが取得できません。画面を再読み込みしてください。', 'error');
      return;
    }
    if (!confirm(`この交代申請を「${label}」しますか？`)) return;
    btn.disabled = true;
    try {
      const res = await fetch(`${API_BASE}/swap-requests/${swapId}/approve`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        // 拒否の場合: reject:true のみ送信（approve:false との混在でバックエンドが誤判定するのを防ぐ）
        // 承認の場合: approve:true のみ送信
        body: JSON.stringify(approve
          ? { approve: true }
          : { reject: true }
        ),
      });
      // レスポンスボディをログ出力（デバッグ用）
      const resBody = await res.json().catch(() => ({}));
      console.log('[decideSwap] status:', res.status, 'body:', JSON.stringify(resBody));
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) {
        throw new Error(resBody.error || resBody.message || `エラー (${res.status})`);
      }
      // ローカルキャッシュを即時更新（再取得前に画面に反映）
      const hit = allAdminSwaps.find(r => (r.swapId || r.id || r.requestId) === swapId);
      if (hit) hit.status = approve ? 'approved' : 'rejected';

      showToast(approve ? '✓ 交代を確定しました' : '✕ 申請を拒否しました', approve ? 'success' : 'error');
      loadAdminSwapList();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
    }
  }

  async function approveSwap(swapId, btn) {
    await decideSwap(swapId, true, btn);
  }


  /* ========================================================
     ⑤ シフト交代申請画面
  ======================================================== */
  let myShiftsCache = [];
  let selectedSwapShiftId = null;

  async function renderSwapShiftPicker() {
    const picker = document.getElementById('swapShiftPicker');
    picker.innerHTML = '<div class="center-state" style="padding:30px 0"><div class="big-spinner"></div><p class="state-sub">読み込み中...</p></div>';

    try {
      if (myShiftsCache.length === 0) myShiftsCache = await fetchMyShifts();

      const today = new Date().toISOString().slice(0, 10);
      const upcoming = myShiftsCache
        .filter(s => (s.date || '') >= today && s.status === 'scheduled')
        .sort((a, b) => (a.date||'').localeCompare(b.date||''));

      if (upcoming.length === 0) {
        picker.innerHTML = '<p style="font-size:13px;color:var(--muted);text-align:center;padding:20px 0">交代申請できる予定シフトがありません</p>';
        return;
      }

      picker.innerHTML = upcoming.map(s => {
        const { month, day, wi } = parseDateParts(s.date);
        const wd  = WEEKDAYS[wi];
        const dur = calcDuration(s.startTime, s.endTime);
        const sel = s.shiftId === selectedSwapShiftId ? 'selected' : '';
        return `
          <div class="swap-shift-item ${sel}" onclick="selectSwapShift('${s.shiftId}')">
            <div class="s-date-mini">
              <div class="sw-day">${month}/${day}</div>
              <div class="sw-wd">(${wd})</div>
            </div>
            <div class="swap-divider-v"></div>
            <div class="swap-shift-meta">
              <div class="meta-time">${s.startTime || '--:--'} → ${s.endTime || '--:--'}</div>
              ${dur ? `<div class="meta-dur">${dur}</div>` : ''}
            </div>
            <div class="swap-check">
              ${sel ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </div>
          </div>`;
      }).join('');

      // スタッフ一覧も同時に取得
      fetchSwapStaffList();
    } catch (err) {
      picker.innerHTML = `<p style="font-size:13px;color:var(--red);text-align:center;padding:20px 0">${err.message}</p>`;
    }

  }

  

  function selectSwapShift(shiftId) {
    selectedSwapShiftId = shiftId;
    renderSwapShiftPicker();
  }

  let selectedSwapStaffEmail = null;

  async function fetchSwapStaffList() {
    const listEl = document.getElementById('swapStaffList');
    try {
      const res = await fetch(`${API_BASE}/staff`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) throw new Error(`エラー (${res.status})`);
      const data = await res.json();
      let staffList = Array.isArray(data.staff) ? data.staff
                    : Array.isArray(data.users) ? data.users
                    : [];
      // 自分自身を除外
      staffList = staffList.filter(s => s.email !== userEmail);
      if (staffList.length === 0) {
        listEl.innerHTML = '<p style="font-size:13px;color:var(--muted);text-align:center;padding:16px 0">スタッフが見つかりません</p>';
        return;
      }
      listEl.innerHTML = staffList.map(s => {
        const initial = (s.name || s.email || '?')[0].toUpperCase();
        const isSel   = s.email === selectedSwapStaffEmail;
        return `
          <div class="staff-item ${isSel ? 'selected' : ''}" data-email="${escHtml(s.email)}">
            <div class="staff-avatar">${escHtml(initial)}</div>
            <div style="flex:1">
              <div class="staff-name">${escHtml(s.name || '—')}</div>
              <div class="staff-email-label">${escHtml(s.email || '')}</div>
            </div>
            <div class="staff-check">
              ${isSel ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </div>
          </div>`;
      }).join('');
      listEl.querySelectorAll('.staff-item').forEach(item =>
        item.addEventListener('click', () => selectSwapStaff(item.dataset.email)));
    } catch (err) {
      listEl.innerHTML = `<p style="font-size:13px;color:var(--red);text-align:center;padding:16px 0">${err.message}</p>`;
    }
  }

  function selectSwapStaff(email) {
    selectedSwapStaffEmail = email;
    fetchSwapStaffList();
  }

  function showSwapConfirmModal() {
    if (!selectedSwapShiftId) {
      showToast('交代するシフトを選択してください', 'error');
      return;
    }
    const email = selectedSwapStaffEmail;
    if (!email) {
      showToast('交代相手のスタッフを選択してください', 'error');
      return;
    }
    const shift = myShiftsCache.find(s => s.shiftId === selectedSwapShiftId);
    const { month, day, wi } = parseDateParts(shift.date);
    document.getElementById('swapConfirmText').textContent =
      `${month}月${day}日(${WEEKDAYS[wi]}曜日) ${shift.startTime}〜${shift.endTime} のシフトを ${email} さんに交代申請します。`;
    document.getElementById('swapConfirmModal').classList.add('show');
  }

  async function submitSwap() {
    closeModal('swapConfirmModal');
    const btn = document.getElementById('swapSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spin"></div> 送信中...';

    const payload = {
      shiftId:     selectedSwapShiftId,
      targetEmail: selectedSwapStaffEmail,
      reason:      document.getElementById('swapReason').value.trim() || null,
    };

    try {
      const res = await fetch(`${API_BASE}/shifts/swap`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `エラー (${res.status})`);
      }
      showToast('交代申請を送信しました ✓', 'success');
      selectedSwapShiftId = null;
      selectedSwapStaffEmail = null;
      document.getElementById('swapReason').value      = '';
      myShiftsCache = [];
      renderSwapShiftPicker();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 2 15 22 11 12 2 9 22 2"/></svg> 交代申請を送信する';
    }
  }

