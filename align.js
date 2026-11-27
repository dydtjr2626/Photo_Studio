/* align.js — 정밀 배치: 정렬 바 · 수치 인스펙터 · 중앙/가장자리 스냅 + 가이드 · Alt+화살표 미세 이동 · 새 요소 겹침 방지
 * app.js 의 전역(state, lastBoxes, cv, layer, checkpoint, paint, draw, syncUI, selItem, selPhoto, selBoxFor, blankBBox, bboxCenterInfo, frameInset, setPhotoScale …)을 그대로 씁니다.
 * 가이드 선은 #layer 안의 DOM 요소일 뿐이라 저장(export) 결과에는 들어가지 않습니다. */
(() => {
  'use strict';
  const $a = (id) => document.getElementById(id);
  const selObj = () => selItem() || selPhoto();
  const r1 = (n) => Math.round(n * 10) / 10;

  /* 단축키 안내(ux.js 가 window.UX_KEYS_EXTRA 를 읽어 병합) */
  window.UX_KEYS_EXTRA = (window.UX_KEYS_EXTRA || []).concat([['정렬·정밀', [['Alt+화살표', '0.1% 미세 이동'], ['드래그 중 중앙 근처', '중앙 스냅 (Alt: 해제)']]]]);

  /* 회전·늘이기를 반영한 '눈에 보이는' 상자(마지막 렌더 기준, 캔버스 px) */
  function vis(o) {
    const b = lastBoxes.find((q) => q.id === o.id); if (!b || b.r - b.l === 0) return null;
    let bx = b;
    if (state.photos.includes(o)) {
      bx = selBoxFor(o, b);
      if (o.blank && blankBBox(o)) bx = { ...bx, l: bx.l + 8, r: bx.r - 8, t: bx.t + 8, b: bx.b - 8 };   // 빈 그림판 선택 상자의 여유(8px) 제외
    }
    const w = bx.r - bx.l, h = bx.b - bx.t, a = (b.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    return { cx: (bx.l + bx.r) / 2, cy: (bx.t + bx.b) / 2, w, h, rot: b.rot || 0, hw: (w * c + h * s) / 2, hh: (w * s + h * c) / 2 };
  }

  /* ---------- 스타일 ---------- */
  const st = document.createElement('style');
  st.textContent = `
#alignBar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 8px;margin:8px 0 2px;font-size:12px;color:var(--sub)}
#alignBar .agrp{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
#alignBar .btn{padding:3px 9px;min-width:0}
#alignBar label{display:inline-flex;align-items:center;gap:2px;white-space:nowrap}
#alignBar input{width:38px;padding:2px 4px;border:1px solid var(--line-strong);border-radius:var(--r-btn);font:inherit;font-variant-numeric:tabular-nums;text-align:right;background:var(--surface);color:var(--ink)}
#alignBar input:disabled{opacity:.45}
#alignBar input.bad{border-color:var(--danger)}
#alignBar .amsg{flex-basis:100%;text-align:center;min-height:1em;color:var(--danger)}
#alignBar .amsg:empty{display:none}
.snapGuide{position:absolute;pointer-events:none;background:#2F6BFF;z-index:6;display:none}
.snapGuide.v{top:0;bottom:0;width:1px;margin-left:-.5px}
.snapGuide.h{left:0;right:0;height:1px;margin-top:-.5px}
`;
  document.head.appendChild(st);

  /* ---------- 정렬 바 + 인스펙터 ---------- */
  const bar = document.createElement('div');
  bar.id = 'alignBar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', '정렬과 수치 입력');
  const ALIGNS = [['l', '왼쪽', '프레임 왼쪽 끝에 맞춤'], ['hc', '가로 중앙', '가로 정중앙에 맞춤'], ['r', '오른쪽', '프레임 오른쪽 끝에 맞춤'], ['t', '위', '프레임 위쪽 끝에 맞춤'], ['vc', '세로 중앙', '세로 정중앙에 맞춤'], ['b', '아래', '프레임 아래쪽 끝에 맞춤']];
  const FIELDS = [['X', 'aX', 'px', '중심 X 좌표(출력 px)'], ['Y', 'aY', 'px', '중심 Y 좌표(출력 px)'], ['너비', 'aW', 'px', '너비(출력 px, 비율 유지)'], ['높이', 'aH', 'px', '높이(출력 px)'], ['회전', 'aR', '°', '회전 각도(-180~180)']];
  bar.innerHTML = '<span class="agrp" role="group" aria-label="정렬">' + ALIGNS.map(([k, n, t]) => `<button type="button" class="btn sm" data-al="${k}" title="${t}" aria-label="${n} 정렬" disabled>${n}</button>`).join('') + '</span>'
    + '<span class="agrp" role="group" aria-label="수치 입력">' + FIELDS.map(([n, id, u, t]) => `<label title="${t}">${n}<input type="text" inputmode="decimal" id="${id}" autocomplete="off" aria-label="${t}" disabled>${u}</label>`).join('') + '</span>'
    + '<span class="amsg" id="alignMsg" role="status" aria-live="polite"></span>';
  const anchor = document.querySelector('.orderbar') || document.querySelector('.stage');
  anchor.insertAdjacentElement('afterend', bar);

  let msgT = 0;
  function msg(t) { const m = $a('alignMsg'); m.textContent = t; clearTimeout(msgT); if (t) msgT = setTimeout(() => { m.textContent = ''; }, 3500); }

  function alignSel(k) {
    const o = selObj(); if (!o || o.locked) return;
    endEdit(); const v = vis(o); if (!v) return;
    const W = cv.width, H = cv.height, ins = frameInset(state);
    let dx = 0, dy = 0;
    if (k === 'l') dx = ins - (v.cx - v.hw); else if (k === 'r') dx = (W - ins) - (v.cx + v.hw); else if (k === 'hc') dx = W / 2 - v.cx;
    else if (k === 't') dy = ins - (v.cy - v.hh); else if (k === 'b') dy = (H - ins) - (v.cy + v.hh); else if (k === 'vc') dy = H / 2 - v.cy;
    checkpoint(); o.x += dx / W * 100; o.y += dy / H * 100;
    syncUI(); paint(); refresh(true);
  }
  bar.querySelectorAll('[data-al]').forEach((b) => b.addEventListener('click', () => alignSel(b.dataset.al)));

  function applyField(id) {
    const o = selObj(); if (!o || o.locked) return;
    const inp = $a(id), raw = inp.value.trim().replace(',', '.'), n = raw === '' ? NaN : Number(raw);
    const v = vis(o), W = cv.width, H = cv.height, ins = frameInset(state), iw = W - 2 * ins, ih = H - 2 * ins;
    const bad = (m) => { inp.classList.add('bad'); msg(m + ' 이전 값을 유지합니다.'); refresh(true); setTimeout(() => inp.classList.remove('bad'), 1500); };
    if (!v) return;
    if (!Number.isFinite(n)) return bad('숫자만 입력할 수 있습니다.');
    if (id === 'aX' || id === 'aY') {
      const isX = id === 'aX', max = isX ? iw : ih;
      if (n < 0 || n > max) return bad(`0~${Math.round(max)} 범위의 값만 쓸 수 있습니다.`);
      const cur = isX ? v.cx - ins : v.cy - ins; if (Math.abs(cur - n) < 0.05) return;
      checkpoint(); if (isX) o.x += (n - cur) / W * 100; else o.y += (n - cur) / H * 100;
    } else if (id === 'aR') {
      if (n < -180 || n > 180) return bad('-180~180 범위의 값만 쓸 수 있습니다.');
      if (Math.abs(num(o.rot, 0) - n) < 0.05) return;
      checkpoint(); o.rot = r1(n);
    } else {
      const isW = id === 'aW', cur = isW ? v.w : v.h;
      if (n <= 0 || n > 20000) return bad('1~20000 범위의 값만 쓸 수 있습니다.');
      if (Math.abs(cur - n) < 0.5) return;
      const f = n / cur;
      if (state.photos.includes(o)) {
        const ns = o.scale * f; if (ns < 10 || ns > 300) return bad('사진 크기는 10~300% 범위여야 합니다.');
        checkpoint(); setPhotoScale(o, ns);
      } else if (o.shape) {
        const key = isW ? 'sx' : 'sy', ns = num(o[key], 1) * f; if (ns < 0.2 || ns > 5) return bad('도형 늘이기는 0.2~5배 범위여야 합니다.');
        checkpoint(); o[key] = Math.round(ns * 100) / 100;
      } else {
        const ns = Math.round(num(o.s, 7) * f * 10) / 10; if (ns < 2 || ns > 20) return bad('글자 크기는 2~20% 범위여야 합니다.');
        checkpoint(); o.s = ns;
      }
    }
    syncUI(); paint(); refresh(true);
  }
  FIELDS.forEach(([, id]) => {
    const inp = $a(id);
    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); applyField(id); inp.select(); }
      else if (e.key === 'Escape') { e.preventDefault(); refresh(true); inp.blur(); }
    });
    inp.addEventListener('blur', () => { if (inp.dataset.dirty) { delete inp.dataset.dirty; applyField(id); } });
    inp.addEventListener('input', () => { inp.dataset.dirty = '1'; });
    inp.addEventListener('focus', () => inp.select());
  });

  /* 선택·드래그·실행 취소에 따라 실시간 갱신(앱 코드를 건드리지 않도록 가벼운 폴링) */
  let sig = '';
  function refresh(force) {
    const o = selObj(), multiOn = !!(window.PSMulti && window.PSMulti.ids.length > 1), on = !!o && !o.locked && !state.editing && !multiOn, v = on ? vis(o) : null, ok = on && !!v;   // 여러 개 선택 중에는 단일 항목용 정렬 바를 숨김(multi.js 의 묶음 도구 사용)
    bar.style.display = ok ? "" : "none";
    bar.querySelectorAll('[data-al]').forEach((b) => { b.disabled = !ok; });
    const ins = frameInset(state);
    const vals = ok ? { aX: r1(v.cx - ins), aY: r1(v.cy - ins), aW: r1(v.w), aH: r1(v.h), aR: r1(num(o.rot, 0)) } : null;
    const s2 = ok ? o.id + '|' + Object.values(vals).join() : 'none';
    if (!force && s2 === sig) return; sig = s2;
    FIELDS.forEach(([, id]) => {
      const inp = $a(id); inp.disabled = !ok;
      if (document.activeElement === inp && !force) return;     // 입력 중인 칸은 덮어쓰지 않음
      inp.value = ok ? String(vals[id]) : ''; delete inp.dataset.dirty;
    });
  }
  setInterval(() => refresh(false), 100);

  /* ---------- 스냅 + 스마트 가이드(DOM 오버레이, export 에 포함되지 않음) ---------- */
  const gv = document.createElement('div'), gh = document.createElement('div');
  gv.className = 'snapGuide v'; gh.className = 'snapGuide h'; gv.setAttribute('aria-hidden', 'true'); gh.setAttribute('aria-hidden', 'true');
  layer.appendChild(gv); layer.appendChild(gh);
  const hideGuides = () => { gv.style.display = 'none'; gh.style.display = 'none'; };
  layer.addEventListener('pointerup', hideGuides); layer.addEventListener('pointercancel', hideGuides);

  function snapAxis(c, half, size, ins, lines) {                // 중심 → 중앙(우선) → 시작/끝 가장자리 → (스마트 가이드) 다른 항목의 중심·가장자리 순으로 가까운 후보를 고름
    const thr = size * 0.01, cand = [[size / 2 - c, size / 2], [ins - (c - half), ins], [(size - ins) - (c + half), size - ins]];
    (lines || []).forEach((L) => { cand.push([L - c, L], [L - (c - half), L], [L - (c + half), L]); });   // 내 중심·왼쪽(위)·오른쪽(아래) 끝이 다른 항목의 선과 만나는 경우
    let best = null;
    for (const [d, line] of cand) if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.d) - 1e-6)) best = { d, line };
    return best;
  }
  window.alignSnap = function (it, e) {                           // app.js 드래그 이동 직후 호출 (it.x/it.y 는 방금 계산된 값)
    if (e.shiftKey || e.altKey) { hideGuides(); return; }
    const v = vis(it); if (!v) { hideGuides(); return; }
    const W = cv.width, H = cv.height, ins = frameInset(state);
    // 사진/문구 위치(x,y)와 보이는 상자 중심의 차이(빈 그림판 등)는 직전 렌더 기준으로 일정하므로 그대로 보정
    const prevX = lastBoxes.find((q) => q.id === it.id); if (!prevX) return;
    const ox = v.cx - ((prevX.l + prevX.r) / 2), oy = v.cy - ((prevX.t + prevX.b) / 2);   // 선택 상자 중심 - 기본 상자 중심 (보통 0)
    const cx = it.x / 100 * W + ox, cy = it.y / 100 * H + oy;
    const others = [...state.items, ...state.photos].filter((q) => q !== it && !q.blank).map(vis).filter((q) => q && q.w < W * 0.9 && q.h < H * 0.9);   // 틀을 가득 채운 큰 사진은 제외
    const lx = [], ly = []; others.forEach((q) => { lx.push(q.cx, q.cx - q.hw, q.cx + q.hw); ly.push(q.cy, q.cy - q.hh, q.cy + q.hh); });
    const sx = snapAxis(cx, v.hw, W, ins, lx), sy = snapAxis(cy, v.hh, H, ins, ly);
    if (sx) { it.x += sx.d / W * 100; gv.style.left = sx.line / W * 100 + '%'; gv.style.display = 'block'; } else gv.style.display = 'none';
    if (sy) { it.y += sy.d / H * 100; gh.style.top = sy.line / H * 100 + '%'; gh.style.display = 'block'; } else gh.style.display = 'none';
  };

  /* ---------- Alt+화살표: 0.1% 미세 이동 ---------- */
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
    const el = document.activeElement, tag = el ? el.tagName : '', type = el ? el.type : '';
    if (tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !/^(range|color|checkbox|radio|file|button)$/.test(type))) return;
    if (state.editing || $('dlg').classList.contains('on') || tool !== 'move') return;
    const o = selObj(); if (!o || o.locked) return;
    e.preventDefault();                                           // Alt+←/→ 는 브라우저 뒤로/앞으로 가기이기도 함
    const k = e.key, d = 0.1;
    checkpoint('arrow');
    o.x = Math.min(100, Math.max(0, o.x + (k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0)));
    o.y = Math.min(100, Math.max(0, o.y + (k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0)));
    draw();
  }, true);

  /* ---------- 새 요소 겹침 방지: 같은 종류가 정중앙 근처에 있으면 약 3%씩 대각선으로 비켜 놓음(6단계 후 순환) ---------- */
  const STEP = 3, CYCLE = 6;
  const kindOf = () => 'item';   // 문구·스티커·도형은 모두 같은 종류(서로 가리지 않게). 사진은 프레임을 채우는 경우가 많아 적용하지 않음
  function spread(o, pool) {
    const kind = kindOf(o), same = pool.filter((q) => q !== o && !q.blank && kindOf(q) === kind);
    let k = 0;
    while (k < CYCLE && same.some((q) => Math.abs(q.x - (50 + k * STEP)) < 1.5 && Math.abs(q.y - (50 + k * STEP)) < 1.5)) k++;
    if (k >= CYCLE) k = same.length % CYCLE;
    o.x = 50 + k * STEP; o.y = 50 + k * STEP;
  }
  { const orig = addItem; addItem = function (props) { const it = orig(props); spread(it, state.items); return it; }; }
})();
