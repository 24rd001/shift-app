'use strict';
/* notices.js — index.html から機能分割（自動生成）*/

  /* ===== 重要連絡 ===== */
  let allNotices = [];

  /* localStorageのキーを統一 */
  const NOTICE_KEY = 'localNotices';

  /* 重要連絡を読んでallNoticesに反映する共通関数 */
  function loadNoticesFromStorage() {
    try {
      const saved = localStorage.getItem(NOTICE_KEY);
      allNotices = saved ? JSON.parse(saved) : [];
    } catch { allNotices = []; }
  }

  async function fetchNotices() {
    // まずlocalStorageをベースにセット（API未実装・失敗時の保証）
    loadNoticesFromStorage();
    try {
      const res = await fetch(`${API_BASE}/notices`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) throw new Error('API未実装');
      const data = await res.json();
      const apiNotices = Array.isArray(data.notices) ? data.notices : [];
      if (apiNotices.length > 0) {
        // APIにデータがある場合：API優先＋ローカルにしかないものを補完
        const apiIds = new Set(apiNotices.map(n => String(n.id)));
        const localOnly = allNotices.filter(n => !apiIds.has(String(n.id)));
        allNotices = [...apiNotices, ...localOnly];
        localStorage.setItem(NOTICE_KEY, JSON.stringify(allNotices));
      }
      // APIが空を返した場合はlocalStorageのデータをそのまま使う
    } catch {
      // loadNoticesFromStorage()は既に呼んでいるのでそのまま
    }
    renderNotices(allNotices);
  }

  /* 別タブ（管理者）がlocalStorageを更新したら即反映 */
  window.addEventListener('storage', e => {
    if (e.key === NOTICE_KEY) {
      loadNoticesFromStorage();
      // スタッフ画面が表示中なら即更新
      if (document.getElementById('shiftsScreen').classList.contains('active')) {
        renderNotices(allNotices);
      }
    }
  });

  function renderNotices(list) {
    const listEl = document.getElementById('noticeList');
    if (list.length === 0) {
      listEl.innerHTML = '<p style="font-size:13px;color:var(--muted);text-align:center;padding:12px 0">連絡はありません</p>';
      return;
    }
    const TAG_CLASS = { ルール:'tag-rule', 予約対応:'tag-reserve', トラブル:'tag-trouble' };
    const all = getAllReactions();
    // 固定を先に
    const sorted = [...list].sort((a,b) => (b.pinned?1:0)-(a.pinned?1:0));
    listEl.innerHTML = sorted.map(n => {
      const myReact = (all[n.id] && all[n.id][userEmail] && all[n.id][userEmail].type) || '';
      const unreacted = !myReact;
      return `
        <div class="notice-item${unreacted ? ' notice-unreacted' : ''}" style="border-bottom:1px solid var(--border);padding-bottom:10px;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
            <span class="notice-tag ${TAG_CLASS[n.tag] || 'tag-other'}">#${escHtml(n.tag || 'その他')}</span>
            ${n.pinned ? '<span style="font-size:10px;color:var(--muted)">📌</span>' : ''}
            ${unreacted
              ? '<span class="notice-todo-badge">⚠️ 要確認</span>'
              : '<span class="notice-done-badge">✓ 確認済み</span>'}
          </div>
          <div class="notice-text">${escHtml(n.body)}</div>
          ${unreacted ? '<div class="reaction-hint">👇 内容を確認したら理解度を教えてください</div>' : ''}
          <div class="reaction-row">
            <button class="reaction-btn ${myReact==='ok'?'selected-ok':''}"
              onclick="reactToNotice(${n.id},'ok',this)">👍 理解</button>
            <button class="reaction-btn ${myReact==='meh'?'selected-meh':''}"
              onclick="reactToNotice(${n.id},'meh',this)">△ あとで</button>
            <button class="reaction-btn ${myReact==='q'?'selected-q':''}"
              onclick="reactToNotice(${n.id},'q',this)">❓ 質問あり</button>
          </div>
        </div>`;
    }).join('');
    // 未提出タスクの表示チェック
    checkPendingTasks();
  }


  /* ===== ① 理解度リアクション ===== */
  const REACT_ALL_KEY = 'noticeReactionsAll';

  function getAllReactions() {
    try { return JSON.parse(localStorage.getItem(REACT_ALL_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveAllReactions(obj) {
    localStorage.setItem(REACT_ALL_KEY, JSON.stringify(obj));
  }

  /* 1件の連絡のリアクションを集計して {ok,meh,q,total,byUser:[{email,name,type,at}]} を返す。
   * API由来の notice.reactions があればそれを優先、無ければ localStorage から復元。 */
  function summarizeReactions(notice) {
    let entries = [];
    if (notice && Array.isArray(notice.reactions)) {
      entries = notice.reactions.map(r => ({
        email: r.email || r.userId || '',
        name:  r.name  || r.email || '名前未設定',
        type:  r.type,
        at:    r.at || 0,
      }));
    } else {
      const map = getAllReactions()[notice.id] || {};
      entries = Object.keys(map).map(email => ({
        email,
        name: map[email].name || email,
        type: map[email].type,
        at:   map[email].at || 0,
      }));
    }
    const sum = { ok:0, meh:0, q:0, total:entries.length, byUser:entries };
    entries.forEach(e => { if (sum[e.type] !== undefined) sum[e.type]++; });
    return sum;
  }

  /* 自分が未リアクションの連絡の件数（必須化・催促用） */
  function countUnreacted() {
    const all = getAllReactions();
    return allNotices.filter(n => !(all[n.id] && all[n.id][userEmail])).length;
  }

  async function reactToNotice(id, type, btn) {
    const all = getAllReactions();
    if (!all[id]) all[id] = {};
    const current = all[id][userEmail] && all[id][userEmail].type;

    // 同じボタンを再押しで解除
    let active;
    if (current === type) {
      delete all[id][userEmail];
      active = null;
    } else {
      all[id][userEmail] = { type, name: userName || userEmail, at: Date.now() };
      active = type;
    }
    saveAllReactions(all);

    // 同じ連絡内のボタンを更新
    const row = btn.closest('.reaction-row');
    row.querySelectorAll('.reaction-btn').forEach(b => {
      b.classList.remove('selected-ok','selected-meh','selected-q');
    });
    if (active) {
      const cls = { ok:'selected-ok', meh:'selected-meh', q:'selected-q' };
      btn.classList.add(cls[active]);
    }
    // 未対応の強調を即時更新
    const item = btn.closest('.notice-item');
    if (item) item.classList.toggle('notice-unreacted', !active);
    checkPendingTasks();

    if (type === 'q' && active) showToast('❓ 質問ありとして記録しました', 'success');

    // サーバーへ送信（API未実装ならlocalStorageのみで継続）。active=null は解除。
    try {
      await fetch(`${API_BASE}/notices/${id}/reactions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: active }),
      });
    } catch (_) { /* API未実装時はlocalStorageのみ */ }
  }


  /* ===== ② 未提出タスク ===== */
  function checkPendingTasks() {
    const card  = document.getElementById('pendingTasksCard');
    const listEl = document.getElementById('pendingTasksList');
    if (!card) return;
    const tasks = [];
    // シフト希望未提出チェック
    const wishes = JSON.parse(localStorage.getItem('localWishes') || '[]');
    const myWish = wishes.find(w => w.email === userEmail);
    const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nm = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth()+1).padStart(2,'0')}`;
    const hasNextWish = myWish && myWish.dates && myWish.dates.some(d => d.startsWith(nm));
    if (!hasNextWish) {
      tasks.push({
        icon: '📅',
        name: '来月のシフト希望が未提出です',
        sub:  `提出期限：${nextMonth.getMonth()+1}月25日`,
        action: () => switchTab('wish'),
        label: '提出する',
      });
    }
    // トーク未読チェック
    const unread = getTotalUnread();
    if (unread > 0) {
      tasks.push({
        icon: '💬',
        name: `未読メッセージが${unread}件あります`,
        sub:  'トークを確認してください',
        action: () => switchTab('talk'),
        label: '確認する',
      });
    }
    // 未確認の連絡チェック（理解度リアクション必須化）
    const unreactedCount = countUnreacted();
    if (unreactedCount > 0) {
      tasks.push({
        icon: '📢',
        name: `未確認の連絡が${unreactedCount}件あります`,
        sub:  '内容を確認してリアクションしてください',
        action: () => {
          switchTab('shifts');
          setTimeout(() => document.getElementById('noticeList')?.scrollIntoView({ behavior:'smooth', block:'center' }), 120);
        },
        label: '確認する',
      });
    }
    if (tasks.length === 0) {
      card.style.display = 'none';
      return;
    }
    card.style.display = 'block';
    listEl.innerHTML = tasks.map((t,i) => `
      <div class="pending-task-item">
        <div class="pending-task-icon">${t.icon}</div>
        <div class="pending-task-info">
          <div class="pending-task-name">${escHtml(t.name)}</div>
          <div class="pending-task-sub">${escHtml(t.sub)}</div>
        </div>
        <button class="pending-task-btn" onclick="pendingTaskActions[${i}]()">${t.label}</button>
      </div>`).join('');
    window.pendingTaskActions = tasks.map(t => t.action);
  }


  /* ===== ⑥ 多言語翻訳（未実装 / TODO） =====
   * ブラウザから api.anthropic.com を直接呼ぶ実装は削除した。理由:
   *   - APIキーをフロントのJSに置くとDevToolsで誰でも閲覧でき、キーが公開されてしまう
   *   - キー無しでは認証エラーになり、そもそも動作しない
   *   - 動かない機能のためにCSPの connect-src に外部ドメインを許可することになり、
   *     XSS発生時のデータ持ち出し経路（出口）を無駄に広げてしまう
   *
   * 実装する場合はバックエンド経由にする:
   *   [ブラウザ] → [自社API Gateway/Lambda] → [api.anthropic.com]
   *                      ↑ APIキーはサーバー側の環境変数で保持
   *   フロントは fetch(`${API_BASE}/translate`) を呼ぶだけ。
   *   通信先は自社APIのみになるため、CSPの変更は不要。
   * 旧実装は Git 履歴から参照可能。 */


  /* ===== 管理者：重要連絡フォーム開閉 ===== */
  function toggleAdminNoticeForm() {
    const form = document.getElementById('adminNoticeForm');
    const btn  = document.getElementById('adminNoticeToggleBtn');
    const open = form.style.display === 'none';
    form.style.display = open ? 'block' : 'none';
    btn.textContent    = open ? '✕ 閉じる' : '＋ 新規投稿';
  }
  document.getElementById('adminNoticeTagRow').addEventListener('click', e => {
    const btn = e.target.closest('.notice-tag-btn');
    if (!btn) return;
    document.querySelectorAll('#adminNoticeTagRow .notice-tag-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });

  function getSelectedTag() {
    const active = document.querySelector('#adminNoticeTagRow .notice-tag-btn.active');
    return active ? active.dataset.tag : 'その他';
  }

  // 投稿
  async function submitAdminNotice() {
    const body   = document.getElementById('adminNoticeBody').value.trim();
    const tag    = getSelectedTag();
    const pinned = document.getElementById('adminNoticePin').checked;
    const btn    = document.getElementById('adminNoticeSubmitBtn');

    if (!body) { showToast('本文を入力してください', 'error'); return; }

    btn.disabled = true;
    btn.innerHTML = '<div class="spin"></div> 送信中...';

    const notice = { id: Date.now(), tag, body, pinned, createdAt: new Date().toISOString() };

    try {
      // APIが実装済みの場合はPOST
      const res = await fetch(`${API_BASE}/notices`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tag, body, pinned }),
      });
      if (res.status === 401) {
        btn.disabled = false;
        btn.innerHTML = '送信する';
        doLogout();
        return;
      }
      if (!res.ok) throw new Error('API未実装');
      const data = await res.json();
      notice.id = data.id || notice.id;
    } catch {
      // API未実装の場合はローカルに保存
    }

    // ローカルに追加してスタッフ側にも反映
    allNotices.unshift(notice);
    localStorage.setItem(NOTICE_KEY, JSON.stringify(allNotices));

    // フォームリセット（送信ボタンも復元しないと「送信中」のまま固まる）
    document.getElementById('adminNoticeBody').value = '';
    document.getElementById('adminNoticePin').checked = false;
    btn.disabled = false;
    btn.innerHTML = '送信する';

    showToast('連絡を投稿しました ✓', 'success');
    renderAdminNoticeList();
    // スタッフ側の表示も更新
    renderNotices(allNotices);
  }

  // 削除
  function deleteAdminNotice(id) {
    if (!window.confirm('この連絡を削除しますか？')) return;
    allNotices = allNotices.filter(n => n.id !== id);
    localStorage.setItem(NOTICE_KEY, JSON.stringify(allNotices));
    showToast('削除しました', 'success');
    renderAdminNoticeList();
    renderNotices(allNotices);
  }

  // 一覧表示
  function renderAdminNoticeList() {
    const TAG_CLASS = { ルール:'tag-rule', 予約対応:'tag-reserve', トラブル:'tag-trouble' };
    const q = (document.getElementById('adminNoticeSearch')?.value || '').toLowerCase().replace('#','');
    const list = q
      ? allNotices.filter(n => (n.tag||'').toLowerCase().includes(q) || (n.body||'').toLowerCase().includes(q))
      : allNotices;
    const el = document.getElementById('adminNoticeList');
    if (list.length === 0) {
      el.innerHTML = '<p style="font-size:13px;color:var(--muted);text-align:center;padding:16px 0">投稿はありません</p>';
      return;
    }
    el.innerHTML = list.map(n => {
      const s = summarizeReactions(n);
      return `
      <div class="admin-notice-item">
        <div class="admin-notice-body">
          <span class="notice-tag ${TAG_CLASS[n.tag] || 'tag-other'}">#${escHtml(n.tag || 'その他')}</span>
          <div class="notice-text" style="margin-top:5px">${escHtml(n.body)}</div>
          ${n.pinned ? '<div class="notice-pin">📌 固定</div>' : ''}
          <div style="font-size:10px;color:var(--muted);margin-top:4px">${new Date(n.createdAt).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
          ${renderReactionSummary(n, s)}
          <div class="reaction-detail" id="react-detail-${n.id}" style="display:none">${renderReactionDetail(n, s)}</div>
        </div>
        <button class="admin-notice-delete" onclick="deleteAdminNotice(${n.id})">削除</button>
      </div>`;
    }).join('');
    el.querySelectorAll('.rd-follow-btn').forEach(btn =>
      btn.addEventListener('click', () => followUp(btn.dataset.email, btn.dataset.name)));
  }

  function filterAdminNoticeList() { renderAdminNoticeList(); }


  /* ===== 管理者：理解度サマリ＆詳細 ===== */
  function renderReactionSummary(n, s) {
    const totalStaff = Array.isArray(allStaffList) ? allStaffList.length : 0;
    const none = Math.max(0, totalStaff - s.total);
    return `
      <div class="reaction-summary">
        <span class="rs-chip rs-ok">👍 ${s.ok}</span>
        <span class="rs-chip rs-meh">△ ${s.meh}</span>
        <span class="rs-chip rs-q">❓ ${s.q}</span>
        ${totalStaff ? `<span class="rs-chip rs-none">未対応 ${none}</span>` : ''}
        <button class="rs-detail-btn" onclick="toggleReactionDetail(${n.id})">
          <span id="rd-arrow-${n.id}">詳細 ▾</span>
        </button>
      </div>`;
  }

  function renderReactionDetail(n, s) {
    const ICON  = { ok:'👍', meh:'△', q:'❓' };
    const order = { q:0, meh:1, ok:2 };
    const reacted = [...s.byUser].sort((a,b) => (order[a.type] ?? 9) - (order[b.type] ?? 9));
    const reactedEmails = new Set(s.byUser.map(u => u.email));
    const noStaff = (Array.isArray(allStaffList) ? allStaffList : [])
      .filter(u => { const em = u.email || u.userId || u.id || ''; return em && !reactedEmails.has(em); });

    if (reacted.length === 0 && noStaff.length === 0) {
      return '<div class="rd-empty">まだリアクションがありません</div>';
    }
    let html = '';
    if (reacted.length) {
      html += '<div class="rd-group-label">リアクション済み</div>';
      html += reacted.map(u => {
        const followable = u.type === 'meh' || u.type === 'q';
        return `
          <div class="rd-row">
            <span class="rd-icon">${ICON[u.type] || '・'}</span>
            <span class="rd-name">${escHtml(u.name)}</span>
            ${followable ? `<button class="rd-follow-btn" data-email="${escHtml(u.email)}" data-name="${escHtml(u.name)}">💬 フォロー</button>` : ''}
          </div>`;
      }).join('');
    }
    if (noStaff.length) {
      html += '<div class="rd-group-label">未対応</div>';
      html += noStaff.map(u => {
        const em = u.email || u.userId || u.id || '';
        const nm = u.name || em;
        return `
          <div class="rd-row">
            <span class="rd-icon">—</span>
            <span class="rd-name" style="color:var(--muted)">${escHtml(nm)}</span>
            <button class="rd-follow-btn" data-email="${escHtml(em)}" data-name="${escHtml(nm)}">💬 フォロー</button>
          </div>`;
      }).join('');
    }
    return html;
  }

  function toggleReactionDetail(id) {
    const el    = document.getElementById(`react-detail-${id}`);
    const arrow = document.getElementById(`rd-arrow-${id}`);
    if (!el) return;
    const open = el.style.display === 'none';
    el.style.display = open ? 'block' : 'none';
    if (arrow) arrow.textContent = open ? '閉じる ▴' : '詳細 ▾';
  }

  /* △・❓・未対応のスタッフを店長がフォロー（個別トークへ誘導） */
  function followUp(email, name) {
    if (!email) { showToast('連絡先が不明です', 'error'); return; }
    startDm(email, name);
  }

