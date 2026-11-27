/* pro.js — 자동 리사이즈(화면비 바꿀 때 자동 재배치) · 모든 화면비 ZIP · PDF · SVG · PSD 내보내기 / SVG·PSD 가져오기.
   app.js 의 전역(state, RATIOS, render, buildExport, drawOrder, drawItem, SHAPES …)을 그대로 쓰는 보조 스크립트. project.js 뒤에 로드. */
(() => {
  'use strict';
  const $q = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const f2 = (n) => Math.round(n * 100) / 100;
  const download = (blob, name) => { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000); };
  const waitFonts = async () => { try { if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 무시 */ } };
  const curPages = () => { const ps = window.PSProject ? window.PSProject.pages : [capturePageLite()]; return ps; };
  const capturePageLite = () => ({ items: state.items, photos: state.photos, bg: state.bg, bgColor: state.bgColor, ratio: state.ratio, freeH: RATIOS.free[1], adj: state.adj, clear: state.clear });
  const pageH = (pg) => (pg.ratio === 'free' ? pg.freeH : RATIOS[pg.ratio][1]);

  /* ================= 자동 리사이즈 ================= */
  /* 가로는 항상 1080 이라 x·글자 크기는 그대로. 세로 위치만: 가운데 근처는 비율대로, 위·아래 가장자리 근처는 '가장자리에서의 거리(px)'를 지킴.
     y' = y·(1+k(1-2y)) (위쪽 절반), 아래쪽은 대칭. k = H0/H1 − 1. 가운데(0.5)에서는 y'=y 라 연속이고 단조 증가라 순서가 뒤집히지 않음 */
  function reflowY(y, H0, H1) {
    const yy = y / 100, k = Math.max(-0.9, Math.min(0.9, H0 / H1 - 1));
    const top = (v) => v * (1 + k * (1 - 2 * v));
    const out = yy <= 0.5 ? top(yy) : 1 - top(1 - yy);
    return Math.min(100, Math.max(0, out * 100));
  }
  function reflow(items, photos, H0, H1) {
    if (!H0 || !H1 || H0 === H1) return;
    [...items, ...photos].forEach((o) => { if (o.blank) return; o.y = f2(reflowY(num(o.y, 50), H0, H1)); });   // 빈 그림판은 틀 크기 그대로라 건드리지 않음
  }
  let autoReflow = true; try { autoReflow = localStorage.getItem('ps-reflow') !== '0'; } catch (e) { /* 무시 */ }
  const react = document.querySelector('.react');
  const rbtn = document.createElement('button'); rbtn.type = 'button'; rbtn.className = 'btn sm'; rbtn.id = 'reflowBtn';
  rbtn.title = '화면비 버튼을 누를 때 문구·도형·사진 위치를 새 화면비에 맞게 자동으로 옮깁니다 (Ctrl+Z로 되돌릴 수 있음)';
  const syncReflowBtn = () => { rbtn.textContent = '자동 재배치 ' + (autoReflow ? '켜짐' : '꺼짐'); rbtn.classList.toggle('on', autoReflow); rbtn.setAttribute('aria-pressed', autoReflow ? 'true' : 'false'); };
  rbtn.addEventListener('click', () => { autoReflow = !autoReflow; try { localStorage.setItem('ps-reflow', autoReflow ? '1' : '0'); } catch (e) { /* 무시 */ } syncReflowBtn(); });
  syncReflowBtn(); if (react) react.appendChild(rbtn);
  const origSetParam = setParam;
  setParam = function (key, raw) {
    if (key === 'ratio' && RATIOS[raw] && raw !== state.ratio) {
      const H0 = RATIOS[state.ratio][1], H1 = RATIOS[raw][1];
      checkpoint();                                                 // 화면비 변경도 한 번에 되돌릴 수 있게
      if (autoReflow && H0 !== H1 && (state.items.length || state.photos.length)) { reflow(state.items, state.photos, H0, H1); toast('화면비에 맞춰 위치를 자동으로 옮겼습니다. 되돌리려면 Ctrl+Z', 'ok'); }
    }
    return origSetParam.apply(this, arguments);
  };

  /* 다른 화면비용 사본(저장용). 원본은 건드리지 않음 */
  function copyForRatio(pg, ratio) {
    if (pg.ratio === ratio) return pg;
    const items = JSON.parse(JSON.stringify(pg.items)), photos = pg.photos.map((p) => ({ ...p }));
    if (autoReflow) reflow(items, photos, pageH(pg), RATIOS[ratio][1]);
    return { ...pg, ratio, items, photos };
  }
  async function saveAllRatios() {
    endEdit(); const pgs = curPages(), k = exportOpt.k, free0 = RATIOS.free[1], files = [], order = ['1:1', '4:5', '9:16'];
    try {
      toast(`카드 ${pgs.length}장 × 화면비 ${order.length}가지를 만드는 중…`, 'ok'); await waitFonts();
      for (const r of order) for (let i = 0; i < pgs.length; i++) {
        RATIOS.free[1] = pgs[i].freeH;
        const c = buildExport(copyForRatio(pgs[i], r), { k }), blob = await new Promise((res) => c.toBlob(res, 'image/png'));
        files.push({ name: `${r.replace(':', 'x')}/card-${String(i + 1).padStart(2, '0')}${k > 1 ? '@' + k + 'x' : ''}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
      }
    } catch (e) { console.error(e); RATIOS.free[1] = free0; toast('저장에 실패했습니다: ' + e.message, 'bad'); return; }
    RATIOS.free[1] = free0; paint();
    const zip = window.PSZip(files); download(zip, `photo-studio_모든화면비_${stamp()}.zip`);
    toast(`1:1·4:5·9:16 세 가지 화면비로 ${files.length}개 파일을 ZIP 으로 저장했습니다 (${fmtBytes(zip.size)}). 위치는 ${autoReflow ? '자동 재배치' : '그대로(비율 위치)'}했습니다.`, 'ok');
  }
  $q('saveAllRatios').addEventListener('click', saveAllRatios);

  /* ================= PDF (모든 카드, 쪽마다 JPEG) ================= */
  async function savePdf() {
    endEdit(); const pgs = curPages(), k = exportOpt.k, free0 = RATIOS.free[1], q = exportOpt.q / 100, imgs = [];
    try {
      toast(`카드 ${pgs.length}장을 PDF 로 만드는 중…`, 'ok'); await waitFonts();
      for (const pg of pgs) { RATIOS.free[1] = pg.freeH; const c = buildExport(pg, { k }), b = await new Promise((r) => c.toBlob(r, 'image/jpeg', q)); imgs.push({ w: c.width, h: c.height, data: new Uint8Array(await b.arrayBuffer()) }); }
    } catch (e) { console.error(e); RATIOS.free[1] = free0; toast('PDF 저장에 실패했습니다: ' + e.message, 'bad'); return; }
    RATIOS.free[1] = free0; paint();
    const blob = makePdf(imgs); download(blob, `photo-studio_카드${pgs.length}장_${stamp()}.pdf`);
    toast(`카드 ${pgs.length}장을 PDF 로 저장했습니다 (${fmtBytes(blob.size)}). 쪽마다 JPEG 이미지입니다.`, 'ok');
  }
  function makePdf(imgs) {
    const te = new TextEncoder(), parts = [], offs = {}; let pos = 0;
    const w = (x) => { const u = typeof x === 'string' ? te.encode(x) : x; parts.push(u); pos += u.length; };
    const n = imgs.length; w(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10, 37, 226, 227, 207, 211, 10]));   // %PDF-1.4 + 바이너리 표시
    const obj = (id, body, stream) => { offs[id] = pos; w(`${id} 0 obj\n`); if (stream) { w(body.replace('%LEN%', stream.length)); w('\nstream\n'); w(stream); w('\nendstream'); } else w(body); w('\nendobj\n'); };
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Count ${n} /Kids [${imgs.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`);
    imgs.forEach((im, i) => {
      const pw = f2(im.w * 0.75), ph = f2(im.h * 0.75), pid = 3 + i * 3, cid = pid + 1, iid = pid + 2;
      obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${iid} 0 R >> >> /Contents ${cid} 0 R >>`);
      obj(cid, '<< /Length %LEN% >>', te.encode(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`));
      obj(iid, `<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %LEN% >>`, im.data);
    });
    const xr = pos, total = 3 + n * 3; w(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let id = 1; id < total; id++) w(String(offs[id]).padStart(10, '0') + ' 00000 n \n');
    w(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xr}\n%%EOF\n`);
    return new Blob(parts, { type: 'application/pdf' });
  }
  $q('savePdf').addEventListener('click', savePdf);

  /* ================= SVG 내보내기 (문구는 글자 그대로, 도형은 벡터, 사진은 이미지로 포함) ================= */
  function shapeD(key) {                                            // SHAPES 의 캔버스 경로를 SVG path 문자열로 기록
    let d = ''; const r = (v) => Math.round(v * 10000) / 10000;
    const c = {
      rect: (x, y, w, h) => { d += `M${r(x)} ${r(y)}h${r(w)}v${r(h)}h${r(-w)}z`; },
      roundRect: (x, y, w, h, rd) => { d += `M${r(x + rd)} ${r(y)}h${r(w - 2 * rd)}a${r(rd)} ${r(rd)} 0 0 1 ${r(rd)} ${r(rd)}v${r(h - 2 * rd)}a${r(rd)} ${r(rd)} 0 0 1 ${r(-rd)} ${r(rd)}h${r(-(w - 2 * rd))}a${r(rd)} ${r(rd)} 0 0 1 ${r(-rd)} ${r(-rd)}v${r(-(h - 2 * rd))}a${r(rd)} ${r(rd)} 0 0 1 ${r(rd)} ${r(-rd)}z`; },
      arc: (cx, cy, rad) => { d += `M${r(cx - rad)} ${r(cy)}a${r(rad)} ${r(rad)} 0 1 0 ${r(2 * rad)} 0a${r(rad)} ${r(rad)} 0 1 0 ${r(-2 * rad)} 0z`; },
      moveTo: (x, y) => { d += `M${r(x)} ${r(y)}`; }, lineTo: (x, y) => { d += `L${r(x)} ${r(y)}`; },
      bezierCurveTo: (a, b, c2, d2, e, g) => { d += `C${r(a)} ${r(b)} ${r(c2)} ${r(d2)} ${r(e)} ${r(g)}`; }, closePath: () => { d += 'z'; },
    };
    SHAPES[key][1](c); return d;
  }
  const png = (c) => c.toDataURL('image/png');
  function buildSvg(st) {
    const [W0, H0] = RATIOS[st.ratio] || RATIOS['1:1'], ins = 0, W = W0, H = H0;
    const scratch = document.createElement('canvas'); scratch.width = W; scratch.height = H;
    const sctx = scratch.getContext('2d'), defs = [], body = []; let uid2 = 0;
    const sttmp = { ...st, k: 1, editing: null };                    // 테두리 없는(=저장 영역) 좌표계로 계산하려고 frame 을 뺀 캔버스 기준
    const fi = frameInset(sttmp), CW = W + 2 * fi, CH = H + 2 * fi;   // 렌더 좌표계(검정 테두리 포함) → 저장 영역으로 이동
    const tx = (x) => f2(x / 100 * CW - fi), ty = (y) => f2(y / 100 * CH - fi);
    if (st.bg) { const c = document.createElement('canvas'); c.width = W; c.height = H; drawTemplate(c.getContext('2d'), st.bg, W, H); body.push(`<image x="0" y="0" width="${W}" height="${H}" href="${png(c)}"/>`); }
    else body.push(`<rect width="${W}" height="${H}" fill="${esc(st.bgColor || '#ffffff')}"/>`);
    const curveEls = new Set();
    const fil = (a) => { const f = adjFilter(a); if (f === 'none') return ''; (f.match(/url\(#(psc_[^)]+)\)/g) || []).forEach((m) => curveEls.add(m.slice(5, -1))); return `filter:${f};`; };
    drawOrder(st).forEach(({ o, isPhoto }) => {
      const mb = o.blend && o.blend !== 'normal' ? `mix-blend-mode:${o.blend};` : '';
      if (isPhoto) {
        const p = o, k = Math.max(W / p.w, H / p.h) * num(p.scale, 100) / 100, pw = p.w * k, ph = p.h * k;
        const cxp = num(p.x, 50) / 100 * CW - fi, cyp = num(p.y, 50) / 100 * CH - fi, px = cxp - pw / 2, py = cyp - ph / 2, rot = num(p.rot, 0), id = 'm' + (++uid2);
        let clip = ''; if (p.mask && SHAPES[p.mask]) { const [mw, mh] = maskScale(p.mask, pw, ph); defs.push(`<clipPath id="${id}"><path d="${shapeD(p.mask)}" transform="translate(${f2(cxp)} ${f2(cyp)}) scale(${f2(mw)} ${f2(mh)})"/></clipPath>`); clip = ` clip-path="url(#${id})"`; }
        body.push(`<g clip-path="url(#frame)"><g${clip} transform="rotate(${rot} ${f2(cxp)} ${f2(cyp)})" style="${mb}opacity:${1 - clampN(p.pclr, 0, 100, 0) / 100};${fil(p.adj)}"><image x="${f2(px)}" y="${f2(py)}" width="${f2(pw)}" height="${f2(ph)}" href="${png(p.canvas)}" preserveAspectRatio="none"/></g></g>`);
        return;
      }
      const it = o, cx = tx(it.x), cy = ty(it.y), rot = num(it.rot, 0), sx = stretchOf(it.sx), sy = stretchOf(it.sy);
      if (it.shape) {
        const size = clampN(it.s, 2, 30, 7) / 100 * W * 3;
        body.push(`<path d="${shapeD(it.shape)}" fill="${esc(it.color || '#ff5a7a')}" opacity="${clampN(it.op, 0, 100, 100) / 100}" style="${mb}" transform="translate(${cx} ${cy}) rotate(${rot}) scale(${f2(sx * size)} ${f2(sy * size)})"/>`);
        return;
      }
      const r = drawItem(sctx, CW, CH, it, 'after'); if (r.blank) return;
      const fp = r.fontPx, lhP = clampN(it.lh, 100, 250, 130) / 100 * fp, th = r.lines.length * lhP, align = it.align === 'left' || it.align === 'right' ? it.align : 'center';
      const bgOn = !!it.bgOn && String(it.text).trim() !== '', padX = bgOn ? fp * 0.5 : 0, padY = bgOn ? fp * 0.25 : 0, wMax = (r.box.r - r.box.l) / sx - 2 * padX;
      const ax = align === 'left' ? -wMax / 2 : align === 'right' ? wMax / 2 : 0, anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
      let fill = esc(/^#[0-9a-f]{6}$/i.test(it.color) ? it.color : '#111111');
      if (it.grad) { const gid = 'g' + (++uid2); defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${f2(-th / 2)}" x2="0" y2="${f2(th / 2)}"><stop offset="0" stop-color="${fill}"/><stop offset="1" stop-color="${esc(/^#[0-9a-f]{6}$/i.test(it.color2) ? it.color2 : '#ff5a7a')}"/></linearGradient>`); fill = `url(#${gid})`; }
      const shA = clampN(it.sh, 0, 100, 0), olW = clampN(it.ol, 0, 20, 0) / 100 * fp; let fx = '';
      if (shA > 0) { const fid = 'f' + (++uid2), off = shA / 100 * fp * 0.08; defs.push(`<filter id="${fid}" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="${f2(off)}" dy="${f2(off)}" stdDeviation="${f2(shA / 100 * fp * 0.35 / 2)}" flood-color="${esc(it.shColor || '#000000')}"/></filter>`); fx = ` filter="url(#${fid})"`; }
      const deco = [it.u ? 'underline' : '', it.st ? 'line-through' : ''].join(' ').trim();
      const fam = esc((FONTS[it.font] || FONTS.gothic)[1]);
      let g = `<g transform="translate(${cx} ${cy}) rotate(${rot}) scale(${sx} ${sy})" style="${mb}" opacity="${clampN(it.op, 0, 100, 100) / 100}"${fx}>`;
      if (bgOn) g += `<rect x="${f2(-(wMax / 2 + padX))}" y="${f2(-(th / 2 + padY))}" width="${f2(wMax + 2 * padX)}" height="${f2(th + 2 * padY)}" rx="${f2(fp * 0.25)}" fill="${esc(it.bgColor || '#ffffff')}" fill-opacity="${1 - clampN(it.bgClear, 0, 100, 0) / 100}"/>`;
      r.lines.forEach((l, i) => { if (!l.trim()) return; g += `<text x="${f2(ax)}" y="${f2(-th / 2 + lhP * (i + 0.5))}" text-anchor="${anchor}" dominant-baseline="central" font-family="${fam}" font-size="${f2(fp)}" font-weight="${it.b === false ? 400 : 800}" font-style="${it.i ? 'italic' : 'normal'}" letter-spacing="${f2(clampN(it.ls, -5, 30, 0) / 100 * fp)}"${deco ? ` text-decoration="${deco}"` : ''} fill="${fill}"${olW > 0 ? ` stroke="${esc(it.olColor || '#ffffff')}" stroke-width="${f2(olW * 2)}" stroke-linejoin="round" paint-order="stroke"` : ''} xml:space="preserve">${esc(l)}</text>`; });
      body.push(g + '</g>');
    });
    curveEls.forEach((id) => { const e = document.getElementById(id); if (e) defs.push(e.outerHTML); });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">\n<defs><clipPath id="frame"><rect width="${W}" height="${H}"/></clipPath>${defs.join('')}</defs>\n${body.join('\n')}\n</svg>\n`;
  }
  async function saveSvg() {
    endEdit(); await waitFonts();
    const svg = buildSvg(state), blob = new Blob([svg], { type: 'image/svg+xml' });
    download(blob, `photo-studio_${state.ratio.replace(':', 'x')}_${stamp()}.svg`);
    toast(`SVG 로 저장했습니다 (${fmtBytes(blob.size)}). 문구·도형은 편집 가능한 벡터이고 사진은 이미지로 들어 있습니다. 전체 보정·전체 투명도는 반영되지 않습니다.`, 'ok');
  }
  $q('saveSvg').addEventListener('click', saveSvg);
  window.PSBuildSvg = buildSvg;

  /* ================= SVG 가져오기: 벡터가 아니라 사진(래스터)으로 들어옴 ================= */
  async function placeCanvas(c, name, msg) {
    endEdit(); checkpoint();
    const ph = { id: uid(), canvas: c, w: c.width, h: c.height, x: 50, y: 50, scale: 100, name, z: newPhotoZ() };
    state.photos.push(ph); state.sel = ph.id; setMsg('imgMsg', msg, 'ok'); syncUI(); paint(); return ph;
  }
  async function importSvg(file, fail) {
    if (file.size > 5 * 1024 * 1024) return fail('SVG 파일이 너무 큽니다(최대 5MB).');
    const text = await file.text(); let root;
    try { const doc = new DOMParser().parseFromString(text, 'image/svg+xml'); root = doc.documentElement; if (!root || root.nodeName.toLowerCase() !== 'svg' || doc.querySelector('parsererror')) throw 0; } catch (e) { return fail('올바른 SVG 파일이 아닙니다.'); }
    const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    let w = parseFloat(root.getAttribute('width')) || (vb.length === 4 ? vb[2] : 0), h = parseFloat(root.getAttribute('height')) || (vb.length === 4 ? vb[3] : 0);
    if (!(w > 0 && h > 0)) { w = 1000; h = 1000; }
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }));
    try {
      const im = new Image(); im.decoding = 'async'; im.src = url; await im.decode();
      const k = 1600 / Math.max(w, h), c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w * k)); c.height = Math.max(2, Math.round(h * k));
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      await placeCanvas(c, file.name, `SVG 를 사진으로 추가했습니다: ${file.name} (${c.width}×${c.height}) · 벡터가 아니라 이미지로 들어옵니다.`);
      return { ok: true, kind: 'SVG' };
    } catch (e) { return fail('SVG 를 그리지 못했습니다(외부 이미지·글꼴을 쓰는 SVG 는 열리지 않을 수 있습니다).'); }
    finally { URL.revokeObjectURL(url); }
  }

  /* ================= PSD 내보내기 (레이어별 래스터 · 혼합 모드 유지) ================= */
  const PSD_BLEND = { multiply: 'mul ', screen: 'scrn', overlay: 'over', darken: 'dark', lighten: 'lite', 'color-dodge': 'div ', 'color-burn': 'idiv', 'hard-light': 'hLit', 'soft-light': 'sLit', difference: 'diff', exclusion: 'smud', hue: 'hue ', saturation: 'sat ', color: 'colr', luminosity: 'lum ' };
  const PSD_BLEND_REV = Object.fromEntries(Object.entries(PSD_BLEND).map(([k, v]) => [v, k]));
  const layerLabel = (o, isPhoto) => (isPhoto ? (o.name || (o.blank ? '그림' : '사진')) : o.shape ? SHAPES[o.shape][0] : (String(o.text || '').replace(/\s+/g, ' ').trim().slice(0, 30) || '문구'));
  function trimmed(c) {                                              // 투명하지 않은 부분만 감싸는 영역으로 자름(파일 크기 절약). 완전히 투명하면 null
    const w = c.width, h = c.height, d = c.getContext('2d').getImageData(0, 0, w, h).data; let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, out = new Uint8Array(bw * bh * 4);
    for (let y = 0; y < bh; y++) out.set(d.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x0 + bw) * 4), y * bw * 4);
    return { l: x0, t: y0, r: x1 + 1, b: y1 + 1, w: bw, h: bh, rgba: out };
  }
  function psdBytes(W, H, layers, merged) {                          // layers: 아래→위, [{name, blend, rect:{l,t,r,b,w,h,rgba}}], merged: Uint8ClampedArray RGBA(W×H)
    const parts = []; let len = 0;
    const put = (u) => { parts.push(u); len += u.length; };
    const u8 = (n) => put(Uint8Array.of(n & 255)), u16 = (n) => put(Uint8Array.of((n >> 8) & 255, n & 255)), s16 = u16;
    const u32 = (n) => put(Uint8Array.of((n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255)), s32 = (n) => u32(n >>> 0);
    const asc = (s) => put(Uint8Array.from(s, (ch) => ch.charCodeAt(0) & 255)), pad = (n) => { if (n > 0) put(new Uint8Array(n)); };
    asc('8BPS'); u16(1); pad(6); u16(3); u32(H); u32(W); u16(8); u16(3);   // 헤더: RGB 8비트, 합성 이미지 채널 3개
    u32(0); u32(0);                                                  // 색상 모드 데이터·이미지 리소스 없음
    // --- 레이어 기록을 별도 버퍼로 모아 길이를 계산
    const rec = [], chan = []; let recLen = 0, chanLen = 0;
    layers.forEach((L) => {
      const r = L.rect, n = r.w * r.h, nm = Array.from(L.name), asciiName = ('Layer ' + (rec.length + 1)), pas = Uint8Array.from([asciiName.length, ...Array.from(asciiName, (c) => c.charCodeAt(0))]);
      const padLen = (4 - (pas.length % 4)) % 4, uni = new Uint8Array(4 + nm.length * 2), uv = new DataView(uni.buffer); uv.setUint32(0, nm.length); nm.forEach((c, i) => uv.setUint16(4 + i * 2, c.charCodeAt(0)));
      const unipad = uni.length % 2, blockLen = 12 + uni.length + unipad, extra = 4 + 4 + pas.length + padLen + blockLen;
      const b = new Uint8Array(4 * 4 + 2 + 4 * 6 + 12 + 4 + extra), v = new DataView(b.buffer); let o = 0;
      [r.t, r.l, r.b, r.r].forEach((x) => { v.setInt32(o, x); o += 4; }); v.setUint16(o, 4); o += 2;
      [0, 1, 2, -1].forEach((id) => { v.setInt16(o, id); v.setUint32(o + 2, n + 2); o += 6; });
      b.set([56, 66, 73, 77], o); o += 4; b.set(Array.from(L.blend && PSD_BLEND[L.blend] || 'norm', (c) => c.charCodeAt(0)), o); o += 4; b[o++] = 255; b[o++] = 0; b[o++] = 0; b[o++] = 0;   // 8BIM, 혼합키, 불투명도 255, 클리핑 없음, 보임
      v.setUint32(o, extra); o += 4; v.setUint32(o, 0); o += 4; v.setUint32(o, 0); o += 4;           // 마스크 없음, 혼합 범위 없음
      b.set(pas, o); o += pas.length + padLen;
      b.set([56, 66, 73, 77, 108, 117, 110, 105], o); o += 8; v.setUint32(o, uni.length + unipad); o += 4; b.set(uni, o);   // 8BIM luni(유니코드 이름)
      rec.push(b); recLen += b.length;
      // 채널 데이터(R,G,B,A 순서로 raw)
      const cd = new Uint8Array(4 * (2 + n)); for (let c = 0; c < 4; c++) { const base = c * (2 + n); cd[base] = 0; cd[base + 1] = 0; const src = c === 3 ? 3 : c; for (let i = 0; i < n; i++) cd[base + 2 + i] = r.rgba[i * 4 + src]; }
      chan.push(cd); chanLen += cd.length;
    });
    const layerInfoLen0 = 2 + recLen + chanLen, layerInfoLen = layerInfoLen0 + (layerInfoLen0 % 2);
    u32(4 + layerInfoLen + 4);                                       // 레이어·마스크 정보 전체 길이
    u32(layerInfoLen); s16(layers.length);
    rec.forEach((b) => put(b)); chan.forEach((b) => put(b)); pad(layerInfoLen - layerInfoLen0);
    u32(0);                                                          // 전역 마스크 정보 없음
    u16(0);                                                          // 합성 이미지: 압축 없음(raw), 채널별(planar) R·G·B
    for (let c = 0; c < 3; c++) { const pl = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) pl[i] = merged[i * 4 + c]; put(pl); }
    const out = new Uint8Array(len); let p = 0; parts.forEach((u) => { out.set(u, p); p += u.length; }); return out;
  }
  async function savePsd() {
    endEdit(); await waitFonts(); paint();
    const k = 1, st = { ...state }, [W, H] = (RATIOS[st.ratio] || RATIOS['1:1']), layers = [];
    const bgc = buildExport({ ...st, photos: [], items: [], adj: null, clear: 0 }, { k });
    layers.push({ name: '배경', rect: { l: 0, t: 0, r: W, b: H, w: W, h: H, rgba: new Uint8Array(bgc.getContext('2d').getImageData(0, 0, W, H).data.buffer) } });
    let skipped = 0;
    drawOrder(st).forEach(({ o, isPhoto }) => {
      const obj = { ...o, blend: undefined }, c = buildExport({ ...st, bg: null, adj: null, clear: 0, photos: isPhoto ? [obj] : [], items: isPhoto ? [] : [obj] }, { k, transparent: true });
      const t = trimmed(c); if (!t) { skipped++; return; }
      layers.push({ name: layerLabel(o, isPhoto), blend: o.blend, rect: t });
    });
    const mc = buildExport(st, { k }), merged = mc.getContext('2d').getImageData(0, 0, W, H).data;
    const bytes = psdBytes(W, H, layers, merged), blob = new Blob([bytes], { type: 'image/vnd.adobe.photoshop' });
    download(blob, `photo-studio_${st.ratio.replace(':', 'x')}_${stamp()}.psd`);
    toast(`PSD 로 저장했습니다 (레이어 ${layers.length}개, ${fmtBytes(blob.size)}). 문구는 편집 불가능한 이미지 레이어이고 혼합 모드는 유지됩니다.${skipped ? ` (비어 있는 ${skipped}개 제외)` : ''}`, 'ok');
  }
  $q('savePsd').addEventListener('click', savePsd);

  /* ================= PSD 가져오기 (8비트 RGB · 레이어를 사진으로) ================= */
  function unpackBits(src, off, n, outLen) {                         // PackBits(RLE) 한 줄 풀기
    const out = new Uint8Array(outLen); let i = off, o = 0; const end = off + n;
    while (i < end && o < outLen) { let c = src[i++]; if (c > 127) c -= 256; if (c >= 0) { for (let j = 0; j <= c && o < outLen; j++) out[o++] = src[i++]; } else if (c !== -128) { const v = src[i++]; for (let j = 0; j < 1 - c && o < outLen; j++) out[o++] = v; } }
    return out;
  }
  function readChannel(u, v, p, w, h, len, depth) {                  // 채널 하나(압축 방식 포함)를 풀어 w×h 바이트 배열로. 반환 {data, end}
    const comp = v.getUint16(p); let q = p + 2;
    if (comp === 0) { const data = u.subarray(q, q + w * h); return { data, end: p + len }; }
    if (comp === 1) {
      const counts = []; for (let y = 0; y < h; y++) { counts.push(v.getUint16(q)); q += 2; }
      const data = new Uint8Array(w * h); for (let y = 0; y < h; y++) { data.set(unpackBits(u, q, counts[y], w), y * w); q += counts[y]; }
      return { data, end: p + len };
    }
    throw new Error('지원하지 않는 압축 방식입니다(ZIP 압축 PSD).');
  }
  async function parsePsd(buf) {
    const u = new Uint8Array(buf), v = new DataView(buf);
    if (u.length < 30 || String.fromCharCode(u[0], u[1], u[2], u[3]) !== '8BPS') throw new Error('PSD 파일이 아닙니다.');
    if (v.getUint16(4) !== 1) throw new Error('PSB(대용량 PSD)는 지원하지 않습니다.');
    const nch = v.getUint16(12), H = v.getUint32(14), W = v.getUint32(18), depth = v.getUint16(22), mode = v.getUint16(24);
    if (depth !== 8) throw new Error(`${depth}비트 PSD 는 지원하지 않습니다(8비트만).`);
    if (mode !== 3) throw new Error('RGB 색상 모드 PSD 만 지원합니다(CMYK·그레이스케일 등은 불가).');
    if (W * H > 40e6) throw new Error('PSD 가 너무 큽니다.');
    let p = 26; p += 4 + v.getUint32(p); p += 4 + v.getUint32(p);       // 색상 모드 데이터·이미지 리소스 건너뜀
    const miLen = v.getUint32(p); p += 4; const miEnd = p + miLen, layers = [];
    if (miLen > 0) {
      const liLen = v.getUint32(p); p += 4; const liEnd = p + liLen;
      if (liLen > 0) {
        let count = v.getInt16(p); p += 2; count = Math.abs(count); const recs = [];
        for (let i = 0; i < count; i++) {
          const t = v.getInt32(p), l = v.getInt32(p + 4), b = v.getInt32(p + 8), r = v.getInt32(p + 12); p += 16;
          const nc = v.getUint16(p); p += 2; const ch = []; for (let c = 0; c < nc; c++) { ch.push({ id: v.getInt16(p), len: v.getUint32(p + 2) }); p += 6; }
          p += 4; const blend = String.fromCharCode(u[p], u[p + 1], u[p + 2], u[p + 3]); p += 4; const opacity = u[p], flags = u[p + 2]; p += 4;
          const exLen = v.getUint32(p); p += 4; const exEnd = p + exLen;
          const ml = v.getUint32(p); p += 4 + ml; const bl = v.getUint32(p); p += 4 + bl;
          const nl = u[p]; let name = new TextDecoder('latin1').decode(u.subarray(p + 1, p + 1 + nl)); p += 1 + nl; p += (4 - ((1 + nl) % 4)) % 4;
          let divider = 0;
          while (p + 12 <= exEnd) {                                  // 추가 정보 블록: 유니코드 이름(luni), 그룹 표시(lsct)
            const key = String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]), bl2 = v.getUint32(p + 8), dp = p + 12;
            if (key === 'luni') { const n = v.getUint32(dp); let s = ''; for (let c = 0; c < n; c++) s += String.fromCharCode(v.getUint16(dp + 4 + c * 2)); name = s; }
            if (key === 'lsct') divider = v.getUint32(dp);
            p = dp + bl2 + (bl2 % 2);
          }
          p = exEnd; recs.push({ t, l, b, r, ch, blend, opacity, hidden: !!(flags & 2), name, divider });
        }
        for (const R of recs) {                                      // 채널 이미지 데이터
          const w = Math.max(0, R.r - R.l), h = Math.max(0, R.b - R.t), planes = {};
          for (const c of R.ch) {
            const start = p; if (c.len <= 2 || w * h === 0) { p = start + c.len; continue; }
            if (c.id < -1) { p = start + c.len; continue; }          // 레이어 마스크 채널은 건너뜀
            const rd = readChannel(u, v, start, w, h, c.len, depth); planes[c.id] = rd.data; p = start + c.len;
          }
          R.w = w; R.h = h; R.planes = planes; layers.push(R);
        }
      }
    }
    p = miEnd;
    let merged = null;                                               // 합성 이미지(레이어가 없거나 못 읽을 때 대비)
    try {
      const comp = v.getUint16(p); p += 2; const planes = [];
      if (comp === 0) { for (let c = 0; c < Math.min(nch, 4); c++) { planes.push(u.subarray(p + c * W * H, p + (c + 1) * W * H)); } }
      else if (comp === 1) { const counts = []; for (let i = 0; i < nch * H; i++) { counts.push(v.getUint16(p)); p += 2; } let ci = 0; for (let c = 0; c < nch; c++) { const pl = new Uint8Array(W * H); for (let y = 0; y < H; y++) { pl.set(unpackBits(u, p, counts[ci], W), y * W); p += counts[ci++]; } if (c < 4) planes.push(pl); } }
      if (planes.length >= 3) merged = planes;
    } catch (e) { merged = null; }
    return { W, H, layers, merged };
  }
  const planesToCanvas = (planes, w, h, a) => {                      // planes: {0:R,1:G,2:B,-1:A} 또는 [R,G,B,(A)]
    const c = document.createElement('canvas'); c.width = w; c.height = h; const img = c.getContext('2d').createImageData(w, h), d = img.data, g = (i) => (Array.isArray(planes) ? planes[i] : planes[i]);
    const R = g(0), G = g(1), B = g(2), A = Array.isArray(planes) ? planes[3] : planes[-1];
    for (let i = 0; i < w * h; i++) { d[i * 4] = R ? R[i] : 0; d[i * 4 + 1] = G ? G[i] : 0; d[i * 4 + 2] = B ? B[i] : 0; d[i * 4 + 3] = A ? A[i] : 255; }
    c.getContext('2d').putImageData(img, 0, 0); return c;
  };
  async function importPsd(file, fail) {
    if (file.size > 200 * 1024 * 1024) return fail('PSD 파일이 너무 큽니다(최대 200MB).');
    let doc; try { doc = await parsePsd(await file.arrayBuffer()); } catch (e) { return fail(e.message || 'PSD 를 읽지 못했습니다.'); }
    const empty = !state.photos.length && !state.items.length && !state.bg;
    endEdit(); checkpoint();
    if (empty) {                                                     // 빈 카드면 PSD 의 가로세로 비율에 화면비를 맞춤
      const a = doc.H / doc.W, hit = [['1:1', 1], ['4:5', 1.25], ['9:16', 1920 / 1080]].find(([, v]) => Math.abs(a - v) < 0.01);
      if (hit) state.ratio = hit[0]; else { RATIOS.free[1] = Math.round(1080 * Math.min(FREE_MAX, Math.max(FREE_MIN, a))); state.ratio = 'free'; freeW = cv.clientWidth || 0; }
    }
    const [CW, CH] = canvasDims(state), ins = frameInset(state), iw = CW - 2 * ins, ih = CH - 2 * ins, K = iw / doc.W;
    const made = []; let skipped = 0;
    const usable = doc.layers.filter((L) => L.w > 0 && L.h > 0 && !L.divider && Object.keys(L.planes).length);
    const add = (canvas, name, L) => {
      let c = canvas, cover = Math.max(iw / c.width, ih / c.height), scale = 100 * K / cover, f = 1;
      if (scale < 10) { f = Math.min(Math.ceil(10 / scale), Math.floor(6000 / Math.max(c.width, c.height)) || 1); if (f > 1) { const u2 = document.createElement('canvas'); u2.width = c.width * f; u2.height = c.height * f; u2.getContext('2d').drawImage(c, 0, 0, u2.width, u2.height); c = u2; cover = Math.max(iw / c.width, ih / c.height); scale = 100 * K / cover; } }
      const cx = L ? (L.l + L.r) / 2 : doc.W / 2, cy = L ? (L.t + L.b) / 2 : doc.H / 2;
      const ph = { id: uid(), canvas: c, w: c.width, h: c.height, x: (ins + cx * K) / CW * 100, y: (ins + cy * K) / CH * 100, scale: Math.min(300, Math.max(10, scale)), name: String(name).slice(0, 40), blank: false };
      if (L) { const bk = PSD_BLEND_REV[L.blend]; if (bk) ph.blend = bk; if (L.opacity < 255) ph.pclr = Math.round(100 - L.opacity / 255 * 100); }
      state.photos.push(ph); made.push(ph);
    };
    if (usable.length) usable.forEach((L) => { if (L.hidden) { skipped++; return; } add(planesToCanvas(L.planes, L.w, L.h), L.name, L); });
    else if (doc.merged) add(planesToCanvas(doc.merged, doc.W, doc.H), file.name.replace(/\.psd$/i, ''), null);
    else return fail('읽을 수 있는 레이어나 합성 이미지가 없습니다.');
    state.sel = made.length ? made[made.length - 1].id : null; syncUI(); paint();
    setMsg('imgMsg', `PSD 를 가져왔습니다: 레이어 ${made.length}개${skipped ? `(숨김 ${skipped}개 제외)` : ''} · 문구·스마트 오브젝트·조정 레이어·효과는 이미지로 들어오며 편집할 수 없습니다.`, 'ok');
    return { ok: true, kind: 'PSD' };
  }
  window.PSImport = { psd: importPsd, svg: importSvg, parsePsd };
  window.PSExport = { psdBytes, buildSvg, makePdf, reflow, reflowY };
})();
