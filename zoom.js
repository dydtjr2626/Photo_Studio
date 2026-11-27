/* zoom.js — 미리보기 줌/팬 + 하단 상태바
 * 방식: #cv 의 CSS 표시 크기만 바꾼다(캔버스 픽셀·render 엔진은 그대로 → 내려받기 diff 0).
 * app.js 의 모든 포인터 좌표는 getBoundingClientRect 비율이라 확대해도 그대로 맞는다.
 * 확대 시 .stage 가 스크롤 컨테이너가 됨. 자유형 프레임에서는 줌 비활성(맞춤 고정). */
(function () {
  'use strict';
  const stage = document.querySelector('.stage');
  const wrap = document.querySelector('.canvaswrap');
  if (!stage || !wrap || typeof cv === 'undefined') return;
  const MIN = 0.1, MAX = 4;
  let fitZ = 0;                 // 마지막으로 관측한 '화면에 맞춤' 배율
  let zoom = 0;                 // 0 = 화면에 맞춤, 아니면 출력 픽셀 대비 배율(1 = 100%)
  let spaceDown = false;

  const st = document.createElement('style');
  st.textContent = `
.stage.zm{display:block;overflow:auto;max-height:64vh;overscroll-behavior:contain;border-radius:6px}
.stage.zm .canvaswrap{max-width:none;width:max-content;margin:0 auto}
#cv.zm{max-width:none !important;max-height:none !important;height:auto !important}
.stage.zm.pan,.stage.zm.pan #layer{cursor:grab !important}
.stage.zm.panning,.stage.zm.panning #layer{cursor:grabbing !important}
#zoomBar{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 8px;margin:8px 0 2px;font-size:12px;color:#555}
#zoomBar .btn{padding:3px 9px;min-width:0}
#zoomBar .zpct{min-width:46px;text-align:center;font-weight:600;font-variant-numeric:tabular-nums}
#zoomBar .zinfo{font-variant-numeric:tabular-nums;white-space:nowrap}
#zoomBar .zsep{opacity:.35}
`;
  document.head.appendChild(st);

  const bar = document.createElement('div');
  bar.id = 'zoomBar'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', '줌과 상태');
  bar.innerHTML = '<button type="button" class="btn sm" id="zOut" title="축소 (Ctrl+-)" aria-label="축소">−</button>'
    + '<span class="zpct" id="zPct" aria-live="polite">100%</span>'
    + '<button type="button" class="btn sm" id="zIn" title="확대 (Ctrl+=)" aria-label="확대">+</button>'
    + '<button type="button" class="btn sm" id="zFit" title="화면에 맞춤 (Ctrl+0)">화면에 맞춤</button>'
    + '<button type="button" class="btn sm" id="z100" title="100% (Ctrl+1)">100%</button>'
    + '<span class="zsep">|</span><span class="zinfo" id="zRes"></span>'
    + '<span class="zsep">|</span><span class="zinfo" id="zSel">선택 없음</span>';
  stage.insertAdjacentElement('afterend', bar);
  const $z = (id) => document.getElementById(id);

  const isFree = () => state.ratio === 'free';
  const effZoom = () => cv.clientWidth / Math.max(1, cv.width);

  function apply() {
    if (isFree() && zoom) zoom = 0;
    const on = zoom > 0;
    stage.classList.toggle('zm', on); cv.classList.toggle('zm', on);
    if (on) cv.style.setProperty('width', cv.width * zoom + 'px', 'important');
    else { cv.style.removeProperty('width'); if (isFree() && freeW) cv.style.width = freeW + 'px'; stage.scrollLeft = stage.scrollTop = 0; }
    refresh();
  }

  function setZoom(z, cx, cy) {   // z: 0 = 맞춤. cx/cy: 커서 기준 확대 중심(화면 좌표)
    if (isFree()) { refresh(); return; }
    const r0 = cv.getBoundingClientRect();
    if (cx == null) { cx = r0.left + r0.width / 2; cy = r0.top + r0.height / 2; }
    const fx = (cx - r0.left) / Math.max(1, r0.width), fy = (cy - r0.top) / Math.max(1, r0.height);
    zoom = z ? Math.min(MAX, Math.max(MIN, z)) : 0;
    if (zoom && fitZ && Math.abs(zoom - fitZ) / fitZ < 0.02) zoom = 0;   // 맞춤 배율과 거의 같으면 '맞춤' 상태로
    apply();
    if (zoom) {
      const r1 = cv.getBoundingClientRect();
      stage.scrollLeft += (r1.left + fx * r1.width) - cx;
      stage.scrollTop += (r1.top + fy * r1.height) - cy;
    }
    refresh();
  }

  const num2 = (v, d) => (Number.isFinite(+v) ? +v : d);
  function selInfo() {
    const it = selItem && selItem(), ph = selPhoto && selPhoto(), o = it || ph;
    if (!o) return '선택 없음';
    const x = Math.round(num2(o.x, 50) / 100 * cv.width - frameInset(state)), y = Math.round(num2(o.y, 50) / 100 * cv.height - frameInset(state));
    const size = it ? num2(it.s, 0) : num2(ph.scale, 100);
    const rot = Math.round(num2(o.rot, 0));
    return `X ${x} · Y ${y} · 크기 ${Math.round(size * 10) / 10}% · 회전 ${rot}°`;
  }
  const cache = {};
  const setTxt = (id, t) => { if (cache[id] !== t) { cache[id] = t; $z(id).textContent = t; } };
  const setDis = (id, v) => { const k = id + ':d'; if (cache[k] !== v) { cache[k] = v; $z(id).disabled = v; } };
  /* 가운데 열 폭을 캔버스 폭에 맞춤: 캔버스는 높이(46vh)로 제한돼 열(560px)보다 좁아 양옆이 비므로, 열을 줄여 여백을 없앤다.
     줌·자유형에서는 기본 폭(560px). 헤더·도구 줄이 들어갈 최소 폭 414px. */
  function fitColumn() {
    const grid = document.getElementById('editor'); if (!grid) return;
    let w = 560;
    if (!zoom && !isFree() && cv.width > 0 && cv.height > 0) {
      const avail = innerWidth > 1250 ? innerWidth - 300 - 420 - 48 : innerWidth - 340 - 24;   // 양옆 패널을 뺀 가운데 열 최대 폭
      w = Math.round(Math.min(980, Math.max(480, Math.min(avail, Math.max(240, innerHeight - 124) * cv.width / cv.height))));
    }
    if (cache.col !== w) { cache.col = w; grid.style.setProperty('--ccol', w + 'px'); grid.classList.toggle('ps-narrow', w < 460); }   // 좁으면 헤더 제목을 숨김
  }
  function refresh() {
    fitColumn();
    const free = isFree();
    const ez = effZoom();
    if (!zoom && ez > 0) fitZ = ez;
    const pct = Math.round(ez * 100);
    setTxt('zPct', free ? '맞춤 ' + pct + '%' : (zoom ? pct + '%' : pct + '% (맞춤)'));
    setTxt('zRes', '출력 ' + (cv.width - 2 * frameInset(state)) + '×' + (cv.height - 2 * frameInset(state)) + ' px' + (free ? ' · 자유형: 줌 사용 불가' : ''));
    setTxt('zSel', selInfo());
    ['zOut', 'zIn', 'zFit', 'z100'].forEach((id) => setDis(id, free));
    const on = !zoom; if (cache.fitOn !== on) { cache.fitOn = on; $z('zFit').classList.toggle('on', on); }
  }

  // paint 를 감싸 상태바를 항상 최신으로(동기 호출 유지)
  const origPaint = paint;
  const hooks = window.__onPaint = window.__onPaint || [];   // ux.js 등이 구독하는 paint 후크(함수 배열)
  const fireHooks = () => hooks.forEach((f) => { try { f(); } catch (_) { } });
  paint = function () { origPaint.apply(this, arguments); refresh(); fireHooks(); };
  const origSync = syncUI;
  syncUI = function () { const r = origSync.apply(this, arguments); if (isFree() && zoom) { zoom = 0; apply(); } refresh(); fireHooks(); return r; };

  $z('zOut').addEventListener('click', () => setZoom(stepZoom(-1)));
  $z('zIn').addEventListener('click', () => setZoom(stepZoom(1)));
  $z('zFit').addEventListener('click', () => setZoom(0));
  $z('z100').addEventListener('click', () => setZoom(1));
  const STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.5, 2, 3, 4];
  function stepZoom(dir) {
    const cur = effZoom();
    if (dir > 0) return STEPS.find((s) => s > cur * 1.02) || MAX;
    return [...STEPS].reverse().find((s) => s < cur * 0.98) || STEPS[0];
  }

  // Ctrl+휠 / 트랙패드 핀치 → 커서 기준 줌
  stage.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey) || isFree()) return;   // 자유형은 브라우저 줌 허용
    e.preventDefault();
    const units = Math.max(-3, Math.min(3, e.deltaY / (e.deltaMode === 1 ? 3 : 100)));   // 마우스 휠 1칸 = ×1.1, 핀치는 연속
    if (!units) return;
    setZoom(effZoom() * Math.pow(1.1, -units), e.clientX, e.clientY);
  }, { passive: false });

  // 팬: 스페이스+드래그, 휠 버튼 드래그
  const typing = (t) => t && (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable || (t.tagName === 'INPUT' && !/^(range|checkbox|radio|button|color|file)$/.test(t.type)));
  const panTarget = (t) => !t || t === document.body || t === document.documentElement || t.id === 'layer' || (t.closest && !t.closest('button,a,select,[role=menuitem],input,textarea,[contenteditable]') && t.closest('#layer'));
  const canPan = () => stage.classList.contains('zm') && (stage.scrollWidth > stage.clientWidth || stage.scrollHeight > stage.clientHeight);
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && panTarget(e.target) && !typing(e.target) && !e.ctrlKey && !e.metaKey && !e.altKey && canPan()) { spaceDown = true; stage.classList.add('pan'); e.preventDefault(); }
  }, true);
  document.addEventListener('keyup', (e) => { if (e.code === 'Space') { spaceDown = false; stage.classList.remove('pan'); } }, true);
  window.addEventListener('blur', () => { spaceDown = false; stage.classList.remove('pan'); });
  let pan = null;
  stage.addEventListener('pointerdown', (e) => {
    if (!(e.button === 1 || (e.button === 0 && spaceDown)) || !stage.classList.contains('zm')) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    pan = { x: e.clientX, y: e.clientY, sl: stage.scrollLeft, st: stage.scrollTop, id: e.pointerId };
    try { stage.setPointerCapture(e.pointerId); } catch (_) { }
    stage.classList.add('panning');
  }, true);
  stage.addEventListener('pointermove', (e) => {
    if (!pan || e.pointerId !== pan.id) return;
    stage.scrollLeft = pan.sl - (e.clientX - pan.x); stage.scrollTop = pan.st - (e.clientY - pan.y);
  });
  const endPan = (e) => { if (pan && e.pointerId === pan.id) { pan = null; stage.classList.remove('panning'); try { stage.releasePointerCapture(e.pointerId); } catch (_) { } } };
  stage.addEventListener('pointerup', endPan); stage.addEventListener('pointercancel', endPan);
  stage.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
  stage.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });   // 휠 버튼 자동 스크롤 방지

  // 단축키
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey || typing(e.target) || isFree()) return;   // 자유형: 브라우저 줌 허용
    let h = null;
    if (e.key === '0') h = () => setZoom(0);
    else if (e.key === '1') h = () => setZoom(1);
    else if (e.key === '=' || e.key === '+') h = () => setZoom(stepZoom(1));
    else if (e.key === '-' || e.key === '_') h = () => setZoom(stepZoom(-1));
    if (!h) return;
    e.preventDefault(); e.stopImmediatePropagation(); h();
  }, true);

  // 자유형으로 들어가기 전에 먼저 맞춤으로 되돌림(app.js 가 현재 표시 폭을 freeW 로 이어받기 때문)
  document.querySelectorAll('.ratio[data-ratio="free"]').forEach((b) => b.addEventListener('click', () => { if (zoom) { zoom = 0; apply(); } }, true));
  window.addEventListener('resize', refresh);
  // 외부(템플릿/비율 변경 등)로 캔버스 크기가 바뀌었을 때도 갱신
  if (window.ResizeObserver) new ResizeObserver(() => refresh()).observe(cv);
  refresh();
  window.__zoom = { set: setZoom, get: () => zoom };
})();
