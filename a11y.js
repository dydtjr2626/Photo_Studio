/* a11y.js — 접근성 보강 (마크업 속성은 여기서 부여) */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const all = (s, r) => Array.from((r || document).querySelectorAll(s));

  // (3) 입력 이름 / valuetext
  function nameInput(el) {
    let text = '';
    if (el.id) { const l = document.querySelector('label[for="' + el.id + '"]'); if (l) text = l.textContent; }
    if (!text) {
      let n = el.previousElementSibling;
      while (n && n.tagName !== 'LABEL') n = n.previousElementSibling;
      if (!n && el.parentElement) { const p = el.parentElement.previousElementSibling; if (p && p.tagName === 'LABEL') n = p; }
      if (n) { const c = n.cloneNode(true); all('.val,button', c).forEach((x) => x.remove()); text = c.textContent; }
    }
    text = (text || '').replace(/\s+/g, ' ').trim();
    if (text && !el.getAttribute('aria-label')) el.setAttribute('aria-label', text);
    if (!el.getAttribute('aria-label') && el.type === 'file') el.setAttribute('aria-label', el.id === 'tplFile' ? '템플릿 JSON 파일 선택' : '이미지 파일 선택');
    if (el.type === 'range') {
      const lab = el.previousElementSibling && el.previousElementSibling.tagName === 'LABEL' ? el.previousElementSibling : null;
      const v = lab && lab.querySelector('.val');
      const sync = () => el.setAttribute('aria-valuetext', (v && v.textContent.trim()) || el.value);
      sync();
      if (v) new MutationObserver(sync).observe(v, { childList: true, characterData: true, subtree: true });
      el.addEventListener('input', sync);
    }
  }
  function nameAll() {
    all('input[type=range],input[type=color],input[type=file],input[type=text],select,textarea').forEach((el) => { if (!el._a11y) { el._a11y = 1; nameInput(el); } });
    const ed = $('editor-input'); if (ed) ed.setAttribute('aria-label', '문구 직접 입력');
  }

  // (5) aria-pressed 동기화
  const TOG = '#bgToggle,#freeCenter,#cutContig,.seg button,.react button,#guideBtn,.catbtn,.preset,.tplbtn,#zFit,.swatches button';
  const pressed = (el) => el.setAttribute('aria-pressed', el.classList.contains('on') ? 'true' : 'false');
  const pobs = new MutationObserver((ms) => ms.forEach((m) => { if (m.target.matches && m.target.matches(TOG)) pressed(m.target); }));
  function bindToggles() {
    all(TOG).forEach((el) => {
      if (!el._p) { el._p = 1; pobs.observe(el, { attributes: true, attributeFilter: ['class'] }); }
      pressed(el);
    });
  }

  // (6) 메뉴
  [['saveBtn', 'saveMenu'], ['loadBtn', 'loadMenu']].forEach(([bi, mi]) => {
    const b = $(bi), m = $(mi);
    if (!b || !m) return;
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-controls', m.id);
    m.setAttribute('aria-label', b.textContent.trim());
    const items = () => all('[role=menuitem]', m);
    items().forEach((li) => li.setAttribute('tabindex', '-1'));
    let kb = false;
    document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('#' + bi)) { kb = e.detail === 0; setTimeout(() => { kb = false; }, 0); } }, true);
    const sync = () => b.setAttribute('aria-expanded', m.classList.contains('open') ? 'true' : 'false');
    new MutationObserver(() => {
      sync();
      if (m.classList.contains('open') && kb) { const f = items()[0]; if (f) f.focus(); }
    }).observe(m, { attributes: true, attributeFilter: ['class'] });
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      if (!m.classList.contains('open')) { b.click(); }
      const it = items(); (e.key === 'ArrowUp' ? it[it.length - 1] : it[0]).focus();
    });
    m.addEventListener('keydown', (e) => {
      const it = items(), i = it.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); it[(i + 1) % it.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); it[(i - 1 + it.length) % it.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); it[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); it[it.length - 1].focus(); }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (i >= 0) it[i].click(); b.focus(); }
      else if (e.key === 'Escape') { b.focus(); }
      else if (e.key === 'Tab') { m.classList.remove('open'); }
    });
  });

  // (6) 다이얼로그 포커스
  const dlg = $('dlg');
  if (dlg) {
    let prev = null, lastF = null;
    const rec = (e) => { const t = e.target; if (t && t.nodeType === 1 && t !== document.body && !dlg.contains(t)) lastF = t.closest('button,[tabindex],input,select,textarea,a,li') || t; };
    document.addEventListener('focusin', rec, true);
    document.addEventListener('pointerdown', rec, true);
    document.addEventListener('keydown', rec, true);
    new MutationObserver(() => {
      if (dlg.classList.contains('on')) {
        prev = lastF || (document.activeElement !== document.body ? document.activeElement : null);
        const c = $('dlgCancel'); if (c && document.activeElement !== c) c.focus();
      } else if (prev) {
        const el = document.contains(prev) && prev.offsetParent !== null ? prev : ($('layer') || document.body);
        try { el.focus(); } catch (_) { /* 무시 */ }
        prev = null;
      }
    }).observe(dlg, { attributes: true, attributeFilter: ['class'] });
    dlg.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !dlg.classList.contains('on')) return;
      const f = all('button', dlg); if (!f.length) return;
      const a = f.indexOf(document.activeElement);
      if (e.shiftKey && a <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && a === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
  }

  // (7) 편집 레이어, 라이브 영역
  const layer = $('layer');
  if (layer) {
    layer.setAttribute('role', 'application');
    layer.setAttribute('aria-label', '편집 영역: 사진·문구·도형을 끌어 옮기고, 선택 후 방향키로 미세 이동, Delete로 삭제');
    layer.setAttribute('tabindex', '0');
  }
  const cv = $('cv'); if (cv) { cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', '카드 미리보기'); }
  const live = document.createElement('div');
  live.className = 'sr-only'; live.id = 'a11yLive';
  live.setAttribute('aria-live', 'polite'); live.setAttribute('role', 'status');
  document.body.appendChild(live);
  let last = '';
  const say = (t) => { if (t === last) return; last = t; live.textContent = ''; setTimeout(() => { live.textContent = t; }, 30); };
  const sel = $('sel');
  function selState() {
    if (!sel || sel.style.display === 'none' || getComputedStyle(sel).display === 'none') return '선택 없음';
    const c = sel.classList;
    if (c.contains('photo')) return '사진 또는 그림 선택됨';
    if (c.contains('text')) { const l = $('lblSize'); return l && /도형|스티커/.test(l.textContent) ? '도형 선택됨' : '문구 선택됨'; }
    return '선택 없음';
  }
  if (sel) new MutationObserver(() => say(selState())).observe(sel, { attributes: true, attributeFilter: ['class', 'style'] });
  const toast = $('toast');
  if (toast) { toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite'); }
  ['textMsg', 'tplMsg', 'cmpMsg'].forEach((id) => { const e = $(id); if (e) e.setAttribute('role', 'status'); });

  const closeBtn = $('closeSite'); if (closeBtn && !closeBtn.getAttribute('aria-label')) closeBtn.setAttribute('aria-label', '사이트 닫기');
  const names = { stickerCats: '스티커 분류', shapeRow: '도형', stickerRow: '스티커', tplRow: '배경 템플릿', layerList: '그림 목록', presets: '사진 보정 프리셋' };
  Object.keys(names).forEach((id) => { const e = $(id); if (e) { if (!e.getAttribute('role')) e.setAttribute('role', 'group'); if (!e.getAttribute('aria-label')) e.setAttribute('aria-label', names[id]); } });

  function nameButtons() {
    all('#shapeRow button,#stickerRow button,#tplRow button,#stickerCats button').forEach((b) => {
      if (!b.getAttribute('aria-label') && !b.textContent.trim()) b.setAttribute('aria-label', b.title || b.dataset.shape || b.dataset.id || '항목');
    });
  }

  // (H) 스킵 링크·랜드마크
  const skip = document.createElement('a');
  skip.className = 'skip-link'; skip.href = '#preview'; skip.textContent = '본문으로 건너뛰기';
  document.body.insertBefore(skip, document.body.firstChild);
  const win = document.querySelector('.window');
  skip.addEventListener('click', (e) => { e.preventDefault(); if (win) { win.setAttribute('tabindex', '-1'); win.focus(); } });
  const lm = (sel2, role, label) => { const e = document.querySelector(sel2); if (e) { if (!e.getAttribute('role') && !/^(ASIDE)$/.test(e.tagName)) e.setAttribute('role', role); if (label && !e.getAttribute('aria-label')) e.setAttribute('aria-label', label); } };
  lm('.window', 'main', '미리보기');
  lm('.side', 'complementary', '도형·스티커·템플릿');
  lm('.main', 'complementary', '이미지·문구 설정');
  lm('.wbar', 'banner', null);

  // (H) 로빙 tabindex 그리드
  const ROV = ['shapeRow', 'stickerRow'];
  function rove(g) {
    const bs = all('button', g); if (!bs.length) return;
    let cur = bs.find((b) => b.getAttribute('tabindex') === '0') || bs[0];
    bs.forEach((b) => b.setAttribute('tabindex', b === cur ? '0' : '-1'));
  }
  ROV.forEach((id) => {
    const g = $(id); if (!g) return;
    g.addEventListener('focusin', (e) => { const b = e.target.closest && e.target.closest('button'); if (b && b.parentElement === g) all('button', g).forEach((x) => x.setAttribute('tabindex', x === b ? '0' : '-1')); });
    g.addEventListener('keydown', (e) => {
      const bs = all('button', g), i = bs.indexOf(document.activeElement); if (i < 0) return;
      let n = -1;
      if (e.key === 'ArrowRight') n = Math.min(i + 1, bs.length - 1);
      else if (e.key === 'ArrowLeft') n = Math.max(i - 1, 0);
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = bs.length - 1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const r = bs[i].getBoundingClientRect(), dir = e.key === 'ArrowDown' ? 1 : -1; let best = null, bd = 1e9;
        bs.forEach((b, k) => { const q = b.getBoundingClientRect(); if ((q.top - r.top) * dir > 2) { const d = Math.abs(q.left - r.left) + Math.abs(q.top - r.top) * 0.01; if (d < bd) { bd = d; best = k; } } });
        if (best !== null) n = best;
      }
      if (n >= 0) { e.preventDefault(); bs[n].focus(); }
    });
  });

  // (G) 동적 영역만 관찰, rAF 디바운스
  function run() { nameAll(); bindToggles(); nameButtons(); ROV.forEach((id) => { const g = $(id); if (g) rove(g); }); }
  run();
  let raf = 0;
  const sched = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; run(); }); };
  const dyn = new MutationObserver(sched);
  ['shapeRow', 'stickerRow', 'stickerCats', 'tplRow', 'layerList'].forEach((id) => { const e = $(id); if (e) dyn.observe(e, { childList: true, subtree: true }); });
  const mainEl = document.querySelector('.main'); if (mainEl) dyn.observe(mainEl, { childList: true, subtree: true });
  const dockEl = document.querySelector('.dock'); if (dockEl) dyn.observe(dockEl, { childList: true, subtree: true });
})();
