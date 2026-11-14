// Idea Atlas cloud sync. Local storage remains the offline source of truth until sign-in.
(() => {
  'use strict';
  const PROJECT_URL = 'https://seqsghbnwfxpakfgdinz.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_Q9ZmLPZgREpQ9fi-mmCsNQ_5FZArneO';
  const TABLE = 'idea_atlas_vaults';
  let bridge;
  let client;
  let user = null;
  let readyToPush = false;
  let saveTimer = null;
  let lastRemoteUpdate = '';
  let applyingRemote = false;
  let dirty = false;

  const badge = () => document.getElementById('syncBadge');
  const hint = () => document.getElementById('storageHint');
  function setStatus(label, detail) {
    if (badge()) badge().textContent = label + ' · V1.5';
    if (hint()) hint().textContent = detail;
  }

  async function pullVault({ quiet = false } = {}) {
    if (!user) return;
    if (dirty && readyToPush) {
      await pushVault();
      return;
    }
    setStatus('SYNCING', 'Checking your private cloud vault…');
    const { data, error } = await client.from(TABLE).select('vault,updated_at').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) {
      await pushVault();
      if (!quiet) bridge.toast('This device is now your first cloud copy.');
      return;
    }
    lastRemoteUpdate = data.updated_at || '';
    applyingRemote = true;
    try { bridge.setData(data.vault); }
    finally { applyingRemote = false; }
    readyToPush = true;
    setStatus('SYNCED', 'Saved on this device and privately synced • JSON backup available');
    if (!quiet) bridge.toast('Latest Idea Atlas loaded.');
  }

  async function pushVault() {
    if (!user) return;
    const payload = bridge.getData();
    const { data, error } = await client.from(TABLE).upsert({
      user_id: user.id,
      vault: payload,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' }).select('updated_at').single();
    if (error) throw error;
    lastRemoteUpdate = data.updated_at || '';
    dirty = false;
    readyToPush = true;
    setStatus('SYNCED', 'Saved on this device and privately synced • JSON backup available');
  }

  function queuePush() {
    if (!user || !readyToPush || applyingRemote) return;
    dirty = true;
    clearTimeout(saveTimer);
    setStatus('SAVING', 'Saved locally • sending changes to your private cloud vault…');
    saveTimer = setTimeout(() => pushVault().catch(handleSyncError), 700);
  }

  function handleSyncError(error) {
    console.error('Idea Atlas sync error', error);
    setStatus('OFFLINE', 'Saved safely on this device • cloud sync will retry');
  }

  function authDialog(message = '') {
    const signedIn = Boolean(user);
    bridge.openModal(`<div class="dialog-header"><div><div class="detail-kicker">PRIVATE CLOUD SYNC</div><h2>${signedIn ? 'Idea Atlas is connected' : 'Use the same vault everywhere'}</h2></div><button class="iconbtn" data-close aria-label="Close dialog">✕</button></div>
      ${message ? `<div class="academy-note">${bridge.safe(message)}</div>` : ''}
      ${signedIn ? `<p>Signed in as <strong>${bridge.safe(user.email || 'your account')}</strong>. Your phone and laptop can now share this private vault.</p>
        <div class="dialogactions"><button class="secondary" id="pullCloudButton">↻ Get latest copy</button><button class="danger" id="signOutCloudButton">Sign out</button></div>`
      : `<p>Your existing ideas stay on this device. Sign in with the same email and password on your phone and laptop to synchronize them.</p>
        <form id="cloudAuthForm">
          <div class="field"><label for="cloudEmail">Email</label><input id="cloudEmail" name="email" type="email" autocomplete="email" required></div>
          <div class="field"><label for="cloudPassword">Password</label><input id="cloudPassword" name="password" type="password" autocomplete="current-password" minlength="8" required></div>
          <div class="dialogactions"><button class="secondary" type="button" id="createCloudAccount">Create free account</button><button class="primary" type="submit">Sign in & sync</button></div>
        </form>
        <p class="hint">Cloud sync is optional. Local storage and JSON backups continue to work without it.</p>`}`, 'Idea Atlas cloud sync');
    if (signedIn) {
      document.getElementById('pullCloudButton').onclick = () => pullVault().catch(handleSyncError);
      document.getElementById('signOutCloudButton').onclick = async () => { await client.auth.signOut(); bridge.closeModal(); };
      return;
    }
    const form = document.getElementById('cloudAuthForm');
    form.onsubmit = async event => {
      event.preventDefault();
      const fields = new FormData(form);
      const { error } = await client.auth.signInWithPassword({ email: String(fields.get('email')).trim(), password: String(fields.get('password')) });
      if (error) authDialog(error.message);
      else bridge.closeModal();
    };
    document.getElementById('createCloudAccount').onclick = async () => {
      const fields = new FormData(form);
      const email = String(fields.get('email') || '').trim();
      const password = String(fields.get('password') || '');
      if (!email || password.length < 8) return authDialog('Enter your email and a password of at least 8 characters.');
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: 'https://beladiel.github.io/hof-card-scout/idea-atlas/' }
      });
      if (error) return authDialog(error.message);
      if (data.session) bridge.closeModal();
      else authDialog('Check your email to confirm the account, then return here and sign in.');
    };
  }

  async function initialize() {
    bridge = window.IdeaAtlasBridge;
    if (!bridge || !window.supabase?.createClient) {
      setStatus('LOCAL', 'Saved on this device • cloud library unavailable • JSON backup available');
      return;
    }
    client = window.supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    document.getElementById('cloudSyncButton').onclick = () => {
      document.getElementById('menu').classList.add('hidden');
      authDialog();
    };
    window.addEventListener('idea-atlas-local-save', queuePush);
    const { data } = await client.auth.getSession();
    user = data.session?.user || null;
    if (user) await pullVault({ quiet: true });
    else setStatus('LOCAL', 'Saved on this device • cloud sync available • JSON backup available');
    client.auth.onAuthStateChange((_event, session) => {
      const previousUserId = user?.id || null;
      user = session?.user || null;
      readyToPush = false;
      if (!user) return setStatus('LOCAL', 'Saved on this device • cloud sync available • JSON backup available');
      if (user.id !== previousUserId) pullVault({ quiet: true }).catch(handleSyncError);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && user && navigator.onLine) pullVault({ quiet: true }).catch(handleSyncError);
    });
  }

  window.addEventListener('idea-atlas-ready', () => initialize().catch(handleSyncError), { once: true });
})();
