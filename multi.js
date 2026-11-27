/* multi.js — 다중 선택(Shift/Ctrl+클릭, 빈 곳 끌어 범위 선택, Ctrl+A) · 함께 이동 · 선택 영역 기준 정렬 · 간격 같게(분배) · 함께 복제/삭제/잠금.
   app.js 의 전역(state, layer, lastBoxes, hit, toCanvas, checkpoint, draw, paint, syncUI …)을 그대로 쓰는 보조 스크립트. align.js 뒤에 로드. */
(() => {
  'use strict';
  const $m = (id) => document.getElementById(id);
  let multi = [];                                              // 선택된 id 들(2개 이상일 때만 의미 있음. state.sel 은 그중 마지막)
  const allObjs = () => [...state.items, ...state.photos];
  const byId = (id) => allObjs().find((o) => o.id === id);
  const objs = () => multi.map(byId).filter(Boolean);
  const r2 = (n) => Math.round(n * 100) / 100;
  window.PSMulti = { get ids() { return multi.slice(); }, clear: () => { multi = []; } };

  /* 회전·늘이기를 반영한 겉 상자(캔버스 px) */
  function aabb(o) {
    const b = lastBoxes.find((q) => q.id === o.id); if (!b || b.r - b.l === 0) return null;
    let bx = b; if (state.photos.includes(o)) { bx = selBoxFor(o, b); if (!b.rot) { const v = visRect(bx); bx = { ...bx, ...v }; } }
    const w = bx.r - bx.l, h = bx.b - bx.t, a = (b.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a)), cx = (bx.l + bx.r) / 2, cy = (bx.t + bx.b) / 2, hw = (w * c + h * s) / 2, hh = (w * s + h * c) / 2;
    return { cx, cy, hw, hh, l: cx - hw, r: cx + hw, t: cy - hh, b: cy + hh, box: bx, rot: b.rot || 0 };
  }
  const union = (bs) => ({ l: Math.min(...bs.map((b) => b.l)), r: Math.max(...bs.map((b) => b.r)), t: Math.min(...bs.map((b) => b.t)), b: Math.max(...bs.map((b) => b.b)) });

  /* ---------- 오버레이: 선택된 항목마다 점선 상자 + 전체를 감싸는 상자 ---------- */
  const ovl = document.createElement('div'); ovl.className = 'msel-layer'; ovl.setAttribute('aria-hidden', 'true'); layer.appendChild(ovl);
  const mq = document.createElement('div'); mq.className = 'marquee'; mq.style.display = 'none'; layer.appendChild(mq);
  const pct = (v, total) => (v / total * 100) + '%';
  function drawMulti() {
    ovl.replaceChildren();
    if (multi.length < 2 || tool !== 'move') { return; }
    selEl.style.display = 'none';                                // 다중 선택 중에는 단일 선택 상자·점을 숨김
    const bs = [];
    objs().forEach((o) => {
      const a = aabb(o); if (!a) return; bs.push(a);
      const bx = a.box, d = document.createElement('div'); d.className = 'msel';
      d.style.cssText = `left:${pct(bx.l, cv.width)};top:${pct(bx.t, cv.height)};width:${pct(bx.r - bx.l, cv.width)};height:${pct(bx.b - bx.t, cv.height)};` + (a.rot ? `transform:rotate(${a.rot}deg);` : '');
      ovl.appendChild(d);
    });
    if (bs.length > 1) { const u = union(bs), g = document.createElement('div'); g.className = 'mgrp'; g.style.cssText = `left:${pct(u.l, cv.width)};top:${pct(u.t, cv.height)};width:${pct(u.r - u.l, cv.width)};height:${pct(u.b - u.t, cv.height)};`; ovl.appendChild(g); }
  }
  (window.__onPaint = window.__onPaint || []).push(drawMulti);

  /* ---------- 선택 상태 ---------- */
  function setMulti(ids) {
    multi = ids.filter((id, i) => ids.indexOf(id) === i && byId(id) && !byId(id).locked);
    state.sel = multi.length ? multi[multi.length - 1] : null; if (multi.length < 2) multi = multi.slice();
    syncUI(); paint();
  }
  const origSync = syncUI;
  syncUI = function () {                                       // state.sel 이 목록에서 벗어났으면(일반 클릭·삭제·되돌리기 등) 다중 선택 해제
    if (!state.sel || !multi.includes(state.sel)) multi = state.sel ? [state.sel] : [];
    multi = multi.filter((id) => byId(id));
    const r = origSync.apply(this, arguments); refreshBar(); return r;
  };

  /* ---------- 포인터: Shift/Ctrl+클릭 토글, 빈 곳 끌기 = 범위 선택, 선택 묶음 끌기 = 함께 이동 ---------- */
  /* 터치 화면에는 Shift 가 없으므로 '다중 선택' 켜기/끄기 버튼: 켜져 있으면 탭만으로 더하고 빼며, 빈 곳 끌기도 범위에 '더하기'가 됨 */
  let addMode = false; const tg = document.createElement('button'); tg.type = 'button'; tg.id = 'multiMode'; tg.className = 'app'; tg.title = '켜면 탭·클릭으로 여러 개를 선택에 더하고 뺍니다 (Shift/Ctrl+클릭과 같음)'; tg.setAttribute('aria-pressed', 'false');
  tg.innerHTML = '<span class="tile t-gray"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="10" height="10" rx="1"/><rect x="11" y="11" width="10" height="10" rx="1"/></svg></span>다중 선택';
  tg.addEventListener('click', () => { addMode = !addMode; tg.classList.toggle('on', addMode); tg.setAttribute('aria-pressed', addMode ? 'true' : 'false'); toast(addMode ? '다중 선택 켜짐: 항목을 하나씩 눌러 더하고 빼세요.' : '다중 선택 꺼짐', 'ok'); });
  const placeTg = () => { const eg = document.querySelector('.ps-edit'); if (eg && !eg.contains(tg)) eg.appendChild(tg); };   // .ps-edit 는 layout.js(나중에 로드)가 만듦
  if (document.readyState === 'complete') placeTg(); else window.addEventListener('load', placeTg);
  let gdrag = null, marq = null;
  layer.addEventListener('pointerdown', (e) => {
    if (e.target !== layer || tool !== 'move' || e.button > 0) return;
    const p = toCanvas(e), it = hit(p), mod = e.shiftKey || e.ctrlKey || e.metaKey || addMode;
    if (mod) {
      e.stopImmediatePropagation(); e.preventDefault(); endEdit();
      if (it && !it.locked) {
        const cur = multi.length ? multi.slice() : (state.sel ? [state.sel] : []);
        setMulti(cur.includes(it.id) ? cur.filter((id) => id !== it.id) : [...cur, it.id]);
      } else if (!it) startMarquee(e, p, true);
      return;
    }
    if (it && !it.locked && multi.length > 1 && multi.includes(it.id)) {          // 묶음 안의 항목을 끌면 전부 함께 이동
      e.stopImmediatePropagation(); e.preventDefault(); endEdit(); checkpoint('gmove' + Date.now());
      gdrag = { x0: p.x, y0: p.y, orig: objs().map((o) => ({ o, x: o.x, y: o.y })) }; interacting = true;
      try { layer.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
      return;
    }
    if (!it) startMarquee(e, p, false);                       // 앱 기본 동작(선택 해제)은 그대로 두고 범위 선택만 시작
  }, true);
  function startMarquee(e, p, add) {
    marq = { x0: p.x, y0: p.y, add, base: add ? (multi.length ? multi.slice() : (state.sel ? [state.sel] : [])) : [], on: false };
    try { layer.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
  }
  layer.addEventListener('pointermove', (e) => {
    if (gdrag) {
      e.stopImmediatePropagation(); const p = toCanvas(e);
      let dx = (p.x - gdrag.x0) / cv.width * 100, dy = (p.y - gdrag.y0) / cv.height * 100;
      gdrag.orig.forEach(({ x, y }) => { dx = Math.min(100 - x, Math.max(-x, dx)); dy = Math.min(100 - y, Math.max(-y, dy)); });   // 가장자리에서 묶음 모양이 변하지 않게 이동량을 제한
      gdrag.orig.forEach(({ o, x, y }) => { o.x = r2(x + dx); o.y = r2(y + dy); });
      draw(); return;
    }
    if (marq) {
      const p = toCanvas(e); if (!marq.on && Math.hypot(p.x - marq.x0, p.y - marq.y0) < 6) return; marq.on = true;
      const l = Math.min(marq.x0, p.x), t = Math.min(marq.y0, p.y), w = Math.abs(p.x - marq.x0), h = Math.abs(p.y - marq.y0);
      mq.style.cssText = `display:block;left:${pct(l, cv.width)};top:${pct(t, cv.height)};width:${pct(w, cv.width)};height:${pct(h, cv.height)};`; marq.rect = { l, t, r: l + w, b: t + h };
    }
  }, true);
  const endPtr = () => {
    if (gdrag) { gdrag = null; if (interacting) { interacting = false; } paint(); syncUI(); }
    if (marq) {
      const m = marq; marq = null; mq.style.display = 'none';
      if (m.on && m.rect) {
        const R = m.rect, ins = frameInset(state), fw = cv.width - 2 * ins, fh = cv.height - 2 * ins;
        const hits = allObjs().filter((o) => {
          if (o.locked || o.blank) return false; const a = aabb(o); if (!a) return false;
          const hitR = a.l < R.r && a.r > R.l && a.t < R.b && a.b > R.t; if (!hitR) return false;
          const big = (a.r - a.l) * (a.b - a.t) > 0.8 * fw * fh && state.photos.includes(o);   // 틀을 가득 채운 사진은 범위가 완전히 감쌀 때만
          return !big || (R.l <= a.l && R.r >= a.r && R.t <= a.t && R.b >= a.b);
        }).map((o) => o.id);
        setMulti([...m.base, ...hits]);
      }
    }
  };
  layer.addEventListener('pointerup', endPtr, true); layer.addEventListener('pointercancel', endPtr, true);

  /* ---------- 묶음 도구 막대 ---------- */
  const bar = document.createElement('section'); bar.id = 'multiBar'; bar.className = 'panel hide'; bar.setAttribute('aria-label', '여러 개 선택 도구');
  const AL = [['l', '왼쪽'], ['hc', '가로 중앙'], ['r', '오른쪽'], ['t', '위'], ['vc', '세로 중앙'], ['b', '아래']];
  bar.innerHTML = '<h2><span id="mCount"></span> <span class="val">선택됨</span></h2><div class="in">'
    + '<label>정렬 <button type="button" class="adjreset" id="mRef" title="무엇을 기준으로 맞출지">기준: 선택 영역</button></label><div class="row" id="mAlign">' + AL.map(([k, n]) => `<button type="button" class="btn sm" data-ma="${k}">${n}</button>`).join('') + '</div>'
    + '<label>간격 같게</label><div class="row"><button type="button" class="btn sm" id="mDistH" title="가장 왼쪽·오른쪽 항목은 두고 사이 간격을 같게(3개 이상)">가로 간격 같게</button><button type="button" class="btn sm" id="mDistV" title="가장 위·아래 항목은 두고 사이 간격을 같게(3개 이상)">세로 간격 같게</button></div>'
    + '<label>함께</label><div class="row"><button type="button" class="btn sm" id="mDup">복제</button><button type="button" class="btn sm" id="mLock">잠금</button><button type="button" class="btn sm danger" id="mDel">삭제</button><button type="button" class="btn sm" id="mNone">선택 해제</button></div>'
    + '<div class="hint">Shift/Ctrl+클릭으로 더하고 빼며, 빈 곳을 끌어 범위로 고릅니다. 하나를 끌면 모두 함께 움직이고, 방향키로 미세 이동합니다.</div></div>';
  const main = document.querySelector('aside.main'); if (main) main.insertBefore(bar, main.firstChild);
  let refMode = 'sel';
  function refreshBar() {
    const on = multi.length > 1; bar.classList.toggle('hide', !on); if (on) $m('mCount').textContent = multi.length + '개';
    const ab = $m('alignBar'); if (ab && on) ab.style.display = 'none';
  }
  $m('mRef').addEventListener('click', () => { refMode = refMode === 'sel' ? 'frame' : 'sel'; $m('mRef').textContent = '기준: ' + (refMode === 'sel' ? '선택 영역' : '프레임'); });
  function moveBy(o, dxPx, dyPx) { o.x = r2(o.x + dxPx / cv.width * 100); o.y = r2(o.y + dyPx / cv.height * 100); }
  function alignMulti(k) {
    const arr = objs().map((o) => ({ o, a: aabb(o) })).filter((x) => x.a); if (arr.length < 2) return;
    const ins = frameInset(state), ref = refMode === 'frame' ? { l: ins, r: cv.width - ins, t: ins, b: cv.height - ins } : union(arr.map((x) => x.a));
    checkpoint();
    arr.forEach(({ o, a }) => {
      let dx = 0, dy = 0;
      if (k === 'l') dx = ref.l - a.l; else if (k === 'r') dx = ref.r - a.r; else if (k === 'hc') dx = (ref.l + ref.r) / 2 - a.cx;
      else if (k === 't') dy = ref.t - a.t; else if (k === 'b') dy = ref.b - a.b; else if (k === 'vc') dy = (ref.t + ref.b) / 2 - a.cy;
      moveBy(o, dx, dy);
    });
    paint(); syncUI();
  }
  function distribute(horizontal) {
    const arr = objs().map((o) => ({ o, a: aabb(o) })).filter((x) => x.a);
    if (arr.length < 3) { toast('간격을 같게 맞추려면 3개 이상 선택해야 합니다.'); return; }
    arr.sort((p, q) => (horizontal ? p.a.cx - q.a.cx : p.a.cy - q.a.cy)); checkpoint();
    const lo = horizontal ? 'l' : 't', hi = horizontal ? 'r' : 'b', size = (a) => a[hi] - a[lo];
    const span = arr[arr.length - 1].a[hi] - arr[0].a[lo], sum = arr.reduce((s, x) => s + size(x.a), 0), gap = (span - sum) / (arr.length - 1);
    let pos = arr[0].a[lo];
    arr.forEach(({ o, a }) => { const d = pos - a[lo]; if (horizontal) moveBy(o, d, 0); else moveBy(o, 0, d); pos += size(a) + gap; });
    paint(); syncUI(); toast(`${horizontal ? '가로' : '세로'} 간격을 같게 맞췄습니다 (간격 ${Math.round(gap)}px).`, 'ok');
  }
  $m('mAlign').addEventListener('click', (e) => { const b = e.target.closest('[data-ma]'); if (b) alignMulti(b.dataset.ma); });
  $m('mDistH').addEventListener('click', () => distribute(true)); $m('mDistV').addEventListener('click', () => distribute(false));
  function dupMulti() {
    const src = objs(); if (src.length < 2) return; endEdit(); checkpoint(); const made = [];
    src.forEach((o) => {
      let n;
      if (state.photos.includes(o)) { n = { ...o, id: uid(), canvas: cloneCanvas(o.canvas), orig: o.orig ? cloneCanvas(o.orig) : null, hist: [], base: null, bbox: undefined, locked: false, ver: 0, x: Math.min(100, o.x + 3), y: Math.min(100, o.y + 3) }; delete n.prev; delete n.prevSrc; delete n.prevKey; if (o.adj) n.adj = { ...o.adj }; if (Number.isFinite(o.z)) n.z = o.z + 0.5; state.photos.push(n); }
      else { n = { ...JSON.parse(JSON.stringify(o)), id: uid(), locked: false, x: Math.min(100, o.x + 3), y: Math.min(100, o.y + 3) }; if (Number.isFinite(o.z)) n.z = o.z + 0.5; state.items.push(n); }
      made.push(n.id);
    });
    setMulti(made);
  }
  function delMulti() { const n = multi.length; if (n < 2) return; endEdit(); checkpoint(); const set = new Set(multi); state.items = state.items.filter((o) => !set.has(o.id)); state.photos = state.photos.filter((o) => !set.has(o.id)); multi = []; state.sel = null; syncUI(); paint(); toast(`${n}개를 삭제했습니다. 되돌리려면 Ctrl+Z`, 'ok'); }
  function lockMulti() { if (multi.length < 2) return; endEdit(); checkpoint(); objs().forEach((o) => { o.locked = true; }); multi = []; state.sel = null; syncUI(); paint(); toast('선택한 항목을 모두 잠갔습니다.', 'ok'); }
  $m('mDup').addEventListener('click', dupMulti); $m('mDel').addEventListener('click', delMulti); $m('mLock').addEventListener('click', lockMulti);
  $m('mNone').addEventListener('click', () => { multi = []; state.sel = null; syncUI(); paint(); });

  /* ---------- 키보드: 방향키 이동·삭제·복제·해제·모두 선택 (캡처 단계라 단일 선택용 앱 핸들러보다 먼저 처리) ---------- */
  document.addEventListener('keydown', (e) => {
    const el = document.activeElement, tag = el ? el.tagName : '', type = el ? el.type : '';
    const typing = tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && !/^(range|color|checkbox|radio|file|button)$/.test(type));
    if (typing || state.editing || $m('dlg').classList.contains('on') || tool !== 'move') return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.code === 'KeyA' && !e.altKey) { e.preventDefault(); e.stopImmediatePropagation(); setMulti(allObjs().filter((o) => !o.locked && !(o.blank && !blankBBox(o))).map((o) => o.id)); return; }
    if (multi.length < 2) return;
    if (mod && e.code === 'KeyJ') { e.preventDefault(); e.stopImmediatePropagation(); dupMulti(); return; }
    if (mod && e.code === 'KeyD') { e.preventDefault(); e.stopImmediatePropagation(); $m('mNone').click(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); delMulti(); return; }
    if (e.key === 'Escape') { e.stopImmediatePropagation(); $m('mNone').click(); return; }
    if (/^Arrow/.test(e.key)) {
      e.preventDefault(); e.stopImmediatePropagation(); const d = e.altKey ? 0.1 : e.shiftKey ? 2 : 0.5;
      const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0;
      checkpoint('garrow'); objs().forEach((o) => { o.x = Math.min(100, Math.max(0, r2(o.x + dx))); o.y = Math.min(100, Math.max(0, r2(o.y + dy))); }); draw();
    }
  }, true);
  window.UX_KEYS_EXTRA = (window.UX_KEYS_EXTRA || []).concat([['여러 개 선택', [['Shift/Ctrl+클릭', '선택에 더하기·빼기'], ['빈 곳 끌기', '범위로 선택'], ['Ctrl+A', '모두 선택'], ['방향키 / Ctrl+J / Delete', '선택 전체 이동·복제·삭제']]]]);
  refreshBar();
})();
