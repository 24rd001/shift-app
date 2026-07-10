'use strict';
/* admin-staff.js — admin.js から機能分割（自動生成）*/

  /* ===== スタッフ一覧 ===== */
  let allStaffList = [];

  async function loadStaffList() {
    const container = document.getElementById('staffListContainer');
    container.innerHTML = '<div class="center-state"><div class="big-spinner"></div><p class="state-sub">読み込み中...</p></div>';
    try {
      const res = await fetch(`${API_BASE}/staff`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.status === 401) { doLogout(); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || body.message || `HTTP ${res.status}`);
      }
      const data = await res.json();
      allStaffList = Array.isArray(data.staff)   ? data.staff
                   : Array.isArray(data.users)   ? data.users
                   : Array.isArray(data.items)   ? data.items
                   : Array.isArray(data.members) ? data.members
                   : Array.isArray(data.data)    ? data.data
                   : Array.isArray(data)         ? data
                   : [];
      renderStaffList();
      populateCreateStaffDropdown();
    } catch (err) {
      container.innerHTML = `
        <div class="center-state">
          <p class="state-title">読み込みに失敗しました</p>
          <p class="state-sub">${err.message}</p>
          <button class="reload-btn" onclick="loadStaffList()">再試行</button>
        </div>`;
    }
  }

  function renderStaffList() {
    const q = (document.getElementById('staffSearch').value || '').toLowerCase();
    const list = q
      ? allStaffList.filter(u =>
          (u.name  || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q))
      : allStaffList;
    const container = document.getElementById('staffListContainer');
    if (list.length === 0) {
      container.innerHTML = '<div class="center-state" style="padding:40px 0"><p class="state-title">スタッフが見つかりません</p></div>';
      return;
    }
    container.innerHTML = list.map(u => {
      const isAdmin  = (u.role === 'admin' || (u.groups || []).includes('admin'));
      const initial  = (u.name || u.email || '?')[0].toUpperCase();
      // userId / id / email の優先順で識別子を決定
      const uid = u.userId || u.id || u.email || '';
      const actionBtn = isAdmin
        ? `<button class="role-act-btn demote"  onclick="changeRole('${uid}','staff')">権限を剥奪</button>`
        : `<button class="role-act-btn promote" onclick="changeRole('${uid}','admin')">管理者にする</button>`;
      return `
        <div class="staff-card">
          <div class="staff-card-avatar ${isAdmin ? 'admin-av' : ''}">${escHtml(initial)}</div>
          <div class="staff-card-info">
            <div class="staff-card-name">${escHtml(u.name || '（名前未設定）')}</div>
            <div class="staff-card-email">${escHtml(u.email || '')}</div>
          </div>
          <span class="role-badge ${isAdmin ? 'admin' : 'staff'}">${isAdmin ? '管理者' : 'スタッフ'}</span>
          <div class="staff-card-actions">${actionBtn}</div>
        </div>`;
    }).join('');
  }


  /* ===== 権限変更 =====
   * template.yaml に /staff/role エンドポイントは存在しない。
   * POST /admin/shifts/{id}/{action} パターンに倣い
   * POST /admin/users/{userId}/role を試みる。
   * 404 の場合はバックエンド未実装である旨を案内する。
   ============================= */
  async function changeRole(userId, newRole) {
    const target = allStaffList.find(u =>
      u.userId === userId || u.id === userId || u.email === userId
    );
    const displayName = target ? (target.name || target.email || userId) : userId;
    const label = newRole === 'admin' ? '管理者' : 'スタッフ';
    if (!window.confirm(`${displayName} を「${label}」に変更しますか？`)) return;
    try {
      const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}/role`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ role: newRole }),
      });
      if (res.status === 401) { doLogout(); return; }
      if (res.status === 404 || res.status === 405) {
        showToast('権限変更APIは未実装です。AWSコンソールから変更してください。', 'error');
        return;
      }
      if (!res.ok) throw new Error(`エラー (${res.status})`);
      showToast(`${displayName} を${label}に変更しました ✓`, 'success');
      if (target) target.role = newRole;
      renderStaffList();
    } catch (err) {
      showToast(err.message, 'error');
    }
  }


