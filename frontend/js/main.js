'use strict';
/* main.js — index.html から機能分割（自動生成）*/

  /* ===== 初期化: 既にログイン済みなら直接画面へ ===== */
  if (idToken) {
    const payload  = decodeJwtPayload(idToken);
    const groups   = payload['cognito:groups'] || [];
    const roleAttr = payload['custom:role'] || '';
    const isAdmin  = groups.includes('admin') || roleAttr === 'admin';
    if (isAdmin) {
      showScreen('adminScreen');
      renderAdminScreen();
    } else {
      renderShiftsScreen();
    }
  } else {
    // 未ログイン時：保存済みアカウント一覧を表示
    renderSavedAccounts();
    // 前回のメールアドレスをフォームに事前入力
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) {
      document.getElementById('emailInput').value = savedEmail;
      // パスワード欄にフォーカスを移してすぐ入力できるようにする
      document.getElementById('passwordInput').focus();
    }
  }

