(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const motionSubscribers = new Set();
  const motionStorageKey = 'sg-portfolio-motion';
  let savedMotion = null;

  function onMediaChange(query, listener) {
    if (typeof query.addEventListener === 'function') query.addEventListener('change', listener);
    else if (typeof query.addListener === 'function') query.addListener(listener);
  }

  try {
    const value = localStorage.getItem(motionStorageKey);
    if (value === 'paused' || value === 'running') savedMotion = value;
  } catch { /* The site also works when browser storage is unavailable. */ }

  let motionPaused = motionQuery.matches || savedMotion === 'paused';
  const motionToggle = $('#motion-toggle');

  function applyMotionPreference() {
    motionPaused = motionQuery.matches || savedMotion === 'paused';
    root.dataset.motion = motionPaused ? 'paused' : 'running';
    if (motionToggle) {
      const labelText = motionQuery.matches
        ? 'Animations disabled by your system preference'
        : (motionPaused ? 'Enable animations' : 'Pause animations');
      motionToggle.disabled = motionQuery.matches;
      motionToggle.setAttribute('aria-pressed', String(motionPaused));
      motionToggle.setAttribute('aria-label', labelText);
      motionToggle.title = labelText;
      const label = $('[data-motion-label]', motionToggle);
      if (label) label.textContent = motionPaused ? 'Motion off' : 'Motion on';
    }
    motionSubscribers.forEach((subscriber) => subscriber(motionPaused));
    document.dispatchEvent(new CustomEvent('portfolio:motionchange', {
      detail: { paused: motionPaused }, bubbles: true,
    }));
  }

  motionToggle?.addEventListener('click', () => {
    if (motionQuery.matches) return;
    savedMotion = motionPaused ? 'running' : 'paused';
    try { localStorage.setItem(motionStorageKey, savedMotion); } catch { /* Optional preference. */ }
    applyMotionPreference();
  });

  onMediaChange(motionQuery, () => {
    // System accessibility preferences always take precedence over saved motion.
    applyMotionPreference();
  });

  applyMotionPreference();

  // Scroll feedback is event-driven; there is no perpetual page animation loop.
  const header = $('.site-header');
  const progress = $('#scroll-progress');
  const navLinks = $$('.nav-link');
  const sectionIds = new Set(['home', 'work', 'experience', 'recognition', 'about', 'contact']);
  const sections = $$('main section[id]').filter((section) => sectionIds.has(section.id));
  let scrollFrame = 0;

  function updateScrollState() {
    scrollFrame = 0;
    const scrollTop = Math.max(0, window.scrollY);
    const scrollable = Math.max(0, root.scrollHeight - window.innerHeight);
    header?.classList.toggle('scrolled', scrollTop > 20);
    if (progress) {
      const ratio = scrollable ? Math.min(1, scrollTop / scrollable) : 0;
      progress.style.transform = `scaleX(${ratio})`;
    }
    let activeSection = sections[0];
    const activationLine = Math.min(window.innerHeight * 0.36, 320);
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= activationLine) activeSection = section;
    });
    if (scrollable && scrollTop >= scrollable - 3) activeSection = sections[sections.length - 1];
    navLinks.forEach((link) => {
      const active = link.getAttribute('href') === `#${activeSection?.id}`;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }

  function scheduleScrollUpdate() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScrollState);
  }

  window.addEventListener('scroll', scheduleScrollUpdate, { passive: true });
  window.addEventListener('resize', scheduleScrollUpdate, { passive: true });
  updateScrollState();

  const menuToggle = $('.menu-toggle');
  const mobileMenu = $('#mobile-menu');

  function closeMenu(restoreFocus = false) {
    if (!mobileMenu || !menuToggle) return;
    mobileMenu.classList.remove('open');
    mobileMenu.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Open navigation menu');
    if (restoreFocus) menuToggle.focus({ preventScroll: true });
  }

  if (menuToggle && mobileMenu) {
    closeMenu();
    menuToggle.addEventListener('click', () => {
      const open = menuToggle.getAttribute('aria-expanded') !== 'true';
      mobileMenu.hidden = !open;
      mobileMenu.classList.toggle('open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    });
    $$('a', mobileMenu).forEach((link) => link.addEventListener('click', () => closeMenu()));
    document.addEventListener('pointerdown', (event) => {
      if (!mobileMenu.contains(event.target) && !menuToggle.contains(event.target)) closeMenu();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
        closeMenu(true);
      }
    });
    onMediaChange(window.matchMedia('(min-width: 801px)'), (event) => {
      if (event.matches) closeMenu();
    });
  }

  // Content is visible in the source. Only enhance once observing has succeeded.
  const revealElements = $$('.reveal');
  let revealObserver = null;

  function revealAll() {
    revealElements.forEach((element) => element.classList.add('in-view'));
    revealObserver?.disconnect();
  }

  if ('IntersectionObserver' in window && !motionPaused) {
    try {
      revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0.08 });
      revealElements.forEach((element) => revealObserver.observe(element));
      root.classList.add('motion-ready');
    } catch {
      root.classList.remove('motion-ready');
      revealAll();
    }
  } else revealAll();

  motionSubscribers.add((paused) => { if (paused) revealAll(); });

  const counters = $$('[data-count]').map((element) => ({
    element,
    target: Number(element.dataset.count),
    decimals: Math.min(4, Math.max(0, Number(element.dataset.decimals) || 0)),
    suffix: element.dataset.suffix || '',
    finalText: element.textContent,
    done: false,
    frame: 0,
  })).filter((counter) => Number.isFinite(counter.target));
  let counterObserver = null;

  function finishCounter(counter) {
    cancelAnimationFrame(counter.frame);
    counter.frame = 0;
    counter.done = true;
    counter.element.textContent = counter.finalText;
    counterObserver?.unobserve(counter.element);
  }

  function animateCounter(counter) {
    if (counter.done) return;
    if (motionPaused || document.hidden) { finishCounter(counter); return; }
    counter.done = true;
    const start = performance.now();
    const duration = 1100;
    function tick(now) {
      if (motionPaused || document.hidden) { finishCounter(counter); return; }
      const fraction = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - fraction, 3);
      counter.element.textContent = `${(counter.target * eased).toFixed(counter.decimals)}${counter.suffix}`;
      if (fraction < 1) counter.frame = requestAnimationFrame(tick);
      else finishCounter(counter);
    }
    counter.frame = requestAnimationFrame(tick);
  }

  if ('IntersectionObserver' in window && !motionPaused) {
    counterObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const counter = counters.find((item) => item.element === entry.target);
        if (counter) animateCounter(counter);
        counterObserver.unobserve(entry.target);
      });
    }, { threshold: 0.35 });
    counters.forEach((counter) => counterObserver.observe(counter.element));
  }

  motionSubscribers.add((paused) => {
    if (!paused) return;
    counterObserver?.disconnect();
    counters.forEach(finishCounter);
  });

  const filterButtons = $$('[data-filter]');
  const projectCards = $$('article[data-category]');
  const filterStatus = $('#filter-status');
  const categoryNames = { networks: 'network assurance', telecom: 'telecom' };

  function filterProjects(category) {
    let visibleCount = 0;
    projectCards.forEach((card) => {
      const visible = category === 'all' || card.dataset.category.split(/\s+/).includes(category);
      card.hidden = !visible;
      if (visible) {
        visibleCount += 1;
        card.classList.add('in-view');
      }
    });
    filterButtons.forEach((button) => {
      const active = button.dataset.filter === category;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('active', active);
    });
    if (filterStatus) {
      const type = category === 'all' ? '' : `${categoryNames[category] || category} `;
      filterStatus.textContent = `Showing ${category === 'all' ? 'all ' : ''}${visibleCount} ${type}project${visibleCount === 1 ? '' : 's'}.`;
    }
    scheduleScrollUpdate();
  }

  filterButtons.forEach((button) => button.addEventListener('click', () => {
    filterProjects(button.dataset.filter || 'all');
  }));

  const projects = {
    pathpilot: {
      title: 'PathPilot AI',
      kicker: 'Network change assurance · October 2026',
      description: 'A synthetic IPv4/FRRouting lab for exploring how a proposed route change affects a network. It parses supported static configurations and checks forwarding paths, reachability, isolation, return paths and N−1 link failures. Human or optional AI proposals pass deterministic BLOCK/REVIEW checks, with human approval required before a reviewed change can proceed.',
      stack: ['IPv4 / FRRouting', 'JavaScript / Node.js', 'Linux namespaces', 'Deterministic validation', 'GitHub Actions'],
      outcome: 'Compared nine predicted route/ICMP outcomes with Linux network-namespace experiments: zero mismatches. The public demo includes 23 automated tests and CI.',
      limitations: 'An independent synthetic lab using supported static-route configurations. These results do not establish production-network coverage; the demo does not apply changes to a live network.',
      demo: 'https://sidharthghai4242.github.io/pathpilot-ai/#config-lab',
      source: 'https://github.com/sidharthghai4242/pathpilot-ai',
    },
    wavesched: {
      title: 'WaveSched AI',
      kicker: 'Radio resource scheduling · October 2026',
      description: 'A seeded, synthetic 5G NR-inspired downlink simulator that explores how limited physical resource blocks are shared among users. I trained a weighted scheduling policy and compared it with round robin, proportional fair and maximum rate. An optional pretrained Qwen2.5 analyst runs through WebLLM/WebGPU in each visitor’s browser to select an analysis focus and follow-up experiment; simulator code determines allocations and numerical findings.',
      stack: ['5G NR-inspired simulation', 'Trained scheduling policy', 'JavaScript / Node.js', 'Qwen2.5', 'WebLLM / WebGPU'],
      outcome: 'Evaluated on 30 held-out synthetic cases, with per-user and per-slot evidence for throughput, fairness, delay and cell-edge service. The workbench exposes the trade-offs between policies.',
      limitations: 'A simplified research simulator rather than a deployed radio scheduler or a 3GPP conformance implementation. The pretrained browser LLM is separate from the trained scheduling policy and requires WebGPU and an opt-in model download.',
      demo: 'https://sidharthghai4242.github.io/WaveSched-AI/#arena',
      source: 'https://github.com/sidharthghai4242/WaveSched-AI',
    },
  };

  const projectDialog = $('#project-dialog');
  const commandDialog = $('#command-dialog');
  const commandSearch = $('#command-search');
  const commandItems = commandDialog ? $$('.command-item', commandDialog) : [];

  function closeDialog(dialog) {
    if (dialog?.open && typeof dialog.close === 'function') dialog.close();
  }

  function showDialog(dialog) {
    if (!dialog || typeof dialog.showModal !== 'function') return false;
    closeMenu();
    if (dialog !== commandDialog) closeDialog(commandDialog);
    if (dialog !== projectDialog) closeDialog(projectDialog);
    if (!dialog.open) dialog.showModal();
    return true;
  }

  $$('[data-project]').forEach((button) => button.addEventListener('click', () => {
    const project = projects[button.dataset.project];
    if (!project || !projectDialog) return;
    const fields = {
      '#project-title': project.title,
      '#project-kicker': project.kicker,
      '#project-description': project.description,
      '#project-outcome': project.outcome,
      '#project-limitations': project.limitations,
    };
    Object.entries(fields).forEach(([selector, value]) => {
      const element = $(selector, projectDialog);
      if (element) element.textContent = value;
    });
    const stack = $('#project-stack', projectDialog);
    if (stack) {
      stack.replaceChildren(...project.stack.map((technology) => {
        const pill = document.createElement('span');
        pill.textContent = technology;
        return pill;
      }));
    }
    const source = $('#project-source', projectDialog);
    if (source) {
      source.href = project.source;
      source.setAttribute('aria-label', `View ${project.title} source code on GitHub`);
    }
    const demo = $('#project-demo', projectDialog);
    if (demo) {
      demo.href = project.demo;
      demo.setAttribute('aria-label', `Try the ${project.title} live demo`);
    }
    // Native dialog restores the opener on close, including pointer use in Safari.
    button.focus({ preventScroll: true });
    showDialog(projectDialog);
  }));

  $$('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => closeDialog(button.closest('dialog')));
  });

  [projectDialog, commandDialog].filter(Boolean).forEach((dialog) => {
    function isOutside(event) {
      const rect = dialog.getBoundingClientRect();
      return event.clientX < rect.left || event.clientX > rect.right
        || event.clientY < rect.top || event.clientY > rect.bottom;
    }
    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (event) => {
      pressedOutside = event.target === dialog && isOutside(event);
    });
    dialog.addEventListener('click', (event) => {
      if (pressedOutside && event.target === dialog && isOutside(event)) closeDialog(dialog);
      pressedOutside = false;
    });
  });

  function filterCommands() {
    const query = (commandSearch?.value || '').trim().toLowerCase();
    let count = 0;
    commandItems.forEach((item) => {
      const label = `${item.textContent} ${item.dataset.search || ''}`.toLowerCase();
      const visible = query.split(/\s+/).every((word) => label.includes(word));
      item.hidden = !visible;
      item.classList.toggle('hidden', !visible);
      if (visible) count += 1;
    });
    const empty = $('#command-empty', commandDialog || document);
    if (empty) empty.hidden = count !== 0;
  }

  function openCommands(event) {
    if (!commandDialog || !commandSearch) return;
    if (event?.currentTarget instanceof HTMLElement) {
      event.currentTarget.focus({ preventScroll: true });
    }
    commandSearch.value = '';
    filterCommands();
    if (showDialog(commandDialog)) commandSearch.focus({ preventScroll: true });
  }

  $('#command-open')?.addEventListener('click', openCommands);
  commandSearch?.addEventListener('input', filterCommands);
  commandItems.forEach((item) => item.addEventListener('click', () => closeDialog(commandDialog)));

  commandDialog?.addEventListener('keydown', (event) => {
    const visibleItems = commandItems.filter((item) => !item.hidden && !item.disabled);
    if (!visibleItems.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const index = visibleItems.indexOf(document.activeElement);
      const next = index === -1
        ? (direction === 1 ? 0 : visibleItems.length - 1)
        : (index + direction + visibleItems.length) % visibleItems.length;
      visibleItems[next].focus({ preventScroll: true });
      visibleItems[next].scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
    if (event.key === 'Enter' && event.target === commandSearch) {
      event.preventDefault();
      visibleItems[0].click();
    }
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const editable = target instanceof Element && (
      target.closest('input, textarea, select') || target.isContentEditable
    );
    const commandShortcut = (event.metaKey || event.ctrlKey)
      && !event.altKey && event.key.toLowerCase() === 'k';
    const slashShortcut = event.key === '/' && !event.metaKey && !event.ctrlKey
      && !event.altKey && !editable;
    if (event.isComposing || (!commandShortcut && !slashShortcut) || !commandDialog) return;
    event.preventDefault();
    if (commandDialog.open && commandShortcut) closeDialog(commandDialog);
    else openCommands();
  });

  const toast = $('#toast');
  let toastTimer = 0;

  function notify(message) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('visible', 'show');
    toast.dataset.visible = 'true';
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('visible', 'show');
      toast.dataset.visible = 'false';
    }, 5000);
  }

  $$('[data-copy-email]').forEach((button) => button.addEventListener('click', async () => {
    const email = 'sidharthghai48@gmail.com';
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(email);
      notify('Email copied. Let’s build something together.');
    } catch {
      notify('Copy unavailable. Use the email link to contact sidharthghai48@gmail.com.');
    }
  }));

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
  const localTime = $('#local-time');
  const localTimeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  let clockTimer = 0;
  let lastClockUpdate = 0;

  function updateClock() {
    clearTimeout(clockTimer);
    if (!localTime || document.hidden) return;
    const now = Date.now();
    if (!lastClockUpdate || now - lastClockUpdate >= 60000) {
      localTime.textContent = `${localTimeFormatter.format(now)} IST`;
      lastClockUpdate = now;
    }
    clockTimer = window.setTimeout(updateClock, Math.max(1000, 60000 - (now - lastClockUpdate)));
  }
  updateClock();

  // Keep interaction transforms in CSS variables so layout/reveal transforms compose.
  const pointerEffects = [];
  function setupPointerEffect(element, kind) {
    const effect = { element, frame: 0, x: 0, y: 0, kind };
    pointerEffects.push(effect);
    element.addEventListener('pointermove', (event) => {
      if (motionPaused || !finePointerQuery.matches || event.pointerType === 'touch') return;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      effect.x = Math.max(-0.5, Math.min(0.5, (event.clientX - rect.left) / rect.width - 0.5));
      effect.y = Math.max(-0.5, Math.min(0.5, (event.clientY - rect.top) / rect.height - 0.5));
      if (effect.frame) return;
      effect.frame = requestAnimationFrame(() => {
        effect.frame = 0;
        if (motionPaused || document.hidden || !finePointerQuery.matches) return;
        if (kind === 'tilt') {
          element.style.setProperty('--tilt-x', `${(-effect.y * 6).toFixed(2)}deg`);
          element.style.setProperty('--tilt-y', `${(effect.x * 6).toFixed(2)}deg`);
        } else {
          element.style.setProperty('--mx', `${(effect.x * 8).toFixed(2)}px`);
          element.style.setProperty('--my', `${(effect.y * 8).toFixed(2)}px`);
        }
      });
    }, { passive: true });
    element.addEventListener('pointerleave', () => resetPointerEffect(effect));
    element.addEventListener('pointercancel', () => resetPointerEffect(effect));
    element.addEventListener('blur', () => resetPointerEffect(effect), true);
  }

  function resetPointerEffect(effect) {
    cancelAnimationFrame(effect.frame);
    effect.frame = 0;
    const properties = effect.kind === 'tilt' ? ['--tilt-x', '--tilt-y'] : ['--mx', '--my'];
    properties.forEach((property) => effect.element.style.removeProperty(property));
  }

  $$('[data-tilt]').forEach((element) => setupPointerEffect(element, 'tilt'));
  $$('[data-magnetic]').forEach((element) => setupPointerEffect(element, 'magnetic'));
  motionSubscribers.add((paused) => { if (paused) pointerEffects.forEach(resetPointerEffect); });
  onMediaChange(finePointerQuery, () => {
    if (!finePointerQuery.matches) pointerEffects.forEach(resetPointerEffect);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(clockTimer);
      pointerEffects.forEach(resetPointerEffect);
      counters.filter((counter) => counter.frame).forEach(finishCounter);
    } else {
      updateClock();
      scheduleScrollUpdate();
    }
  });
})();
