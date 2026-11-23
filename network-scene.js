/* A small, dependency-free network atlas. All geometry is generated locally. */
(() => {
  'use strict';

  const canvas = document.getElementById('network-canvas');
  if (!canvas) return;

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) {
    canvas.style.background = 'radial-gradient(circle at 44% 38%, #4dbaac55, #143e3b88 38%, transparent 66%)';
    canvas.dataset.rendering = 'fallback';
    return;
  }

  const stage = canvas.closest('.network-stage') || canvas;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const TAU = Math.PI * 2;
  const state = {
    width: 0, height: 0, radius: 0, dpr: 1,
    time: 0, rotation: -0.42, lastTime: 0, frame: null,
    visible: true, eventPaused: false, pointerX: 0, pointerY: 0,
    tiltX: -0.12, tiltY: 0, pulses: [],
  };

  // Repeatable geometry prevents the constellation from changing on resize.
  let seed = 47137;
  function random() {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  }

  function vector(latitude, longitude, radius = 1) {
    return {
      x: Math.cos(latitude) * Math.sin(longitude) * radius,
      y: Math.sin(latitude) * radius,
      z: Math.cos(latitude) * Math.cos(longitude) * radius,
    };
  }

  const nodes = [];
  const clusters = [
    [-0.10, -0.34, 17], [0.44, 0.65, 15], [-0.50, 0.42, 12],
    [0.15, 1.63, 14], [0.62, -1.05, 12], [-0.33, -1.46, 13],
    [0.22, 2.9, 10], [-0.42, -2.9, 9],
  ];
  clusters.forEach(([latitude, longitude, count], cluster) => {
    for (let i = 0; i < count; i += 1) {
      const lat = latitude + (random() - 0.5) * 0.56;
      const lon = longitude + (random() - 0.5) * 0.64;
      nodes.push({ ...vector(lat, lon), cluster, size: 0.75 + random() * 1.1, phase: random() * TAU, hub: i === 0 });
    }
  });

  const routes = [];
  const routeKeys = new Set();
  function addRoute(a, b, trunk = false) {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (routeKeys.has(key)) return;
    routeKeys.add(key);
    const from = nodes[a];
    const to = nodes[b];
    const dot = Math.min(1, Math.max(-1, from.x * to.x + from.y * to.y + from.z * to.z));
    const angle = Math.acos(dot);
    if (angle < 0.015 || angle > 2.75) return;
    const segments = Math.max(6, Math.ceil(angle * 22));
    const path = [];
    for (let step = 0; step <= segments; step += 1) {
      const t = step / segments;
      const first = Math.sin((1 - t) * angle) / Math.sin(angle);
      const second = Math.sin(t * angle) / Math.sin(angle);
      const lift = 1 + Math.sin(t * Math.PI) * (trunk ? 0.09 : 0.013);
      path.push({
        x: (from.x * first + to.x * second) * lift,
        y: (from.y * first + to.y * second) * lift,
        z: (from.z * first + to.z * second) * lift,
      });
    }
    routes.push({ path, trunk, phase: random(), speed: 0.06 + random() * 0.06 });
  }

  nodes.forEach((node, index) => {
    const nearby = nodes.map((other, otherIndex) => ({
      index: otherIndex,
      distance: (node.x - other.x) ** 2 + (node.y - other.y) ** 2 + (node.z - other.z) ** 2,
    })).filter(other => other.index !== index).sort((a, b) => a.distance - b.distance);
    nearby.slice(0, node.hub ? 4 : 2).forEach(other => addRoute(index, other.index));
  });
  const hubs = nodes.map((node, index) => node.hub ? index : -1).filter(index => index >= 0);
  hubs.forEach((hub, index) => {
    addRoute(hub, hubs[(index + 1) % hubs.length], true);
    if (index % 2 === 0) addRoute(hub, hubs[(index + 3) % hubs.length], true);
  });

  const meridians = [];
  const parallels = [];
  for (let longitude = 0; longitude < TAU - 0.01; longitude += TAU / 18) {
    const path = [];
    for (let i = 0; i <= 54; i += 1) path.push(vector(-Math.PI / 2 + (i / 54) * Math.PI, longitude));
    meridians.push(path);
  }
  for (let row = -4; row <= 4; row += 1) {
    const path = [];
    for (let i = 0; i <= 90; i += 1) path.push(vector(row * Math.PI / 12, (i / 90) * TAU));
    parallels.push(path);
  }
  const dust = Array.from({ length: 48 }, () => ({
    x: random(), y: random(), size: random() * 0.8 + 0.25, phase: random() * TAU,
  }));

  function paused() {
    return reducedMotion.matches || document.documentElement.dataset.motion === 'paused' || state.eventPaused;
  }

  function running() {
    return state.visible && !document.hidden && !paused();
  }

  function project(point) {
    const yaw = state.rotation + state.tiltY;
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);
    const sinTilt = Math.sin(state.tiltX);
    const cosTilt = Math.cos(state.tiltX);
    const x = point.x * cosYaw + point.z * sinYaw;
    const depth = point.z * cosYaw - point.x * sinYaw;
    const y = point.y * cosTilt - depth * sinTilt;
    const z = point.y * sinTilt + depth * cosTilt;
    const perspective = 3.8 / (3.8 - z);
    return {
      x: state.width / 2 + x * state.radius * perspective,
      y: state.height / 2 - y * state.radius * perspective,
      z, scale: perspective,
    };
  }

  function strokePath(path, opacity, lineWidth, frontOnly = false) {
    let previous = project(path[0]);
    context.lineWidth = lineWidth;
    for (let i = 1; i < path.length; i += 1) {
      const next = project(path[i]);
      const depth = (previous.z + next.z) / 2;
      if (!frontOnly || depth > -0.1) {
        const visibility = depth < 0 ? 0.13 : 0.25 + depth * 0.75;
        context.strokeStyle = `rgba(111,224,196,${opacity * visibility})`;
        context.beginPath();
        context.moveTo(previous.x, previous.y);
        context.lineTo(next.x, next.y);
        context.stroke();
      }
      previous = next;
    }
  }

  function drawOrbit() {
    const cx = state.width / 2;
    const cy = state.height / 2;
    const r = state.radius;
    context.save();
    context.translate(cx, cy);
    context.rotate(-0.34);
    context.strokeStyle = 'rgba(113,216,195,0.13)';
    context.lineWidth = 0.65;
    context.beginPath();
    context.ellipse(0, 0, r * 1.47, r * 0.49, 0, 0, TAU);
    context.stroke();
    context.setLineDash([2, 9]);
    context.strokeStyle = 'rgba(113,216,195,0.10)';
    context.beginPath();
    context.ellipse(0, 0, r * 1.52, r * 0.53, 0, 0, TAU);
    context.stroke();
    context.setLineDash([]);
    const phase = state.time * 0.14 + 0.7;
    const x = Math.cos(phase) * r * 1.47;
    const y = Math.sin(phase) * r * 0.49;
    const glow = context.createRadialGradient(x, y, 0, x, y, 11);
    glow.addColorStop(0, 'rgba(198,255,230,0.6)');
    glow.addColorStop(1, 'rgba(111,224,196,0)');
    context.fillStyle = glow;
    context.fillRect(x - 11, y - 11, 22, 22);
    context.fillStyle = '#d9ffea';
    context.beginPath();
    context.arc(x, y, 1.65, 0, TAU);
    context.fill();
    context.restore();
  }

  function drawPackets(route, projectedPath) {
    const progress = (state.time * route.speed + route.phase) % 1;
    const position = progress * (projectedPath.length - 1);
    const index = Math.min(projectedPath.length - 2, Math.floor(position));
    const fraction = position - index;
    const a = projectedPath[index];
    const b = projectedPath[index + 1];
    const z = a.z + (b.z - a.z) * fraction;
    if (z < 0.02) return;
    const x = a.x + (b.x - a.x) * fraction;
    const y = a.y + (b.y - a.y) * fraction;
    const opacity = Math.min(1, z + 0.2);
    if (route.trunk) {
      const glow = context.createRadialGradient(x, y, 0, x, y, 8);
      glow.addColorStop(0, `rgba(196,255,223,${0.48 * opacity})`);
      glow.addColorStop(1, 'rgba(107,248,184,0)');
      context.fillStyle = glow;
      context.fillRect(x - 8, y - 8, 16, 16);
    }
    context.fillStyle = `rgba(213,255,230,${opacity * (route.trunk ? 0.95 : 0.65)})`;
    context.beginPath();
    context.arc(x, y, route.trunk ? 1.55 : 0.85, 0, TAU);
    context.fill();
  }

  function draw() {
    const { width, height, radius, dpr } = state;
    if (!width || !height) return;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;

    const atmosphere = context.createRadialGradient(cx, cy, radius * 0.45, cx, cy, radius * 1.65);
    atmosphere.addColorStop(0, 'rgba(44,155,130,0.07)');
    atmosphere.addColorStop(0.6, 'rgba(33,122,108,0.065)');
    atmosphere.addColorStop(1, 'rgba(23,76,69,0)');
    context.fillStyle = atmosphere;
    context.fillRect(0, 0, width, height);

    dust.forEach(star => {
      const opacity = 0.12 + (Math.sin(state.time * 0.5 + star.phase) + 1) * 0.07;
      context.fillStyle = `rgba(167,226,212,${opacity})`;
      context.beginPath();
      context.arc(star.x * width, star.y * height, star.size, 0, TAU);
      context.fill();
    });
    drawOrbit();

    const bodyRadius = radius * 1.037;
    const body = context.createRadialGradient(cx - radius * 0.32, cy - radius * 0.4, 0, cx, cy, bodyRadius);
    body.addColorStop(0, 'rgba(40,102,88,0.16)');
    body.addColorStop(0.75, 'rgba(13,49,45,0.10)');
    body.addColorStop(0.965, 'rgba(60,151,133,0.09)');
    body.addColorStop(1, 'rgba(103,228,198,0.025)');
    context.fillStyle = body;
    context.beginPath();
    context.arc(cx, cy, bodyRadius, 0, TAU);
    context.fill();
    context.strokeStyle = 'rgba(134,247,209,0.2)';
    context.lineWidth = 0.8;
    context.stroke();

    meridians.forEach(path => strokePath(path, 0.17, 0.55));
    parallels.forEach(path => strokePath(path, 0.22, 0.6));

    routes.forEach(route => {
      strokePath(route.path, route.trunk ? 0.62 : 0.30, route.trunk ? 0.85 : 0.65, true);
      drawPackets(route, route.path.map(project));
    });

    nodes.map(node => ({ ...node, projected: project(node) }))
      .sort((a, b) => a.projected.z - b.projected.z)
      .forEach(node => {
        const point = node.projected;
        if (point.z < -0.14) return;
        const opacity = Math.max(0.1, (point.z + 0.2) / 1.2);
        const pulse = 0.9 + Math.sin(state.time * 1.7 + node.phase) * 0.1;
        const size = node.size * point.scale * (node.hub ? 1.25 : 0.7);
        if (node.hub) {
          const haloSize = 13 * point.scale;
          const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, haloSize);
          halo.addColorStop(0, `rgba(94,246,184,${opacity * 0.42 * pulse})`);
          halo.addColorStop(1, 'rgba(94,246,184,0)');
          context.fillStyle = halo;
          context.fillRect(point.x - haloSize, point.y - haloSize, haloSize * 2, haloSize * 2);
          context.strokeStyle = `rgba(150,255,216,${opacity * 0.35})`;
          context.lineWidth = 0.65;
          context.beginPath();
          context.arc(point.x, point.y, size + 3.1, 0, TAU);
          context.stroke();
        }
        context.fillStyle = `rgba(${node.hub ? '218,255,229' : '145,245,209'},${opacity * pulse})`;
        context.beginPath();
        context.arc(point.x, point.y, size, 0, TAU);
        context.fill();
      });

    state.pulses.forEach(pulse => {
      const age = state.time - pulse.born;
      if (age < 0 || age > 2.1) return;
      const progress = age / 2.1;
      const eased = 1 - (1 - progress) ** 3;
      const pulseRadius = eased * radius * 1.7;
      context.strokeStyle = `rgba(169,255,217,${(1 - progress) ** 2 * 0.65})`;
      context.lineWidth = 1.15 - progress * 0.75;
      context.beginPath();
      context.arc(pulse.x, pulse.y, Math.max(1, pulseRadius), 0, TAU);
      context.stroke();
      context.strokeStyle = `rgba(98,235,191,${(1 - progress) ** 2 * 0.21})`;
      context.beginPath();
      context.arc(pulse.x, pulse.y, Math.max(1, pulseRadius * 0.84), 0, TAU);
      context.stroke();
    });
  }

  function tick(timestamp) {
    state.frame = null;
    if (!state.visible || document.hidden) {
      state.lastTime = 0;
      return;
    }
    if (!paused()) {
      const delta = state.lastTime ? Math.min((timestamp - state.lastTime) / 1000, 0.05) : 0;
      state.time += delta;
      state.rotation += delta * 0.065;
      const ease = 1 - Math.exp(-delta * 4);
      state.tiltX += ((-0.12 + state.pointerY * 0.17) - state.tiltX) * ease;
      state.tiltY += (state.pointerX * 0.25 - state.tiltY) * ease;
      state.pulses = state.pulses.filter(pulse => state.time - pulse.born < 2.1);
      state.lastTime = timestamp;
    } else {
      state.lastTime = 0;
    }
    draw();
    if (running()) state.frame = requestAnimationFrame(tick);
  }

  function refresh() {
    if (state.frame !== null) cancelAnimationFrame(state.frame);
    state.frame = null;
    state.lastTime = 0;
    if (state.visible && !document.hidden) state.frame = requestAnimationFrame(tick);
  }

  function resize() {
    const bounds = canvas.getBoundingClientRect();
    state.width = bounds.width;
    state.height = bounds.height;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.radius = Math.min(bounds.width * 0.32, bounds.height * 0.35);
    canvas.width = Math.max(1, Math.round(bounds.width * state.dpr));
    canvas.height = Math.max(1, Math.round(bounds.height * state.dpr));
    refresh();
  }

  stage.addEventListener('pointermove', event => {
    if (paused()) return;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    state.pointerX = Math.max(-1, Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2));
    state.pointerY = Math.max(-1, Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2));
  }, { passive: true });
  stage.addEventListener('pointerleave', () => {
    state.pointerX = 0;
    state.pointerY = 0;
  }, { passive: true });
  stage.addEventListener('pointerdown', event => {
    if (paused() || event.target.closest('a, button, input, select, textarea')) return;
    const bounds = canvas.getBoundingClientRect();
    state.pulses.push({ x: event.clientX - bounds.left, y: event.clientY - bounds.top, born: state.time });
    if (state.pulses.length > 5) state.pulses.shift();
  }, { passive: true });

  document.addEventListener('visibilitychange', refresh);
  document.addEventListener('portfolio:motionchange', event => {
    if (typeof event.detail?.paused === 'boolean') state.eventPaused = event.detail.paused;
    state.pulses = [];
    refresh();
  });
  const attributeObserver = new MutationObserver(records => {
    if (records.some(record => record.attributeName === 'data-motion')) {
      state.eventPaused = document.documentElement.dataset.motion === 'paused';
      state.pulses = [];
      refresh();
    }
  });
  attributeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', refresh);
  else reducedMotion.addListener(refresh);

  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener('resize', resize, { passive: true });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      state.visible = entries[0].isIntersecting;
      refresh();
    }, { rootMargin: '70px' }).observe(stage);
  }
  canvas.dataset.rendering = 'ready';
  resize();
})();
