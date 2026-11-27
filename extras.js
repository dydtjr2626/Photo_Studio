/* extras.js — 글자 효과 UI, HEX·스포이트·브랜드 색, 레이어 목록(순서·잠금·삭제), 이미지·객체 붙여넣기.
   app.js 의 전역(state, setParam, syncUI, drawOrder …)을 그대로 쓰는 보조 스크립트(app.js 뒤에 로드). */
(() => {
  'use strict';
  const $x = (id) => document.getElementById(id);
  const isHex = (v) => /^#[0-9a-f]{6}$/i.test(String(v));

  /* ---------- 글자 효과: 그림자 · 외곽선 · 그라디언트 ---------- */
  $x('shSl').addEventListener('input', (e) => setParam('sh', e.target.value));
  $x('shc').addEventListener('input', (e) => setParam('shColor', e.target.value));
  $x('olSl').addEventListener('input', (e) => setParam('ol', e.target.value));
  $x('olc').addEventListener('input', (e) => setParam('olColor', e.target.value));
  $x('c2').addEventListener('input', (e) => setParam('color2', e.target.value));
  $x('gradToggle').addEventListener('click', () => { const it = selItem(); setParam('grad', it ? !it.grad : false); });

  /* ---------- HEX 입력 · 스포이트 · 브랜드 색(브라우저에 저장) ---------- */
  const PAL_KEY = 'ps-palette', PAL_MAX = 12;
  const palLoad = () => { try { const a = JSON.parse(localStorage.getItem(PAL_KEY) || '[]'); return Array.isArray(a) ? a.filter(isHex).slice(0, PAL_MAX) : []; } catch (e) { return []; } };
  let palette = palLoad();
  const palSave = () => { try { localStorage.setItem(PAL_KEY, JSON.stringify(palette)); } catch (e) { toast('이 브라우저에서는 색을 저장할 수 없습니다.'); } };
  const normHex = (v) => { let t = String(v).trim().toLowerCase(); if (t && t[0] !== '#') t = '#' + t; if (/^#[0-9a-f]{3}$/.test(t)) t = '#' + t.slice(1).split('').map((c) => c + c).join(''); return t; };
  function renderPalette() {
    const box = $x('palRow'), it = selItem(); box.replaceChildren();
    if (!palette.length) { const h = document.createElement('span'); h.className = 'palhint'; h.textContent = '“+ 색 저장”으로 자주 쓰는 색을 모아 두세요 (우클릭: 삭제)'; box.appendChild(h); return; }
    palette.forEach((c) => {
      const b = document.createElement('button'); b.type = 'button'; b.style.background = c; b.title = c + ' · 눌러서 적용 · 우클릭으로 삭제'; b.setAttribute('aria-label', '브랜드 색 ' + c);
      if (it && it.color === c) b.classList.add('on');
      b.addEventListener('click', (e) => { if (e.altKey) { palette = palette.filter((x) => x !== c); palSave(); renderPalette(); return; } setParam('color', c); });
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); palette = palette.filter((x) => x !== c); palSave(); renderPalette(); });
      box.appendChild(b);
    });
  }
  $x('palAdd').addEventListener('click', () => {
    const it = selItem(); if (!it) return;
    if (palette.includes(it.color)) { toast('이미 저장된 색입니다.'); return; }
    if (palette.length >= PAL_MAX) palette.shift();
    palette.push(it.color); palSave(); renderPalette(); toast('브랜드 색에 저장했습니다.', 'ok');
  });
  const hexIn = $x('hexIn');
  const applyHex = () => { const v = normHex(hexIn.value); if (!isHex(v)) { setParam('color', v); return; } setParam('color', v); };
  hexIn.addEventListener('change', applyHex);
  hexIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyHex(); hexIn.blur(); } });
  if ('EyeDropper' in window) $x('eyeBtn').addEventListener('click', async () => { try { const r = await new EyeDropper().open(); if (selItem()) setParam('color', r.sRGBHex); } catch (e) { /* 취소 */ } });
  else $x('eyeBtn').classList.add('hide');   // 이 브라우저는 스포이트를 지원하지 않음(Chrome·Edge 에서 사용 가능)

  /* ---------- 레이어 목록 ---------- */
  const labelOf = (o, isPhoto) => (isPhoto ? (o.name || (o.blank ? '그림' : '사진')) : o.shape ? SHAPES[o.shape][0] : (String(o.text || '').replace(/\s+/g, ' ').trim().slice(0, 16) || '(빈 문구)'));
  const kindOf = (o, isPhoto) => (isPhoto ? (o.blank ? '그림' : '사진') : o.shape ? '도형' : '문구');
  function moveLayer(id, dir) {                                   // dir +1 = 앞으로(위), -1 = 뒤로
    const ord = drawOrder(state).map((e) => e.o), i = ord.findIndex((o) => o.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= ord.length) return;
    endEdit(); checkpoint();
    [ord[i], ord[j]] = [ord[j], ord[i]];
    ord.forEach((o, n) => { o.z = n; });                          // 순서를 z 로 굳힘(되돌리기 가능)
    syncUI(); paint();
  }
  window.moveLayer = moveLayer;
  let layerSig = '';
  function renderLayers() {
    const rows = drawOrder(state).slice().reverse();              // 위(앞) → 아래(뒤)
    const sig = rows.map((r) => [r.o.id, labelOf(r.o, r.isPhoto), !!r.o.locked, r.o.id === state.sel ? 1 : 0].join(':')).join('|');
    if (sig === layerSig) return; layerSig = sig;
    const box = $x('layerItems'); box.replaceChildren(); $x('layerCount').textContent = rows.length ? rows.length + '개' : '';
    if (!rows.length) { const e = document.createElement('div'); e.className = 'lempty'; e.textContent = '사진·문구·도형을 추가하면 여기에 쌓입니다.'; box.appendChild(e); return; }
    rows.forEach((r, idx) => {
      const o = r.o, row = document.createElement('div'); row.className = 'lrow' + (o.id === state.sel ? ' on' : '') + (o.locked ? ' locked' : ''); row.setAttribute('role', 'listitem');
      const mkBtn = (txt, title, fn, dis) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.title = title; b.setAttribute('aria-label', title); b.disabled = !!dis; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; };
      const kind = document.createElement('span'); kind.className = 'lkind k-' + kindOf(o, r.isPhoto); kind.textContent = kindOf(o, r.isPhoto);
      const name = document.createElement('span'); name.className = 'lname'; name.textContent = labelOf(o, r.isPhoto);
      row.append(kind, name,
        mkBtn('▲', '앞으로 (위로)', () => moveLayer(o.id, +1), idx === 0),
        mkBtn('▼', '뒤로 (아래로)', () => moveLayer(o.id, -1), idx === rows.length - 1),
        mkBtn(o.locked ? '🔒' : '🔓', o.locked ? '잠금 해제' : '잠그기', () => { endEdit(); checkpoint(); o.locked = !o.locked; if (o.locked && state.sel === o.id) state.sel = null; syncUI(); paint(); }),
        mkBtn('✕', '삭제', () => confirmDelete(`‘${labelOf(o, r.isPhoto)}’을(를) 삭제할까요? 삭제한 뒤에도 되돌리기(Ctrl+Z)로 복구할 수 있습니다.`, () => { state.sel = o.id; removeSel(); })));
      row.addEventListener('click', () => {
        endEdit();
        if (o.locked) { revealedLock = o.id; toast('잠긴 항목입니다. 🔓 버튼이나 항목 위의 자물쇠로 해제할 수 있습니다.'); paint(); return; }
        state.sel = o.id; syncUI(); paint();
      });
      box.appendChild(row);
    });
  }

  /* ---------- 혼합 모드 · 모양 마스크 ---------- */
  BLENDS.forEach(([v, n]) => { for (const id of ['photoBlend', 'itemBlend']) { const o = document.createElement('option'); o.value = v; o.textContent = n; $x(id).appendChild(o); } });
  MASKS.forEach(([v, n]) => { const o = document.createElement('option'); o.value = v; o.textContent = n; $x('photoMask').appendChild(o); });
  $x('itemBlend').addEventListener('change', (e) => setParam('blend', e.target.value));
  $x('photoBlend').addEventListener('change', (e) => { const p = selPhoto(); if (!p) return; checkpoint(); p.blend = e.target.value === 'normal' ? undefined : e.target.value; syncUI(); paint(); });
  $x('photoMask').addEventListener('change', (e) => { const p = selPhoto(); if (!p) return; checkpoint(); p.mask = e.target.value || undefined; syncUI(); paint(); });

  /* ---------- 동기화: syncUI 가 끝날 때마다 새 컨트롤 값을 맞춤 ---------- */
  function syncExtras() {
    const it = selItem();
    if (it) {
      const sh = Math.round(clampN(it.sh, 0, 100, 0)), ol = Math.round(clampN(it.ol, 0, 20, 0));
      $x('shSl').value = sh; $x('vsh').textContent = sh ? sh + '%' : '없음'; $x('shc').value = isHex(it.shColor) ? it.shColor : '#000000'; $x('shc').disabled = !sh;
      $x('olSl').value = ol; $x('vol').textContent = ol ? ol + '%' : '없음'; $x('olc').value = isHex(it.olColor) ? it.olColor : '#ffffff'; $x('olc').disabled = !ol;
      $x('gradToggle').textContent = it.grad ? '그라디언트 켜짐' : '그라디언트 꺼짐'; $x('gradToggle').classList.toggle('on', !!it.grad); $x('gradToggle').setAttribute('aria-pressed', it.grad ? 'true' : 'false');
      $x('c2').value = isHex(it.color2) ? it.color2 : '#ff5a7a'; $x('c2').disabled = !it.grad;
      if (document.activeElement !== hexIn) hexIn.value = it.color;
      renderPalette();
    }
    { const p = selPhoto(); if (p) { $x('photoBlend').value = p.blend || 'normal'; $x('photoMask').value = p.mask || ''; } }
    if (it) $x('itemBlend').value = it.blend || 'normal';
    renderLayers();
  }
  const origSync = syncUI;
  syncUI = function () { const r = origSync.apply(this, arguments); try { syncExtras(); } catch (e) { console.error(e); } return r; };
  renderPalette(); renderLayers();

  /* ---------- 복사·붙여넣기: 화면 캡처·복사한 이미지(Ctrl+V)와 선택한 항목 복제 ---------- */
  let clipId = null;
  const typingNow = () => { const el = document.activeElement, tag = el ? el.tagName : '', type = el ? el.type : ''; return tag === 'TEXTAREA' || (tag === 'INPUT' && !/^(range|color|checkbox|radio|file|button)$/.test(type)); };
  document.addEventListener('copy', () => {
    if (typingNow() || state.editing || $x('dlg').classList.contains('on')) return;
    if (window.getSelection && String(window.getSelection())) return;           // 글자를 드래그해 복사하는 중이면 건드리지 않음
    const o = selItem() || selPhoto(); if (!o) return; clipId = o.id; toast('복사했습니다. Ctrl+V 로 붙여넣습니다.', 'ok');
  });
  document.addEventListener('paste', async (e) => {
    if ($x('dlg').classList.contains('on')) return;
    const dt = e.clipboardData, files = [...((dt && dt.files) || [])].filter((f) => /^image\//.test(f.type));
    if (files.length) {
      if (typingNow() && dt.getData('text/plain')) return;                        // 글자와 함께 들어온 경우는 글자 붙여넣기 우선
      e.preventDefault(); for (const f of files) await loadFile(f); return;
    }
    if (typingNow() || state.editing) return;
    const o = clipId && [...state.items, ...state.photos].find((q) => q.id === clipId);
    if (o) { e.preventDefault(); endEdit(); state.sel = o.id; duplicateSel(); }
  });
})();
