/* ============ FileFlexer Auth & Storage (client-side, per-browser) ============ */
const FF = (function(){
  const USERS_KEY = 'ff_users';
  const SESSION_KEY = 'ff_session';

  function getUsers(){
    try{ return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }catch(e){ return {}; }
  }
  function saveUsers(u){ localStorage.setItem(USERS_KEY, JSON.stringify(u)); }

  async function hash(str){
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  function currentUser(){ return localStorage.getItem(SESSION_KEY); }
  function isLoggedIn(){ return !!currentUser(); }

  function dataKey(email){ return 'ff_data_' + email; }
  function getData(){
    const email = currentUser();
    if(!email) return null;
    try{
      return JSON.parse(localStorage.getItem(dataKey(email))) || defaultData();
    }catch(e){ return defaultData(); }
  }
  function defaultData(){
    return { profile:{name:'', bio:''}, pdf:[], image:[], chat:[], bg:[], qr:[], password:[], unit:[], age:[] };
  }
  function setData(d){
    const email = currentUser();
    if(!email) return;
    localStorage.setItem(dataKey(email), JSON.stringify(d));
  }
  function pushHistory(tool, entry){
    const d = getData(); if(!d) return;
    if(!d[tool]) d[tool] = [];
    entry.ts = Date.now();
    entry.id = 'h_' + Math.random().toString(36).slice(2,9);
    d[tool].unshift(entry);
    d[tool] = d[tool].slice(0, 40);
    setData(d);
    return entry;
  }
  function removeHistory(tool, id){
    const d = getData(); if(!d) return;
    d[tool] = (d[tool]||[]).filter(e=>e.id!==id);
    setData(d);
  }

  async function signup(name, email, password){
    email = email.trim().toLowerCase();
    const users = getUsers();
    if(users[email]) throw new Error('An account with this email already exists.');
    if(!name.trim()) throw new Error('Please enter your name.');
    if(password.length < 6) throw new Error('Password must be at least 6 characters.');
    users[email] = { name: name.trim(), passwordHash: await hash(password), createdAt: Date.now() };
    saveUsers(users);
    localStorage.setItem(SESSION_KEY, email);
    const d = defaultData(); d.profile.name = name.trim();
    setData(d);
    return email;
  }
  async function login(email, password){
    email = email.trim().toLowerCase();
    const users = getUsers();
    const u = users[email];
    if(!u) throw new Error('No account found with that email.');
    const h = await hash(password);
    if(h !== u.passwordHash) throw new Error('Incorrect password.');
    localStorage.setItem(SESSION_KEY, email);
    return email;
  }

  /* ---------- Email OTP (one-time code) system ---------- */
  const OTP_PREFIX = 'ff_otp_';
  const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const OTP_MAX_ATTEMPTS = 5;

  function otpKey(email){ return OTP_PREFIX + email.trim().toLowerCase(); }
  function genOtpCode(){ return String(Math.floor(100000 + Math.random() * 900000)); }

  // Sends the code via the configured email backend (see js/config.js -> OTP_API_URL).
  // If no backend is configured yet, falls back to a visible "demo mode" toast so the
  // whole flow can still be tested end-to-end before you wire up real email delivery.
  async function sendOtpEmail(email, code, purpose){
    const cfg = window.FF_CONFIG || {};
    const endpoint = cfg.OTP_API_URL;
    const subject = purpose === 'signup' ? 'Your FileFlexer verification code' : 'Your FileFlexer password reset code';
    if(!endpoint){
      throw new Error('Email service is not configured. Please try again later.');
    }
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: email, code, subject, purpose })
    });
    if(!res.ok) throw new Error('Could not send the email right now. Please try again in a moment.');
  }

  async function requestOtp(email, purpose){
    email = email.trim().toLowerCase();
    const users = getUsers();
    if(purpose === 'signup' && users[email]) throw new Error('An account with this email already exists.');
    if(purpose === 'reset' && !users[email]) throw new Error('No account found with that email.');
    const code = genOtpCode();
    const rec = { hash: await hash(code), expiresAt: Date.now() + OTP_TTL_MS, attempts: 0, purpose };
    localStorage.setItem(otpKey(email), JSON.stringify(rec));
    await sendOtpEmail(email, code, purpose);
    return true;
  }

  async function verifyOtp(email, code){
    email = email.trim().toLowerCase();
    const raw = localStorage.getItem(otpKey(email));
    if(!raw) throw new Error('No code was requested for this email. Tap "Resend code".');
    const rec = JSON.parse(raw);
    if(Date.now() > rec.expiresAt){
      localStorage.removeItem(otpKey(email));
      throw new Error('This code expired. Tap "Resend code" for a new one.');
    }
    rec.attempts = (rec.attempts || 0) + 1;
    if(rec.attempts > OTP_MAX_ATTEMPTS){
      localStorage.removeItem(otpKey(email));
      throw new Error('Too many incorrect attempts. Tap "Resend code" for a new one.');
    }
    localStorage.setItem(otpKey(email), JSON.stringify(rec));
    const h = await hash(String(code).trim());
    if(h !== rec.hash) throw new Error('Incorrect code. Please try again.');
    localStorage.removeItem(otpKey(email));
    return true;
  }

  async function resetPassword(email, newPassword){
    email = email.trim().toLowerCase();
    const users = getUsers();
    if(!users[email]) throw new Error('No account found with that email.');
    if(newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
    users[email].passwordHash = await hash(newPassword);
    saveUsers(users);
    return true;
  }
  function logout(){
    localStorage.removeItem(SESSION_KEY);
    location.href = resolvePath('index.html');
  }
  function getProfile(){
    const email = currentUser();
    if(!email) return null;
    const users = getUsers();
    const d = getData();
    return {
      email,
      name: (d && d.profile && d.profile.name) || (users[email]&&users[email].name) || '',
      avatar: (d && d.profile && d.profile.avatar) || ''
    };
  }
  function updateProfileName(name){
    const d = getData(); if(!d) return;
    d.profile.name = name;
    setData(d);
    const users = getUsers();
    const email = currentUser();
    if(users[email]){ users[email].name = name; saveUsers(users); }
  }
  function updateProfileAvatar(dataUrl){
    const d = getData(); if(!d) return;
    d.profile.avatar = dataUrl || '';
    setData(d);
  }

  // path helper: pages live at root or /tools/, normalize links
  function resolvePath(rel){
    const inTools = location.pathname.includes('/tools/');
    if(rel.startsWith('tools/')) return inTools ? rel.replace('tools/','') : rel;
    if(rel === 'index.html' || rel==='about.html' || rel==='profile.html') return inTools ? '../'+rel : rel;
    return rel;
  }

  /* ---------- Modal wiring (login / signup+OTP / forgot-password+OTP) ---------- */
  function openAuthModal(nextUrl, mode){
    const overlay = document.getElementById('authOverlay');
    if(!overlay) return;
    overlay.dataset.next = nextUrl || location.href;
    setStep(mode || 'login');
    overlay.classList.add('open');
  }
  function closeAuthModal(){
    const overlay = document.getElementById('authOverlay');
    if(overlay) overlay.classList.remove('open');
  }

  // Drives every screen of the auth modal from one state machine:
  // login -> signup -> signup-otp -> (account created)
  // login -> forgot -> forgot-otp -> reset -> login
  function setStep(step){
    const overlay = document.getElementById('authOverlay');
    if(!overlay) return;
    overlay.dataset.mode = step;
    const $ = (id)=>document.getElementById(id);
    $('authError').textContent = '';
    $('authSubmit').disabled = false;

    // reset visibility to a known baseline each time
    $('nameField').style.display = 'none';
    $('otpField').style.display = 'none';
    $('newPasswordField').style.display = 'none';
    $('emailField').style.display = 'block';
    $('passwordField').style.display = 'block';
    $('authTabs').style.display = 'flex';
    $('modalLinks').style.display = 'flex';
    $('backLinkWrap').style.display = 'none';

    $('tabLogin').classList.toggle('active', step==='login');
    $('tabSignup').classList.toggle('active', step==='signup');

    if(step === 'login'){
      $('authTitle').textContent = 'Welcome back';
      $('authSub').textContent = 'Sign in to your FileFlexer account.';
      $('authSubmit').textContent = 'Sign in';
    } else if(step === 'signup'){
      $('nameField').style.display = 'block';
      $('authTitle').textContent = 'Create your account';
      $('authSub').textContent = "We'll email you a 6-digit code to verify it's really you.";
      $('authSubmit').textContent = 'Send verification code';
    } else if(step === 'signup-otp'){
      $('authTabs').style.display = 'none';
      $('emailField').style.display = 'none';
      $('passwordField').style.display = 'none';
      $('modalLinks').style.display = 'none';
      $('otpField').style.display = 'block';
      $('backLinkWrap').style.display = 'flex';
      $('authTitle').textContent = 'Check your email';
      $('authSub').textContent = 'Enter the 6-digit code we sent to ' + (overlay.dataset.pendingEmail || 'your email') + '.';
      $('authSubmit').textContent = 'Verify & create account';
    } else if(step === 'forgot'){
      $('authTabs').style.display = 'none';
      $('passwordField').style.display = 'none';
      $('modalLinks').style.display = 'none';
      $('backLinkWrap').style.display = 'flex';
      $('authTitle').textContent = 'Reset your password';
      $('authSub').textContent = "Enter your account email and we'll send you a 6-digit code.";
      $('authSubmit').textContent = 'Send code';
    } else if(step === 'forgot-otp'){
      $('authTabs').style.display = 'none';
      $('emailField').style.display = 'none';
      $('passwordField').style.display = 'none';
      $('modalLinks').style.display = 'none';
      $('otpField').style.display = 'block';
      $('backLinkWrap').style.display = 'flex';
      $('authTitle').textContent = 'Enter the code';
      $('authSub').textContent = 'Enter the 6-digit code we sent to ' + (overlay.dataset.pendingEmail || 'your email') + '.';
      $('authSubmit').textContent = 'Verify code';
    } else if(step === 'reset'){
      $('authTabs').style.display = 'none';
      $('emailField').style.display = 'none';
      $('passwordField').style.display = 'none';
      $('modalLinks').style.display = 'none';
      $('newPasswordField').style.display = 'block';
      $('authTitle').textContent = 'Set a new password';
      $('authSub').textContent = 'Choose a new password for your account.';
      $('authSubmit').textContent = 'Reset password';
    }
  }

  function requireAuth(nextUrl){
    if(isLoggedIn()) return true;
    openAuthModal(nextUrl, 'signup');
    return false;
  }

  function finishAuth(){
    const overlay = document.getElementById('authOverlay');
    closeAuthModal();
    renderNavAuth();
    const next = overlay.dataset.next;
    if(next && next !== location.href){ location.href = next; }
    else { location.reload(); }
  }

  function wireModal(){
    const overlay = document.getElementById('authOverlay');
    if(!overlay) return;
    const $ = (id)=>document.getElementById(id);

    $('tabLogin').onclick = ()=>setStep('login');
    $('tabSignup').onclick = ()=>setStep('signup');
    $('authClose').onclick = closeAuthModal;
    overlay.onclick = (e)=>{ if(e.target===overlay) closeAuthModal(); };

    $('forgotLink').onclick = (e)=>{ e.preventDefault(); setStep('forgot'); };
    $('backLink').onclick = (e)=>{
      e.preventDefault();
      const cur = overlay.dataset.mode;
      if(cur === 'signup-otp') setStep('signup');
      else if(cur === 'forgot') setStep('login');
      else if(cur === 'forgot-otp') setStep('forgot');
      else if(cur === 'reset') setStep('login');
      else setStep('login');
    };
    $('otpResend').onclick = async (e)=>{
      e.preventDefault();
      const purpose = overlay.dataset.mode === 'signup-otp' ? 'signup' : 'reset';
      const errEl = $('authError');
      errEl.textContent = '';
      try{ await requestOtp(overlay.dataset.pendingEmail, purpose); toast('Code resent'); }
      catch(err){ errEl.textContent = err.message; }
    };

    $('authForm').onsubmit = async (e)=>{
      e.preventDefault();
      const mode = overlay.dataset.mode;
      const errEl = $('authError');
      const submitBtn = $('authSubmit');
      errEl.textContent = '';
      const email = $('authEmail').value;
      try{
        if(mode === 'login'){
          const pass = $('authPassword').value;
          await login(email, pass);
          finishAuth();

        } else if(mode === 'signup'){
          const name = $('authName').value;
          const pass = $('authPassword').value;
          if(!name.trim()) throw new Error('Please enter your name.');
          if(pass.length < 6) throw new Error('Password must be at least 6 characters.');
          const users = getUsers();
          if(users[email.trim().toLowerCase()]) throw new Error('An account with this email already exists.');
          overlay.dataset.pendingName = name.trim();
          overlay.dataset.pendingPassword = pass;
          overlay.dataset.pendingEmail = email.trim().toLowerCase();
          submitBtn.disabled = true; submitBtn.textContent = 'Sending code…';
          await requestOtp(email, 'signup');
          setStep('signup-otp');

        } else if(mode === 'signup-otp'){
          const code = $('authOtp').value;
          await verifyOtp(overlay.dataset.pendingEmail, code);
          await signup(overlay.dataset.pendingName, overlay.dataset.pendingEmail, overlay.dataset.pendingPassword);
          delete overlay.dataset.pendingPassword;
          finishAuth();

        } else if(mode === 'forgot'){
          const users = getUsers();
          if(!users[email.trim().toLowerCase()]) throw new Error('No account found with that email.');
          overlay.dataset.pendingEmail = email.trim().toLowerCase();
          submitBtn.disabled = true; submitBtn.textContent = 'Sending code…';
          await requestOtp(email, 'reset');
          setStep('forgot-otp');

        } else if(mode === 'forgot-otp'){
          const code = $('authOtp').value;
          await verifyOtp(overlay.dataset.pendingEmail, code);
          setStep('reset');

        } else if(mode === 'reset'){
          const newPass = $('authNewPassword').value;
          await resetPassword(overlay.dataset.pendingEmail, newPass);
          toast('Password updated. Please sign in.');
          setStep('login');
          $('authEmail').value = overlay.dataset.pendingEmail || '';
        }
      }catch(err){
        submitBtn.disabled = false;
        errEl.textContent = err.message;
      }
    };
  }

  /* ---------- Day / night theme ---------- */
  const THEME_KEY = 'ff_theme';
  function applyTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }
  function initTheme(){
    const saved = localStorage.getItem(THEME_KEY);
    const theme = saved === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }
  // Injects the day/night slider into the top-right of the nav on every page,
  // right next to the sign-in/account button — no per-page markup needed.
  function injectThemeToggle(){
    if(document.getElementById('ffThemeToggle')) return;
    const slot = document.getElementById('navAuthSlot');
    if(!slot || !slot.parentNode) return;
    const wrap = document.createElement('div');
    wrap.className = 'theme-toggle';
    wrap.id = 'ffThemeToggle';
    wrap.innerHTML = `
      <span class="tt-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"></path></svg>
      </span>
      <label class="tt-switch" title="Toggle day / night">
        <input type="checkbox" id="ffThemeSwitch">
        <span class="tt-slider"></span>
      </label>
      <span class="tt-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      </span>`;
    slot.parentNode.insertBefore(wrap, slot);
    const checkbox = wrap.querySelector('#ffThemeSwitch');
    checkbox.checked = (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark';
    checkbox.addEventListener('change', ()=> applyTheme(checkbox.checked ? 'dark' : 'light'));
  }

  // Adds a "show/hide" eye button inside any password field, without needing
  // to touch every page's modal markup — just wraps whatever's already there.
  function wirePasswordToggles(){
    ['authPassword','authNewPassword'].forEach(id=>{
      const input = document.getElementById(id);
      if(!input || input.dataset.pwWrapped) return;
      input.dataset.pwWrapped = '1';
      const wrap = document.createElement('div');
      wrap.className = 'pw-wrap';
      input.parentNode.insertBefore(wrap, input);
      wrap.appendChild(input);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'pw-toggle';
      btn.textContent = '👁';
      btn.setAttribute('aria-label', 'Show password');
      wrap.appendChild(btn);
      btn.onclick = ()=>{
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        btn.textContent = showing ? '👁' : '🙈';
        btn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
      };
    });
  }

  function renderNavAuth(){
    const slot = document.getElementById('navAuthSlot');
    if(!slot) return;
    const profile = getProfile();
    if(profile){
      const initial = (profile.name||profile.email).trim().charAt(0).toUpperCase();
      const avatarHtml = profile.avatar
        ? `<img src="${profile.avatar}" style="width:22px;height:22px;border-radius:50%;object-fit:cover;display:inline-block;vertical-align:-5px;margin-right:2px;">`
        : '👤 ';
      slot.innerHTML = `
        <a class="btn btn-ghost btn-sm" href="${resolvePath('profile.html')}">${avatarHtml}${profile.name || 'Account'}</a>
        <button class="btn btn-sm" id="navLogout">Log out</button>`;
      document.getElementById('navLogout').onclick = logout;
    } else {
      slot.innerHTML = `<button class="btn btn-primary btn-sm" id="navGetStarted">Get Started</button>`;
      document.getElementById('navGetStarted').onclick = ()=>openAuthModal(resolvePath('index.html'), 'signup');
    }
  }

  /* ---------- Generic history-detail modal ---------- */
  function ensureInfoModal(){
    let overlay = document.getElementById('ffInfoOverlay');
    if(overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'ffInfoOverlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:440px;">
        <button class="modal-close" id="ffInfoClose">✕</button>
        <div id="ffInfoThumbWrap" style="display:none;text-align:center;margin-bottom:16px;"></div>
        <h2 id="ffInfoTitle" style="font-size:19px;">Details</h2>
        <div id="ffInfoRows" style="margin-top:10px;display:flex;flex-direction:column;gap:10px;"></div>
        <div id="ffInfoNote" class="muted" style="color:var(--muted);font-size:12.5px;margin-top:16px;"></div>
        <div id="ffInfoActions" style="display:flex;gap:10px;margin-top:20px;"></div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeInfoModal(); });
    overlay.querySelector('#ffInfoClose').onclick = closeInfoModal;
    return overlay;
  }
  function closeInfoModal(){
    const overlay = document.getElementById('ffInfoOverlay');
    if(overlay) overlay.classList.remove('open');
  }
  // opts: { title, thumb, thumbClass, rows:[{label,value}], note, actions:[{label,onClick,primary}] }
  function openInfoModal(opts){
    const overlay = ensureInfoModal();
    overlay.querySelector('#ffInfoTitle').textContent = opts.title || 'Details';
    const thumbWrap = overlay.querySelector('#ffInfoThumbWrap');
    if(opts.thumb){
      thumbWrap.style.display = 'block';
      thumbWrap.innerHTML = `<img src="${opts.thumb}" class="${opts.thumbClass||''}" style="max-width:100%;max-height:220px;border-radius:10px;border:1px solid var(--border);">`;
    } else {
      thumbWrap.style.display = 'none';
      thumbWrap.innerHTML = '';
    }
    const rows = overlay.querySelector('#ffInfoRows');
    rows.innerHTML = (opts.rows||[]).map(r=>`
      <div style="display:flex;justify-content:space-between;gap:14px;background:var(--surface-2);border:1px solid var(--border);border-radius:9px;padding:10px 13px;">
        <span class="muted" style="color:var(--muted);font-size:13px;">${r.label}</span>
        <span style="font-size:13.5px;font-weight:600;text-align:right;">${r.value}</span>
      </div>`).join('');
    overlay.querySelector('#ffInfoNote').textContent = opts.note || '';
    const actions = overlay.querySelector('#ffInfoActions');
    actions.innerHTML = '';
    (opts.actions||[]).forEach(a=>{
      const btn = document.createElement('button');
      btn.className = 'btn btn-sm' + (a.primary ? ' btn-primary' : '');
      btn.textContent = a.label;
      btn.style.flex = '1';
      btn.onclick = a.onClick;
      actions.appendChild(btn);
    });
    overlay.classList.add('open');
  }

  function toast(msg){
    let t = document.getElementById('ffToast');
    if(!t){
      t = document.createElement('div'); t.id='ffToast'; t.className='toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(()=>t.classList.remove('show'), 2600);
  }

  initTheme(); // applied immediately (before DOMContentLoaded) to avoid a flash of the wrong theme

  document.addEventListener('DOMContentLoaded', ()=>{
    wireModal();
    renderNavAuth();
    injectThemeToggle();
    wirePasswordToggles();
  });

  return { signup, login, logout, isLoggedIn, currentUser, getProfile, updateProfileName, updateProfileAvatar,
           getData, setData, pushHistory, removeHistory, requireAuth, openAuthModal, resolvePath, toast,
           openInfoModal, closeInfoModal, renderNavAuth, requestOtp, verifyOtp, resetPassword,
           applyTheme, initTheme };
})();
