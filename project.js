/* project.js — 여러 장 카드(페이지), 자동저장(IndexedDB), 프로젝트 파일(.json) 저장·열기, 모든 카드 ZIP 저장.
   app.js 의 전역(state, RATIOS, docHist …)을 그대로 쓰는 보조 스크립트. layout.js 뒤에 로드(왼쪽 위 묶음 .ps-sidetop 에 카드 막대를 넣기 때문). */
(() => {
  'use strict';
  const $p = (id) => document.getElementById(id);
  const FORMAT = 'photo-studio-project', MAX_PAGES = 30, MAX_FILE = 300 * 1024 * 1024;

  /* ---------- 카드(페이지): 지금 보는 카드는 state 에 있고, 나머지는 pages[] 에 보관 ---------- */
  const newPage = (ratio) => ({ items: [], photos: [], bg: null, bgColor: '#ffffff', ratio: ratio || '1:1', freeH: RATIOS.free[1], adj: null, clear: 0, docHist: [], docRedo: [] });
  const capture = () => ({ items: state.items, photos: state.photos, bg: state.bg, bgColor: state.bgColor, ratio: state.ratio, freeH: RATIOS.free[1], adj: state.adj, clear: state.clear, docHist, docRedo });
  let pages = [newPage()], cur = 0, pageRev = 0;
  const stash = () => { pages[cur] = capture(); };
  function applyPage(pg) {
    endEdit(); if (tool !== 'move') setTool('move');
    revealedLock = null; presetFor = null;
    state.items = pg.items; state.photos = pg.photos; state.bg = pg.bg; state.bgColor = pg.bgColor; state.ratio = pg.ratio; RATIOS.free[1] = pg.freeH; state.adj = pg.adj; state.clear = pg.clear; state.sel = null;
    docHist = pg.docHist || []; docRedo = pg.docRedo || []; lastCk = { key: '', t: 0 };
    $p('bgPick').value = state.bgColor; renderTplButtons(); syncUI(); paint();
  }
  function gotoPage(i) {
    if (i === cur || i < 0 || i >= pages.length) return;
    stash(); cur = i; pageRev++; applyPage(pages[cur]); renderBar();
  }
  const cloneItems = (a) => JSON.parse(JSON.stringify(a));
  function clonePhoto(p) {
    const n = { ...p, canvas: cloneCanvas(p.canvas), orig: p.orig ? cloneCanvas(p.orig) : null, hist: [], base: null, bbox: undefined, ver: 0 };
    delete n.prev; delete n.prevSrc; delete n.prevKey; if (p.adj) n.adj = { ...p.adj }; return n;
  }
  function addPage(copy) {
    if (pages.length >= MAX_PAGES) { toast(`카드는 최대 ${MAX_PAGES}장까지 만들 수 있습니다.`); return; }
    stash();
    const src = pages[cur], pg = copy
      ? { ...src, items: cloneItems(src.items), photos: src.photos.map(clonePhoto), adj: src.adj ? { ...src.adj } : null, docHist: [], docRedo: [] }
      : newPage(src.ratio);
    pages.splice(cur + 1, 0, pg); cur++; pageRev++; applyPage(pages[cur]); renderBar();
    toast(copy ? `카드 ${cur + 1}번으로 복제했습니다.` : `새 카드 ${cur + 1}번을 만들었습니다. (화면비는 이전 카드와 같게 시작)`, 'ok');
  }
  function deletePage() {
    if (pages.length < 2) return;
    confirmDelete(`카드 ${cur + 1}번을 삭제할까요? 이 카드의 사진·문구가 모두 사라지며 되돌릴 수 없습니다.`, () => {
      pages.splice(cur, 1); cur = Math.min(cur, pages.length - 1); pageRev++; applyPage(pages[cur]); renderBar();
    }, '카드 삭제', '삭제');
  }

  /* ---------- 카드 막대 UI ---------- */
  const bar = document.createElement('div'); bar.className = 'ps-pages'; bar.setAttribute('role', 'group'); bar.setAttribute('aria-label', '카드');
  const sideTop = document.querySelector('.ps-sidetop') || document.querySelector('aside.side');
  const tools = sideTop && sideTop.querySelector('.ps-tools');
  if (sideTop) { if (tools) tools.insertAdjacentElement('afterend', bar); else sideTop.appendChild(bar); }
  const status = document.createElement('span'); status.className = 'ps-autosave'; status.setAttribute('role', 'status');
  function renderBar() {
    bar.replaceChildren();
    const lab = document.createElement('span'); lab.className = 'plabel'; lab.textContent = '카드'; bar.appendChild(lab);
    pages.forEach((_, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm pg' + (i === cur ? ' on' : ''); b.textContent = String(i + 1); b.title = `카드 ${i + 1}번으로 이동`; b.setAttribute('aria-label', b.title); b.setAttribute('aria-pressed', i === cur ? 'true' : 'false'); b.addEventListener('click', () => gotoPage(i)); bar.appendChild(b); });
    const mk = (txt, title, fn, dis) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.textContent = txt; b.title = title; b.disabled = !!dis; b.addEventListener('click', fn); bar.appendChild(b); };
    mk('+ 새 카드', '빈 카드를 오른쪽에 추가', () => addPage(false));
    mk('복제', '지금 카드를 그대로 복제(사진·문구 포함)', () => addPage(true));
    mk('삭제', '지금 카드 삭제', deletePage, pages.length < 2);
    bar.appendChild(status);
  }
  renderBar();

  /* ---------- 직렬화: 사진은 PNG Blob(IndexedDB) 또는 data URL(파일) ---------- */
  const blobCache = new WeakMap();                                    // 캔버스 → { ver, promise }: 바뀌지 않은 사진은 다시 인코딩하지 않음
  const canvasBlob = (c, ver) => { const e = blobCache.get(c); if (e && e.ver === ver) return e.p; const p = new Promise((r) => c.toBlob(r, 'image/png')); blobCache.set(c, { ver, p }); return p; };
  const toDataURL = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(b); });
  const bgDef = (bg) => { if (!bg) return null; const t = TEMPLATES.find((q) => q.id === bg.id); return t ? { id: t.id, name: t.name, src: t.src, y0: t.y0, y1: t.y1 } : null; };
  async function serPage(pg, asFile) {
    const enc = async (c, ver) => { const b = await canvasBlob(c, ver); return asFile ? toDataURL(b) : b; };
    const photos = [];
    for (const p of pg.photos) {
      photos.push({ id: p.id, name: p.name, blank: !!p.blank, x: p.x, y: p.y, scale: p.scale, rot: num(p.rot, 0), pclr: num(p.pclr, 0), z: p.z, locked: !!p.locked, adj: p.adj || null, png: await enc(p.canvas, p.ver || 0), orig: p.orig ? await enc(p.orig, 0) : null });
    }
    return { ratio: pg.ratio, freeH: pg.freeH, bgColor: pg.bgColor, bg: bgDef(pg.bg), adj: pg.adj || null, clear: num(pg.clear, 0), items: cloneItems(pg.items), photos };
  }
  async function toCanvas(b) {
    const blob = typeof b === 'string' ? await (await fetch(b)).blob() : b;
    const bmp = await createImageBitmap(blob), c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height; c.getContext('2d').drawImage(bmp, 0, 0); return c;
  }
  async function desPage(sp) {
    if (!sp || typeof sp !== 'object' || !Array.isArray(sp.photos) || !Array.isArray(sp.items)) throw new Error('카드 데이터 형식이 올바르지 않습니다.');
    const ratio = RATIOS[sp.ratio] ? sp.ratio : '1:1', freeH = Math.round(clampN(sp.freeH, 540, 2376, 1350));
    const photos = [];
    for (const q of sp.photos) {
      if (!q || !q.png) throw new Error('사진 데이터가 없습니다.');
      const canvas = await toCanvas(q.png), orig = q.orig ? await toCanvas(q.orig) : null;
      photos.push({ id: String(q.id || uid()), canvas, w: canvas.width, h: canvas.height, x: num(q.x, 50), y: num(q.y, 50), scale: clampN(q.scale, 10, 300, 100), rot: num(q.rot, 0), pclr: clampN(q.pclr, 0, 100, 0), z: Number.isFinite(q.z) ? q.z : undefined, locked: !!q.locked, name: typeof q.name === 'string' ? q.name.slice(0, 60) : '', blank: !!q.blank, adj: q.adj && typeof q.adj === 'object' ? { ...ADJ0, ...q.adj } : null, orig, hist: [], base: null, bbox: undefined, ver: 0 });
    }
    let bg = null;
    if (sp.bg && typeof sp.bg === 'object') { try { bg = await loadTemplate(sp.bg); } catch (e) { toast(`배경 템플릿을 불러오지 못해 배경 없이 열었습니다: ${e.message}`); } }
    return { items: cleanItems(sp.items), photos, bg, bgColor: /^#[0-9a-f]{6}$/i.test(sp.bgColor) ? sp.bgColor : '#ffffff', ratio, freeH, adj: sp.adj && typeof sp.adj === 'object' ? { ...ADJ0, ...sp.adj } : null, clear: clampN(sp.clear, 0, 100, 0), docHist: [], docRedo: [] };
  }
  async function loadAll(list, at) {
    const out = []; for (const sp of list) out.push(await desPage(sp));
    pages = out; cur = Math.min(Math.max(0, at | 0), out.length - 1); pageRev++; applyPage(pages[cur]); renderBar();
  }
  const hasContent = (pg) => pg.photos.length > 0 || pg.items.length > 0 || !!pg.bg;
  const anyWork = () => { stash(); return pages.some(hasContent); };

  /* ---------- 자동저장(IndexedDB) ---------- */
  const openDb = () => new Promise((res, rej) => { if (!window.indexedDB) return rej(new Error('IndexedDB 없음')); const r = indexedDB.open('photo-studio', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function kv(mode, fn) {
    const db = await openDb();
    return new Promise((res, rej) => { const tx = db.transaction('kv', mode), rq = fn(tx.objectStore('kv')); tx.oncomplete = () => { db.close(); res(rq && rq.result); }; tx.onerror = tx.onabort = () => { db.close(); rej(tx.error || new Error('저장 실패')); }; });
  }
  let armed = false, restoring = false, saving = false, again = false, timer = 0, lastSig = '', everSaved = false;
  const sigOf = () => {
    try { return [cur, pages.length, pageRev, JSON.stringify(state.items), state.bgColor, state.bg ? state.bg.id : '', state.ratio, RATIOS.free[1], JSON.stringify(state.adj), state.clear, state.photos.map((p) => [p.id, p.x, p.y, p.scale, p.rot, p.pclr, p.z, p.locked, p.name, p.ver || 0, p.canvas.width, JSON.stringify(p.adj)].join()).join(';')].join('|'); } catch (e) { return Math.random() + ''; }
  };
  const setStatus = (t, bad) => { status.textContent = t; status.classList.toggle('bad', !!bad); };
  const clock = () => new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  function schedule() {
    if (!armed || restoring) return;
    if (sigOf() === lastSig) return;
    window.__autosaved = false; setStatus('저장 대기 중…');
    clearTimeout(timer); timer = setTimeout(doSave, 2500);
  }
  async function doSave() {
    if (saving) { again = true; return; }
    if (restoring) return;
    saving = true; clearTimeout(timer);
    try {
      const sig = sigOf(); stash();
      if (!pages.some(hasContent)) { if (everSaved) { await kv('readwrite', (s) => s.delete('autosave')); everSaved = false; } lastSig = sig; window.__autosaved = true; setStatus(''); }
      else {
        setStatus('저장 중…');
        const ps = []; for (const pg of pages) ps.push(await serPage(pg, false));
        await kv('readwrite', (s) => s.put({ format: FORMAT, savedAt: Date.now(), cur, pages: ps }, 'autosave'));
        everSaved = true; lastSig = sig; window.__autosaved = true; setStatus('자동 저장됨 ' + clock());
      }
    } catch (e) {
      console.error(e); window.__autosaved = false;
      setStatus('자동저장 실패 — 프로젝트 파일로 저장해 주세요', true);
      if (e && /quota/i.test(String(e.name || e.message))) toast('브라우저 저장 공간이 부족해 자동저장하지 못했습니다. 저장하기 → 프로젝트 파일로 저장해 주세요.');
    } finally { saving = false; if (again) { again = false; schedule(); } }
  }
  (window.__onPaint = window.__onPaint || []).push(schedule);
  document.addEventListener('visibilitychange', () => { if (document.hidden && armed && !restoring && sigOf() !== lastSig) doSave(); });

  /* 시작할 때: 이전에 자동 저장된 작업이 있으면 복구할지 물어봄 */
  (async () => {
    let rec = null;
    try { rec = await kv('readonly', (s) => s.get('autosave')); } catch (e) { /* 저장소를 못 쓰면 자동저장 없이 동작 */ }
    const ok = rec && rec.format === FORMAT && Array.isArray(rec.pages) && rec.pages.some((p) => p && ((p.photos && p.photos.length) || (p.items && p.items.length) || p.bg));
    const arm = () => { if (armed) return; armed = true; lastSig = sigOf(); };
    if (!ok) { arm(); return; }
    const when = new Date(rec.savedAt || Date.now()).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const dlg = $p('dlg'); everSaved = true;
    const mo = new MutationObserver(() => { if (!dlg.classList.contains('on')) { mo.disconnect(); if (!restoring) arm(); } });   // 창이 닫히면(취소·Esc 포함) 자동저장 시작
    mo.observe(dlg, { attributes: true, attributeFilter: ['class'] });
    confirmDelete(`브라우저에 자동 저장된 이전 작업이 있습니다 (${when}, 카드 ${rec.pages.length}장). 이어서 작업할까요? 새로 시작하면 이전 작업은 새 작업으로 덮어써집니다.`, async () => {
      restoring = true;
      try { await loadAll(rec.pages, rec.cur); toast('이전 작업을 복구했습니다.', 'ok'); }
      catch (e) { console.error(e); toast('복구하지 못했습니다: ' + e.message, 'bad'); }
      finally { restoring = false; arm(); setStatus('복구됨 ' + clock()); }
    }, '작업 복구', '복구');
  })();

  /* ---------- 프로젝트 파일(.json) ---------- */
  async function saveProject() {
    try {
      stash(); setStatus('프로젝트 파일 만드는 중…');
      const ps = []; for (const pg of pages) ps.push(await serPage(pg, true));
      const blob = new Blob([JSON.stringify({ format: FORMAT, version: 1, savedAt: new Date().toISOString(), cur, pages: ps })], { type: 'application/json' });
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `photo-studio_프로젝트_${stamp()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      toast(`프로젝트 파일로 저장했습니다 (카드 ${pages.length}장, ${fmtBytes(blob.size)}). 저장하기 → ‘프로젝트 열기’로 이어서 작업할 수 있습니다.`, 'ok'); setStatus('');
    } catch (e) { console.error(e); toast('프로젝트 저장에 실패했습니다: ' + e.message, 'bad'); }
  }
  async function openProject(file) {
    const fail = (why) => toast(`프로젝트를 열지 못했습니다: ${why} 작업 중인 내용은 그대로입니다.`, 'bad');
    if (!file || !file.size) return fail('빈 파일입니다.');
    if (file.size > MAX_FILE) return fail('파일이 너무 큽니다(최대 300MB).');
    let data; try { data = JSON.parse(await file.text()); } catch (e) { return fail('JSON 문법이 올바르지 않습니다.'); }
    if (!data || data.format !== FORMAT || !Array.isArray(data.pages) || data.pages.length < 1 || data.pages.length > MAX_PAGES) return fail('Photo Studio 프로젝트 파일이 아닙니다.');
    const go = async () => {
      restoring = true; const backup = { pages, cur };
      try { await loadAll(data.pages, data.cur); toast(`프로젝트를 열었습니다 (카드 ${pages.length}장).`, 'ok'); }
      catch (e) { console.error(e); pages = backup.pages; cur = backup.cur; applyPage(pages[cur]); renderBar(); fail(e.message); }
      finally { restoring = false; schedule(); }
    };
    if (anyWork()) confirmDelete('지금 작업 중인 카드들을 이 프로젝트 파일의 내용으로 바꿉니다. 계속할까요? (저장하지 않은 내용은 사라집니다)', go, '프로젝트 열기', '열기'); else go();
  }
  $p('prjSave').addEventListener('click', saveProject);
  $p('prjOpen').addEventListener('click', () => $p('prjFile').click());
  $p('prjFile').addEventListener('change', (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) openProject(f); });

  /* ---------- 모든 카드 ZIP (압축 없이 묶기) ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = (u) => { let c = ~0; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (~c) >>> 0; };
  function zipStore(files) {
    const te = new TextEncoder(), d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const parts = [], cen = []; let off = 0;
    files.forEach((f) => {
      const nm = te.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true); lh.setUint16(10, tm, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, nm, f.data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      cen.push(ch.buffer, nm); off += 30 + nm.length + sz;
    });
    const csz = cen.reduce((a, b) => a + (b.byteLength ?? b.length), 0), end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csz, true); end.setUint32(16, off, true);
    return new Blob([...parts, ...cen, end.buffer], { type: 'application/zip' });
  }
  window.PSZip = zipStore;
  async function saveZip() {
    endEdit(); stash(); const k = exportOpt.k, free0 = RATIOS.free[1], files = [];
    try {
      toast(`카드 ${pages.length}장을 PNG(${k}x)로 만드는 중…`, 'ok');
      try { if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 무시 */ }
      for (let i = 0; i < pages.length; i++) {
        RATIOS.free[1] = pages[i].freeH;
        const c = buildExport(pages[i], { k }), blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        files.push({ name: `card-${String(i + 1).padStart(2, '0')}${k > 1 ? '@' + k + 'x' : ''}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
    } catch (e) { console.error(e); RATIOS.free[1] = free0; toast('ZIP 저장에 실패했습니다: ' + e.message, 'bad'); return; }
    RATIOS.free[1] = free0; paint();
    const zip = zipStore(files), url = URL.createObjectURL(zip), a = document.createElement('a'); a.href = url; a.download = `photo-studio_카드${pages.length}장_${stamp()}.zip`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    toast(`카드 ${pages.length}장을 ZIP 으로 저장했습니다 (${fmtBytes(zip.size)}).`, 'ok');
  }
  $p('saveZip').addEventListener('click', saveZip);
  window.PSProject = { get pages() { stash(); return pages; }, get cur() { return cur; }, gotoPage, addPage };
})();
