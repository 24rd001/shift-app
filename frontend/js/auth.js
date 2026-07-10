'use strict';
/* auth.js — index.html から機能分割（自動生成）*/

  /* ===== Cognito ログイン ===== */
  async function cognitoLogin(email, password) {
    const res = await fetch(COGNITO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      },
      body: JSON.stringify({
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: CLIENT_ID,
        AuthParameters: { USERNAME: email, PASSWORD: password },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const MSG = {
        'NotAuthorizedException':    'メールアドレスまたはパスワードが正しくありません',
        'UserNotFoundException':     'メールアドレスまたはパスワードが正しくありません',
        'UserNotConfirmedException': 'メールアドレスの確認が完了していません',
        'TooManyRequestsException':  'しばらく時間をおいてから再度お試しください',
        'PasswordResetRequiredException': 'パスワードのリセットが必要です',
      };
      throw new Error(MSG[data.__type] || data.message || 'ログインに失敗しました');
    }

    if (!data.AuthenticationResult) {
      throw new Error('追加の認証ステップが必要です（管理者に連絡してください）');
    }

    return data.AuthenticationResult.IdToken;
  }


  /* ===== ログアウト ===== */
  function doLogout() {
    localStorage.removeItem('idToken');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    idToken = null;
    userEmail = '';
    userName = '';
    // パスワード欄をクリアし、保存済みアカウント一覧を最新化
    document.getElementById('passwordInput').value = '';
    renderSavedAccounts();
    showScreen('loginScreen');
  }


  /* ===== Cognito: アカウント登録 ===== */
  async function cognitoSignUp(name, email, password, role) {
    const res = await fetch(COGNITO_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': 'AWSCognitoIdentityProviderService.SignUp',
      },
      body: JSON.stringify({
        ClientId: CLIENT_ID,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name',  Value: name  },
        ],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const MSG = {
        'UsernameExistsException':       'このメールアドレスはすでに登録されています',
        'InvalidPasswordException':      'パスワードは8文字以上で、大文字・小文字・数字を含めてください',
        'InvalidParameterException':     '入力内容に誤りがあります。もう一度ご確認ください',
        'TooManyRequestsException':      'しばらく時間をおいてから再度お試しください',
      };
      throw new Error(MSG[data.__type] || data.message || '登録に失敗しました');
    }

    return data;
  }


  /* ===== 登録ボタン処理 ===== */
  async function submitRegister() {
    const name     = document.getElementById('regNameInput').value.trim();
    const email    = document.getElementById('regEmailInput').value.trim();
    const password = document.getElementById('regPasswordInput').value;
    const confirm  = document.getElementById('regPasswordConfirm').value;
    const btn      = document.getElementById('registerBtn');
    const errBox   = document.getElementById('regErrorBox');

    errBox.classList.remove('show');

    // バリデーション
    if (!name) {
      errBox.textContent = '名前を入力してください';
      errBox.classList.add('show'); return;
    }
    if (!email) {
      errBox.textContent = 'メールアドレスを入力してください';
      errBox.classList.add('show'); return;
    }
    if (password.length < 8) {
      errBox.textContent = 'パスワードは8文字以上で入力してください';
      errBox.classList.add('show'); return;
    }
    if (password !== confirm) {
      errBox.textContent = 'パスワードが一致しません';
      errBox.classList.add('show'); return;
    }

    btn.disabled = true;
    btn.innerHTML = '<div class="spin"></div> 登録中...';

    try {
      await cognitoSignUp(name, email, password, 'staff');
      // 登録成功 → ログイン画面へ戻してメッセージ表示
      showScreen('loginScreen');
      const errLogin = document.getElementById('errorBox');
      errLogin.style.background = 'var(--green-light)';
      errLogin.style.borderColor = '#6EE7B7';
      errLogin.style.color = '#065F46';
      errLogin.textContent = '✓ アカウントを作成しました。メールアドレスを確認後、ログインしてください。';
      errLogin.classList.add('show');
      // メールを自動入力
      document.getElementById('emailInput').value = email;
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg> アカウントを作成する';
    }
  }


  /* ===== パスワード表示切り替え（登録画面） ===== */
  document.getElementById('regPwToggle').addEventListener('click', () => {
    const inp  = document.getElementById('regPasswordInput');
    const icon = document.getElementById('regEyeIcon');
    const showing = inp.type === 'text';
    inp.type = showing ? 'password' : 'text';
    icon.innerHTML = showing
      ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
      : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
  });


  /* ===== イベント: ログインフォーム ===== */

  /* ===== 保存済みアカウント（端末に記憶・選択で自動入力） =====
   * デモ用途のためlocalStorageに保存（base64は難読化のみで暗号化ではない）。
   * 本番ではブラウザのパスワードマネージャーに任せる想定。 */
  const ACCTS_KEY = 'savedAccounts';
  const encPw = p => btoa(unescape(encodeURIComponent(p)));
  const decPw = s => { try { return decodeURIComponent(escape(atob(s))); } catch { return ''; } };

  function getSavedAccounts() {
    try { return JSON.parse(localStorage.getItem(ACCTS_KEY) || '[]'); }
    catch { return []; }
  }

  function saveAccount(email, password, name) {
    const list = getSavedAccounts().filter(a => a.email !== email);
    list.unshift({ email, pw: encPw(password), name: name || '', lastUsed: Date.now() });
    localStorage.setItem(ACCTS_KEY, JSON.stringify(list));
  }

  function removeSavedAccount(email, ev) {
    ev.stopPropagation();
    const list = getSavedAccounts().filter(a => a.email !== email);
    localStorage.setItem(ACCTS_KEY, JSON.stringify(list));
    renderSavedAccounts();
  }

  function selectSavedAccount(email) {
    const acct = getSavedAccounts().find(a => a.email === email);
    if (!acct) return;
    document.getElementById('emailInput').value    = acct.email;
    document.getElementById('passwordInput').value = decPw(acct.pw);
    document.getElementById('loginBtn').focus();
  }

  function renderSavedAccounts() {
    const wrap   = document.getElementById('savedAccountsWrap');
    const listEl = document.getElementById('savedAccountsList');
    const list   = getSavedAccounts();
    if (list.length === 0) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    listEl.innerHTML = list.map(a => {
      const initial = (a.name || a.email)[0].toUpperCase();
      return `
        <div class="saved-acct-item" onclick="selectSavedAccount('${a.email}')">
          <div class="saved-acct-avatar">${initial}</div>
          <div class="saved-acct-info">
            <div class="saved-acct-name">${escHtml(a.name || a.email)}</div>
            ${a.name ? `<div class="saved-acct-email">${escHtml(a.email)}</div>` : ''}
          </div>
          <button class="saved-acct-remove" onclick="removeSavedAccount('${a.email}', event)" aria-label="このアカウントを削除">✕</button>
        </div>`;
    }).join('');
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('emailInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const btn      = document.getElementById('loginBtn');
    const errBox   = document.getElementById('errorBox');

    if (!email || !password) {
      errBox.textContent = 'メールアドレスとパスワードを入力してください';
      errBox.classList.add('show');
      return;
    }

    errBox.classList.remove('show');
    btn.disabled = true;
    btn.innerHTML = '<div class="spin"></div>';

    try {
      idToken   = await cognitoLogin(email, password);
      userEmail = email;
      const payload = decodeJwtPayload(idToken);
      // name属性がUUID形式の場合は使わない
      const rawName = payload.name || '';
      const isUuid  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawName);
      userName  = (!rawName || isUuid) ? '' : rawName;
      localStorage.setItem('idToken',   idToken);
      localStorage.setItem('userEmail', userEmail);
      localStorage.setItem('userName',  userName);
      // 次回ログイン時にメールを事前入力するため保存（ログアウトしても残す）
      localStorage.setItem('savedEmail', email);
      // アカウント一覧に記憶（次回は選択だけで自動入力）
      saveAccount(email, password, userName);

      // 管理者判定: custom:role または cognito:groups で確認
      const groups   = payload['cognito:groups'] || [];
      const roleAttr = payload['custom:role'] || '';
      const isAdmin  = groups.includes('admin') || roleAttr === 'admin';

      if (isAdmin) {
        showScreen('adminScreen');
        renderAdminScreen();
      } else {
        await renderShiftsScreen();
      }
    } catch (err) {
      errBox.textContent = err.message;
      errBox.classList.add('show');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'ログイン';
    }
  });


  /* ===== イベント: パスワード表示切り替え ===== */
  document.getElementById('pwToggle').addEventListener('click', () => {
    const inp = document.getElementById('passwordInput');
    const icon = document.getElementById('eyeIcon');
    const showing = inp.type === 'text';
    inp.type = showing ? 'password' : 'text';
    // 目アイコン ↔ 目に斜線アイコン
    icon.innerHTML = showing
      ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
      : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
  });


  /* ===== イベント: ログアウト ===== */
  document.getElementById('logoutBtn').addEventListener('click', doLogout);

