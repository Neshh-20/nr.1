(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  // Footer year
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Mobile menu
  const burger = $('#hamburger');
  const drawer = $('#mobileDrawer');
  if (burger && drawer) {
    const setOpen = (isOpen) => {
      drawer.setAttribute('data-open', String(isOpen));
      drawer.classList.toggle('hidden', !isOpen);
      burger.setAttribute('aria-expanded', String(isOpen));
    };

    burger.addEventListener('click', () => {
      const open = drawer.getAttribute('data-open') === 'true';
      setOpen(!open);
    });

    // Close drawer after click on a link (better mobile UX)
    $$('#mobileDrawer a').forEach((a) => {
      a.addEventListener('click', () => setOpen(false));
    });
  }

  // Active link highlight (robust against "/", query params, hashes)
  const path = (location.pathname.split('/').pop() || 'index.html');
  const cleanPath = path.split('?')[0].split('#')[0];
  $$('.navlinks a, #mobileDrawer a').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href) return;
    const cleanHref = href.split('?')[0].split('#')[0];
    if (cleanHref === cleanPath) a.classList.add('active');
  });

  // Menu tabs (speisekarte)
  const tabs = $$('.tab');
  if (tabs.length) {
    const panels = $$('.menu-panel');

    // A11y: make tabs behave like real tabs
    tabs.forEach((t, i) => {
      if (!t.id) t.id = `menu-tab-${i + 1}`;
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', 'false');
      t.tabIndex = i === 0 ? 0 : -1;
    });

    panels.forEach((p) => {
      p.setAttribute('role', 'tabpanel');
      p.setAttribute('tabindex', '0');
      const tab = tabs.find((t) => t.dataset.target === p.id);
      if (tab) {
        tab.setAttribute('aria-controls', p.id);
        p.setAttribute('aria-labelledby', tab.id);
      }
    });

    const show = (id) => {
      tabs.forEach((t) => {
        const active = t.dataset.target === id;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', String(active));
        t.tabIndex = active ? 0 : -1;
      });
      panels.forEach((p) => {
        const isActive = p.id === id;
        p.classList.toggle('hidden', !isActive);
      });
    };

    tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.target)));

    // Keyboard support: ArrowLeft/ArrowRight/Home/End
    tabs.forEach((t, idx) => {
      t.addEventListener('keydown', (e) => {
        const key = e.key;
        const last = tabs.length - 1;
        let next = null;
        if (key === 'ArrowRight') next = idx === last ? 0 : idx + 1;
        if (key === 'ArrowLeft') next = idx === 0 ? last : idx - 1;
        if (key === 'Home') next = 0;
        if (key === 'End') next = last;
        if (next === null) return;
        e.preventDefault();
        tabs[next].focus();
        show(tabs[next].dataset.target);
      });
    });

    show(tabs[0].dataset.target);
  }

  // Cookie banner (essential-only)
  const cookieKey = 'lpc_cookie_consent_v1';
  const cookie = $('#cookieBanner');
  if (cookie && !localStorage.getItem(cookieKey)) {
    cookie.style.display = 'block';
    $('#cookieAccept')?.addEventListener('click', () => {
      localStorage.setItem(cookieKey, 'accepted');
      cookie.style.display = 'none';
    });
  } else if (cookie) {
    cookie.style.display = 'none';
  }

  // Reservation rules (global limit via Netlify Function)
const resForm = $('#reservationForm');
if (resForm) {
  const dateEl = $('#resDate');
  const timeEl = $('#resTime');
  const msgEl = $('#resMessage');
  const idEl = $('#resId');

  const SLOT_MINUTES = 90;
  const MAX_TABLES_PER_SLOT = 6;

  const pad = (n) => String(n).padStart(2, '0');
  const minutesOf = (hhmm) => {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const hhmmOf = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

  // Öffnungszeiten + letzte Reservierung (= 90 Min vor Ladenschluss)
  const getHours = (isoDate) => {
    const d = new Date(`${isoDate}T00:00:00`);
    const day = d.getDay(); // Sun 0 ... Sat 6

    // Sonntag
    if (day === 0) return { open: '10:00', close: '18:00' };

    // Freitag + Samstag
    if (day === 5 || day === 6) return { open: '11:00', close: '22:00' };

    // Montag – Donnerstag
    return { open: '11:00', close: '18:00' };
  };

  const setMessage = (text, ok = false) => {
    if (!msgEl) return;
    msgEl.textContent = text;
    msgEl.className = ok ? 'success' : 'notice';
    msgEl.classList.remove('hidden');
  };

  // date: min today
  if (dateEl) {
    const today = new Date();
    const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    dateEl.min = iso;
  }

  // generate stable reservation id (prevents double-count on retry)
  if (idEl && !idEl.value) {
    const existing = sessionStorage.getItem('lpc_res_id');
    const rid = existing || (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
    sessionStorage.setItem('lpc_res_id', rid);
    idEl.value = rid;
  }

  const applyTimeLimits = () => {
    if (!dateEl || !timeEl || !dateEl.value) return;
    const hours = getHours(dateEl.value);
    const last = hhmmOf(minutesOf(hours.close) - SLOT_MINUTES);

    timeEl.min = hours.open;
    timeEl.max = last;
    timeEl.step = 900; // 15 minutes
  };

  const timeInRange = () => {
    if (!dateEl?.value || !timeEl?.value) return false;
    const hours = getHours(dateEl.value);
    const last = hhmmOf(minutesOf(hours.close) - SLOT_MINUTES);
    return timeEl.value >= hours.open && timeEl.value <= last;
  };

  // Live feedback
  dateEl?.addEventListener('change', () => {
    applyTimeLimits();
    msgEl?.classList.add('hidden');
  });

  timeEl?.addEventListener('change', () => {
    if (timeEl.value && !timeInRange()) {
      setMessage('Zu dieser Uhrzeit sind keine Reservierungen möglich. Bitte wähle eine andere Uhrzeit.');
    } else {
      msgEl?.classList.add('hidden');
    }
  });

  applyTimeLimits();

  // Submit: check global slot capacity (server-side)
  let approved = false;

  resForm.addEventListener('submit', async (e) => {
    if (approved) return;

    if (!dateEl?.value || !timeEl?.value) return;

    if (!timeInRange()) {
      e.preventDefault();
      setMessage('Zu dieser Uhrzeit sind keine Reservierungen möglich. Bitte wähle eine andere Uhrzeit.');
      return;
    }

    e.preventDefault();

    try {
      const res = await fetch('/.netlify/functions/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: dateEl.value,
          time: timeEl.value,
          res_id: idEl?.value || null,
          slot_minutes: SLOT_MINUTES,
          max_tables: MAX_TABLES_PER_SLOT
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        setMessage(data.message || 'Leider hat das nicht geklappt. Bitte wähle einen anderen Zeitraum.');
        return;
      }

      approved = true;
      msgEl?.classList.add('hidden');

      // continue with Netlify Forms submit
      resForm.submit();
    } catch (err) {
      setMessage('Netzwerkfehler. Bitte versuche es erneut oder wähle einen anderen Zeitraum.');
    }
  });
}

})();
