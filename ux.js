/* ux.js — 온보딩/발견성: 빈 상태 오버레이, 단축키 치트시트, 선택 힌트, 이탈 경고, 첫 방문 팁 (app.js 뒤에 로드, app.js 동작은 바꾸지 않음) */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const hasWork = () => { try { return state.photos.length + state.items.length > 0; } catch (_) { return false; } };
  const typing = (t) => !!t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && !/^(button|checkbox|radio|range|file)$/.test(t.type)) || t.isContentEditable);

  /* ---------- (1) 빈 상태 오버레이 (DOM 전용, #cv 픽셀과 무관) ---------- */
  const wrap = document.querySelector('.canvaswrap');
  let empty = null;
  if (wrap) {
    empty = el('div', 'ux-empty'); empty.setAttribute('role', 'group'); empty.setAttribute('aria-label', '시작하기');
    const card = el('div', 'ux-empty-card');
    const main = el('button', 'ux-empty-main', '사진 불러오기'); main.type = 'button';
    main.addEventListener('click', () => { const f = $('file'); if (f) f.click(); });
    const drop = el('p', 'ux-empty-drop', '또는 사진을 여기로 끌어다 놓으세요 (PNG·JPEG)');
    const row = el('div', 'ux-empty-row');
    const b1 = el('button', 'ux-empty-sub', '새 그림으로 시작'); b1.type = 'button';
    b1.addEventListener('click', () => { const n = $('newCanvas'); if (n) n.click(); });
    const b2 = el('button', 'ux-empty-sub', '문구부터 시작'); b2.type = 'button';
    b2.addEventListener('click', () => { const n = $('newText'); if (n) n.focus(); });
    row.append(b1, b2); card.append(main, drop, row); empty.append(card);
    wrap.appendChild(empty);
  }

  /* ---------- (3) 선택 힌트 ---------- */
  let hint = null;
  const bar = document.querySelector('.orderbar');
  if (bar) { hint = el('div', 'ux-hint'); hint.setAttribute('aria-live', 'polite'); hint.hidden = true; bar.insertAdjacentElement('afterend', hint); }
  function hintText() {
    let o; try { o = [...state.items, ...state.photos].find((q) => q.id === state.sel); } catch (_) { return ''; }
    if (!o || state.editing) return '';
    if (o.canvas) return o.blank ? '그림: 모서리=크기, 위 점=회전, Delete=삭제 · 잠금 Ctrl+/'
      : '사진: 모서리=크기, 옆 점=늘이기, 위 점=회전, Delete=삭제';
    if (o.shape) return '도형: 모서리=크기, 옆 점=늘이기, 위 점=회전, 숫자키=불투명도, Delete=삭제';
    return '문구: 모서리=크기, 위 점=회전, 더블클릭=문구 수정, 숫자키=불투명도, Delete=삭제';
  }

  let lastKey = '';
  function refresh() {
    if (empty) empty.classList.toggle('ux-off', hasWork());
    if (hint) { const t = hintText(); if (t !== lastKey) { lastKey = t; hint.textContent = t; hint.hidden = !t; } }
  }
  // zoom.js 가 paint/syncUI 를 감싼 뒤 window.__onPaint 배열의 함수를 호출한다 → 폴링 대신 구독
  (window.__onPaint = window.__onPaint || []).push(() => { if (!document.hidden) refresh(); });
  setTimeout(() => { if (!window.__zoom) setInterval(() => { if (!document.hidden) refresh(); }, 250); }, 2000);   // zoom.js 가 없을 때만 폴링
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  ['pointerup', 'keyup', 'click'].forEach((ev) => document.addEventListener(ev, () => setTimeout(refresh, 30), true));
  refresh();

  /* ---------- (2) 단축키 치트시트 ---------- */
  const GROUPS = [
    ['도구', [['V', '이동·크기'], ['C', '자르기'], ['B', '그리기(펜)'], ['E', '지우개'], ['W', '배경 지우기: 색 지우기'], ['L', '배경 지우기: 영역 선택'], ['T', '문구 입력창으로 이동'], ['[ / ]', '펜·지우개 크기 줄이기 / 키우기'], ['Enter / Esc', '자르기 적용 / 취소']]],
    ['편집', [['Ctrl+Z', '되돌리기'], ['Ctrl+Y / Ctrl+Shift+Z', '다시 실행'], ['Ctrl+J', '복제'], ['Ctrl+D', '선택 해제'], ['Ctrl+Shift+X', '터치 보정'], ['Ctrl+/', '잠금'], ['Ctrl+; / Ctrl+\'', '안내선'], ['화살표', '선택 항목 0.5% 이동 (Shift: 2%)'], ['Delete', '선택 항목 삭제']]],
    ['미리보기 줌', [['Ctrl+0', '화면에 맞춤'], ['Ctrl+1', '100%'], ['Ctrl+= / Ctrl+-', '확대 / 축소 (단계)'], ['Ctrl+휠', '커서 기준 확대·축소 (×1.1씩)'], ['Space+드래그 / 휠 버튼', '확대했을 때 화면 이동'], ['자유형', '줌 없음 (브라우저 줌 사용 가능)']]],
    ['저장·불러오기', [['Ctrl+S', 'PNG로 저장'], ['Ctrl+Shift+S', 'JPEG로 저장'], ['Ctrl+O', '사진 불러오기'], ['Ctrl+C / Ctrl+V', '선택 항목 복사·붙여넣기 (복사한 이미지도 붙여넣기)']]],
    ['숫자키', [['1 ~ 9', '선택한 문구·도형 불투명도 10~90%'], ['0', '불투명도 100%']]],
    ['기타', [['?', '이 단축키 안내 열기'], ['더블클릭', '문구 수정 (회전 점: 기울기 초기화)'], ['Shift + 회전', '15° 단위 회전']]],
  ];
  let dlg = null, opener = null;
  // 다른 모듈(align.js 등)이 window.UX_KEYS_EXTRA = [[제목, [[키, 설명], ...]], ...] 로 항목을 추가하면 열 때마다 병합(같은 제목은 합침)
  function fillBody(body) {
    body.textContent = '';
    const all = GROUPS.map(([g, r]) => [g, r.slice()]);
    let extra = []; try { extra = Array.isArray(window.UX_KEYS_EXTRA) ? window.UX_KEYS_EXTRA : []; } catch (_) { }
    extra.forEach((x) => {
      if (!Array.isArray(x) || typeof x[0] !== 'string' || !Array.isArray(x[1])) return;
      const rows = x[1].filter((r) => Array.isArray(r) && r.length >= 2);
      const hit = all.find((a) => a[0] === x[0]);
      if (hit) hit[1].push(...rows); else all.push([x[0], rows]);
    });
    all.forEach(([g, rows]) => {
      const sec = el('section', 'ux-keys-group'); sec.append(el('h3', null, g));
      const dl = el('dl');
      rows.forEach(([k, d]) => { const dt = el('dt'); String(k).split(' / ').forEach((p, i) => { if (i) dt.append(' / '); dt.append(el('kbd', null, p)); }); dl.append(dt, el('dd', null, String(d))); });
      sec.append(dl); body.append(sec);
    });
  }
  function build() {
    dlg = el('div', 'ux-modal'); dlg.hidden = true;
    const box = el('div', 'ux-modal-box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'ux-keys-title'); box.tabIndex = -1;
    const head = el('div', 'ux-modal-head'); const h = el('h2', null, '단축키'); h.id = 'ux-keys-title';
    const x = el('button', 'ux-modal-x', '닫기'); x.type = 'button'; x.addEventListener('click', closeKeys);
    head.append(h, x); box.append(head);
    const body = el('div', 'ux-modal-body'); fillBody(body);
    box.append(body); dlg.append(box);
    dlg.addEventListener('mousedown', (e) => { if (e.target === dlg) closeKeys(); });
    document.body.appendChild(dlg);
  }
  function openKeys() {
    if (!dlg) build(); else fillBody(dlg.querySelector('.ux-modal-body'));
    opener = document.activeElement; dlg.hidden = false;
    dlg.querySelector('.ux-modal-x').focus();
  }
  function closeKeys() {
    if (!dlg || dlg.hidden) return; dlg.hidden = true;
    if (opener && opener.focus && document.contains(opener)) opener.focus(); opener = null;
  }
  document.addEventListener('keydown', (e) => {
    if (dlg && !dlg.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeKeys(); return; }
      if (e.key === 'Tab') { e.preventDefault(); dlg.querySelector('.ux-modal-x').focus(); }   // 버튼이 하나뿐이라 포커스 고정
      else { if ((e.ctrlKey || e.metaKey) && /^[sopSOP]$/.test(e.key)) e.preventDefault(); }  // 브라우저 '페이지 저장' 등 방지
      e.stopImmediatePropagation();                                                          // 모달 중 앱 단축키 차단
      return;
    }
    const dOn = $('dlg') && $('dlg').classList.contains('on');
    if (e.key === '?' && !dOn && !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e.target)) { e.preventDefault(); openKeys(); }
  }, true);
  const wbar = document.querySelector('.wbar');
  if (wbar) {
    const kb = el('button', 'ux-keys-btn', '단축키'); kb.type = 'button'; kb.title = '단축키 안내 (?)'; kb.setAttribute('aria-haspopup', 'dialog');
    kb.addEventListener('click', openKeys); wbar.appendChild(kb);
  }

  /* ---------- (4) 이탈 경고 ---------- */
  // 변경 감지: 문서 기록(마지막 seq)·사진 픽셀 기록·개수의 서명. PNG/JPEG 저장 성공 시점의 서명과 같으면 '저장됨'
  const sig = () => { try {
    const dh = docHist.length ? docHist[docHist.length - 1].seq : 0;
    return [dh, docHist.length, docRedo.length, state.items.length, state.photos.map((p) => p.id + ':' + (p.hist ? p.hist.length + '/' + (p.hist.length ? p.hist[p.hist.length - 1].seq : 0) : 0)).join(',')].join('|');
  } catch (_) { return Math.random() + ''; } };
  let savedSig = null;
  if (typeof exportAs === 'function') {
    const origExport = exportAs;
    exportAs = async function () { const sg = sig(); const r = await origExport.apply(this, arguments); savedSig = sg; return r; };   // 예외 없이 끝난 저장만 인정
  }
  const dirty = () => hasWork() && sig() !== savedSig;
  // 사이트 닫기: 앱 자체 확인창을 수락하면 브라우저 이탈 경고를 또 띄우지 않음
  let closing = false;
  const cs = $('closeSite'), dOk = $('dlgOk'), dBox = $('dlg');
  if (cs) cs.addEventListener('click', () => { closing = true; }, true);
  if (dOk) dOk.addEventListener('click', () => { if (closing) { window.__skipUnload = true; setTimeout(() => { window.__skipUnload = false; }, 3000); } closing = false; }, true);
  if (dBox) dBox.addEventListener('click', (e) => { if (e.target !== dOk) closing = false; }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closing = false; }, true);
  window.addEventListener('beforeunload', (e) => {
    if (window.__skipUnload || window.__autosaved || !dirty()) return;   // 자동저장이 끝난 상태면 경고하지 않음
    e.preventDefault(); e.returnValue = '저장하지 않은 작업이 사라집니다.'; return e.returnValue;
  });

  /* ---------- (5) 첫 방문 팁 (1회) ---------- */
  try {
    if (!localStorage.getItem('ux-tip-seen')) {
      localStorage.setItem('ux-tip-seen', '1');
      setTimeout(() => { if (typeof toast === 'function') toast('처음이신가요? ? 키를 누르면 단축키 안내가 열립니다.', 'ux-tip'); }, 900);
    }
  } catch (_) { /* 저장소 차단 시 건너뜀 */ }
})();
