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

  // Reservation rules
  const resForm = $('#reservationForm');
  if (resForm) {
    const dateEl = $('#resDate');
    const timeEl = $('#resTime');
    const msgEl = $('#resMessage');

    const OPEN_TIME = '10:30';
    const LAST_TIME = '16:30'; // last reservation time
    const CLOSED_DAY = 3; // Wednesday (Sun 0 ... Sat 6)

    // Set input limits
    if (timeEl) {
      timeEl.min = OPEN_TIME;
      timeEl.max = LAST_TIME;
      timeEl.step = 900; // 15 minutes
    }

    // date: min today
    if (dateEl) {
      const today = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
      dateEl.min = iso;
    }

    const setMessage = (text, ok = false) => {
      if (!msgEl) return;
      msgEl.textContent = text;
      msgEl.className = ok ? 'success' : 'notice';
      msgEl.classList.remove('hidden');
    };

    const isWednesday = (d) => {
      if (!d) return false;
      const dt = new Date(`${d}T00:00:00`);
      return dt.getDay() === CLOSED_DAY;
    };

    const timeInRange = (t) => {
      if (!t) return false;
      return t >= OPEN_TIME && t <= LAST_TIME;
    };

    // Live feedback
    dateEl?.addEventListener('change', () => {
      if (isWednesday(dateEl.value)) {
        setMessage('Mittwoch ist Ruhetag – bitte wähle einen anderen Tag.');
      } else {
        msgEl?.classList.add('hidden');
      }
    });

    timeEl?.addEventListener('change', () => {
      if (!timeInRange(timeEl.value)) {
        setMessage(`Reservierungen sind nur zwischen ${OPEN_TIME} und ${LAST_TIME} möglich.`);
      } else {
        msgEl?.classList.add('hidden');
      }
    });

    resForm.addEventListener('submit', (e) => {
      // Hard validation
      if (isWednesday(dateEl?.value)) {
        e.preventDefault();
        setMessage('Mittwoch ist Ruhetag – bitte wähle einen anderen Tag.');
        return;
      }

      if (!timeInRange(timeEl?.value)) {
        e.preventDefault();
        setMessage(`Reservierungen sind nur zwischen ${OPEN_TIME} und ${LAST_TIME} möglich.`);
        return;
      }

      // If user selected today, ensure time not in the past
      try {
        const now = new Date();
        if (dateEl?.value && timeEl?.value) {
          const chosenDate = new Date(`${dateEl.value}T00:00:00`);
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (chosenDate.getTime() === today.getTime()) {
            const [hh, mm] = timeEl.value.split(':').map(Number);
            const chosen = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0);
            if (chosen.getTime() < now.getTime()) {
              e.preventDefault();
              setMessage('Bitte wähle eine Uhrzeit in der Zukunft.');
            }
          }
        }
      } catch (_) {}
    });
  }
})();
