// Banque de papa et maman, in 90 seconds. HTML + WebGL2 + plain JavaScript, no library.
// Everything on screen is a pure function of the time t (render(t)), so the browser player
// and the frame-by-frame recording (scripts/record-explainer.mjs) show exactly the same video.
(() => {
  'use strict';

  const W = 1280;
  const H = 720;
  const DURATION = 88;
  const IMG = '../guide/img/';
  const RECORD = new URLSearchParams(location.search).has('record');
  if (RECORD) document.body.classList.add('record');

  // ---------- subtitles (French, English below) ----------
  const CUES = [
    [0.5, 6, "Une tirelire virtuelle qui paie des intérêts… et la banque, c'est toi.", 'A virtual piggy bank that pays interest… and you are the bank.'],
    [6, 10.5, "Pour un enfant, les intérêts composés, c'est abstrait.", 'For a child, compound interest is abstract.'],
    [10.5, 15.5, "Ici, chaque jour, l'argent de la veille rapporte un peu…", "Here, every day, yesterday's money earns a little…"],
    [15.5, 20, '…et ce petit peu rapporte à son tour. Ça se voit !', '…and that little bit earns too. You can see it!'],
    [20, 24, 'Il voit sa pièce se remplir avec les intérêts de la semaine.', "They watch a coin fill up with the week's interest."],
    [24, 28, "Garder sa pièce, c'est permis : la courbe montre ce qu'elle aurait rapporté.", 'Keeping a coin is fine: the chart shows what it would have earned.'],
    [28, 34, 'Tout est chiffré sur ton téléphone. Le serveur ne peut rien lire.', "Everything is encrypted on your phone. The server can't read a thing."],
    [34, 38, 'Ta propre banque : un clic sur « Deploy to Cloudflare ». C\'est gratuit.', 'Run your own: one click on “Deploy to Cloudflare”. It’s free.'],
    [38, 42, "Choisis un mot de passe d'administration de 32 caractères ou plus.", 'Pick an admin password of 32 characters or more.'],
    [42, 46, 'Sur /admin : crée ta banque, ou invite une famille amie.', "On /admin: create your own bank, or invite a friend's family."],
    [46, 50, "Un prénom, l'argent de poche, un taux : la banque de ton enfant est créée.", "A first name, pocket money, a rate: your child's bank is ready."],
    [50, 55, 'Ces 12 mots sont la seule clé. Imprime la carte, range-la avec la tirelire.', 'These 12 words are the only key. Print the card, keep it with the piggy bank.'],
    [55, 60, "Le QR code va sur le téléphone de ton enfant, sur l'écran d'accueil.", "The QR code goes on your child's phone, on the home screen."],
    [60, 65, 'Chaque dimanche : la pièce va à la banque, ou ton enfant la garde ?', 'Every Sunday: does the coin go to the bank, or does your child keep it?'],
    [65, 70, 'Télécharge une sauvegarde et range-la hors de ton téléphone.', 'Download a backup and keep it off your phone.'],
    [70, 75, 'Et ton enfant ? Son solde, les centimes du jour, sa pièce…', "And your child? Their balance, today's cents, their coin…"],
    [75, 80, '…sa courbe, ses deux avenirs pour son anniversaire, et son livret.', '…their chart, two futures for their birthday, and their passbook.'],
    [80, 87.5, 'Libre, gratuit, et rien de lisible sur le serveur.', 'Free, open source, and nothing readable on the server.'],
  ];

  // ---------- helpers ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v;
      else if (k === 'style') Object.assign(el.style, v);
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const ramp = (t, a, b) => clamp01((t - a) / (b - a));
  const ease = (x) => 1 - Math.pow(1 - clamp01(x), 3);
  const easeInOut = (x) => {
    x = clamp01(x);
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  };
  const mix = (a, b, k) => a + (b - a) * k;
  const at = (el, x, y, extra = '') => {
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) ${extra}`;
  };
  const show = (el, a) => {
    el.style.opacity = String(clamp01(a));
  };
  const abs = (el) => {
    el.classList.add('abs');
    el.style.left = '0';
    el.style.top = '0';
    return el;
  };
  const money = (n) => `${Math.round(n)} €`;
  /** A screenshot in a fixed window; scroll(k) moves it from its top (0) to its bottom (1). */
  function frame(name, width, height) {
    const pic = h('img', { src: IMG + name, alt: '', style: { width: `${width}px`, display: 'block' } });
    const root = abs(h('div', { style: { width: `${width}px`, height: `${height}px`, overflow: 'hidden', borderRadius: '18px', background: '#EEF4F1', boxShadow: '0 24px 50px rgba(0,0,0,.45)' } }, pic));
    const scroll = (k) => {
      pic.style.transform = `translateY(${(-clamp01(k) * Math.max(0, pic.offsetHeight - height)).toFixed(1)}px)`;
    };
    return { root, scroll };
  }
  const svg = (markup, size) => {
    const span = h('span', { style: { display: 'inline-block', width: `${size}px`, height: `${size}px`, verticalAlign: 'middle' } });
    span.innerHTML = markup;
    return span;
  };
  const LOCK = '<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="#E2BE5C" stroke-width="2.4" stroke-linecap="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" fill="#E2BE5C33"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>';
  const POINTER = '<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M5 2.5v17l4.6-4.3 3 6.6 3-1.4-3-6.4 6.4-.3z" fill="#fff" stroke="#0F1830" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  const stage = document.getElementById('stage');
  const scenes = [];
  function scene(start, end, build, update) {
    const el = h('div', { class: 'scene' });
    build(el);
    stage.append(el);
    scenes.push({ start, end, el, update });
  }

  function phone(parts) {
    const strip = h('div', { class: 'strip' }, parts);
    const root = abs(h('div', { class: 'phone' }, h('div', { class: 'screen' }, strip)));
    return { root, strip };
  }
  const cropped = (name, height) => h('div', { style: { height: `${height}px`, overflow: 'hidden', marginBottom: '10px' } }, h('img', { src: IMG + name, alt: '' }));
  const shot = (name) => h('img', { src: IMG + name, alt: '' });

  // ---------- WebGL2 background: navy glow and rising gold coins ----------
  const canvas = h('canvas', { class: 'bg', width: W, height: H, 'aria-hidden': 'true' });
  stage.append(canvas);
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: true, premultipliedAlpha: false });
  const COINS = 42;
  let drawBackground = () => {};
  if (gl) {
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const program = (vs, fs) => {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      return p;
    };
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const sky = program(
      `#version 300 es
       in vec2 aQuad; void main() { gl_Position = vec4(aQuad, 0.0, 1.0); }`,
      `#version 300 es
       precision highp float;
       uniform float uTime; uniform vec2 uRes; out vec4 o;
       void main() {
         vec2 uv = gl_FragCoord.xy / uRes;
         vec3 navy = vec3(0.059, 0.094, 0.188), card = vec3(0.086, 0.133, 0.247);
         float g = 0.5 + 0.5 * sin(uv.x * 3.0 + uTime * 0.15) * cos(uv.y * 2.2 - uTime * 0.11);
         vec3 col = mix(navy, card, g * 0.85);
         vec2 c = vec2(0.78 + 0.06 * sin(uTime * 0.21), 0.72 + 0.05 * cos(uTime * 0.17));
         float d = length((uv - c) * vec2(uRes.x / uRes.y, 1.0));
         col += vec3(0.85, 0.66, 0.23) * 0.11 * exp(-d * d * 2.6);
         o = vec4(col, 1.0);
       }`,
    );
    const coins = program(
      `#version 300 es
       in vec2 aQuad;
       uniform float uTime; uniform vec2 uRes; uniform float uIntensity;
       out vec2 vUv; out float vSpin; out float vAlpha;
       float hash(float n) { return fract(sin(n * 127.1) * 43758.5453); }
       void main() {
         float id = float(gl_InstanceID);
         float size = mix(10.0, 38.0, hash(id + 1.0));
         float speed = mix(14.0, 40.0, hash(id + 2.0));
         float span = uRes.y + 160.0;
         float y = mod(hash(id + 4.0) * span - uTime * speed, span) - 80.0;
         float x = hash(id + 3.0) * uRes.x + sin(uTime * 0.5 + id) * 16.0;
         vec2 pos = vec2(x, y) + aQuad * size;
         vSpin = uTime * mix(0.5, 1.5, hash(id + 5.0)) + id;
         vUv = aQuad;
         vAlpha = mix(0.10, 0.42, hash(id + 6.0)) * uIntensity;
         vec2 clip = pos / uRes * 2.0 - 1.0;
         gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
       }`,
      `#version 300 es
       precision highp float;
       in vec2 vUv; in float vSpin; in float vAlpha; out vec4 o;
       void main() {
         float c = cos(vSpin);
         float sx = max(abs(c), 0.3);
         vec2 p = vec2(vUv.x / sx, vUv.y);
         float r = length(p);
         if (r > 1.0) discard;
         vec3 gold = vec3(0.85, 0.66, 0.23), deep = vec3(0.61, 0.45, 0.06);
         vec3 col = mix(gold, deep, smoothstep(0.74, 0.84, r));
         col += 0.4 * pow(max(0.0, 1.0 - length(p - vec2(-0.35, -0.4))), 3.0) * (c > 0.0 ? 1.0 : 0.45);
         o = vec4(col, vAlpha * (1.0 - smoothstep(0.94, 1.0, r)));
       }`,
    );
    const bind = (p) => {
      gl.useProgram(p);
      const loc = gl.getAttribLocation(p, 'aQuad');
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      gl.uniform1f(gl.getUniformLocation(p, 'uTime'), drawBackground.t);
      gl.uniform2f(gl.getUniformLocation(p, 'uRes'), W, H);
    };
    drawBackground = (t, intensity) => {
      drawBackground.t = t;
      gl.viewport(0, 0, W, H);
      gl.disable(gl.BLEND);
      bind(sky);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      bind(coins);
      gl.uniform1f(gl.getUniformLocation(coins, 'uIntensity'), intensity);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, COINS);
    };
  }
  // Coins shine in the title and the outro, and step back behind screenshots.
  const coinIntensity = (t) => (t < 6 ? 1 : t > 80 ? mix(0.45, 1, ramp(t, 80, 82)) : t < 8 ? mix(1, 0.45, ramp(t, 6, 8)) : 0.45);

  // ---------- 1. Title (0–6) ----------
  scene(0, 6, (el) => {
    el.append(
      (el.logo = abs(h('img', { src: IMG + 'icon.png', alt: '', style: { width: '150px', height: '150px', borderRadius: '34px', boxShadow: '0 20px 60px rgba(217,169,58,.35)' } }))),
      (el.t1 = abs(h('div', { class: 'title big', style: { width: `${W}px`, textAlign: 'center' } }, 'Banque de papa et maman'))),
      (el.t2 = abs(h('div', { class: 'small', style: { width: `${W}px`, textAlign: 'center' } }, 'Une tirelire virtuelle qui paie des intérêts · ', h('span', { lang: 'en' }, 'Mum and dad’s bank')))),
      (el.t3 = abs(h('div', { class: 'hand', style: { width: `${W}px`, textAlign: 'center', fontSize: '40px', color: '#E2BE5C' } }, "…et la banque, c'est toi."))),
    );
  }, (lt, d, el) => {
    at(el.logo, W / 2 - 75, 120 + Math.sin(lt * 2) * 6 - (1 - ease(ramp(lt, 0, 1))) * 40, `scale(${mix(0.6, 1, ease(ramp(lt, 0, 1)))})`);
    at(el.t1, 0, 300 + (1 - ease(ramp(lt, 0.4, 1.4))) * 30);
    show(el.t1, ramp(lt, 0.4, 1.4));
    at(el.t2, 0, 386);
    show(el.t2, ramp(lt, 1.2, 2.2));
    at(el.t3, 0, 440);
    show(el.t3, ramp(lt, 2.6, 3.6));
  });

  // ---------- 2. Compound interest, live (6–20) ----------
  const DAYS = 5 * 365;
  const piggy = new Float64Array(DAYS + 1);
  const bank = new Float64Array(DAYS + 1);
  for (let d = 0, p = 0, b = 0; d <= DAYS; d++) {
    const coin = d % 7 === 0 ? 2 : 0;
    b = b * (1 + 0.12 / 365) + coin; // the app's rule: yesterday's balance earns apr / 365
    p += coin;
    piggy[d] = p;
    bank[d] = b;
  }
  scene(6, 20, (el) => {
    const c = h('canvas', { width: 1440, height: 720, style: { width: '720px', height: '360px' } });
    el.ctx = c.getContext('2d');
    el.ctx.scale(2, 2);
    el.append(
      abs(h('div', { class: 'kicker', style: { transform: 'translate(70px, 50px)' } }, 'Pourquoi ? · Why?')),
      (el.heading = abs(h('div', { class: 'title mid' }, 'Les intérêts composés, pour de vrai'))),
      (el.chart = abs(c)),
      (el.cards = abs(h('div', { style: { width: '360px' } },
        h('div', { class: 'chip', style: { display: 'block', borderColor: '#8C97AB' } }, 'Tirelire · Piggy bank', h('br'), (el.vPiggy = h('b', { style: { fontSize: '36px' } }, '0 €'))),
        h('div', { class: 'chip', style: { display: 'block', borderColor: '#D9A93A' } }, 'Banque de papa et maman, 12 %/an', h('br'), (el.vBank = h('b', { style: { fontSize: '36px', color: '#E2BE5C' } }, '0 €'))),
        (el.gain = h('div', { class: 'hand', style: { fontSize: '40px', color: '#E2BE5C', marginTop: '10px' } }, '')),
      ))),
    );
    at(el.heading, 70, 84);
    at(el.chart, 60, 170);
    at(el.cards, 860, 190);
  }, (lt, d, el) => {
    const p = easeInOut(ramp(lt, 1.2, 12.5));
    const n = Math.round(p * DAYS);
    const ctx = el.ctx;
    ctx.clearRect(0, 0, 720, 360);
    const top = 800;
    const X = (i) => 50 + (i / DAYS) * 650;
    const Y = (v) => 320 - (v / top) * 300;
    ctx.font = '15px "Atkinson Hyperlegible Next", sans-serif';
    for (let v = 0; v <= top; v += 200) {
      ctx.strokeStyle = 'rgba(180,191,206,.18)';
      ctx.beginPath();
      ctx.moveTo(50, Y(v));
      ctx.lineTo(700, Y(v));
      ctx.stroke();
      ctx.fillStyle = '#8C97AB';
      ctx.fillText(`${v} €`, 0, Y(v) + 5);
    }
    ['1 an', '2 ans', '3 ans', '4 ans', '5 ans'].forEach((label, i) => ctx.fillText(label, X((i + 1) * 365) - 18, 345));
    if (n > 0) {
      // the gain between the two lines
      ctx.beginPath();
      for (let i = 0; i <= n; i++) ctx.lineTo(X(i), Y(bank[i]));
      for (let i = n; i >= 0; i--) ctx.lineTo(X(i), Y(piggy[i]));
      ctx.fillStyle = 'rgba(217,169,58,.18)';
      ctx.fill();
      const line = (arr, color, width, dash) => {
        ctx.beginPath();
        for (let i = 0; i <= n; i++) ctx.lineTo(X(i), Y(arr[i]));
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.setLineDash(dash);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(X(n), Y(arr[n]), 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      };
      line(piggy, '#8C97AB', 3, [8, 7]);
      line(bank, '#D9A93A', 4, []);
    }
    el.vPiggy.textContent = money(piggy[n]);
    el.vBank.textContent = money(bank[n]);
    el.gain.textContent = n > 30 ? `+${money(bank[n] - piggy[n])} d'intérêts` : '';
    show(el.cards, ramp(lt, 0.8, 1.8));
  });

  // ---------- 3. The coin and the choice (20–28) ----------
  scene(20, 28, (el) => {
    el.append(
      abs(h('div', { class: 'kicker', style: { transform: 'translate(70px, 50px)' } }, 'Ce que voit ton enfant · What they see')),
      (el.a = frame('kid-coin.jpg', 470, 440)).root,
      (el.b = frame('kid-chart.jpg', 440, 470)).root,
      (el.la = abs(h('div', { class: 'label' }, 'La pièce se remplit · The coin fills up'))),
      (el.lb = abs(h('div', { class: 'label' }, 'Et si… ? · What if…?'))),
    );
  }, (lt, d, el) => {
    at(el.a.root, 70 - (1 - ease(ramp(lt, 0, 1))) * 80, 120);
    el.a.scroll(0);
    at(el.la, 100, 538);
    show(el.la, ramp(lt, 1, 1.6));
    at(el.b.root, 720 + (1 - ease(ramp(lt, 3.6, 4.6))) * 120, 105);
    show(el.b.root, ramp(lt, 3.6, 4.4));
    el.b.scroll(easeInOut(ramp(lt, 4.6, 7)) * 0.75);
    at(el.lb, 750, 553);
    show(el.lb, ramp(lt, 4.6, 5.2));
  });

  // ---------- 4. Privacy (28–34) ----------
  scene(28, 34, (el) => {
    const box = (title, body, color) =>
      abs(h('div', { style: { width: '300px', padding: '22px', borderRadius: '18px', background: '#16223F', border: `3px solid ${color}`, textAlign: 'center' } },
        h('div', { style: { fontSize: '22px', color: '#B4BFCE' } }, title), h('div', { style: { fontSize: '32px', fontWeight: '800', marginTop: '6px' } }, body)));
    el.append(
      abs(h('div', { class: 'kicker', style: { transform: 'translate(70px, 50px)' } }, 'Confidentialité · Privacy')),
      (el.phoneBox = box('Ton téléphone · Your phone', 'Léa · 289,24 €', '#6E9BEF')),
      (el.wire = box('Envoyé · Sent', '8f3k…q9Zx', '#8C97AB')),
      (el.server = box('Le serveur · The server', '', '#D9A93A')),
      (el.chips = abs(h('div', { style: { width: '1140px', textAlign: 'center' } },
        ['Pas de compte · No account', 'Pas de mot de passe · No password', 'Aucun journal · No logs', 'Sauvegarde : un fichier à toi · Backup: your own file'].map((c) => h('span', { class: 'chip' }, c))))),
    );
  }, (lt, d, el) => {
    if (!el.server.dataset.lock) {
      el.server.dataset.lock = '1';
      el.server.lastChild.append(svg(LOCK, 34), ' illisible');
    }
    at(el.phoneBox, 70, 200);
    show(el.phoneBox, ramp(lt, 0.2, 0.8));
    at(el.wire, 70 + ease(ramp(lt, 1, 2.4)) * 420, 200);
    show(el.wire, ramp(lt, 1, 1.4));
    at(el.server, 910, 200);
    show(el.server, ramp(lt, 2.2, 2.8));
    at(el.chips, 70, 410);
    show(el.chips, ramp(lt, 3, 3.8));
  });

  // ---------- 5. Deploy your own (34–46) ----------
  scene(34, 46, (el) => {
    el.append(
      abs(h('div', { class: 'kicker', style: { transform: 'translate(70px, 50px)' } }, 'Installer · Deploy your own')),
      (el.steps = abs(h('ol', { class: 'steps', style: { width: '560px' } },
        h('li', {}, h('b', {}, '1'), 'Deploy to Cloudflare (gratuit · free)'),
        h('li', {}, h('b', {}, '2'), 'ADMIN_TOKEN : 32+ caractères'),
        h('li', {}, h('b', {}, '3'), '/admin → Créer ma banque · Inviter'),
      ))),
      (el.button = abs(h('div', { class: 'deploy' }, '☁  Deploy to Cloudflare'))),
      (el.done = abs(h('div', { class: 'small', style: { width: '520px', textAlign: 'center' } }, '✓ base de données · app · adresse .workers.dev'))),
      (el.ripple = abs(h('div', { class: 'ripple' }))),
      (el.cursor = abs(h('div', {}, svg(POINTER, 44)))),
      (el.field = abs(h('div', { class: 'field' }, h('small', {}, 'ADMIN_TOKEN · gestionnaire de mots de passe'), (el.dots = h('span', {}, ''))))),
      (el.admin = frame('admin-invite.jpg', 380, 500)).root,
    );
    at(el.steps, 70, 190);
  }, (lt, d, el) => {
    [...el.steps.children].forEach((li, i) => li.classList.toggle('on', lt >= i * 4 && lt < (i + 1) * 4 + (i === 2 ? 1 : 0)));
    // 1. the button, a pointer and a click
    const a1 = Math.min(ramp(lt, 0.2, 0.7), 1 - ramp(lt, 3.6, 4));
    at(el.button, 760, 250, `scale(${lt > 2.2 && lt < 2.5 ? 0.96 : 1})`);
    show(el.button, a1);
    const k = easeInOut(ramp(lt, 0.6, 2.2));
    at(el.cursor, mix(1120, 900, k), mix(560, 282, k));
    show(el.cursor, a1);
    const r = ramp(lt, 2.2, 3.2);
    at(el.ripple, 860, 250, `scale(${mix(0.4, 2.2, r)})`);
    show(el.ripple, r > 0 && r < 1 ? 1 - r : 0);
    at(el.done, 700, 350);
    show(el.done, Math.min(ramp(lt, 2.6, 3), 1 - ramp(lt, 3.6, 4)));
    // 2. the password field filling with dots
    const a2 = Math.min(ramp(lt, 4.1, 4.5), 1 - ramp(lt, 7.6, 8));
    at(el.field, 640, 270);
    show(el.field, a2);
    el.dots.textContent = '•'.repeat(Math.round(ramp(lt, 4.6, 7) * 34));
    // 3. the admin page
    at(el.admin.root, 780 + (1 - ease(ramp(lt, 8.1, 9))) * 100, 80);
    show(el.admin.root, ramp(lt, 8.1, 8.7));
    el.admin.scroll(easeInOut(ramp(lt, 9.4, 11.4)));
  });

  // ---------- 6. Parent setup: form, 12 words, the kid's link (46–60) ----------
  scene(46, 60, (el) => {
    const step = (n, title, sub) => abs(h('div', { style: { width: '520px' } }, h('div', { class: 'kicker' }, `Pour les parents · ${n}`), h('div', { class: 'title mid', style: { margin: '10px 0' } }, title), h('div', { class: 'small' }, sub)));
    el.append(
      (el.s1 = step('1 / 3', 'Créer la banque', 'Prénom, argent de poche, taux. · First name, pocket money, rate.')),
      (el.s2 = step('2 / 3', '12 mots : la seule clé', 'Imprime la carte, range-la avec la tirelire. · Print the card, keep it safe.')),
      (el.s3 = step('3 / 3', 'Le lien de ton enfant', "QR code → téléphone de l'enfant → écran d'accueil. · Onto your child's home screen.")),
      (el.form = frame('create-form.jpg', 360, 540)).root,
      (el.p2 = phone([shot('recovery.jpg')])).root,
      (el.p3 = phone([shot('ready.jpg')])).root,
    );
  }, (lt, d, el) => {
    const win = (a, b) => Math.min(ramp(lt, a, a + 0.5), 1 - ramp(lt, b - 0.5, b));
    [[el.s1, 0, 4.5], [el.s2, 4.5, 9.5], [el.s3, 9.5, 14.2]].forEach(([s, a, b]) => {
      at(s, 70, 170 + (1 - ease(ramp(lt, a, a + 0.6))) * 20);
      show(s, win(a, b));
    });
    at(el.form.root, 780, 40);
    el.form.scroll(easeInOut(ramp(lt, 1, 3.8)));
    show(el.form.root, win(0, 4.5));
    at(el.p2.root, 820, 40);
    show(el.p2.root, win(4.5, 9.5));
    at(el.p3.root, 820, 40);
    show(el.p3.root, win(9.5, 14.2));
  });

  // ---------- 7. Every Sunday, and backups (60–70) ----------
  scene(60, 70, (el) => {
    el.append(
      abs(h('div', { class: 'kicker', style: { transform: 'translate(70px, 50px)' } }, 'Chaque semaine · Every week')),
      (el.heading = abs(h('div', { class: 'title mid', style: { width: '460px' } }, 'Banque, ou gardée ?'))),
      (el.heading2 = abs(h('div', { class: 'title mid', style: { width: '460px' } }, 'Une sauvegarde, hors du téléphone'))),
      (el.catch = frame('catch-up.jpg', 400, 540)).root,
      (el.share = frame('sharing.jpg', 400, 540)).root,
      (el.tag = abs(h('div', { class: 'label' }, '↓ Télécharger · Download'))),
    );
  }, (lt, d, el) => {
    at(el.heading, 70, 110);
    show(el.heading, 1 - ramp(lt, 4.6, 5));
    at(el.heading2, 70, 110);
    show(el.heading2, ramp(lt, 5, 5.5));
    at(el.catch.root, 760, 40);
    el.catch.scroll(easeInOut(ramp(lt, 1.2, 4)));
    show(el.catch.root, Math.min(ramp(lt, 0, 0.5), 1 - ramp(lt, 4.6, 5)));
    at(el.share.root, 760, 40);
    el.share.scroll(ease(ramp(lt, 5.8, 8)));
    show(el.share.root, ramp(lt, 5, 5.5));
    at(el.tag, 440, 560);
    show(el.tag, ramp(lt, 8, 8.5));
  });

  // ---------- 8. What children see (70–80) ----------
  scene(70, 80, (el) => {
    el.items = ['Son solde · Their balance', 'La pièce qui se remplit · The coin', 'Et si… ? · What if…?', 'Deux avenirs · Two futures', 'Son livret · Their passbook'].map((t) => h('li', {}, h('b', {}, '•'), t));
    el.append(
      abs(h('div', { class: 'kicker', style: { transform: 'translate(70px, 50px)' } }, 'Pour les enfants · For kids')),
      abs(h('div', { class: 'title mid', style: { transform: 'translate(70px, 92px)' } }, 'Sa page à lui')),
      (el.list = abs(h('ol', { class: 'steps', style: { width: '600px' } }, el.items))),
      (el.p = phone([cropped('kid-top.jpg', 446), shot('kid-chart.jpg'), shot('kid-birthday.jpg'), shot('kid-passbook.jpg')])).root,
    );
    at(el.list, 70, 190);
  }, (lt, d, el) => {
    at(el.p.root, 860, 40 + (1 - ease(ramp(lt, 0, 0.8))) * 40);
    const parts = [...el.p.strip.children];
    const stops = [0, 250, parts[1].offsetTop, parts[2].offsetTop, parts[3].offsetTop].map((y) => Math.min(y, el.p.strip.offsetHeight - 541));
    const times = [0, 2, 4.2, 6.4, 8.2];
    let y = stops[0];
    let active = 0;
    for (let i = 1; i < times.length; i++) {
      if (lt >= times[i] - 1) {
        y = mix(stops[i - 1], stops[i], easeInOut(ramp(lt, times[i] - 1, times[i])));
        active = lt >= times[i] - 0.5 ? i : i - 1;
      }
    }
    el.p.strip.style.transform = `translateY(${(-y).toFixed(1)}px)`;
    el.items.forEach((li, i) => li.classList.toggle('on', i === active));
  });

  // ---------- 9. Outro (80–88) ----------
  scene(80, 88, (el) => {
    el.append(
      (el.logo = abs(h('img', { src: IMG + 'icon.png', alt: '', style: { width: '120px', height: '120px', borderRadius: '28px' } }))),
      (el.t1 = abs(h('div', { class: 'title mid', style: { width: `${W}px`, textAlign: 'center' } }, 'Banque de papa et maman'))),
      (el.t2 = abs(h('div', { class: 'small', style: { width: `${W}px`, textAlign: 'center' } }, 'Libre et gratuit · Free and open source · MIT'))),
      (el.t3 = abs(h('div', { style: { width: `${W}px`, textAlign: 'center', fontSize: '30px', fontWeight: '800', color: '#E2BE5C' } }, 'github.com/hardymathieu/BanquePM'))),
      (el.t4 = abs(h('div', { class: 'small', style: { width: `${W}px`, textAlign: 'center' } }, 'Le guide · The guide : hardymathieu.github.io/BanquePM/guide'))),
    );
  }, (lt, d, el) => {
    at(el.logo, W / 2 - 60, 110 + Math.sin(lt * 2) * 5);
    at(el.t1, 0, 260);
    at(el.t2, 0, 330);
    show(el.t2, ramp(lt, 0.6, 1.2));
    at(el.t3, 0, 390);
    show(el.t3, ramp(lt, 1.2, 1.8));
    at(el.t4, 0, 444);
    show(el.t4, ramp(lt, 1.8, 2.4));
  });

  // ---------- subtitles and progress bar ----------
  const fr = h('p', { class: 'fr' });
  const en = h('p', { class: 'en', lang: 'en' });
  const subs = h('div', { class: 'subs', 'aria-hidden': 'true' }, fr, en);
  const bar = abs(h('div', { class: 'bar' }));
  bar.style.top = 'auto';
  bar.style.bottom = '0';
  stage.append(subs, bar);

  // ---------- render(t): the whole frame ----------
  function render(t) {
    drawBackground(t, coinIntensity(t));
    for (const s of scenes) {
      const lt = t - s.start;
      const d = s.end - s.start;
      const on = lt >= 0 && lt < d;
      s.el.style.visibility = on ? 'visible' : 'hidden';
      if (!on) continue;
      s.el.style.opacity = String(Math.min(ramp(lt, 0, 0.6), 1 - ramp(lt, d - 0.5, d)));
      s.update(lt, d, s.el);
    }
    const cue = CUES.find(([a, b]) => t >= a && t < b);
    fr.textContent = cue ? cue[2] : '';
    en.textContent = cue ? cue[3] : '';
    show(subs, cue ? Math.min(ramp(t, cue[0], cue[0] + 0.25), 1 - ramp(t, cue[1] - 0.2, cue[1])) : 0);
    fr.style.visibility = en.style.visibility = cue ? 'visible' : 'hidden';
    bar.style.width = `${((t / DURATION) * W).toFixed(1)}px`;
  }

  // ---------- loading ----------
  const ready = Promise.all([
    document.fonts.load('400 20px "Atkinson Hyperlegible Next"'),
    document.fonts.load('800 20px "Atkinson Hyperlegible Next"'),
    document.fonts.load('20px "Patrick Hand"'),
    ...[...stage.querySelectorAll('img')].map((i) => i.decode().catch(() => undefined)),
  ]).then(() => render(0));

  // ---------- transcript ----------
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const list = document.getElementById('transcript');
  if (list) for (const [a, , f, e] of CUES) list.append(h('li', {}, h('b', {}, `${fmt(a)} `), f, h('span', { class: 'en', lang: 'en' }, e)));

  window.explainer = { duration: DURATION, ready, seek: render };
  if (RECORD) return;

  // ---------- the player ----------
  const player = document.getElementById('player');
  const playBtn = document.getElementById('play');
  const seek = document.getElementById('seek');
  const time = document.getElementById('time');
  const fit = () => {
    stage.style.transform = `scale(${player.clientWidth / W})`;
  };
  addEventListener('resize', fit);
  fit();
  let t = 0;
  let playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let last = performance.now();
  const ui = () => {
    playBtn.textContent = playing ? '❚❚' : '▶';
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Lecture');
    seek.value = String(Math.round((t / DURATION) * 1000));
    time.textContent = fmt(t);
  };
  const toggle = () => {
    playing = !playing;
    ui();
  };
  playBtn.addEventListener('click', toggle);
  stage.addEventListener('click', toggle);
  addEventListener('keydown', (e) => {
    if (e.key === ' ' && e.target === document.body) {
      e.preventDefault();
      toggle();
    }
  });
  seek.addEventListener('input', () => {
    t = (Number(seek.value) / 1000) * DURATION;
    render(t);
    ui();
  });
  ready.then(() => {
    last = performance.now();
    const tick = (now) => {
      if (playing) {
        t += (now - last) / 1000;
        if (t >= DURATION) t = 0;
        render(t);
        ui();
      }
      last = now;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    ui();
  });
})();
