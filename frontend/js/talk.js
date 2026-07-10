'use strict';
/* talk.js — index.html から機能分割（自動生成）*/

  /* ===== ⑦ トーク機能 ===== */
  const TALK_KEY   = 'talkMessages';
  const TALK_READ  = 'talkReadAt';
  let currentRoomId   = null;
  let currentRoomName = null;

  function getTalkMessages(roomId) {
    const all = JSON.parse(localStorage.getItem(TALK_KEY) || '{}');
    return all[roomId] || [];
  }
  function saveTalkMessage(roomId, msg) {
    const all = JSON.parse(localStorage.getItem(TALK_KEY) || '{}');
    if (!all[roomId]) all[roomId] = [];
    all[roomId].push(msg);
    localStorage.setItem(TALK_KEY, JSON.stringify(all));
  }
  function markRoomRead(roomId) {
    const reads = JSON.parse(localStorage.getItem(TALK_READ) || '{}');
    reads[roomId] = Date.now();
    localStorage.setItem(TALK_READ, JSON.stringify(reads));
  }
  function getRoomUnread(roomId) {
    const msgs  = getTalkMessages(roomId);
    const reads = JSON.parse(localStorage.getItem(TALK_READ) || '{}');
    const readAt = reads[roomId] || 0;
    return msgs.filter(m => m.ts > readAt && m.sender !== userEmail).length;
  }
  function getTotalUnread() {
    const rooms = ['group-all','group-shift', ...getDmRoomIds()];
    return rooms.reduce((sum, id) => sum + getRoomUnread(id), 0);
  }
  function getDmRoomIds() {
    const all = JSON.parse(localStorage.getItem(TALK_KEY) || '{}');
    return Object.keys(all).filter(k => k.startsWith('dm-'));
  }

  function renderTalkList() {
    // グループ
    ['group-all','group-shift'].forEach(id => {
      const msgs   = getTalkMessages(id);
      const last   = msgs[msgs.length - 1];
      const unread = getRoomUnread(id);
      document.getElementById(`preview-${id}`).textContent =
        last ? `${last.senderName}: ${last.text}` : 'メッセージはありません';
      document.getElementById(`time-${id}`).textContent =
        last ? formatMsgTime(last.ts) : '';
      const badge = document.getElementById(`unread-${id}`);
      if (badge) { badge.style.display = unread > 0 ? 'inline-block' : 'none'; badge.textContent = unread; }
    });
    // DM一覧
    const dmEl = document.getElementById('dmRoomList');
    const dmIds = getDmRoomIds();
    if (dmIds.length === 0) {
      dmEl.innerHTML = '<p style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0">個人トークはまだありません</p>';
      return;
    }
    dmEl.innerHTML = dmIds.map(id => {
      const name   = id.replace('dm-','').replace(/-/g,' ');
      const msgs   = getTalkMessages(id);
      const last   = msgs[msgs.length - 1];
      const unread = getRoomUnread(id);
      const init   = name[0]?.toUpperCase() || '?';
      return `
        <div class="talk-room-item" data-room="${escHtml(id)}" data-name="${escHtml(name)}">
          <div class="talk-room-avatar group-dm">${escHtml(init)}</div>
          <div class="talk-room-info">
            <div class="talk-room-name">${escHtml(name)}</div>
            <div class="talk-room-preview">${last ? escHtml(last.senderName+': '+last.text) : 'メッセージはありません'}</div>
          </div>
          <div class="talk-room-meta">
            <div class="talk-room-time">${last ? formatMsgTime(last.ts) : ''}</div>
            ${unread > 0 ? `<span class="talk-unread-badge">${unread}</span>` : ''}
          </div>
        </div>`;
    }).join('');
    dmEl.querySelectorAll('.talk-room-item').forEach(item =>
      item.addEventListener('click', () => openChatRoom(item.dataset.room, item.dataset.name, 'dm')));
    // 未読バッジをナビに反映
    const total = getTotalUnread();
    const navBadge = document.getElementById('talkUnreadBadgeNav');
    if (navBadge) navBadge.style.display = total > 0 ? 'inline-block' : 'none';
  }

  function formatMsgTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }
    return `${d.getMonth()+1}/${d.getDate()}`;
  }

  function openChatRoom(roomId, roomName, type) {
    currentRoomId   = roomId;
    currentRoomName = roomName;
    document.getElementById('chatRoomTitle').textContent = roomName;
    markRoomRead(roomId);
    renderChatMessages();
    document.getElementById('chatRoomScreen').classList.add('active');
    const msgs = document.getElementById('chatMessages');
    msgs.scrollTop = msgs.scrollHeight;
  }

  function closeChatRoom() {
    document.getElementById('chatRoomScreen').classList.remove('active');
    currentRoomId = null;
    renderTalkList();
    checkPendingTasks();
  }

  function renderChatMessages() {
    const msgs = getTalkMessages(currentRoomId);
    const el   = document.getElementById('chatMessages');
    if (msgs.length === 0) {
      el.innerHTML = '<div class="chat-day-divider">メッセージはまだありません</div>';
      return;
    }
    let lastDate = '';
    el.innerHTML = msgs.map(m => {
      const d      = new Date(m.ts);
      const dateStr = `${d.getMonth()+1}月${d.getDate()}日`;
      const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      const isMine  = m.sender === userEmail;
      const init    = (m.senderName || '?')[0].toUpperCase();
      let html = '';
      if (dateStr !== lastDate) {
        lastDate = dateStr;
        html += `<div class="chat-day-divider">${dateStr}</div>`;
      }
      html += `
        <div class="chat-bubble-wrap ${isMine ? 'mine' : ''}">
          ${!isMine ? `<div class="chat-bubble-avatar">${escHtml(init)}</div>` : ''}
          <div class="chat-bubble-col ${isMine ? 'mine' : ''}">
            ${!isMine ? `<div class="chat-bubble-sender">${escHtml(m.senderName || m.sender)}</div>` : ''}
            <div class="chat-bubble ${isMine ? 'mine-bubble' : 'theirs'}">${escHtml(m.text)}</div>
            <div class="chat-bubble-time">${timeStr}</div>
          </div>
        </div>`;
      return html;
    }).join('');
    el.scrollTop = el.scrollHeight;
  }

  function sendChatMessage() {
    const inp  = document.getElementById('chatInputText');
    const text = inp.value.trim();
    if (!text || !currentRoomId) return;
    const msg = {
      sender:     userEmail,
      senderName: userName || userEmail,
      text,
      ts: Date.now(),
    };
    saveTalkMessage(currentRoomId, msg);
    inp.value = '';
    inp.style.height = 'auto';
    renderChatMessages();
  }

  function showNewDmModal() {
    const modal = document.getElementById('newDmModal');
    const list  = document.getElementById('dmStaffList');
    // localStorageのスタッフ一覧を使う
    const staffs = JSON.parse(localStorage.getItem('localWishes') || '[]')
      .filter(s => s.email !== userEmail);
    if (staffs.length === 0) {
      list.innerHTML = '<p style="font-size:13px;color:var(--muted);text-align:center;padding:16px 0">スタッフが見つかりません</p>';
    } else {
      list.innerHTML = staffs.map(s => {
        const name = s.name || s.email;
        return `
        <div class="talk-room-item" data-email="${escHtml(s.email)}" data-name="${escHtml(name)}">
          <div class="talk-room-avatar group-dm">${escHtml(name[0].toUpperCase())}</div>
          <div class="talk-room-info">
            <div class="talk-room-name">${escHtml(name)}</div>
            <div class="talk-room-preview">${escHtml(s.email)}</div>
          </div>
        </div>`;
      }).join('');
      list.querySelectorAll('.talk-room-item').forEach(item =>
        item.addEventListener('click', () => startDm(item.dataset.email, item.dataset.name)));
    }
    modal.style.display = 'flex';
  }

  function startDm(email, name) {
    document.getElementById('newDmModal').style.display = 'none';
    const roomId = `dm-${email}`;
    openChatRoom(roomId, name, 'dm');
  }

  /* storageイベントでトークも即時反映 */
  window.addEventListener('storage', e => {
    if (e.key === TALK_KEY && currentRoomId) {
      renderChatMessages();
    }
    if (e.key === TALK_KEY) {
      renderTalkList();
    }
  });

