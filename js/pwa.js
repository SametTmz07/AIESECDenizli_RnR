(() => {
  'use strict';
  const COOLDOWN_KEY = 'aiesec-denizli-install-dismissed';
  const COOLDOWN = 7 * 24 * 60 * 60 * 1000;
  const standalone = window.matchMedia('(display-mode: standalone)');
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installed = standalone.matches || navigator.standalone === true;
  let installPrompt = null;
  let registration = null;
  let dismissedAt = 0;
  let autoOfferTimer = null;
  let reloading = false;
  try { dismissedAt = Number(localStorage.getItem(COOLDOWN_KEY)) || 0; } catch { /* Optional preference. */ }

  const stack = document.createElement('div');
  stack.className = 'pwa-stack';
  stack.innerHTML = `
    <section class="pwa-panel" id="pwaUpdatePanel" aria-labelledby="pwaUpdateTitle" hidden>
      <h2 id="pwaUpdateTitle">Yeni sürüm hazır</h2>
      <p>Güncel sürüme geçmek için açık AIESEC Denizli sayfaları yenilenecek.</p>
      <div class="pwa-actions"><button type="button" class="pwa-primary" id="pwaUpdate">Güncelle</button><button type="button" id="pwaUpdateLater">Daha sonra</button></div>
      <p id="pwaUpdateStatus" role="status"></p>
    </section>
    <section class="pwa-panel" id="pwaInstallPanel" aria-labelledby="pwaInstallTitle" hidden>
      <h2 id="pwaInstallTitle">AIESEC Denizli’yi yükle</h2>
      <p id="pwaInstallDescription">Ana ekranından uygulama gibi aç; son kaydedilen sıralamalara çevrimdışı da ulaş.</p>
      <ol id="pwaIosSteps" hidden><li>Siteyi Safari’de aç.</li><li>Paylaş menüsünde <strong>Ana Ekrana Ekle</strong> seçeneğine dokun.</li><li>Varsa <strong>Web Uygulaması Olarak Aç</strong> seçeneğini onayla.</li></ol>
      <div class="pwa-actions"><button type="button" class="pwa-primary" id="pwaInstall">Yükle</button><button type="button" id="pwaInstallLater">Şimdi değil</button></div>
      <p id="pwaInstallStatus" role="status"></p>
    </section>`;
  document.body.append(stack);
  const connection = document.createElement('p');
  connection.className = 'pwa-connection';
  connection.id = 'pwaConnection';
  connection.setAttribute('role', 'status');
  connection.setAttribute('aria-live', 'polite');
  connection.hidden = true;
  (document.querySelector('.global-navbar') || document.body.firstElementChild).insertAdjacentElement('afterend', connection);
  document.querySelectorAll('iframe').forEach(frame => {
    const note = document.createElement('p');
    note.className = 'pwa-media-note';
    note.textContent = 'Videoyu izlemek için internet bağlantısı gerekir.';
    note.hidden = navigator.onLine;
    frame.insertAdjacentElement('afterend', note);
  });

  const installPanel = document.getElementById('pwaInstallPanel');
  const installButton = document.getElementById('pwaInstall');
  const manualButton = document.querySelector('[data-pwa-install]');
  const updatePanel = document.getElementById('pwaUpdatePanel');
  const updateButton = document.getElementById('pwaUpdate');
  const readyLabel = document.querySelector('[data-pwa-ready]');
  const focusReturn = () => (manualButton?.getClientRects().length ? manualButton : document.querySelector('.brand-logo'))?.focus();
  const hasInstallSupport = () => !installed && (ios || !!installPrompt);
  function syncInstallUI() {
    if (manualButton) manualButton.hidden = !hasInstallSupport();
    if (!hasInstallSupport()) installPanel.hidden = true;
  }
  function showInstallOffer(manual = false) {
    if (!hasInstallSupport() || updatePanel.hidden === false || (!manual && Date.now() - dismissedAt < COOLDOWN)) return;
    installPanel.hidden = false;
    installButton.hidden = ios && !installPrompt;
    document.getElementById('pwaIosSteps').hidden = !(ios && !installPrompt);
    document.getElementById('pwaInstallLater').textContent = ios && !installPrompt ? 'Kapat' : 'Şimdi değil';
    document.getElementById('pwaInstallStatus').textContent = '';
    if (manual) (installButton.hidden ? document.getElementById('pwaInstallLater') : installButton).focus();
  }
  function scheduleOffer() {
    clearTimeout(autoOfferTimer);
    if (hasInstallSupport()) autoOfferTimer = setTimeout(() => showInstallOffer(), 6000);
  }
  function dismissOffer() {
    dismissedAt = Date.now();
    try { localStorage.setItem(COOLDOWN_KEY, String(dismissedAt)); } catch { /* Works in memory too. */ }
    const hadFocus = installPanel.contains(document.activeElement);
    installPanel.hidden = true;
    if (hadFocus) focusReturn();
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    syncInstallUI();
    scheduleOffer();
  });
  window.addEventListener('appinstalled', () => {
    installed = true;
    installPrompt = null;
    clearTimeout(autoOfferTimer);
    syncInstallUI();
  });
  standalone.addEventListener('change', event => {
    installed = event.matches || navigator.standalone === true;
    syncInstallUI();
    if (!installed) scheduleOffer();
  });
  manualButton?.addEventListener('click', () => showInstallOffer(true));
  document.getElementById('pwaInstallLater').addEventListener('click', dismissOffer);
  installButton.addEventListener('click', async () => {
    const prompt = installPrompt;
    if (!prompt) return;
    installButton.disabled = true;
    try {
      const result = await prompt.prompt();
      const choice = result || await prompt.userChoice;
      if (choice?.outcome === 'dismissed') dismissOffer();
      installPrompt = null; // The native prompt is single-use; appinstalled confirms completion.
      syncInstallUI();
    } catch {
      installPrompt = null;
      installButton.hidden = true;
      document.getElementById('pwaInstallStatus').textContent = 'Kurulum başlatılamadı. Tarayıcının menüsündeki uygulama yükleme seçeneğini kullanabilirsin.';
      if (manualButton) manualButton.hidden = true;
    } finally { installButton.disabled = false; }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !installPanel.hidden) dismissOffer();
  });

  function showConnection() {
    const offline = navigator.onLine === false;
    document.body.classList.toggle('is-offline', offline);
    document.querySelectorAll('.pwa-media-note').forEach(note => { note.hidden = !offline; });
    connection.hidden = !offline;
    connection.dataset.state = offline ? 'offline' : 'online';
    connection.textContent = offline
      ? 'Çevrimdışısın. Kaydı olan bölümlerde son kaydedilen veriler gösterilir; yeni veriler, videolar ve dış bağlantılar için internet gerekir.'
      : '';
  }
  window.addEventListener('offline', () => {
    showConnection();
    window.dispatchEvent(new Event('aiesec:refresh-data'));
  });
  window.addEventListener('online', () => {
    showConnection();
    window.dispatchEvent(new Event('aiesec:refresh-data'));
    registration?.update().catch(() => {});
  });
  const drawer = document.getElementById('mobileDrawer');
  if (drawer) new MutationObserver(() => {
    const open = drawer.classList.contains('open');
    document.body.classList.toggle('pwa-drawer-open', open);
    stack.inert = open;
  }).observe(drawer, { attributes: true, attributeFilter: ['class'] });

  const themeColor = document.querySelector('meta[name="theme-color"]');
  function syncThemeColor() { if (themeColor) themeColor.content = document.documentElement.dataset.theme === 'dark' ? '#080a0e' : '#00a551'; }
  new MutationObserver(syncThemeColor).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  syncThemeColor();
  syncInstallUI();
  scheduleOffer();
  showConnection();

  function offerUpdate() {
    if (!registration?.waiting || !navigator.serviceWorker.controller) return;
    installPanel.hidden = true;
    updatePanel.hidden = false;
    updateButton.disabled = false;
  }
  document.getElementById('pwaUpdateLater').addEventListener('click', () => {
    const hadFocus = updatePanel.contains(document.activeElement);
    updatePanel.hidden = true;
    if (hadFocus) focusReturn();
  });
  updateButton.addEventListener('click', () => {
    if (!registration?.waiting) return;
    updateButton.disabled = true;
    document.getElementById('pwaUpdateStatus').textContent = 'Güncelleniyor…';
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    // Resolve relative to this script, so /repo/ hosting also registers /repo/sw.js.
    const scriptURL = document.currentScript?.src;
    const appURL = new URL('../', scriptURL || new URL('js/pwa.js', document.baseURI));
    let hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloading) { reloading = true; window.location.reload(); }
      hadController = true;
    });
    navigator.serviceWorker.register(new URL('sw.js', appURL), { scope: appURL.pathname, updateViaCache: 'none' }).then(reg => {
      registration = reg;
      offerUpdate();
      function watchWorker(worker) {
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed') offerUpdate();
        });
      }
      watchWorker(reg.installing);
      reg.addEventListener('updatefound', () => watchWorker(reg.installing));
      navigator.serviceWorker.ready.then(() => {
        if (readyLabel) readyLabel.textContent = 'Arayüz çevrimdışı kullanıma hazır. Veriler görüntülendikçe kaydedilir.';
        showConnection();
      });
    }).catch(() => {
      if (readyLabel) readyLabel.textContent = 'Uygulama kurulumu ve çevrimdışı açılış için HTTPS ve destekleyen bir tarayıcı gerekir.';
      showConnection();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        offerUpdate();
        registration?.update().catch(() => {});
      }
    });
  } else if (readyLabel) readyLabel.textContent = 'Uygulama kurulumu ve çevrimdışı açılış için HTTPS ve destekleyen bir tarayıcı gerekir.';
})();
