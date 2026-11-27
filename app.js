'use strict';
/* 짤 카드 스튜디오 — 조건1 불러오기·문구 편집 / 조건2 화면비·내보내기 일치 / 조건3 12건 검사 / 조건4 템플릿 CRUD */

const $ = (id) => document.getElementById(id);
const RATIOS = { '1:1': [1080, 1080], '4:5': [1080, 1350], '9:16': [1080, 1920], free: [1080, 1350] };   // free(자유형): 높이를 테두리 끌기로 바꿈
const FREE_MIN = 0.5, FREE_MAX = 2.2;                                                                   // 자유형 세로/가로 비율 범위
const MARGIN = 0.04;            // 안전 여백(가장자리 4%)
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_TEXT = 300;
const FONT = "'Pretendard','Noto Sans KR','Malgun Gothic','Apple SD Gothic Neo',sans-serif";
const DEFAULTS = { items: [], ratio: '1:1' };
/* 글꼴 목록: [이름, CSS 글꼴 목록, 웹폰트 이름(있으면)]. 웹폰트는 index.html 의 Google Fonts 링크로 내려받아 PC마다 같은 모양으로 보이게 함
 * (인터넷이 막혀 있으면 설치된 글꼴로 대체됨) */
const FONTS = {
  gothic: ['고딕', FONT, 'Noto Sans KR'],
  myeongjo: ['명조', "'Noto Serif KR','Batang','Nanum Myeongjo','AppleMyungjo','Times New Roman',serif", 'Noto Serif KR'],
  round: ['둥근', "'Jua','Gulim','Nanum Gothic','Arial Rounded MT Bold','Apple SD Gothic Neo',sans-serif", 'Jua'],
  hand: ['손글씨', "'Nanum Pen Script','Segoe Script','Comic Sans MS','Apple SD Gothic Neo',cursive", 'Nanum Pen Script'],
  mono: ['타자기', "'D2Coding','Consolas','Courier New',monospace"],
  black: ['굵은 제목', "'Black Han Sans','Noto Sans KR','Malgun Gothic',sans-serif", 'Black Han Sans'],
  dohyeon: ['도현체', "'Do Hyeon','Noto Sans KR','Malgun Gothic',sans-serif", 'Do Hyeon'],
  gaegu: ['귀여운 손글씨', "'Gaegu','Nanum Pen Script','Comic Sans MS',cursive", 'Gaegu'],
  gowun: ['고운 돋움', "'Gowun Dodum','Noto Sans KR','Malgun Gothic',sans-serif", 'Gowun Dodum'],
  brush: ['붓글씨', "'Nanum Brush Script','Nanum Pen Script','Segoe Script',cursive", 'Nanum Brush Script'],
};
const fontReady = {};   // 웹폰트 이름 → true(받음) / 'loading' / 'fail'
function needFont(key, text) {   // 아직 받지 않은 웹폰트를 내려받고, 다 받으면 다시 그림(받는 동안은 대체 글꼴로 보임)
  const f = FONTS[key], name = f && f[2];
  if (!name || fontReady[name] || !document.fonts || !document.fonts.load) return;
  fontReady[name] = 'loading';
  Promise.all([document.fonts.load(`800 40px "${name}"`, text || '가'), document.fonts.load(`400 40px "${name}"`, text || '가')])
    .then(() => { fontReady[name] = true; draw(); }).catch(() => { fontReady[name] = 'fail'; });
}
const ITEM = { text: '', x: 50, y: 50, s: 7, color: '#111111', rot: 0, font: 'gothic', bgOn: false, bgColor: '#ffffff', bgClear: 0, sx: 1, sy: 1, op: 100, b: true, i: false, u: false, st: false, align: 'center', ls: 0, lh: 130, sh: 0, shColor: '#000000', ol: 0, olColor: '#ffffff', grad: false, color2: '#ff5a7a' };   // sh 그림자 세기(0=없음), ol 외곽선 굵기(글자 크기의 %), grad 두 색 그라디언트(color → color2, 위→아래)   // op 글자 불투명도, b/i/u/st 굵게·기울임·밑줄·취소선, ls 글자 간격(글자 크기의 %), lh 줄 간격(%)   // bgClear: 배경 투명도 0(불투명)~100(완전 투명)   // rot: 기울기(도, 시계 방향)

/* ---------- 상태: 문구는 items 배열(처음엔 비어 있음) ---------- */
const state = { ...DEFAULTS, photos: [], bg: null, bgColor: '#ffffff', adj: null, clear: 0, sel: null, editing: null };   // adj: 미리보기 전체에 거는 보정(사진을 하나도 선택하지 않았을 때의 '사진 보정'). null = 보정 없음   // photos: [{id, canvas, w, h, x, y, scale}]
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const cleanItems = (v) => (Array.isArray(v) ? v.filter((i) => i && typeof i.text === 'string').map((i) => ({ ...ITEM, ...i, id: i.id || uid() })) : []);
try { localStorage.removeItem('zzal.draft'); } catch (e) { /* 이전 버전 초안 정리 */ }

const save = () => {};   // 새로고침하면 사진·문구·화면비는 초기화됨 (템플릿만 저장소에 유지)
const params = (st) => ({ items: JSON.parse(JSON.stringify(st.items)), ratio: st.ratio });
const selItem = () => state.items.find((i) => i.id === state.sel) || null;
const selPhoto = () => state.photos.find((p) => p.id === state.sel) || null;

/* ---------- 렌더 엔진 (미리보기와 저장이 같은 함수를 씁니다) ---------- */
function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    if (para === '') { out.push(''); continue; }
    let cur = '';
    for (const ch of Array.from(para)) {
      const t = cur + ch;
      if (cur && ctx.measureText(t).width > maxW) {
        const sp = cur.lastIndexOf(' ');
        if (sp > 0 && ch !== ' ') { out.push(cur.slice(0, sp)); cur = cur.slice(sp + 1) + ch; }
        else { out.push(cur); cur = ch === ' ' ? '' : ch; }
      } else cur = t;
    }
    out.push(cur);
  }
  return out;
}
const num = (v, d) => (Number.isFinite(v) ? v : d);
/** 템플릿을 화면비에 맞춰 유동적으로 배치: 위·아래 장식은 폭에 맞춰 그대로 두고, 가운데 띠만 늘이거나 줄임.
 *  너무 많이 찌그러져야 하면(q<0.5) 비율을 지킨 채 전체를 줄여 가운데에 놓음. */
function drawTemplate(ctx, bg, W, H) {
  const { canvas: c, w, h, y0, y1 } = bg;
  const k = W / w, hn = h * k, top = y0 * hn, bot = (1 - y1) * hn, mid = hn - top - bot;
  const q = (H - top - bot) / mid;                            // 가운데 띠의 세로 배율
  if (q >= 0.5) {
    const s0 = y0 * h, s1 = y1 * h;
    ctx.drawImage(c, 0, 0, w, s0, 0, 0, W, top);
    ctx.drawImage(c, 0, s0, w, s1 - s0, 0, top, W, H - top - bot);
    ctx.drawImage(c, 0, s1, w, h - s1, 0, H - bot, W, bot);
  } else {
    const k2 = H / h, dw = w * k2;
    ctx.drawImage(c, (W - dw) / 2, 0, dw, H);
  }
}
const frameInset =(st) => (st.bg ? 0 : Math.round((RATIOS[st.ratio] || RATIOS['1:1'])[0] * (st.k || 1) * 0.006));   // 검정 테두리 두께 (st.k: 내보내기 배율, 미리보기는 1)
const canvasDims = (st) => { const [w, h] = (RATIOS[st.ratio] || RATIOS['1:1']).map((v) => Math.round(v * (st.k || 1))), i = frameInset(st); return [w + 2 * i, h + 2 * i]; };   // 캔버스 = 출력 크기 + 검정 테두리 양쪽(저장하면 테두리를 잘라 정확히 1080 폭)

/* ---------- 사진 보정 (밝기·대비·채도·따뜻함·흐림, 미리보기/내보내기 공통) ---------- */
const ADJ0 = { br: 100, ct: 100, sa: 100, wm: 0, bl: 0, hu: 0, cs: 0, cm: 0, ch: 0 };   // hu 색조 회전(°), cs/cm/ch 곡선(어두운 영역·중간톤·밝은 영역, -100~100)
/* 곡선: CSS filter 로는 안 되는 톤 곡선을 보이지 않는 SVG <filter>(feComponentTransfer table) 로 만들어 ctx.filter = url(#id) 로 씀 */
const curveIds = {};
function curveFilterId(cs, cm, ch) {
  const key = [cs, cm, ch].join('_'); if (curveIds[key]) return curveIds[key];
  const NS = 'http://www.w3.org/2000/svg', id = 'psc_' + key.replace(/-/g, 'm');
  let host = document.getElementById('psDefs');
  if (!host) { const sv = document.createElementNS(NS, 'svg'); sv.setAttribute('width', '0'); sv.setAttribute('height', '0'); sv.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none'; sv.setAttribute('aria-hidden', 'true'); host = document.createElementNS(NS, 'defs'); host.id = 'psDefs'; sv.appendChild(host); document.body.appendChild(sv); }
  const bump = (x, c) => { const t = Math.max(0, 1 - Math.abs(x - c) / 0.3); return t * t * (3 - 2 * t); };
  const vals = []; for (let i = 0; i <= 16; i++) { const x = i / 16, y = x + (cs * bump(x, 0.22) + cm * bump(x, 0.5) + ch * bump(x, 0.78)) / 100 * 0.16; vals.push(Math.min(1, Math.max(0, y)).toFixed(4)); }
  const f = document.createElementNS(NS, 'filter'); f.id = id; f.setAttribute('color-interpolation-filters', 'sRGB'); f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', '100%'); f.setAttribute('height', '100%');
  const t = document.createElementNS(NS, 'feComponentTransfer');
  ['R', 'G', 'B'].forEach((c) => { const fn = document.createElementNS(NS, 'feFunc' + c); fn.setAttribute('type', 'table'); fn.setAttribute('tableValues', vals.join(' ')); t.appendChild(fn); });
  f.appendChild(t); host.appendChild(f); return (curveIds[key] = id);
}
const PRESETS = [
  ['원본', {}], ['선명', { ct: 118, sa: 125 }], ['따뜻', { wm: 55, br: 104 }], ['차가움', { wm: -60, sa: 95 }],
  ['흑백', { sa: 0, ct: 110 }], ['빈티지', { wm: 70, sa: 80, ct: 92, br: 105 }], ['몽글', { bl: 3, br: 108, sa: 110 }],
];
function adjFilter(a, k = 1) {   // k: 내보내기 배율(2x 로 저장할 때 흐림 픽셀도 같이 커짐)
  if (!a) return 'none';
  const v = { ...ADJ0, ...a }, f = [];
  if (v.br !== 100) f.push(`brightness(${v.br}%)`);
  if (v.ct !== 100) f.push(`contrast(${v.ct}%)`);
  if (v.sa !== 100) f.push(`saturate(${v.sa}%)`);
  if (v.cs || v.cm || v.ch) f.push(`url(#${curveFilterId(Math.round(v.cs), Math.round(v.cm), Math.round(v.ch))})`);   // 곡선
  if (v.hu) f.push(`hue-rotate(${v.hu}deg)`);                // 색조
  if (v.wm > 0) f.push(`sepia(${v.wm * 0.6}%)`);
  if (v.wm < 0) f.push(`hue-rotate(${v.wm * 0.25}deg)`);
  if (v.bl > 0) f.push(`blur(${v.bl * 0.8 * k}px)`);       // 출력 캔버스 픽셀 기준(배율 k 를 곱해 미리보기=내보내기)
  return f.length ? f.join(' ') : 'none';
}

/** engine 'after' = 현재 엔진, 'before' = 줄바꿈·보정이 없는 기준 엔진(검사 비교용) */
/* 미리보기 가속: 끌기·크기 조절 중에만, 지금 화면에 그려질 크기로 미리 줄이고 보정 필터까지 입혀 둔 사본을 그림.
 * (원본 12MP+ 사진을 매 프레임 줄이고 필터까지 걸면 끊김) 손을 떼면 항상 원본으로 다시 그리므로
 * 최종 미리보기·내보내기는 원본 그대로 → 미리보기=파일 검사 유지 */
const PREV_MAX_W = 3072;
function previewOf(p, pw) {
  const f = adjFilter(p.adj), cw = Math.min(p.w, PREV_MAX_W, Math.ceil(pw / 256) * 256);
  if (f === 'none' && cw >= p.w) return null;                  // 줄일 필요도 필터도 없으면 원본 그대로
  const key = f + '|' + cw;
  if (!p.prev || p.prevSrc !== p.canvas || p.prevKey !== key) {
    const c = document.createElement('canvas'); c.width = cw; c.height = Math.max(1, Math.round(p.h * cw / p.w));
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.filter = f; x.drawImage(p.canvas, 0, 0, c.width, c.height);
    p.prev = c; p.prevSrc = p.canvas; p.prevKey = key;
  }
  return p.prev;
}
const dropPrev = (p) => { if (p) { p.prev = null; p.ver = (p.ver || 0) + 1; } };    // 사진 픽셀이 제자리에서 바뀌면(붓·터치 보정) 사본을 버림. ver: 자동저장이 바뀐 사진만 다시 저장하려고 올리는 번호
let interacting = false;                               // 끌기·크기 조절 중 여부
function drawOrder(st) {                                            // 그리는 순서(아래→위). z가 없으면 사진은 아래, 문구·도형은 위 (z는 앞으로·뒤로 버튼으로 정해짐)
  const list = [];
  (st.photos || []).forEach((o, i) => list.push({ o, isPhoto: true, i, r: Number.isFinite(o.z) ? o.z : -1e6 + i }));
  (st.items || []).forEach((o, i) => list.push({ o, isPhoto: false, i, r: Number.isFinite(o.z) ? o.z : 1e6 + i }));
  return list.sort((a, b) => a.r - b.r || (a.isPhoto === b.isPhoto ? a.i - b.i : a.isPhoto ? -1 : 1));
}
const newPhotoZ = () => {                                           // 새 사진의 z: 순서를 한 번이라도 바꿨다면 맨 위 사진 바로 위(문구가 그 위에 있으면 문구 아래)에 둠
  const all = [...state.photos, ...state.items].filter((o) => Number.isFinite(o.z)).map((o) => o.z); if (!all.length) return undefined;
  const pz = state.photos.filter((o) => Number.isFinite(o.z)).map((o) => o.z);
  return pz.length ? Math.max(...pz) + 0.5 : Math.min(...all) - 1;
};
/* 블렌드 모드(포토샵의 레이어 혼합 모드): globalCompositeOperation 값 */
const BLENDS = [['normal', '일반'], ['multiply', '곱하기'], ['screen', '스크린'], ['overlay', '오버레이'], ['darken', '어둡게'], ['lighten', '밝게'], ['color-dodge', '색상 닷지'], ['color-burn', '색상 번'], ['hard-light', '하드 라이트'], ['soft-light', '소프트 라이트'], ['difference', '차이'], ['exclusion', '제외'], ['hue', '색조'], ['saturation', '채도'], ['color', '색상'], ['luminosity', '광도']];
const blendOp = (b) => (b && b !== 'normal' && BLENDS.some((x) => x[0] === b) ? b : 'source-over');
/* 사진을 모양으로 자르기(마스크): 사진 상자 안에서 SHAPES 경로로 잘라 보임. 원·하트·별 등은 짧은 변 기준 정비례, 사각형류는 상자 전체 */
const MASKS = [['', '없음'], ['circle', '원'], ['round', '둥근 사각형'], ['heart', '하트'], ['star', '별'], ['triangle', '삼각형'], ['bubble', '말풍선']];
const maskScale = (m, pw, ph) => (m === 'round' || m === 'rect' ? [pw, ph] : [Math.min(pw, ph), Math.min(pw, ph)]);
const gTmp = document.createElement('canvas');                      // 전체 보정용 임시 캔버스(렌더 때마다 새로 만들지 않음)
function render(canvas, st, engine = 'after', fast = false) {
  const [W, H] = canvasDims(st);
  if (canvas.width !== W) canvas.width = W; if (canvas.height !== H) canvas.height = H;   // 크기가 같으면 다시 만들지 않음(fillRect로 전체를 덮음)
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (st.transparent && !st.bg) ctx.clearRect(0, 0, W, H); else { ctx.fillStyle = st.bgColor || '#fff'; ctx.fillRect(0, 0, W, H); }          // 투명 PNG 저장이면 배경색을 칠하지 않음. 기본 배경: 흰색 + 검정 테두리 (투명 PNG도 불투명하게 합성)
  if (st.bg) {
    drawTemplate(ctx, st.bg, W, H);
  }
  const inset = frameInset(st), res = { W, H, lines: [], blank: true, boxes: [] };
  const order = drawOrder(st), lastPhoto = order.reduce((a, e, i) => (e.isPhoto ? i : a), -1);
  const useG = !!st.adj && adjFilter(st.adj) !== 'none';           // 미리보기 전체 보정이 켜져 있는지
  const useOp = num(st.clear, 0) > 0, useP = useG || useOp;         // 미리보기 전체 투명도(state.clear)가 있는지
  const drawFrame = () => { if (!st.bg) { ctx.strokeStyle = '#111'; ctx.lineWidth = inset; ctx.strokeRect(inset / 2, inset / 2, W - inset, H - inset); } };   // 미리보기용 테두리(저장 시 제외)
  const frame = () => { if (!useP) drawFrame(); };                  // 전체 보정 중에는 테두리를 보정이 끝난 뒤에 그림(흐림 효과가 검정 테두리를 안쪽으로 번지게 하지 않으려고)
  if (lastPhoto < 0) frame();
  order.forEach(({ o, isPhoto }, idx) => {                      // 아래 → 위 순서로 그림 (사진이 문구 위로 올 수도 있음)
    if (isPhoto) {
      const p = o;
      ctx.save(); ctx.beginPath(); ctx.rect(inset, inset, W - 2 * inset, H - 2 * inset); ctx.clip();   // 검정 테두리 안쪽만 사진이 보임
      const k = Math.max((W - 2 * inset) / p.w, (H - 2 * inset) / p.h) * (num(p.scale, 100) / 100), pw = p.w * k * num(p.dsx, 1), ph = p.h * k * num(p.dsy, 1);   // dsx·dsy: 변 점을 끄는 동안만 쓰는 임시 늘이기 배율. 사진은 기본으로 틀 안을 가득 채움(100% = 꽉 채우기)
      const px = num(p.x, 50) / 100 * W - pw / 2, py = num(p.y, 50) / 100 * H - ph / 2;
      const pv = fast ? previewOf(p, pw) : null, rot = num(p.rot, 0);
      if (rot) { ctx.save(); ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate(rot * Math.PI / 180); ctx.translate(-(px + pw / 2), -(py + ph / 2)); }   // 사진 가운데를 기준으로 기울임
      ctx.globalAlpha = 1 - clampN(p.pclr, 0, 100, 0) / 100;       // 사진 투명도(0% = 그대로, 100% = 완전 투명)
      ctx.globalCompositeOperation = blendOp(p.blend);                 // 혼합 모드(곱하기·스크린 …)
      if (p.mask && SHAPES[p.mask]) { const [mw, mh] = maskScale(p.mask, pw, ph); ctx.beginPath(); ctx.save(); ctx.translate(px + pw / 2, py + ph / 2); ctx.scale(mw, mh); SHAPES[p.mask][1](ctx); ctx.restore(); ctx.clip(); }   // 모양 마스크
      if (pv) ctx.drawImage(pv, px, py, pw, ph);                // 필터가 이미 입혀진 사본
      else { ctx.filter = adjFilter(p.adj, st.k || 1); ctx.drawImage(p.canvas, px, py, pw, ph); ctx.filter = 'none'; }   // 사진별 보정 필터
      if (rot) ctx.restore();
      ctx.restore();
      res.boxes.push({ id: p.id, kind: 'photo', l: px, r: px + pw, t: py, b: py + ph, rot });
      if (idx === lastPhoto) frame();                           // 테두리는 가장 위 사진 바로 위에 그림(그 위의 문구는 테두리 위로 보임)
    } else {
      const it = o;
      if (it.id !== undefined && it.id === st.editing) return;  // 입력 중인 문구는 입력칸이 대신 보여줌
      const r = drawItem(ctx, W, H, it, engine);
      res.lines.push(...r.lines); res.boxes.push({ id: it.id, ...r.box }); if (!r.blank) res.blank = false;
    }
  });
  if (useP) {                                                       // 사진·템플릿·문구·도형 전부 한꺼번에 보정(밝기·대비·채도·따뜻함·흐림)과 투명도
    if (gTmp.width !== W) gTmp.width = W; if (gTmp.height !== H) gTmp.height = H;
    const t = gTmp.getContext('2d'); t.clearRect(0, 0, W, H); t.drawImage(canvas, 0, 0);
    if (st.transparent && !st.bg) ctx.clearRect(0, 0, W, H); else { ctx.fillStyle = st.bgColor || '#fff'; ctx.fillRect(0, 0, W, H); }
    ctx.filter = useG ? adjFilter(st.adj, st.k || 1) : 'none'; ctx.globalAlpha = 1 - clampN(st.clear, 0, 100, 0) / 100; ctx.drawImage(gTmp, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = 1;   // 전체 투명도는 배경색 위로 옅어지게 함
    drawFrame();
  }
  return res;
}
const stretchOf = (v) => Math.min(5, Math.max(0.2, num(v, 1)));   // 늘이기 배율 범위
const clampN = (v, lo, hi, d) => Math.min(hi, Math.max(lo, num(v, d)));
/* 도형 경로: 가운데가 (0,0)이고 한 변이 1인 정사각형 안에 그림 */
const SHAPES = {
  rect: ['사각형', (c) => c.rect(-.5, -.5, 1, 1)],
  round: ['둥근 사각형', (c) => { if (c.roundRect) c.roundRect(-.5, -.5, 1, 1, .22); else c.rect(-.5, -.5, 1, 1); }],
  circle: ['원', (c) => c.arc(0, 0, .5, 0, Math.PI * 2)],
  triangle: ['삼각형', (c) => { c.moveTo(0, -.5); c.lineTo(.5, .5); c.lineTo(-.5, .5); c.closePath(); }],
  heart: ['하트', (c) => { c.moveTo(0, .45); c.bezierCurveTo(-.75, -.05, -.4, -.62, 0, -.2); c.bezierCurveTo(.4, -.62, .75, -.05, 0, .45); c.closePath(); }],
  star: ['별', (c) => { for (let k = 0; k < 10; k++) { const r = k % 2 ? .22 : .5, an = -Math.PI / 2 + k * Math.PI / 5; c[k ? 'lineTo' : 'moveTo'](Math.cos(an) * r, Math.sin(an) * r); } c.closePath(); }],
  bubble: ['말풍선', (c) => { if (c.roundRect) c.roundRect(-.5, -.42, 1, .72, .16); else c.rect(-.5, -.42, 1, .72); c.moveTo(-.28, .28); c.lineTo(-.34, .5); c.lineTo(-.06, .28); c.closePath(); }],
  arrow: ['화살표', (c) => { c.moveTo(-.5, -.16); c.lineTo(.1, -.16); c.lineTo(.1, -.36); c.lineTo(.5, 0); c.lineTo(.1, .36); c.lineTo(.1, .16); c.lineTo(-.5, .16); c.closePath(); }],
};
function drawShape(ctx, W, H, st) {      // 도형: 크기·색·불투명도·기울기·늘이기는 문구와 같은 항목을 씀
  const size = clampN(st.s, 2, 30, 7) / 100 * W * 3, sx = stretchOf(st.sx), sy = stretchOf(st.sy);
  const cx = num(st.x, 50) / 100 * W, cy = num(st.y, 50) / 100 * H, rot = num(st.rot, 0);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180); ctx.scale(sx * size, sy * size); ctx.globalCompositeOperation = blendOp(st.blend);
  ctx.globalAlpha = clampN(st.op, 0, 100, 100) / 100; ctx.fillStyle = st.color || '#ff5a7a';
  ctx.beginPath(); (SHAPES[st.shape] || SHAPES.rect)[1](ctx); ctx.fill(); ctx.restore();
  const bw = size * sx, bh = size * sy;
  return { lines: [], blank: false, box: { l: cx - bw / 2, r: cx + bw / 2, t: cy - bh / 2, b: cy + bh / 2, rot }, fontPx: size };
}
function drawItem(ctx, W, H, st, engine) {
  if (st.shape) return drawShape(ctx, W, H, st);
  const fixed = engine === 'after';
  const text = String(st.text ?? '');
  const sizePct = fixed ? Math.min(30, Math.max(2, num(st.s, 7))) : st.s;
  let fontPx = sizePct / 100 * W;
  const m = MARGIN * W;
  const fam = (FONTS[st.font] || FONTS.gothic)[1]; if (fixed) needFont(st.font, text);
  const weight = st.b === false ? 400 : 800, italic = fixed && st.i ? 'italic ' : '';
  const lsPct = fixed ? clampN(st.ls, -5, 30, 0) : 0, lhPct = fixed ? clampN(st.lh, 100, 250, 130) : 130;   // 글자 간격·줄 간격
  const bgOn = fixed && !!st.bgOn && text.trim() !== '';          // 글자 뒤 배경(빈 문구엔 그리지 않음)
  const padX = () => bgOn ? fontPx * 0.5 : 0, padY = () => bgOn ? fontPx * 0.25 : 0;
  const lineH = () => fontPx * lhPct / 100;
  let lines;
  const layout = () => {
    ctx.font = `${italic}${weight} ${fontPx}px ${fam}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = (lsPct / 100 * fontPx) + 'px';
    const maxW = W - 2 * m - 2 * padX();
    lines = fixed ? wrapLines(ctx, text, maxW) : text.split('\n');
  };
  layout();
  const mv = MARGIN * H;                                      // 세로 여백도 화면 높이의 4%
  if (fixed) { while (lines.length * lineH() > H - 2 * mv && fontPx > 12) { fontPx *= 0.92; layout(); } }
  const blank = lines.every((l) => l.trim() === '');
  const wMax = Math.max(0, ...lines.map((l) => ctx.measureText(l).width));
  const th = lines.length * lineH(), bw0 = wMax + 2 * padX(), bh0 = th + 2 * padY();
  const sx = fixed ? stretchOf(st.sx) : 1, sy = fixed ? stretchOf(st.sy) : 1;   // 가로·세로 늘이기(글자 모양이 찌그러져도 되고, 화면 밖으로 나가 잘려도 됨)
  const bw = bw0 * sx, bh = bh0 * sy;                          // 늘어난 뒤의 상자 크기(선택 상자·위치 제한 기준)
  let cx = (fixed ? num(st.x, 50) : st.x) / 100 * W;
  let cy = (fixed ? num(st.y, 50) : st.y) / 100 * H;
  const align = fixed && (st.align === 'left' || st.align === 'right') ? st.align : 'center';
  const ax = align === 'left' ? -wMax / 2 : align === 'right' ? wMax / 2 : 0;   // 가장 긴 줄을 기준으로 왼쪽·가운데·오른쪽 맞춤
  ctx.textAlign = align; ctx.textBaseline = 'middle';
  const rot = fixed ? num(st.rot, 0) : 0;
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot * Math.PI / 180); ctx.scale(sx, sy); if (fixed) ctx.globalCompositeOperation = blendOp(st.blend);   // 글자 상자의 가운데를 기준으로 기울이고 늘임
  if (bgOn) {
    ctx.fillStyle = /^#[0-9a-f]{6}$/i.test(st.bgColor) ? st.bgColor : '#ffffff';
    ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(-bw0 / 2, -bh0 / 2, bw0, bh0, fontPx * 0.25); else ctx.rect(-bw0 / 2, -bh0 / 2, bw0, bh0);
    ctx.globalAlpha = 1 - clampN(st.bgClear, 0, 100, 0) / 100;       // 배경만 투명하게(글자는 그대로)
    ctx.fill();
  }
  ctx.globalAlpha = fixed ? clampN(st.op, 0, 100, 100) / 100 : 1; ctx.fillStyle = st.color || '#111111';   // 글자 불투명도
  const hexOk = (c, d) => (/^#[0-9a-f]{6}$/i.test(c) ? c : d);
  if (fixed && st.grad) { const g = ctx.createLinearGradient(0, -th / 2, 0, th / 2); g.addColorStop(0, hexOk(st.color, '#111111')); g.addColorStop(1, hexOk(st.color2, '#ff5a7a')); ctx.fillStyle = g; }   // 두 색 그라디언트(위→아래)
  const shA = fixed ? clampN(st.sh, 0, 100, 0) : 0, olW = fixed ? clampN(st.ol, 0, 20, 0) / 100 * fontPx : 0;     // 그림자 세기·외곽선 굵기(px)
  if (shA > 0) { ctx.shadowColor = hexOk(st.shColor, '#000000'); ctx.shadowBlur = shA / 100 * fontPx * 0.35; ctx.shadowOffsetX = ctx.shadowOffsetY = shA / 100 * fontPx * 0.08; }
  if (olW > 0) { ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.lineWidth = olW * 2; ctx.strokeStyle = hexOk(st.olColor, '#ffffff'); }   // 바깥쪽만 보이도록 글자 아래에 두 배 굵기로 먼저 그림
  lines.forEach((l, i) => {                                                         // 외곽선(선택) → 글자
    const y = -th / 2 + lineH() * (i + 0.5);
    if (olW > 0) ctx.strokeText(l, ax, y);
    ctx.fillText(l, ax, y);
    if (fixed && (st.u || st.st) && l.trim() !== '') {                              // 밑줄·취소선
      const w = ctx.measureText(l).width, x0 = align === 'left' ? ax : align === 'right' ? ax - w : ax - w / 2, t = Math.max(1, fontPx * 0.06);
      if (st.u) ctx.fillRect(x0, y + fontPx * 0.42, w, t);
      if (st.st) ctx.fillRect(x0, y - t / 2 - fontPx * 0.02, w, t);
    }
  });
  ctx.restore();   // (save/restore 가 그림자·외곽선 설정도 되돌림)
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  return { lines, blank, box: { l: cx - bw / 2, r: cx + bw / 2, t: cy - bh / 2, b: cy + bh / 2, rot }, fontPx };
}
const inside = (r) => r.boxes.every((b) => b.r - b.l === 0 || (b.l >= MARGIN * r.W - 1 && b.r <= (1 - MARGIN) * r.W + 1 &&
  b.t >= MARGIN * r.H - 1 && b.b <= (1 - MARGIN) * r.H + 1));

/* ---------- 화면 갱신 ---------- */
const cv = $('cv'), layer = $('layer'), inp = $('editor-input');
const selEl = document.createElement('div'); selEl.id = 'sel'; layer.appendChild(selEl);
let lastBoxes = [];
let presetFor = null, gThumbT = 0;   // presetFor: 보정 썸네일이 어느 대상(사진 id 또는 'global')의 것인지
let freeW = 0;      // 자유형일 때 화면에 보이는 캔버스 가로(css px). 세로 끌기는 비율만, 가로 끌기는 가로+비율을 바꿈
let tool = 'move';   // 사진 도구: 'move'(이동·크기) | 'crop'(자르기) | 'brush'(붓 보정)
let pending = false;
const off = document.createElement('canvas'); off.getContext('2d');   // willReadFrequently 없이 먼저 만들어 둠 → 미리보기는 GPU 캔버스로 유지(매 프레임 GPU↔CPU 복사 방지)
function paint() {   // 저장과 같은 방식(오프스크린 렌더)으로 그린 뒤 화면에 복사 → 미리보기 = 파일
  const r = render(off, state, 'after', interacting); lastBoxes = r.boxes;
  if (cv.width !== off.width) cv.width = off.width; if (cv.height !== off.height) cv.height = off.height;
  cv.getContext('2d').drawImage(off, 0, 0); drawSel(); syncLocks();
  if (!selPhoto() && presetFor === 'global') scheduleGlobalThumbs();
}
function draw() { if (!pending) { pending = true; requestAnimationFrame(() => { pending = false; paint(); }); } }
/* 빈 그림판의 선택 상자: 그려진(투명하지 않은) 부분을 감싸는 상자. p.bbox = undefined(다시 계산 필요) | null(비어 있음) | {x0,y0,x1,y1}(사진 픽셀 좌표) */
function blankBBox(p) {
  if (p.bbox !== undefined) return p.bbox;
  const w = p.w, h = p.h, d = p.canvas.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) { const row = y * w * 4; for (let x = 0; x < w; x++) if (d[row + x * 4 + 3] > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
  return (p.bbox = x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 });
}
function selBoxOf(p, b) {                                           // 빈 그림판이면 그림에 맞춘 상자(여유 8px), 아니면 사진 전체 상자
  if (!p || !p.blank) return b;
  const bb = blankBBox(p); if (!bb) return b;
  const k = (b.r - b.l) / p.w, m = 8;
  return { ...b, l: b.l + bb.x0 * k - m, r: b.l + bb.x1 * k + m, t: b.t + bb.y0 * k - m, b: b.t + bb.y1 * k + m };
}
function selBoxFor(ph, b) {                                         // 사진의 선택 상자. 기울어진 사진이면 상자 가운데를 사진 가운데 기준으로 돌린 위치로 옮김
  const nb = selBoxOf(ph, b); if (!b.rot) return nb;
  const pcx = (b.l + b.r) / 2, pcy = (b.t + b.b) / 2, dx = (nb.l + nb.r) / 2 - pcx, dy = (nb.t + nb.b) / 2 - pcy, an = b.rot * Math.PI / 180;
  const cx = pcx + dx * Math.cos(an) - dy * Math.sin(an), cy = pcy + dx * Math.sin(an) + dy * Math.cos(an), w = nb.r - nb.l, hh = nb.b - nb.t;
  return { ...nb, l: cx - w / 2, r: cx + w / 2, t: cy - hh / 2, b: cy + hh / 2 };
}
function drawSel() {
  let b = lastBoxes.find((x) => x.id === state.sel);
  if (b && b.kind === 'photo') b = selBoxFor(selPhoto(), b);
  if (!b || state.editing || tool !== 'move' || b.r - b.l === 0) { selEl.style.display = 'none'; return; }
  selEl.style.display = 'block';
  const isPhoto = b.kind === 'photo', ins = isPhoto ? frameInset(state) : 0, pad = isPhoto ? 0 : 6;
  const clip = isPhoto && !b.rot;                                  // 기울어진 사진은 틀 밖까지 상자 전체를 보여 줌
  const l = clip ? Math.max(b.l, ins) : b.l, r = clip ? Math.min(b.r, cv.width - ins) : b.r, t = clip ? Math.max(b.t, ins) : b.t, bt = clip ? Math.min(b.b, cv.height - ins) : b.b;   // 안 기울어진 사진은 보이는 부분만 표시
  selEl.style.left = `calc(${l / cv.width * 100}% - ${pad}px)`; selEl.style.top = `calc(${t / cv.height * 100}% - ${pad ? 4 : 0}px)`;
  selEl.style.width = `calc(${(r - l) / cv.width * 100}% + ${pad * 2}px)`; selEl.style.height = `calc(${(bt - t) / cv.height * 100}% + ${pad ? 8 : 0}px)`;
  selEl.style.transform = b.rot ? `rotate(${b.rot}deg)` : '';                   // 기울어진 항목은 선택 상자도 함께 기울임
  selEl.classList.toggle('photo', isPhoto);
  selEl.classList.toggle('text', !isPhoto);                       // 선택된 텍스트는 마우스를 올리지 않아도 항상 선택 표시
}
// 사진 테두리의 점(모서리·변 가운데)을 끌어 크기 조절
const HANDLES = [[0, 0, 'nwse'], [50, 0, 'ns'], [100, 0, 'nesw'], [100, 50, 'ew'], [100, 100, 'nwse'], [50, 100, 'ns'], [0, 100, 'nesw'], [0, 50, 'ew']];
function bboxCenterInfo(ph, pb) {                                  // 빈 그림판: 그림(그려진 부분) 가운데의 화면 위치와 사진 가운데에서의 거리(사진 기울기 반영)
  const bb = blankBBox(ph); if (!bb) return null;
  const k = (pb.r - pb.l) / ph.w, pcx = (pb.l + pb.r) / 2, pcy = (pb.t + pb.b) / 2, an = (pb.rot || 0) * Math.PI / 180;
  let ox = pb.l + (bb.x0 + bb.x1) / 2 * k - pcx, oy = pb.t + (bb.y0 + bb.y1) / 2 * k - pcy;
  if (an) { const rx = ox * Math.cos(an) - oy * Math.sin(an), ry = ox * Math.sin(an) + oy * Math.cos(an); ox = rx; oy = ry; }
  return { bx: pcx + ox, by: pcy + oy, ox, oy };
}
HANDLES.forEach(([x, y, cur]) => {
  const corner = x % 100 === 0 && y % 100 === 0, del = x === 100 && y === 0;   // 오른쪽 위 꼭짓점 = 삭제(X)
  const h = document.createElement('div'); h.className = 'hd' + (del ? ' del' : ''); h.style.left = x + '%'; h.style.top = y + '%';
  if (del) {
    h.textContent = '×'; h.title = '삭제 (Ctrl+Z로 되돌릴 수 있습니다)'; h.setAttribute('aria-label', '삭제'); h.style.cursor = 'pointer';
    h.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); });
    h.addEventListener('click', (e) => { e.stopPropagation(); removeSel(); });
    selEl.appendChild(h); return;
  }
  h.style.cursor = cur + '-resize';
  h.addEventListener('pointerdown', (e) => {
    const tb = selItem() && lastBoxes.find((q) => q.id === state.sel);
    if (tb) {                                                    // 문구·도형·스티커: 꼭짓점 = 크기(비율 유지), 변 가운데 = 가로·세로 늘이기
      e.stopPropagation(); e.preventDefault();
      const p = toCanvas(e), it = selItem(), cx = (tb.l + tb.r) / 2, cy = (tb.t + tb.b) / 2;
      interacting = true; checkpoint();
      if (corner) scaling = { id: state.sel, cx, cy, uni: true, d0: Math.max(1, Math.hypot(p.x - cx, p.y - cy)), s0: num(it.s, 7) };
      else {
        const ax = x === 50 ? 'y' : 'x', a = -(tb.rot || 0) * Math.PI / 180, dx = p.x - cx, dy = p.y - cy;
        const loc = ax === 'x' ? dx * Math.cos(a) - dy * Math.sin(a) : dx * Math.sin(a) + dy * Math.cos(a);   // 글자 방향 기준 거리
        scaling = { id: state.sel, cx, cy, ax, rot: a, d0: Math.max(1, Math.abs(loc)), s0: num(ax === 'x' ? it.sx : it.sy, 1) };
      }
      try { layer.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 끝남 */ }
      return;
    }
    const ph = selPhoto(); if (!ph) return;
    e.stopPropagation(); e.preventDefault();
    if (!corner) {                                               // 변 가운데 점: 사진을 가로·세로로 늘이거나 줄임(원본이 일그러져도 됨). 손을 떼면 사진 픽셀에 반영
      const b = lastBoxes.find((q) => q.id === ph.id); if (!b) return;
      const p0 = toCanvas(e); let cx0 = (b.l + b.r) / 2, cy0 = (b.t + b.b) / 2, anchor = null;
      const ax = x === 50 ? 'y' : 'x', an = -(b.rot || 0) * Math.PI / 180;
      const bb = ph.blank && blankBBox(ph);
      if (bb) {                                                  // 빈 그림판: 그림(그려진 부분)의 가운데를 기준으로 늘이고 줄임
        const k = (b.r - b.l) / ph.w, lx = ((bb.x0 + bb.x1) / 2 - ph.w / 2) * k, ly = ((bb.y0 + bb.y1) / 2 - ph.h / 2) * k, a2 = (b.rot || 0) * Math.PI / 180;
        anchor = { lx, ly, a2, Cx: cx0 + lx * Math.cos(a2) - ly * Math.sin(a2), Cy: cy0 + lx * Math.sin(a2) + ly * Math.cos(a2) };
        cx0 = anchor.Cx; cy0 = anchor.Cy;
      }
      const dx = p0.x - cx0, dy = p0.y - cy0, loc = ax === 'x' ? dx * Math.cos(an) - dy * Math.sin(an) : dx * Math.sin(an) + dy * Math.cos(an);   // 사진 방향 기준 거리
      interacting = true; ph.dsx = 1; ph.dsy = 1;
      scaling = { id: ph.id, photo: true, cx: cx0, cy: cy0, ax, rot: an, anchor, d0: Math.max(1, Math.abs(loc)) };
      try { layer.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 끝남 */ }
      return;
    }
    const p = toCanvas(e); let cx = ph.x / 100 * cv.width, cy = ph.y / 100 * cv.height, ox = 0, oy = 0, around = false;
    const pb = ph.blank && photoBoxOf(ph), bi = pb && bboxCenterInfo(ph, pb);
    if (bi) { ox = bi.ox; oy = bi.oy; cx = bi.bx; cy = bi.by; around = true; }   // 빈 그림판: 그림(그려진 부분)의 가운데를 기준으로 키우고 줄임
    selEl.classList.add('show');
    interacting = true; checkpoint();
    resizing = { id: ph.id, cx, cy, ox, oy, around, d0: Math.max(1, Math.hypot(p.x - cx, p.y - cy)), s0: ph.scale };
    try { layer.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 끝남 */ }
  });
  selEl.appendChild(h);
});
{                                                                 // 기울기: 선택 상자 위쪽에 실선 + 끝 점. 점을 돌리면 기울어지고, 더블클릭하면 0°
  const rh = document.createElement('div'); rh.className = 'rh'; rh.title = '끌어서 기울이기 (Shift: 15°씩 · 더블클릭: 0°)';
  const target = () => { const o = selItem() || selPhoto(); return o && !o.locked ? o : null; };
  rh.addEventListener('pointerdown', (e) => {
    const o = target(), b = o && lastBoxes.find((q) => q.id === o.id); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    const p = toCanvas(e), cx = (b.l + b.r) / 2, cy = (b.t + b.b) / 2;
    interacting = true; checkpoint();
    rotating = { id: o.id, cx, cy, a0: Math.atan2(p.y - cy, p.x - cx), r0: b.rot || 0 };
    try { layer.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 끝남 */ }
  });
  rh.addEventListener('dblclick', (e) => { e.stopPropagation(); const o = target(); if (!o) return; checkpoint(); o.rot = 0; syncUI(); paint(); });
  selEl.appendChild(rh);
}
let resizing = null, rotating = null, scaling = null;
function syncUI() {
  const it = selItem(), ph = selPhoto();
  if (ph) { $('ps').value = ph.scale; $('vps').textContent = Math.round(ph.scale) + '%'; }
  syncAdj(ph || state);                                            // 이미지를 고르지 않으면 '사진 보정'은 미리보기 전체에 적용
  { const oc = Math.round(ph ? num(ph.pclr, 0) : num(state.clear, 0)); $('pOp').value = oc; $('vpo').textContent = oc + '%';   // 사진 투명도: 선택한 사진 / 없으면 미리보기 전체
    $('opTarget').textContent = ph ? '선택한 사진·그림에만 적용됩니다.' : '선택한 것이 없으면 미리보기 화면 전체에 적용됩니다.'; }
  $('imgPanel').classList.toggle('nophoto', !ph);                  // 이미지 패널은 항상 보임. 사진이 있어야 쓰는 도구만 흐리게·비활성
  document.querySelectorAll('#imgPanel .needphoto').forEach((e) => e.querySelectorAll('button,input').forEach((x) => { x.disabled = !ph; }));
  $('lockBtn').disabled = !((ph && !ph.locked) || (it && !it.locked));
  $('adjBox').classList.toggle('blankMode', !!(ph && ph.blank)); if (ph && ph.blank) renderLayerList();
  if (ph && ph.blank && (tool === 'crop' || tool === 'liquify' || tool === 'cut')) setTool('move');
  if (tool !== 'move' && !ph) setTool('move');
  $('resetPhoto').disabled = !(ph && ph.base); refreshUndo();
  $('styleBox').classList.toggle('hide', !it); $('delText').disabled = !(it || ph);
  {                                                              // 복사: 사진·문구·도형을 선택했을 때만 보임
    const sel = it || ph; $('dupBtn').classList.toggle('hide', !sel);
    if (sel) $('dupBtn').disabled = false;
  }

  if (it) {                                                      // 문구·도형 공통 항목과, 문구에만 있는 항목
    const sh = !!it.shape, op = Math.round(clampN(it.op, 0, 100, 100)), ls = Math.round(clampN(it.ls, -5, 30, 0)), lh = Math.round(clampN(it.lh, 100, 250, 130));
    $('textOnly').classList.toggle('hide', sh); $('lblSize').textContent = sh ? '크기 · 색' : '글자 크기 · 색'; $('lblOp').textContent = sh ? '불투명도' : '글자 불투명도';
    $('opSl').value = op; $('vop').textContent = op + '%';
    document.querySelectorAll('#fmtSeg button').forEach((b) => b.classList.toggle('on', b.dataset.k === 'b' ? it.b !== false : !!it[b.dataset.k]));
    document.querySelectorAll('#alignSeg button').forEach((b) => b.classList.toggle('on', b.dataset.a === (it.align || 'center')));
    $('lsSl').value = ls; $('vlsp').textContent = ls + '%'; $('lhSl').value = lh; $('vlh').textContent = lh + '%';
  }
  if (it) { const r = Math.round(num(it.rot, 0)); $('vr').textContent = r + '°'; $('resetRot').disabled = !r; $('resetStretch').disabled = num(it.sx, 1) === 1 && num(it.sy, 1) === 1; }
  if (it) {
    $('fontSel').value = FONTS[it.font] ? it.font : 'gothic';
    $('bgToggle').textContent = it.bgOn ? '적용' : '비적용'; $('bgToggle').classList.toggle('on', !!it.bgOn); $('bgToggle').setAttribute('aria-pressed', it.bgOn ? 'true' : 'false');
    $('bgc').value = /^#[0-9a-f]{6}$/i.test(it.bgColor) ? it.bgColor : '#ffffff'; $('bgc').disabled = !it.bgOn;
    const bc = Math.round(num(it.bgClear, 0)); $('bga').value = bc; $('vba').textContent = bc + '%'; $('bga').disabled = !it.bgOn;
  }
  if (it) { $('s').value = it.s; $('vs').textContent = it.s + '%'; $('vc').textContent = it.color; $('c').value = it.color; }
  document.querySelectorAll('.ratio').forEach((b) => b.classList.toggle('on', b.dataset.ratio === state.ratio));
  if (state.ratio !== 'free') document.querySelector('.stage').style.marginTop = '';   // 자유형 가운데 보정용 위쪽 여백 해제
  $('freeCenter').classList.toggle('hide', state.ratio !== 'free'); $('freeCenter').classList.toggle('on', freeCenter);
  layer.classList.toggle('free', state.ratio === 'free'); cv.classList.toggle('free', state.ratio === 'free');
  document.querySelector('.window').classList.toggle('nosticky', state.ratio === 'free');   // 자유형에서는 미리보기 창 따라오기(sticky) 끔
  cv.style.width = state.ratio === 'free' && freeW ? freeW + 'px' : '';
  $('guide').firstElementChild.style.inset = (MARGIN * 100) + '%';
}
/* ---------- 보정 UI: 슬라이더 + 프리셋 썸네일 (터치·마우스 공통) ---------- */
const globalSample = () => { const t = document.createElement('canvas'); render(t, { ...state, adj: null, clear: 0 }, 'after', true); return t; };   // 보정 전 미리보기 전체(썸네일용)
const adjOwner = () => selPhoto() || state;                        // 선택한 사진이 있으면 그 사진, 없으면 미리보기 전체가 보정 대상
function buildPresets(o) {
  const box = $('presets'); box.innerHTML = ''; presetFor = o === state ? 'global' : o.id;
  const src = o === state ? globalSample() : o.canvas, sw = o === state ? src.width : o.w, sh = o === state ? src.height : o.h;
  const sc = 54 * 2 / Math.min(sw, sh);
  PRESETS.forEach(([name, vals], i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'preset'; b.dataset.i = i;
    const c = document.createElement('canvas'); c.width = c.height = 108;
    const x = c.getContext('2d'); x.filter = adjFilter(vals);
    x.drawImage(src, (108 - sw * sc) / 2, (108 - sh * sc) / 2, sw * sc, sh * sc);
    b.append(c, name); box.append(b);
  });
}
function syncAdj(o) {
  const key = o === state ? 'global' : o.id;
  if (presetFor !== key) buildPresets(o);
  const a = { ...ADJ0, ...o.adj };
  for (const k of Object.keys(ADJ0)) { $('adj-' + k).value = a[k]; $('v' + k).textContent = a[k] + (k === 'wm' || k === 'bl' || ['cs', 'cm', 'ch'].includes(k) ? '' : k === 'hu' ? '°' : '%'); }
  document.querySelectorAll('.preset').forEach((b) => {
    const pv = { ...ADJ0, ...PRESETS[b.dataset.i][1] };
    b.classList.toggle('on', Object.keys(ADJ0).every((k) => pv[k] === a[k]));
  });
  $('adjTarget').textContent = o === state ? '선택한 것이 없으면 미리보기 화면 전체(사진·템플릿·문구·도형)에 적용됩니다.' : '선택한 사진·그림에만 적용됩니다.';
}
function scheduleGlobalThumbs() {                                   // 전체 보정 썸네일은 미리보기가 바뀐 뒤 잠깐 멈췄을 때 다시 만듦
  clearTimeout(gThumbT);
  gThumbT = setTimeout(() => { if (!selPhoto() && presetFor === 'global') { buildPresets(state); syncAdj(state); } }, 600);
}
$('pOp').addEventListener('input', (e) => {                        // 사진 투명도 슬라이더
  const o = adjOwner(), v = Number(e.target.value);
  checkpoint('pop' + (o.id || 'g')); if (o === state) state.clear = v; else o.pclr = v;
  syncUI(); paint();
});
document.querySelectorAll('#adjBox input[type=range][data-k]').forEach((r) => r.addEventListener('input', () => {   // data-k 가 있는 보정 슬라이더만(붓·터치 보정 슬라이더가 사진 보정 값을 바꾸던 문제 수정)
  const o = adjOwner();
  checkpoint('adj' + (o.id || 'g')); o.adj = { ...ADJ0, ...o.adj, [r.dataset.k]: Number(r.value) }; syncAdj(o); paint();
}));
$('presets').addEventListener('click', (e) => {
  const b = e.target.closest('.preset'); if (!b) return;
  const o = adjOwner(); checkpoint(); o.adj = { ...ADJ0, ...PRESETS[b.dataset.i][1] }; syncAdj(o); paint();
});
$('adjReset').addEventListener('click', () => { const o = adjOwner(); checkpoint(); o.adj = o === state ? null : { ...ADJ0 }; syncAdj(o); paint(); });

/* ---------- 사진 도구: 되돌리기 · 자르기 · 붓 보정 ---------- */
const photoBoxOf = (ph) => lastBoxes.find((b) => b.id === ph.id);
const visRect = (b) => { const i = frameInset(state); return { l: Math.max(b.l, i), t: Math.max(b.t, i), r: Math.min(b.r, cv.width - i), b: Math.min(b.b, cv.height - i) }; };
const cloneCanvas = (src) => { const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); return c; };
const HIST_MAX = 12;
function pushHist(p) {            // 자르기·붓·유동화 한 번(누르고 뗄 때까지)마다 이전 상태 저장 — 메모리 때문에 최근 12단계만
  dropPrev(p);
  const snap = { seq: ++SEQ, canvas: cloneCanvas(p.canvas), orig: p.orig, w: p.w, h: p.h, x: p.x, y: p.y, scale: p.scale };
  if (!p.base) p.base = snap;       // 첫 작업 직전 상태 = '초기화'가 돌아갈 처음 상태 (기록이 12단계를 넘어도 유지)
  (p.hist = p.hist || []).push(snap);
  if (p.hist.length > HIST_MAX) p.hist.shift();
  $('resetPhoto').disabled = false; refreshUndo();
}
function undoPhoto() {
  const p = selPhoto(); if (!p || !p.hist || !p.hist.length) return;
  endStroke(); if (tool === 'crop') setTool('move');
  const e = p.hist.pop();
  p.bbox = undefined; Object.assign(p, e, { canvas: e === p.base ? cloneCanvas(e.canvas) : e.canvas });   // 처음 상태(base)는 이후 붓질로 망가지지 않게 복사본을 사용
  presetFor = null; syncUI(); paint();      // 도구는 그대로 유지(연속으로 되돌리기 가능)
}
$('resetPhoto').addEventListener('click', () => {              // 사진 도구(자르기·붓·터치 보정)로 한 모든 작업을 처음 상태로 ("이전"으로 취소 가능)
  const p = selPhoto(); if (!p || !p.base) return;
  endStroke(); if (tool !== 'move') setTool('move');
  pushHist(p);
  const b = p.base; p.bbox = undefined; p.canvas = cloneCanvas(b.canvas); p.orig = null; p.w = b.w; p.h = b.h; p.x = b.x; p.y = b.y; p.scale = b.scale;
  presetFor = null; syncUI(); paint();
});
$('fitPhoto').addEventListener('click', () => { const p = selPhoto(); if (p) { checkpoint(); p.scale = 100; p.x = 50; p.y = 50; syncUI(); paint(); } });

function setTool(t) {
  if (t === 'crop' || t === 'liquify') { const rp = selPhoto(); if (rp && rp.rot) { rp.rot = 0; toast('자르기·터치 보정을 위해 기울기를 0°로 되돌렸습니다.'); } }
  if (t !== 'move') endEdit();
  tool = t; endStroke();
  document.querySelectorAll('#toolSeg button').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
  $('cropOpts').classList.toggle('hide', tool !== 'crop'); $('brushOpts').classList.toggle('hide', tool !== 'brush'); $('liqOpts').classList.toggle('hide', tool !== 'liquify'); $('cutOpts').classList.toggle('hide', tool !== 'cut');
  layer.classList.toggle('brush', tool === 'brush' || tool === 'liquify'); layer.classList.remove('cross'); brushCur.style.display = 'none'; clearLasso();
  if (tool === 'cut') syncCutUI();
  cropBox.classList.toggle('on', tool === 'crop');
  if (tool === 'crop') initCrop();
  paint();
}
document.querySelectorAll('#toolSeg button').forEach((b) => b.addEventListener('click', () => { if (selPhoto()) setTool(b.dataset.tool); }));
document.querySelectorAll('.ratio').forEach((b) => b.addEventListener('click', () => { if (tool !== 'move') setTool('move'); }));

/* 자르기: 상자를 끌어 영역을 정하고 적용하면 사진 픽셀 자체를 잘라냄(되돌리기 가능) */
const cropWrap = document.createElement('div'); cropWrap.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none';
const cropBox = document.createElement('div'); cropBox.id = 'cropBox'; cropWrap.appendChild(cropBox); layer.appendChild(cropWrap);
let crop = null, cropRatio = 0, cropDrag = null;
const cropBounds = () => { const p = selPhoto(), b = p && photoBoxOf(p); return b ? visRect(b) : null; };
function showCrop() {
  if (!crop) return;
  cropBox.style.left = crop.l / cv.width * 100 + '%'; cropBox.style.top = crop.t / cv.height * 100 + '%';
  cropBox.style.width = (crop.r - crop.l) / cv.width * 100 + '%'; cropBox.style.height = (crop.b - crop.t) / cv.height * 100 + '%';
}
function initCrop() {
  const v = cropBounds(); if (!v) { tool = 'move'; return; }
  crop = { ...v };
  if (cropRatio) {
    const w = Math.min(v.r - v.l, (v.b - v.t) * cropRatio), h = w / cropRatio, cx = (v.l + v.r) / 2, cy = (v.t + v.b) / 2;
    crop = { l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2 };
  }
  showCrop();
}
[[0, 0, 'nwse'], [.5, 0, 'ns'], [1, 0, 'nesw'], [1, .5, 'ew'], [1, 1, 'nwse'], [.5, 1, 'ns'], [0, 1, 'nesw'], [0, .5, 'ew']].forEach(([hx, hy, cur]) => {
  const h = document.createElement('div'); h.className = 'hd'; h.style.left = hx * 100 + '%'; h.style.top = hy * 100 + '%'; h.style.cursor = cur + '-resize';
  h.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); h.setPointerCapture(e.pointerId); cropDrag = { hx, hy, start: { ...crop }, p0: toCanvas(e) }; });
  cropBox.appendChild(h);
});
cropBox.addEventListener('pointerdown', (e) => { if (e.target !== cropBox) return; e.preventDefault(); cropBox.setPointerCapture(e.pointerId); cropDrag = { move: true, start: { ...crop }, p0: toCanvas(e) }; });
cropBox.addEventListener('pointermove', (e) => {
  if (!cropDrag) return;
  const v = cropBounds(), p = toCanvas(e), d = cropDrag, dx = p.x - d.p0.x, dy = p.y - d.p0.y, s = d.start, MIN = 30;
  if (!v) return;
  if (d.move) {
    const w = s.r - s.l, h = s.b - s.t, l = Math.min(v.r - w, Math.max(v.l, s.l + dx)), t = Math.min(v.b - h, Math.max(v.t, s.t + dy));
    crop = { l, t, r: l + w, b: t + h }; showCrop(); return;
  }
  let { l, t, r, b } = s;
  if (d.hx === 0) l += dx; if (d.hx === 1) r += dx; if (d.hy === 0) t += dy; if (d.hy === 1) b += dy;
  if (!cropRatio) {
    l = Math.max(v.l, Math.min(l, r - MIN)); r = Math.min(v.r, Math.max(r, l + MIN)); t = Math.max(v.t, Math.min(t, b - MIN)); b = Math.min(v.b, Math.max(b, t + MIN));
  } else {
    let w = r - l, h = b - t;
    if (d.hx === .5) { w = h * cropRatio; const cx = (s.l + s.r) / 2; l = cx - w / 2; r = cx + w / 2; }
    else { h = w / cropRatio; if (d.hy === 0) t = b - h; else if (d.hy === 1) b = t + h; else { const cy = (s.t + s.b) / 2; t = cy - h / 2; b = cy + h / 2; } }
    if (l < v.l || r > v.r || t < v.t || b > v.b || r - l < MIN || b - t < MIN) return;   // 범위를 벗어나면 직전 상태 유지
  }
  crop = { l, t, r, b }; showCrop();
});
const endCropDrag = () => { cropDrag = null; };
cropBox.addEventListener('pointerup', endCropDrag); cropBox.addEventListener('pointercancel', endCropDrag);
$('cropRatio').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  cropRatio = Number(b.dataset.r);
  document.querySelectorAll('#cropRatio button').forEach((x) => x.classList.toggle('on', x === b));
  initCrop();
});
$('cropCancel').addEventListener('click', () => setTool('move'));
$('cropOk').addEventListener('click', () => {
  const ph = selPhoto(), b = ph && photoBoxOf(ph); if (!ph || !b || !crop) return;
  const k = (b.r - b.l) / ph.w;                                  // 화면(캔버스) 픽셀 → 사진 원본 픽셀
  const sx = Math.max(0, Math.round((crop.l - b.l) / k)), sy = Math.max(0, Math.round((crop.t - b.t) / k));
  const sw = Math.min(ph.w - sx, Math.round((crop.r - crop.l) / k)), sh = Math.min(ph.h - sy, Math.round((crop.b - crop.t) / k));
  if (sw < 8 || sh < 8) { toast('자를 영역이 너무 작습니다.'); return; }
  pushHist(ph);
  const cut = (src) => { const c = document.createElement('canvas'); c.width = sw; c.height = sh; c.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh); return c; };
  ph.canvas = cut(ph.canvas); if (ph.orig) ph.orig = cut(ph.orig);
  ph.w = sw; ph.h = sh;
  const [W, H] = canvasDims(state), ins = frameInset(state);   // 잘라낸 부분이 제자리·같은 배율로 남도록 위치·크기 보정
  ph.scale = Math.min(300, Math.max(10, k / Math.max((W - 2 * ins) / sw, (H - 2 * ins) / sh) * 100));
  ph.x = (crop.l + crop.r) / 2 / W * 100; ph.y = (crop.t + crop.b) / 2 / H * 100;
  presetFor = null; setTool('move'); syncUI(); paint();
  setMsg('imgMsg', '사진을 잘랐습니다. "테두리에 꽉 채우기"로 맞추거나 "되돌리기"로 취소할 수 있습니다.', 'ok');
});

/* 그리기: 사진 픽셀 위에 펜으로 그리거나 지우개로 지움 (사진 픽셀을 직접 수정) */
const brushCur = document.createElement('div'); brushCur.id = 'brushCur'; layer.appendChild(brushCur);
const brush = { mode: 'pen', size: 2, eraseSize: 4, color: '#ff3b30' };   // 그리기: size = 펜 지름, eraseSize = 지우개 지름(캔버스 가로의 %), mode = pen 펜 | erase 지우개
const liq = { mode: 'push', size: 14, str: 60 };                 // 픽셀 유동화 설정
const brushR = () => (tool === 'liquify' ? liq.size : brush.mode === 'erase' ? brush.eraseSize : brush.size) / 100 * cv.width / 2;   // 붓 반지름(캔버스 픽셀)
let stroke = null;
function syncBrushLabels() { $('vbs').textContent = Math.round(brush.size / 100 * 1080) + 'px'; $('ves').textContent = Math.round(brush.eraseSize / 100 * 1080) + 'px'; $('vls').textContent = liq.size; $('vlt').textContent = liq.str + '%'; }
syncBrushLabels();
$('liqSize').addEventListener('input', (e) => { liq.size = Number(e.target.value); syncBrushLabels(); });
$('liqStr').addEventListener('input', (e) => { liq.str = Number(e.target.value); syncBrushLabels(); });
$('liqMode').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  liq.mode = b.dataset.m; document.querySelectorAll('#liqMode button').forEach((x) => x.classList.toggle('on', x === b));
});
/** 픽셀 유동화 한 단계: (cx,cy) 둘레 반지름 안의 픽셀을 밀거나(push) 부풀리거나(bloat) 오므림(pucker). ddx/ddy = 캔버스 픽셀 이동량 */
function liqStep(p, b, cx, cy, ddx, ddy) {
  const k = (b.r - b.l) / p.w, r = brushR() / k, sx = (cx - b.l) / k, sy = (cy - b.t) / k;
  const x0 = Math.max(0, Math.floor(sx - r)), y0 = Math.max(0, Math.floor(sy - r)), x1 = Math.min(p.w, Math.ceil(sx + r)), y1 = Math.min(p.h, Math.ceil(sy + r));
  const w = x1 - x0, h = y1 - y0; if (w < 2 || h < 2) return;
  const ctx = p.canvas.getContext('2d', { willReadFrequently: true });
  const src = ctx.getImageData(x0, y0, w, h), out = ctx.createImageData(w, h), S = src.data, O = out.data;
  const s = Math.max(.05, liq.str / 100), mx = ddx / k, my = ddy / k;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x0 + x + .5 - sx, py = y0 + y + .5 - sy, d = Math.hypot(px, py), o = (y * w + x) * 4;
    if (d >= r) { O[o] = S[o]; O[o + 1] = S[o + 1]; O[o + 2] = S[o + 2]; O[o + 3] = S[o + 3]; continue; }
    const t = 1 - d / r, f = t * t * (3 - 2 * t);                // 가운데 1 → 가장자리 0 (부드러운 감쇠)
    let vx, vy;
    if (liq.mode === 'push') { vx = -mx * f * s; vy = -my * f * s; }
    else { const a = (liq.mode === 'bloat' ? -1 : 1) * f * s * .12; vx = px * a; vy = py * a; }
    const fx = Math.min(w - 1.001, Math.max(0, x + vx)), fy = Math.min(h - 1.001, Math.max(0, y + vy));
    const ix = fx | 0, iy = fy | 0, ax = fx - ix, ay = fy - iy, i00 = (iy * w + ix) * 4, i10 = i00 + 4, i01 = i00 + w * 4, i11 = i01 + 4;
    for (let c = 0; c < 4; c++) O[o + c] = (S[i00 + c] * (1 - ax) + S[i10 + c] * ax) * (1 - ay) + (S[i01 + c] * (1 - ax) + S[i11 + c] * ax) * ay;
  }
  ctx.putImageData(out, x0, y0);
}
$('brushSize').addEventListener('input', (e) => { brush.size = Number(e.target.value) / 5; syncBrushLabels(); });   // 슬라이더 1~100 → 지름 0.2~20%
$('eraseSize').addEventListener('input', (e) => { brush.eraseSize = Number(e.target.value) / 5; syncBrushLabels(); });   // 지우개 크기는 따로(슬라이더 1~100 → 지름 0.2~20%)
brush.eraseSize = Number($('eraseSize').value) / 5; syncBrushLabels();
const syncBrushUI = () => { $('penSizeBox').classList.toggle('hide', brush.mode === 'erase'); $('eraseSizeBox').classList.toggle('hide', brush.mode !== 'erase'); $('drawColorBox').classList.toggle('hide', brush.mode !== 'pen'); };   // 펜: 색·굵기 / 지우개: 지우개 크기
$('brushMode').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  brush.mode = b.dataset.m; document.querySelectorAll('#brushMode button').forEach((x) => x.classList.toggle('on', x === b)); syncBrushUI();
});
brush.size = Number($('brushSize').value) / 5; syncBrushLabels();
const setDrawColor = (col) => {
  brush.color = col; $('drawColor').value = col;
  document.querySelectorAll('#drawSwatches button').forEach((x) => x.classList.toggle('on', x.dataset.c === col));
  if (brush.mode !== 'pen') { brush.mode = 'pen'; document.querySelectorAll('#brushMode button').forEach((x) => x.classList.toggle('on', x.dataset.m === 'pen')); syncBrushUI(); }   // 색을 고르면 펜으로
};
$('drawColor').addEventListener('input', (e) => setDrawColor(e.target.value));
document.querySelectorAll('#drawSwatches button').forEach((b) => b.addEventListener('click', () => setDrawColor(b.dataset.c)));
setDrawColor(brush.color); syncBrushUI();
$('brushMode').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  brush.mode = b.dataset.m; document.querySelectorAll('#brushMode button').forEach((x) => x.classList.toggle('on', x === b));
});
/** 사진 픽셀 위에 a→c 선분을 그림(펜) 또는 처음 상태로 되돌림(지우개). 좌표는 미리보기 캔버스 픽셀 */
function drawSeg(p, b, a, c) {
  const k = (b.r - b.l) / p.w, ctx = p.canvas.getContext('2d'), rs = brushR() / k;
  const ax = (a.x - b.l) / k, ay = (a.y - b.t) / k, cx = (c.x - b.l) / k, cy = (c.y - b.t) / k;
  if (brush.mode === 'erase' && p.orig) {
    const n = Math.max(1, Math.ceil(Math.hypot(cx - ax, cy - ay) / Math.max(1, rs * 0.3)));
    for (let i = 0; i <= n; i++) {
      ctx.save(); ctx.beginPath(); ctx.arc(ax + (cx - ax) * i / n, ay + (cy - ay) * i / n, rs, 0, Math.PI * 2); ctx.clip();
      ctx.clearRect(0, 0, p.w, p.h); ctx.drawImage(p.orig, 0, 0); ctx.restore();    // 원래 사진(투명 포함)으로 덮음
    }
    return;
  }
  ctx.save(); ctx.strokeStyle = ctx.fillStyle = brush.color; ctx.lineWidth = rs * 2; ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(cx, cy); ctx.stroke();
  if (ax === cx && ay === cy) { ctx.beginPath(); ctx.arc(ax, ay, rs, 0, Math.PI * 2); ctx.fill(); }   // 한 번 클릭하면 점
  ctx.restore();
  if (p.blank && p.bbox !== undefined) {                          // 선택 상자를 새로 그은 선만큼 넓힘(지우개는 끝난 뒤 다시 계산)
    const r = rs + 1, nb = { x0: Math.max(0, Math.floor(Math.min(ax, cx) - r)), y0: Math.max(0, Math.floor(Math.min(ay, cy) - r)), x1: Math.min(p.w, Math.ceil(Math.max(ax, cx) + r)), y1: Math.min(p.h, Math.ceil(Math.max(ay, cy) + r)) };
    p.bbox = p.bbox ? { x0: Math.min(p.bbox.x0, nb.x0), y0: Math.min(p.bbox.y0, nb.y0), x1: Math.max(p.bbox.x1, nb.x1), y1: Math.max(p.bbox.y1, nb.y1) } : nb;
  }
}
const unrotPt = (b, p) => {                                       // 기울어진 사진 위의 화면 좌표를 사진의 기울지 않은 좌표로 되돌림
  if (!b || !b.rot) return p;
  const cx = (b.l + b.r) / 2, cy = (b.t + b.b) / 2, an = -b.rot * Math.PI / 180, dx = p.x - cx, dy = p.y - cy;
  return { x: cx + dx * Math.cos(an) - dy * Math.sin(an), y: cy + dx * Math.sin(an) + dy * Math.cos(an) };
};
function brushDown(p, e) {
  const ph = selPhoto(), b = ph && photoBoxOf(ph); if (!b) return;
  const q = unrotPt(b, p), ins = frameInset(state);
  if (b.rot) { if (p.x < ins || p.x > cv.width - ins || p.y < ins || p.y > cv.height - ins || q.x < b.l || q.x > b.r || q.y < b.t || q.y > b.b) return; }
  else { const v = visRect(b); if (p.x < v.l || p.x > v.r || p.y < v.t || p.y > v.b) return; }
  p = q;                                                          // 이하는 사진의 좌표계
  if (!ph.orig) ph.orig = cloneCanvas(ph.canvas);                 // 지우개가 되돌릴 기준(그리기 시작 전 상태)
  pushHist(ph);
  stroke = { id: ph.id, last: p };
  if (tool === 'liquify') {
    if (liq.mode !== 'push') stroke.timer = setInterval(() => {   // 부풀리기·오므리기: 누르고 있는 동안 계속 적용
      const q = selPhoto(), bb = q && photoBoxOf(q); if (!stroke || !bb) return;
      liqStep(q, bb, stroke.last.x, stroke.last.y, 0, 0); draw();
    }, 40);
  } else drawSeg(ph, b, p, p);                                    // 한 번 클릭만으로도 점이 찍힘
  try { layer.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 끝남 */ }
  paint();
}
function brushMove(p) {
  const ph = selPhoto(), b = ph && photoBoxOf(ph), v = b && visRect(b), q = unrotPt(b, p);
  const inside = b && (b.rot ? q.x >= b.l && q.x <= b.r && q.y >= b.t && q.y <= b.b : v && p.x >= v.l && p.x <= v.r && p.y >= v.t && p.y <= v.b);
  brushCur.style.display = (inside || stroke) ? 'block' : 'none';
  const d = brushR() * 2 / cv.width * 100;
  brushCur.style.left = p.x / cv.width * 100 + '%'; brushCur.style.top = p.y / cv.height * 100 + '%';
  brushCur.style.width = d + '%'; brushCur.style.aspectRatio = '1';
  if (!stroke || !ph || ph.id !== stroke.id) return;
  if (tool !== 'liquify') p = q;                                  // 그리기는 사진의 좌표계로
  if (tool === 'liquify') {
    if (liq.mode !== 'push') { stroke.last = p; return; }
    const dx = p.x - stroke.last.x, dy = p.y - stroke.last.y, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (brushR() * .25)));
    for (let i = 0; i < n; i++) liqStep(ph, b, stroke.last.x + dx * (i + .5) / n, stroke.last.y + dy * (i + .5) / n, dx / n, dy / n);
    stroke.last = p; draw(); return;
  }
  if (p.x === stroke.last.x && p.y === stroke.last.y) return;
  drawSeg(ph, b, stroke.last, p); stroke.last = p; draw();
}
document.addEventListener('keydown', (e) => {                       // Ctrl+Shift+X: 픽셀 유동화 켜기/끄기 (포토샵과 같은 단축키)
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') {
    e.preventDefault(); if (!selPhoto()) { toast('먼저 사진을 선택해 주세요.'); return; }
    if (selPhoto().blank) { toast('그림에서는 터치 보정을 쓸 수 없습니다.'); return; }
    setTool(tool === 'liquify' ? 'move' : 'liquify');
  }
});
function endStroke() {
  if (!stroke) return;
  clearInterval(stroke.timer); dropPrev(selPhoto()); { const sp = selPhoto(); if (sp) sp.bbox = undefined; } stroke = null; presetFor = null; const ph = selPhoto(); if (ph) syncAdj(ph); paint();
}

/* ---------- 배경 지우기(누끼): 색 지우기(마술봉) · 투명 지우개 · 되살리기 · 올가미. 사진 픽셀을 투명하게 바꿈("이전"으로 취소) ---------- */
const cut = { mode: 'wand', tol: 30, contig: true, size: 4, soft: 1, side: 'out' };   // tol 허용 오차(%), contig 연결된 부분만, size 지우개 지름(캔버스 가로의 %), soft 경계 부드럽게(0~10), side 올가미가 지울 쪽
const lasso = { pts: [] };                                          // 올가미 점들(미리보기 캔버스 좌표)
const cutHints = {
  wand: '지울 배경을 클릭합니다. 비슷한 색 범위를 넓히면 더 많이 지워집니다.',
  erase: '끌어서 칠한 곳을 투명하게 지웁니다. [ ] 키로 크기를 바꿀 수 있습니다.',
  restore: '끌어서 지운 곳을 되살립니다.',
  lasso: '지울 영역의 둘레에 점을 찍고, 처음 점을 누르거나 더블클릭(Enter)하면 완료됩니다. Esc는 취소.',
};
function syncCutUI() {
  document.querySelectorAll('#cutMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === cut.mode));
  document.querySelectorAll('#lassoSide button').forEach((b) => b.classList.toggle('on', b.dataset.s === cut.side));
  $('cutWandBox').classList.toggle('hide', cut.mode !== 'wand');
  $('cutSizeBox').classList.toggle('hide', cut.mode !== 'erase' && cut.mode !== 'restore');
  $('cutLassoBox').classList.toggle('hide', cut.mode !== 'lasso');
  $('cutContig').classList.toggle('on', cut.contig); $('cutContig').setAttribute('aria-pressed', cut.contig ? 'true' : 'false');
  $('vcutTol').textContent = cut.tol + '%'; $('vcutSize').textContent = Math.round(cut.size / 100 * 1080) + 'px'; $('vcutSoft').textContent = cut.soft;
  $('cutSoftLbl').textContent = (cut.mode === 'erase' || cut.mode === 'restore') ? '가장자리 부드럽게' : '경계 부드럽게';
  $('cutHint').textContent = cutHints[cut.mode];
  if (tool === 'cut') { layer.classList.toggle('brush', cut.mode === 'erase' || cut.mode === 'restore'); layer.classList.toggle('cross', cut.mode === 'wand' || cut.mode === 'lasso'); }
  if (cut.mode !== 'lasso') clearLasso();
}
$('cutMode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cut.mode = b.dataset.m; syncCutUI(); });
$('lassoSide').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; cut.side = b.dataset.s; syncCutUI(); });
$('cutTol').addEventListener('input', (e) => { cut.tol = Number(e.target.value); syncCutUI(); });
$('cutSize').addEventListener('input', (e) => { cut.size = Number(e.target.value) / 5; syncCutUI(); });
$('cutSoft').addEventListener('input', (e) => { cut.soft = Number(e.target.value); syncCutUI(); });
$('cutContig').addEventListener('click', () => { cut.contig = !cut.contig; syncCutUI(); });
$('lassoDone').addEventListener('click', () => closeLasso());
$('lassoCancel').addEventListener('click', () => clearLasso());
cut.size = Number($('cutSize').value) / 5; cut.tol = Number($('cutTol').value); cut.soft = Number($('cutSoft').value); syncCutUI();

function softenAlpha(p, r) {                                        // 투명해진 경계를 r px만큼 부드럽게(바깥쪽은 건드리지 않고 안쪽 가장자리만 옅어짐)
  r = Math.round(r); if (r < 1) return;
  const w = p.w, h = p.h, ctx = p.canvas.getContext('2d'), img = ctx.getImageData(0, 0, w, h), d = img.data, n = w * h;
  const a = new Float32Array(n), t = new Float32Array(n), o = new Float32Array(n);
  for (let i = 0; i < n; i++) a[i] = d[i * 4 + 3];
  const cl = (v, m) => (v < 0 ? 0 : v > m ? m : v), div = 2 * r + 1;
  for (let y = 0; y < h; y++) { const row = y * w; let sum = 0; for (let x = -r; x <= r; x++) sum += a[row + cl(x, w - 1)]; for (let x = 0; x < w; x++) { t[row + x] = sum / div; sum += a[row + cl(x + r + 1, w - 1)] - a[row + cl(x - r, w - 1)]; } }
  for (let x = 0; x < w; x++) { let sum = 0; for (let y = -r; y <= r; y++) sum += t[cl(y, h - 1) * w + x]; for (let y = 0; y < h; y++) { o[y * w + x] = sum / div; sum += t[cl(y + r + 1, h - 1) * w + x] - t[cl(y - r, h - 1) * w + x]; } }
  for (let i = 0; i < n; i++) { const v = Math.round(o[i]); if (v < d[i * 4 + 3]) d[i * 4 + 3] = v; }
  ctx.putImageData(img, 0, 0);
}
function wandCut(p, sx, sy) {                                       // (sx,sy) 사진 픽셀의 색과 비슷한 색을 투명하게. 지운 픽셀이 있으면 true
  const w = p.w, h = p.h, ctx = p.canvas.getContext('2d'), img = ctx.getImageData(0, 0, w, h), d = img.data;
  const x0 = Math.min(w - 1, Math.max(0, Math.floor(sx))), y0 = Math.min(h - 1, Math.max(0, Math.floor(sy))), i0 = (y0 * w + x0) * 4;
  if (d[i0 + 3] < 8) return false;                                  // 이미 투명한 곳
  const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2], lim = (cut.tol / 100) * 300, lim2 = lim * lim;
  const near = (i) => { if (d[i + 3] < 8) return false; const dr = d[i] - tr, dg = d[i + 1] - tg, db = d[i + 2] - tb; return dr * dr + dg * dg + db * db <= lim2; };
  const mask = new Uint8Array(w * h); let count = 0;
  if (cut.contig) {                                                 // 클릭한 곳과 이어진 비슷한 색만(상하좌우)
    const q = new Int32Array(w * h); let qh = 0, qt = 0; q[qt++] = y0 * w + x0; mask[y0 * w + x0] = 1;
    while (qh < qt) {
      const idx = q[qh++], x = idx % w, y = (idx - x) / w;
      if (x > 0 && !mask[idx - 1] && near((idx - 1) * 4)) { mask[idx - 1] = 1; q[qt++] = idx - 1; }
      if (x < w - 1 && !mask[idx + 1] && near((idx + 1) * 4)) { mask[idx + 1] = 1; q[qt++] = idx + 1; }
      if (y > 0 && !mask[idx - w] && near((idx - w) * 4)) { mask[idx - w] = 1; q[qt++] = idx - w; }
      if (y < h - 1 && !mask[idx + w] && near((idx + w) * 4)) { mask[idx + w] = 1; q[qt++] = idx + w; }
    }
  } else { for (let i = 0; i < w * h; i++) if (near(i * 4)) mask[i] = 1; }   // 사진 전체에서 비슷한 색 모두
  for (let i = 0; i < w * h; i++) if (mask[i]) { d[i * 4 + 3] = 0; count++; }
  if (!count) return false;
  ctx.putImageData(img, 0, 0); if (cut.soft > 0) softenAlpha(p, cut.soft);
  return true;
}
function cutStamp(p, b, cx, cy, restore) {                          // 투명 지우개·되살리기: (cx,cy)에 둥근 붓자국 하나
  const k = (b.r - b.l) / p.w, rs = (cut.size / 100 * cv.width / 2) / k, sx = (cx - b.l) / k, sy = (cy - b.t) / k, ctx = p.canvas.getContext('2d'), f = Math.min(0.95, cut.soft / 10);
  const mask = (c, x, y) => { const g = c.createRadialGradient(x, y, 0, x, y, rs); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(Math.max(0, 1 - f), 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); return g; };
  if (!restore) { ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = mask(ctx, sx, sy); ctx.fillRect(sx - rs, sy - rs, rs * 2, rs * 2); ctx.restore(); }
  else if (p.orig) {
    const m = Math.ceil(rs * 2) + 2, t = document.createElement('canvas'); t.width = t.height = m;
    const tc = t.getContext('2d'); tc.drawImage(p.orig, sx - m / 2, sy - m / 2, m, m, 0, 0, m, m);
    tc.globalCompositeOperation = 'destination-in'; tc.fillStyle = mask(tc, m / 2, m / 2); tc.fillRect(0, 0, m, m);
    ctx.drawImage(t, sx - m / 2, sy - m / 2);
  }
}
const NS_SVG = 'http://www.w3.org/2000/svg';
function lassoDraw(cur) {                                           // 올가미 점·선을 미리보기 위에 그림
  let svg = document.getElementById('lassoSvg');
  if (!svg) { svg = document.createElementNS(NS_SVG, 'svg'); svg.id = 'lassoSvg'; svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:4'; svg.setAttribute('preserveAspectRatio', 'none'); layer.appendChild(svg); }
  svg.setAttribute('viewBox', '0 0 ' + cv.width + ' ' + cv.height);
  const pts = lasso.pts.slice(); if (cur && pts.length) pts.push(cur);
  const rr = 5 * cv.width / Math.max(1, cv.clientWidth);
  svg.innerHTML = pts.length ? '<polyline points="' + pts.map((q) => q.x + ',' + q.y).join(' ') + '" fill="rgba(47,140,255,.12)" stroke="#2f8cff" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>' +
    lasso.pts.map((q, i) => '<circle cx="' + q.x + '" cy="' + q.y + '" r="' + (i === 0 ? rr * 1.5 : rr) + '" fill="' + (i === 0 ? '#e5322d' : '#fff') + '" stroke="#2f8cff" stroke-width="2" vector-effect="non-scaling-stroke"/>').join('') : '';
}
function clearLasso() { lasso.pts = []; const svg = document.getElementById('lassoSvg'); if (svg) svg.innerHTML = ''; }
function closeLasso() {                                             // 올가미 선택을 끝내고 바깥(또는 안쪽)을 투명하게
  const ph = selPhoto(), b = ph && photoBoxOf(ph);
  if (!ph || !b || lasso.pts.length < 3) { clearLasso(); return; }
  const k = (b.r - b.l) / ph.w, poly = lasso.pts.map((pt) => { const q = unrotPt(b, pt); return { x: (q.x - b.l) / k, y: (q.y - b.t) / k }; });
  if (!ph.orig) ph.orig = cloneCanvas(ph.canvas);
  endStroke(); pushHist(ph);
  const ctx = ph.canvas.getContext('2d'), path = () => { ctx.beginPath(); poly.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); };
  if (cut.side === 'out') { const t = cloneCanvas(ph.canvas); ctx.clearRect(0, 0, ph.w, ph.h); ctx.save(); path(); ctx.clip(); ctx.drawImage(t, 0, 0); ctx.restore(); }
  else { ctx.save(); path(); ctx.globalCompositeOperation = 'destination-out'; ctx.fill(); ctx.restore(); }
  if (cut.soft > 0) softenAlpha(ph, cut.soft);
  clearLasso(); dropPrev(ph); presetFor = null; syncUI(); paint();
}
function cutDown(p, e) {
  const ph = selPhoto(), b = ph && photoBoxOf(ph); if (!b) return;
  const q = unrotPt(b, p), ins = frameInset(state), k = (b.r - b.l) / ph.w;
  if (cut.mode === 'lasso') {                                       // 올가미는 사진 밖에도 점을 찍을 수 있음
    if (p.x < 0 || p.x > cv.width || p.y < 0 || p.y > cv.height) return;
    const first = lasso.pts[0], tol = 12 * cv.width / Math.max(1, cv.clientWidth);
    if (lasso.pts.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) < tol) { closeLasso(); return; }
    lasso.pts.push({ x: p.x, y: p.y }); lassoDraw(); return;
  }
  const inPhoto = q.x >= b.l && q.x <= b.r && q.y >= b.t && q.y <= b.b, inFrame = p.x >= ins && p.x <= cv.width - ins && p.y >= ins && p.y <= cv.height - ins;
  if (!inPhoto || !inFrame) return;
  if (!ph.orig) ph.orig = cloneCanvas(ph.canvas);                   // 되살리기가 돌아갈 기준(누끼 따기 전 모습)
  endStroke(); pushHist(ph);
  if (cut.mode === 'wand') {
    if (!wandCut(ph, (q.x - b.l) / k, (q.y - b.t) / k)) { ph.hist.pop(); toast('지울 부분이 없습니다. 이미 투명하거나 비슷한 색 범위가 너무 좁습니다.'); refreshUndo(); return; }
    dropPrev(ph); presetFor = null; syncUI(); paint(); return;
  }
  stroke = { id: ph.id, last: q, cut: true };                       // 지우개·되살리기: 끌어서 칠함
  cutStamp(ph, b, q.x, q.y, cut.mode === 'restore');
  try { layer.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 끝남 */ }
  paint();
}
function cutMove(p) {
  const ph = selPhoto(), b = ph && photoBoxOf(ph), q = unrotPt(b, p);
  if (cut.mode === 'lasso') { if (lasso.pts.length) lassoDraw({ x: p.x, y: p.y }); return; }
  const brushy = cut.mode === 'erase' || cut.mode === 'restore';
  const inside = b && q.x >= b.l && q.x <= b.r && q.y >= b.t && q.y <= b.b;
  brushCur.style.display = brushy && (inside || stroke) ? 'block' : 'none';
  if (brushy) { const d = cut.size * 2 / 2; brushCur.style.left = p.x / cv.width * 100 + '%'; brushCur.style.top = p.y / cv.height * 100 + '%'; brushCur.style.width = cut.size + '%'; brushCur.style.aspectRatio = '1'; }
  if (!stroke || !stroke.cut || !ph || ph.id !== stroke.id) return;
  const rs = cut.size / 100 * cv.width / 2, dist = Math.hypot(q.x - stroke.last.x, q.y - stroke.last.y), step = Math.max(2, rs * 0.25), n = Math.max(1, Math.ceil(dist / step));
  for (let i = 1; i <= n; i++) cutStamp(ph, b, stroke.last.x + (q.x - stroke.last.x) * i / n, stroke.last.y + (q.y - stroke.last.y) * i / n, cut.mode === 'restore');
  stroke.last = q; draw();
}

/* ---------- 자유형 비율: 사진 틀(검정 테두리)의 변·모서리를 끌어 비율 조절 ---------- */
$('freeCenter').addEventListener('click', () => { freeCenter = !freeCenter; $('freeCenter').classList.toggle('on', freeCenter); $('freeCenter').setAttribute('aria-pressed', freeCenter ? 'true' : 'false'); });
let freeDrag = null, freeCenter = true;   // freeCenter: 위아래를 가운데 기준으로(양쪽이 함께) 조절
['t', 'b', 'l', 'r', 'tl', 'tr', 'bl', 'br'].forEach((e) => {
  const h = document.createElement('div'); h.className = 'fh'; h.dataset.e = e; h.title = '끌어서 비율 조절';
  h.addEventListener('pointerdown', (ev) => {
    ev.stopPropagation(); ev.preventDefault();
    if (tool !== 'move') setTool('move');
    endEdit(); try { h.setPointerCapture(ev.pointerId); } catch (err) { /* 포인터가 이미 끝남 */ } h.classList.add('drag');
    freeDrag = { e, x0: ev.clientX, y0: ev.clientY, w0: cv.clientWidth, h0: cv.clientHeight, lastH: cv.clientHeight, vCy0: (() => { const r = cv.getBoundingClientRect(); return (r.top + r.bottom) / 2; })(), el: h };   // vCy0: 끌기 시작 때 캔버스 가운데의 화면 위치
  });
  h.addEventListener('pointermove', (ev) => {
    if (!freeDrag || freeDrag.el !== h) return;
    const d = freeDrag, dx = ev.clientX - d.x0, dy = ev.clientY - d.y0;
    const maxW = document.querySelector('.stage').clientWidth;      // 가로는 가운데 정렬이라 양쪽이 함께 움직이므로 2배
    const center = freeCenter !== ev.altKey, vy = d.e.includes('b') ? dy : d.e.includes('t') ? -dy : 0;   // 가운데 기준이면 위·아래가 함께 움직이므로 세로도 2배
    const w = Math.min(maxW, d.w0 + (d.e.includes('r') ? 2 * dx : d.e.includes('l') ? -2 * dx : 0)), hh = d.h0 + (center ? 2 * vy : vy);
    if (w < 120 || hh < 60) return;
    freeW = w; cv.style.width = w + 'px';
    const a = Math.min(FREE_MAX, Math.max(FREE_MIN, hh / w));      // 세로/가로 비율. 출력 가로는 1080 고정, 세로만 변함
    { const i2 = frameInset(state); RATIOS.free[1] = Math.max(2, Math.round(a * (RATIOS.free[0] + 2 * i2) - 2 * i2)); }   // 캔버스(테두리 포함) 비율 a 에서 출력 세로를 역산
    if (center) {                                                   // 늘어난 높이의 절반만큼 화면을 스크롤해서 캔버스의 가운데가 제자리에 보이게 함
      paint(); const r = cv.getBoundingClientRect(), want = (r.top + r.bottom) / 2 - d.vCy0;   // 가운데가 화면에서 시작 위치보다 얼마나 내려갔는지(레이아웃이 어떻든 실제로 재서 보정). want>0: 내용을 위로 올려야 함
      const st = document.querySelector('.stage'); let pad = parseFloat(st.style.marginTop) || 0;
      if (want > 0) { const take = Math.min(pad, want); pad -= take; const y0 = window.scrollY; window.scrollBy(0, want - take); }   // 먼저 위쪽 여백을 줄이고, 남는 만큼 스크롤
      else if (want < 0) { const y0 = window.scrollY; window.scrollBy(0, want); pad += -(want - (window.scrollY - y0)); }            // 맨 위라서 스크롤이 모자라면 부족한 만큼 위쪽 여백으로 보충
      st.style.marginTop = pad > 0.5 ? pad + 'px' : '';
    } else draw();
  });
  const end = () => { if (freeDrag) { freeDrag.el.classList.remove('drag'); freeDrag = null; } };
  h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  layer.appendChild(h);
});

function toast(msg, kind = 'warn') {
  const t = $('toast'); t.className = 'msg ' + kind; t.textContent = msg; t.style.display = 'block';
  clearTimeout(toast.t); toast.t = setTimeout(() => { t.style.display = 'none'; }, 3500);
}
function setMsg(id, msg, kind) { const e = $(id); e.className = 'msg ' + kind; e.textContent = msg; }

/* ---------- 입력 검증: 잘못된 값은 거부하고 기존 편집 내용을 유지 ---------- */
const BOUNDS = { x: [0, 100], y: [0, 100], s: [2, 20], bgClear: [0, 100], op: [0, 100], ls: [-5, 30], lh: [100, 250], sh: [0, 100], ol: [0, 20] };
function setParam(key, raw) {
  const bad = (m, kind = 'bad') => { setMsg('textMsg', m, kind); $('textMsg').classList.remove('hide'); syncUI(); return false; };
  if (key === 'ratio') { if (!RATIOS[raw]) return false; state.ratio = raw; save(); syncUI(); draw(); return true; }
  const it = selItem();
  if (!it) return bad('먼저 문구를 선택하거나 추가해 주세요.');
  checkpoint('p:' + key + ':' + it.id);                          // 되돌리기 기록(슬라이더는 끄는 동안 한 번만)
  if (key === 'text') {
    let v = String(raw ?? '');
    if (v.length > MAX_TEXT) { v = v.slice(0, MAX_TEXT); bad(`문구는 ${MAX_TEXT}자까지만 반영됩니다.`, 'warn'); }
    else $('textMsg').classList.add('hide');
    it.text = v;
  } else if (key === 'blend') {
    if (!BLENDS.some((b) => b[0] === raw)) return bad('지원하지 않는 혼합 모드라 이전 값을 유지합니다.');
    it.blend = raw === 'normal' ? undefined : raw; $('textMsg').classList.add('hide');
  } else if (['b', 'i', 'u', 'st', 'grad'].includes(key)) {
    it[key] = !!raw; $('textMsg').classList.add('hide');
  } else if (key === 'align') {
    if (!['left', 'center', 'right'].includes(raw)) return bad('지원하지 않는 정렬이라 이전 값을 유지합니다.');
    it.align = raw; $('textMsg').classList.add('hide');
  } else if (key === 'font') {
    if (!FONTS[raw]) return bad('지원하지 않는 글꼴이라 이전 글꼴을 유지합니다.');
    it.font = raw; $('textMsg').classList.add('hide');
  } else if (key === 'bgOn') {
    it.bgOn = !!raw; $('textMsg').classList.add('hide');
  } else if (key === 'bgColor') {
    if (!/^#[0-9a-f]{6}$/i.test(String(raw))) return bad('올바른 색이 아니어서 이전 배경색을 유지합니다.');
    it.bgColor = String(raw).toLowerCase(); $('textMsg').classList.add('hide');
  } else if (['color', 'shColor', 'olColor', 'color2'].includes(key)) {
    if (!/^#[0-9a-f]{6}$/i.test(String(raw))) return bad('올바른 색이 아니어서 이전 색을 유지합니다.');
    it[key] = String(raw).toLowerCase(); $('textMsg').classList.add('hide');
  } else {
    const n = typeof raw === 'string' && raw.trim() === '' ? NaN : Number(raw);
    const [lo, hi] = BOUNDS[key];
    if (!Number.isFinite(n) || n < lo || n > hi) return bad(`${lo}~${hi} 범위의 값만 쓸 수 있어 이전 값을 유지합니다.`);
    it[key] = n; $('textMsg').classList.add('hide');
  }
  save(); syncUI(); draw(); return true;
}
$('s').addEventListener('input', (e) => setParam('s', e.target.value));
Object.entries(FONTS).forEach(([k, [name, fam]]) => { const o = document.createElement('option'); o.value = k; o.textContent = name; o.style.fontFamily = fam; $('fontSel').appendChild(o); });
$('fontSel').addEventListener('change', (e) => setParam('font', e.target.value));
$('bgToggle').addEventListener('click', () => { const it = selItem(); setParam('bgOn', it ? !it.bgOn : false); });   // 한 버튼으로 비적용 ↔ 적용
$('bga').addEventListener('input', (e) => setParam('bgClear', e.target.value));
$('bgc').addEventListener('input', (e) => setParam('bgColor', e.target.value));
$('c').addEventListener('input', (e) => setParam('color', e.target.value));
document.querySelectorAll('.ratio').forEach((b) => b.addEventListener('click', () => {
  endEdit();
  if (b.dataset.ratio === 'free' && state.ratio !== 'free') { RATIOS.free[1] = RATIOS[state.ratio][1]; freeW = cv.clientWidth; }   // 지금 비율에서 이어서 조절 시작
  setParam('ratio', b.dataset.ratio);
}));

/* ---------- 전체 되돌리기·다시 실행 (문구·도형·사진의 위치/크기/보정·배경). 사진 픽셀 작업(자르기·붓·회전)은 사진별 '이전' 기록을 씀 ---------- */
let SEQ = 0, docHist = [], docRedo = [], lastCk = { key: '', t: 0 };
const DOC_MAX = 100;
const snapDoc = () => ({ seq: ++SEQ, items: JSON.stringify(state.items), adj: state.adj ? { ...state.adj } : null, clear: num(state.clear, 0), photos: state.photos.map((p) => ({ p, x: p.x, y: p.y, scale: p.scale, rot: num(p.rot, 0), pclr: num(p.pclr, 0), z: p.z, locked: !!p.locked, blend: p.blend, mask: p.mask, adj: p.adj ? { ...p.adj } : p.adj })), bgColor: state.bgColor, bg: state.bg, sel: state.sel, ratio: state.ratio, freeH: RATIOS.free[1] });
const docKey = (d) => d.items + '|' + JSON.stringify(d.adj) + '|' + d.clear + '|' + d.photos.map((o) => [o.p.id, o.x, o.y, o.scale, o.rot, o.pclr, o.z, o.locked, o.blend, o.mask, JSON.stringify(o.adj)].join()).join(';') + '|' + d.bgColor + '|' + (d.bg ? d.bg.id : '') + '|' + d.ratio + '|' + d.freeH;
function checkpoint(key = '') {                 // 바꾸기 직전 상태를 기록
  const now = Date.now();
  if (key && key === lastCk.key && now - lastCk.t < 800) { lastCk.t = now; return; }   // 슬라이더를 끄는 동안은 한 번만 기록
  lastCk = { key, t: now };
  docHist.push(snapDoc()); if (docHist.length > DOC_MAX) docHist.shift(); docRedo = [];
  refreshUndo();
}
function restoreDoc(d) {
  endEdit(); revealedLock = null;
  state.items = JSON.parse(d.items); state.adj = d.adj ? { ...d.adj } : null; state.clear = num(d.clear, 0);
  state.photos = d.photos.map((o) => { Object.assign(o.p, { x: o.x, y: o.y, scale: o.scale, rot: o.rot, pclr: o.pclr, z: o.z, locked: o.locked, blend: o.blend, mask: o.mask, adj: o.adj }); return o.p; });
  if (d.ratio && RATIOS[d.ratio]) { state.ratio = d.ratio; RATIOS.free[1] = d.freeH || RATIOS.free[1]; }   // 화면비·자동 재배치도 되돌림
  state.bgColor = d.bgColor; state.bg = d.bg; $('bgPick').value = state.bgColor; renderTplButtons();
  state.sel = [...state.items, ...state.photos].some((q) => q.id === d.sel && !q.locked) ? d.sel : null;   // 잠긴 사진은 선택하지 않음
  if (tool !== 'move' && !selPhoto()) setTool('move');
  presetFor = null; syncUI(); paint();
}
function undoDoc() {
  const cur = snapDoc(), key = docKey(cur);
  while (docHist.length) { const d = docHist.pop(); if (docKey(d) !== key) { docRedo.push(cur); restoreDoc(d); return; } }   // 바뀐 게 없는 기록은 건너뜀
}
function redoDoc() { const d = docRedo.pop(); if (!d) return; docHist.push(snapDoc()); restoreDoc(d); }
function refreshUndo() { const p = selPhoto(); $('undoBtn').disabled = !(docHist.length || (p && p.hist && p.hist.length)); }   // "이전" 버튼: 되돌릴 것이 있을 때만 켜짐
$('undoBtn').addEventListener('click', () => undoAny());
function undoAny() {                            // 사진 픽셀 기록과 전체 기록 중 더 최근 것을 되돌림
  const p = selPhoto(), px = p && p.hist && p.hist.length ? p.hist[p.hist.length - 1].seq || 0 : -1, dx = docHist.length ? docHist[docHist.length - 1].seq : -1;
  if (px > dx) undoPhoto(); else undoDoc();
}

/* ---------- 복사 (복제) ---------- */
function duplicateSel() {
  const it = selItem(), ph = selPhoto(); if (!it && !ph) return;
  endEdit(); checkpoint();
  if (it) { const n = { ...JSON.parse(JSON.stringify(it)), locked: false, id: uid(), x: Math.min(100, it.x + 4), y: Math.min(100, it.y + 4) }; if (Number.isFinite(it.z)) n.z = it.z + 0.5; state.items.push(n); state.sel = n.id; }
  else {
    const n = { ...ph, id: uid(), canvas: cloneCanvas(ph.canvas), orig: ph.orig ? cloneCanvas(ph.orig) : null, hist: [], base: null, bbox: undefined, z: Number.isFinite(ph.z) ? ph.z + 0.5 : undefined, adj: ph.adj ? { ...ph.adj } : ph.adj, x: Math.min(100, ph.x + 4), y: Math.min(100, ph.y + 4), locked: false };
    delete n.prev; delete n.prevSrc; delete n.prevKey; state.photos.push(n); state.sel = n.id;
  }
  syncUI(); paint();
}
$('dupBtn').addEventListener('click', duplicateSel);

/* ---------- 사진 회전·반전 (픽셀 작업이라 '이전'으로 취소) ---------- */
function transformPhoto(kind) {
  const p = selPhoto(); if (!p) return;
  endStroke(); if (tool !== 'move') setTool('move');
  pushHist(p);
  const apply = (src) => {
    const w = src.width, hh = src.height, rot = kind === 'rot', c = document.createElement('canvas');
    c.width = rot ? hh : w; c.height = rot ? w : hh;
    const x = c.getContext('2d');
    if (rot) { x.translate(hh, 0); x.rotate(Math.PI / 2); } else if (kind === 'flipH') { x.translate(w, 0); x.scale(-1, 1); } else { x.translate(0, hh); x.scale(1, -1); }
    x.drawImage(src, 0, 0); x.setTransform(1, 0, 0, 1, 0, 0); return c;   // 변환을 되돌려 둠(안 그러면 이후 그리기가 뒤집힌 좌표로 그려짐)
  };
  p.canvas = apply(p.canvas); if (p.orig) p.orig = apply(p.orig);
  if (kind === 'rot') [p.w, p.h] = [p.h, p.w];
  p.bbox = undefined; dropPrev(p); presetFor = null; syncUI(); paint();
}
$('rotPhoto').addEventListener('click', () => transformPhoto('rot'));
$('flipH').addEventListener('click', () => transformPhoto('flipH'));
$('flipV').addEventListener('click', () => transformPhoto('flipV'));

/* ---------- 문구 모양·정렬·간격·불투명도 ---------- */
$('opSl').addEventListener('input', (e) => setParam('op', e.target.value));
$('lsSl').addEventListener('input', (e) => setParam('ls', e.target.value));
$('lhSl').addEventListener('input', (e) => setParam('lh', e.target.value));
document.querySelectorAll('#fmtSeg button').forEach((b) => b.addEventListener('click', () => {
  const it = selItem(), k = b.dataset.k; if (!it) return;
  setParam(k, k === 'b' ? it.b === false : !it[k]);              // 굵게는 기본이 켜짐
}));
document.querySelectorAll('#alignSeg button').forEach((b) => b.addEventListener('click', () => setParam('align', b.dataset.a)));

/* ---------- 도형·스티커 ---------- */
const STICKER_CATS = {   // 이모지 스티커(분류별). 오래된 PC에서도 보이도록 비교적 널리 지원되는 이모지만 사용
  '하트·반짝임': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💕', '💖', '💗', '💘', '💝', '💞', '💓', '💔', '❣️', '💟', '⭐', '🌟', '✨', '💫', '💥', '🔥', '⚡', '💋', '🎇'],
  '자연·날씨': ['🌼', '🌸', '🌷', '🌻', '🌹', '🌺', '💐', '🍀', '🌿', '🌱', '🌾', '🍁', '🍂', '🍃', '🌵', '🌲', '🌳', '🌴', '🍄', '🌈', '☀️', '🌤️', '⛅', '☁️', '🌧️', '⛈️', '❄️', '⛄', '🌙', '🌕', '🌊', '💧', '🌍', '🪐'],
  '동물': ['🐱', '🐶', '🐰', '🐻', '🐼', '🐨', '🦊', '🐸', '🐷', '🐥', '🐧', '🐦', '🦋', '🐝', '🐞', '🐢', '🐬', '🐳', '🦄', '🐙', '🦉', '🐯', '🦁', '🐮', '🐵', '🐹', '🐭', '🐔', '🦆', '🦢', '🐠', '🦀', '🐌', '🦔'],
  '음식·카페': ['🍓', '🍒', '🍑', '🍋', '🍉', '🍇', '🍎', '🍊', '🍌', '🍍', '🥑', '🥕', '🌽', '🍕', '🍔', '🍟', '🌭', '🥪', '🍜', '🍣', '🍱', '🍙', '🍩', '🍰', '🧁', '🍪', '🍫', '🍦', '🍭', '🍬', '☕', '🧋', '🍵', '🥤', '🍺', '🍷'],
  '소품·취미': ['🎀', '🎁', '🎈', '🎉', '👑', '💎', '📷', '🎧', '🎵', '🎶', '🎨', '🧸', '📚', '💌', '🕯️', '🔮', '🎮', '🎬', '🎤', '🎸', '🎹', '🎺', '🥁', '🖼️', '🧩', '🎭'],
  '표정·손짓': ['😊', '😎', '😍', '🥳', '😴', '😭', '🤩', '🤔', '😂', '😜', '🥰', '😇', '😡', '😱', '😘', '😋', '😏', '🙄', '😅', '😢', '🤗', '👍', '👏', '🙌', '✌️', '🙏', '💪', '👌', '🤞', '👋', '🤟', '🖐️'],
  '운동·게임': ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏓', '🏸', '🥊', '⛳', '🎯', '🎳', '🎲', '♟️', '🕹️', '🏆', '🥇', '🥈', '🥉', '🏅', '🚴', '🏊', '🧗', '⛷️'],
  '일상·사무': ['📱', '💻', '⌨️', '🖥️', '📞', '⏰', '⌚', '💡', '🔋', '📝', '✏️', '🖊️', '📌', '📎', '✂️', '📅', '📦', '🔑', '🔒', '🛒', '💰', '💳', '📢', '🔔'],
  '의상·뷰티': ['👗', '👚', '👕', '👖', '🧥', '🧣', '🧤', '🧢', '👒', '👓', '🕶️', '👜', '🎒', '👟', '👠', '💄', '💍', '💅', '👙'],
  '파티·기념일': ['🎂', '🎊', '🎆', '🎇', '🥂', '🍾', '🎄', '🎃', '🎓', '🏆', '🥇', '💐', '🎅', '🕊️', '🧧', '🎍', '🎎', '🎐', '🎏', '🎑', '🎋'],
  '여행·장소': ['✈️', '🚗', '🚲', '🚌', '🚂', '🚢', '⛵', '🛵', '🚀', '🏝️', '🏖️', '🗼', '🗽', '🎡', '🎢', '🏠', '🏡', '🏰', '⛺', '🌃', '🌄', '🌅', '🗺️', '🧳', '📍', '⛰️', '🗻', '🏞️'],
  '기호·말풍선': ['💬', '💭', '🗯️', '❗', '❓', '‼️', '⁉️', '💯', '🆗', '🆒', '🆕', '🔔', '✔️', '✅', '❌', '⚠️', '🚫', '➡️', '⬆️', '⬇️', '⬅️', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '♻️', '➕', '➖'],
  '숫자·글자': ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔤', '🔠', '🅰️', '🅱️', '🆎', '🅾️', 'ℹ️', 'Ⓜ️', '🔝', '🔜', '🔙', '🔛', '🆙'],
};
let stickerCat = Object.keys(STICKER_CATS)[0];
Object.entries(SHAPES).forEach(([k, [name, path]]) => {
  const b = document.createElement('button'); b.type = 'button'; b.title = name + ' 추가'; b.setAttribute('aria-label', name + ' 추가');
  const c = document.createElement('canvas'); c.width = c.height = 56; c.style.width = c.style.height = '28px';
  const x = c.getContext('2d'); x.translate(28, 28); x.scale(40, 40); x.fillStyle = '#4a4a4c'; x.beginPath(); path(x); x.fill();
  b.appendChild(c); b.addEventListener('click', () => { const it = addItem({ shape: k, text: '', s: 7, color: '#ff5a7a' }); state.sel = it.id; syncUI(); paint(); });
  $('shapeRow').appendChild(b);
});
function showStickers(name) {                                     // 분류 버튼을 누르면 그 분류의 스티커를 보여 줌
  stickerCat = name;
  document.querySelectorAll('#stickerCats button').forEach((b) => b.classList.toggle('on', b.dataset.cat === name));
  const row = $('stickerRow'); row.replaceChildren();
  STICKER_CATS[name].forEach((e) => {
    const b = document.createElement('button'); b.type = 'button'; b.title = '스티커 추가'; b.setAttribute('aria-label', e + ' 스티커 추가'); b.textContent = e;
    b.addEventListener('click', () => { const it = addItem({ text: e, s: 14 }); state.sel = it.id; syncUI(); paint(); });   // 이모지는 문구와 같은 방식으로 그려짐
    row.appendChild(b);
  });
}
Object.keys(STICKER_CATS).forEach((name) => {
  const b = document.createElement('button'); b.type = 'button'; b.className = 'catbtn'; b.dataset.cat = name; b.textContent = name; b.title = '스티커 ' + STICKER_CATS[name].length + '개';
  b.addEventListener('click', () => showStickers(name)); $('stickerCats').appendChild(b);
});
showStickers(stickerCat);

/* ---------- 배경색 (템플릿 대신 단색 배경) ---------- */
$('bgPick').addEventListener('input', (e) => {
  checkpoint('bgc'); state.bgColor = e.target.value;
  if (state.bg) { state.bg = null; renderTplButtons(); setMsg('tplMsg', '템플릿 배경을 해제하고 단색을 적용했습니다.', 'ok'); }
  draw();
});

/* ---------- 포토샵 단축키 ----------
 * Ctrl+Z 되돌리기 · Ctrl+Y / Ctrl+Shift+Z 다시 실행 · Ctrl+J 복사 · Ctrl+D 선택 해제
 * Ctrl+S PNG 저장 · Ctrl+Shift+S JPEG 저장 · Ctrl+O 이미지 불러오기 · Ctrl+; (또는 ') 안내선 · Ctrl+/ 잠금 · Ctrl+Shift+X 터치 보정(위쪽 처리기)
 * V 이동·크기 · C 자르기 · B 그리기(펜) · E 지우개 · T 문구 입력칸 · [ ] 펜·지우개 크기 · 0~9 불투명도(0=100%) · Enter/Esc 자르기 적용/취소 · 방향키 미세 이동(Shift 크게) */
document.addEventListener('keydown', (e) => {
  const el = document.activeElement, tag = el ? el.tagName : '', type = el ? el.type : '';
  const typing = tag === 'TEXTAREA' || (tag === 'INPUT' && !/^(range|color|checkbox|radio|file|button)$/.test(type));
  const mod = e.ctrlKey || e.metaKey, dlgOn = $('dlg').classList.contains('on');
  if (mod && !e.altKey && !dlgOn && (e.code === 'KeyS' || e.code === 'KeyO')) {      // 입력 중이어도 브라우저의 저장·열기 창 대신 앱 기능을 씀
    e.preventDefault(); endEdit();
    if (e.code === 'KeyS') exportAs(e.shiftKey ? 'image/jpeg' : 'image/png'); else $('file').click();
    return;
  }
  if (typing || state.editing || dlgOn) return;
  const k = e.key.toLowerCase(), code = e.code;
  if (mod && !e.altKey) {
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undoAny(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redoDoc(); }
    else if (k === 'j') { e.preventDefault(); duplicateSel(); }                      // 복사
    else if (k === 'd') { e.preventDefault(); endStroke(); revealedLock = null; state.sel = null; syncUI(); paint(); }   // 선택 해제
    else if (code === 'Semicolon' || code === 'Quote') { e.preventDefault(); $('guideBtn').click(); }
    else if (code === 'Slash') { e.preventDefault(); $('lockBtn').click(); }
    return;
  }
  if (e.altKey) return;
  if (!e.shiftKey) {
    const ph = selPhoto();
    if (k === 'v') { e.preventDefault(); setTool('move'); return; }
    if (k === 'c' || k === 'b' || k === 'e') {
      e.preventDefault();
      if (!ph) { toast('먼저 사진이나 그림을 선택해 주세요.'); return; }
      if (k === 'c' && ph.blank) { toast('그림은 자를 수 없습니다.'); return; }
      if (k === 'c') setTool('crop');
      else { setTool('brush'); document.querySelector('#brushMode [data-m="' + (k === 'e' ? 'erase' : 'pen') + '"]').click(); }
      return;
    }
    if (k === 'w' || k === 'l') {                                    // W 색 지우기(마술봉) · L 올가미 — 누끼
      e.preventDefault();
      if (!ph) { toast('먼저 사진을 선택해 주세요.'); return; }
      if (ph.blank) { toast('그림에는 배경 지우기를 쓸 수 없습니다.'); return; }
      setTool('cut'); cut.mode = k === 'w' ? 'wand' : 'lasso'; syncCutUI(); return;
    }
    if (k === 't') { e.preventDefault(); $('newText').focus(); return; }
    if ((code === 'BracketLeft' || code === 'BracketRight') && (tool === 'brush' || (tool === 'cut' && (cut.mode === 'erase' || cut.mode === 'restore')))) {   // 펜·지우개 크기
      e.preventDefault(); const sl = $(tool === 'cut' ? 'cutSize' : brush.mode === 'erase' ? 'eraseSize' : 'brushSize');
      sl.value = Math.min(100, Math.max(1, Number(sl.value) + (code === 'BracketRight' ? 5 : -5))); sl.dispatchEvent(new Event('input', { bubbles: true })); return;
    }
    if (/^[0-9]$/.test(k) && selItem()) { e.preventDefault(); setParam('op', k === '0' ? 100 : Number(k) * 10); return; }   // 불투명도
    if (tool === 'cut' && cut.mode === 'lasso' && lasso.pts.length && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); if (e.key === 'Enter') closeLasso(); else clearLasso(); return; }
    if (tool === 'crop' && tag !== 'BUTTON' && (e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); $(e.key === 'Enter' ? 'cropOk' : 'cropCancel').click(); return; }
  }
  if (/^arrow/.test(k) && state.sel && tool === 'move' && tag !== 'SELECT' && !(tag === 'INPUT' && /^(range|color)$/.test(type))) {
    const it = selItem() || selPhoto(); if (!it) return;
    const d = e.shiftKey ? 2 : 0.5, dx = k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0, dy = k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0;
    e.preventDefault(); checkpoint('arrow');
    it.x = Math.min(100, Math.max(0, it.x + dx)); it.y = Math.min(100, Math.max(0, it.y + dy)); draw();
  }
});

/* ---------- 잠금: 이미지·그림을 고정하고, 오른쪽 위 꼭짓점의 자물쇠 아이콘으로 해제 ---------- */
const lockBtns = new Map();   // 항목 id → 해제 아이콘 버튼
let revealedLock = null;      // 잠긴 항목을 클릭하면 그 항목의 해제 아이콘만 보임(다른 곳을 누르면 숨김)
const UNLOCK_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#2c2c2e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 017.5-2"/></svg>';
function syncLocks() {                                              // 잠긴 사진·문구·도형마다 오른쪽 위 꼭짓점에 해제 아이콘을 둠(항상 틀 안에서 누를 수 있게 위치를 제한)
  const locked = [...state.photos, ...state.items].filter((q) => q.locked && q.id === revealedLock), keep = new Set(), placed = [];
  locked.forEach((q) => {
    const b = lastBoxes.find((z) => z.id === q.id); if (!b || b.r - b.l <= 0) return;
    const ins = frameInset(state);
    const sb = b.kind === 'photo' ? selBoxFor(q, b) : b;               // 선택 상자(기울기 반영)
    let cx0 = sb.r, cy0 = sb.t;                                        // 안 기울어진 사진: 보이는 영역의 오른쪽 위 / 그 밖: (기울어진) 상자의 오른쪽 위 꼭짓점
    if (sb.rot) { const mx = (sb.l + sb.r) / 2, my = (sb.t + sb.b) / 2, an = sb.rot * Math.PI / 180, dx = sb.r - mx, dy = sb.t - my; cx0 = mx + dx * Math.cos(an) - dy * Math.sin(an); cy0 = my + dx * Math.sin(an) + dy * Math.cos(an); }
    else if (b.kind === 'photo') { const v = visRect(sb); cx0 = v.r; cy0 = v.t; }
    const x = Math.min(cv.width - ins, Math.max(ins + 36, cx0)), y = Math.min(cv.height - ins - 36, Math.max(ins, cy0));
    const k = cv.clientWidth / cv.width; let off = 0;                  // off: 화면 px(아이콘이 겹치면 옆으로 비킴)
    while (placed.some((pp) => Math.abs(pp.x - (x * k - off)) < 30 && Math.abs(pp.y - y * k) < 30)) off += 34;
    placed.push({ x: x * k - off, y: y * k });
    let btn = lockBtns.get(q.id);
    if (!btn) {
      btn = document.createElement('button'); btn.type = 'button'; btn.className = 'unlockBtn'; btn.innerHTML = UNLOCK_SVG;
      btn.addEventListener('pointerdown', (e) => e.stopPropagation());
      const id = q.id;                                                 // 되돌리기로 문구 객체가 바뀔 수 있어 id로 다시 찾음
      btn.addEventListener('click', (e) => { e.stopPropagation(); const cur = [...state.photos, ...state.items].find((o) => o.id === id); if (!cur) return; checkpoint(); cur.locked = false; revealedLock = null; state.sel = id; syncUI(); paint(); toast('잠금을 해제했습니다.', 'ok'); });
      layer.appendChild(btn); lockBtns.set(q.id, btn);
    }
    btn.title = (q.name || (q.shape ? SHAPES[q.shape][0] : q.text ? String(q.text).slice(0, 8) : '사진')) + ' 잠금 해제'; btn.setAttribute('aria-label', btn.title);
    btn.style.left = `calc(${x / cv.width * 100}% - ${off}px)`; btn.style.top = (y / cv.height * 100) + '%';
    keep.add(q.id);
  });
  for (const [id, btn] of lockBtns) if (!keep.has(id)) { btn.remove(); lockBtns.delete(id); }
}
$('lockBtn').addEventListener('click', () => {
  const tg = selItem() || selPhoto(); if (!tg || tg.locked) return;
  endEdit(); endStroke(); if (tool !== 'move') setTool('move');
  checkpoint(); tg.locked = true; revealedLock = null; state.sel = null; syncUI(); paint();
  toast('잠갔습니다. 잠긴 항목을 클릭하면 나타나는 자물쇠 아이콘으로 해제합니다.', 'ok');
});

/* ---------- 문구 추가·입력칸·끌어서 이동 ---------- */
let editW = 0;   // 편집 시작 때의 글자 상자 가로(캔버스 px, 늘이기 전 기준)
function placeInput(it) {
  const k = cv.clientWidth / cv.width;
  inp.style.width = editW ? Math.min(78, Math.max(30, (editW * k + 40) / cv.clientWidth * 100)) + '%' : '';   // 늘어난 상자가 화면을 덮지 않도록 원래 글자 폭에 맞춤
  inp.style.textAlign = it.align || 'center'; inp.style.fontWeight = it.b === false ? 400 : 800; inp.style.fontStyle = it.i ? 'italic' : 'normal';
  inp.style.textDecoration = [it.u ? 'underline' : '', it.st ? 'line-through' : ''].join(' ').trim() || 'none';
  inp.style.lineHeight = clampN(it.lh, 100, 250, 130) / 100; inp.style.letterSpacing = clampN(it.ls, -5, 30, 0) / 100 + 'em'; inp.style.opacity = '';
  inp.style.left = it.x + '%'; inp.style.top = it.y + '%';                              // 글자 가운데 위치 그대로
  inp.style.transform = `translate(-50%,-50%) rotate(${num(it.rot, 0)}deg) scale(${stretchOf(it.sx)},${stretchOf(it.sy)})`;   // 기울기·늘이기도 그대로 보임
  inp.style.fontFamily = (FONTS[it.font] || FONTS.gothic)[1]; inp.style.fontSize = (Math.min(30, Math.max(2, it.s)) / 100 * cv.width * k) + 'px';   // 입력 중 색은 CSS로 고정(흰 배경 + 검정 글자)
  inp.style.height = 'auto'; inp.style.height = inp.scrollHeight + 'px';
}
function startEdit(it) {
  const bx = lastBoxes.find((q) => q.id === it.id); editW = bx ? (bx.r - bx.l) / stretchOf(it.sx) : 0;
  state.sel = it.id; state.editing = it.id;
  inp.classList.remove('hide'); inp.value = it.text; inp.placeholder = '문구를 입력하세요'; placeInput(it);
  syncUI(); paint(); inp.focus();
}
function endEdit() {
  if (!state.editing) return;
  const it = state.items.find((i) => i.id === state.editing);
  state.editing = null; inp.classList.add('hide');
  if (it && it.text.trim() === '') { state.items = state.items.filter((i) => i !== it); if (state.sel === it.id) state.sel = null; }
  save(); syncUI(); paint();
}
function addItem(props = {}) { endEdit(); checkpoint(); const it = { ...ITEM, ...props, id: uid() }; state.items.push(it); return it; }
function removeSel() { if (!selItem() && !selPhoto()) return; const id = state.sel; endEdit(); checkpoint(); state.items = state.items.filter((i) => i.id !== id); state.photos = state.photos.filter((p) => p.id !== id); state.sel = null; syncUI(); paint(); }
function bakeStretch(p) {                                            // 끌어서 늘인 가로·세로 배율을 사진 픽셀(canvas·orig)에 굳힘 → 이후 도구·저장이 같은 모양을 씀. 화면에 보이는 크기는 scale을 보정해 그대로 유지
  const fx = num(p.dsx, 1), fy = num(p.dsy, 1); p.dsx = 1; p.dsy = 1;
  if (Math.abs(fx - 1) < 0.005 && Math.abs(fy - 1) < 0.005) { paint(); return; }
  const [W, H] = canvasDims(state), ins = frameInset(state), cover = (w, h) => Math.max((W - 2 * ins) / w, (H - 2 * ins) / h);
  const nw = Math.min(6000, Math.max(8, Math.round(p.w * fx))), nh = Math.min(6000, Math.max(8, Math.round(p.h * fy)));
  const kOld = cover(p.w, p.h);
  endStroke(); pushHist(p);                                         // "이전"으로 취소할 수 있게 먼저 기록
  const resample = (src) => { const c = document.createElement('canvas'); c.width = nw; c.height = nh; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, nw, nh); return c; };
  p.canvas = resample(p.canvas); if (p.orig) p.orig = resample(p.orig);
  p.w = nw; p.h = nh; p.scale = Math.min(300, Math.max(10, kOld * p.scale / cover(nw, nh)));
  p.bbox = undefined; dropPrev(p); presetFor = null; syncUI(); paint();
}
function setPhotoScale(p, n) {                                       // 사진 크기 바꾸기. 빈 그림판은 그림(그려진 부분) 가운데가 제자리에 있게 위치도 보정
  const pb = p.blank && photoBoxOf(p), bi = pb && bboxCenterInfo(p, pb), old = p.scale;
  if (bi && old > 0) { const r = n / old; p.x = (bi.bx - bi.ox * r) / cv.width * 100; p.y = (bi.by - bi.oy * r) / cv.height * 100; }
  p.scale = n;
}
$('ps').addEventListener('input', (e) => { const p = selPhoto(), n = Number(e.target.value); if (p && Number.isFinite(n) && n >= 10 && n <= 300) { checkpoint('ps' + p.id); setPhotoScale(p, n); syncUI(); draw(); } });
const newText = $('newText');
newText.addEventListener('focus', () => { newText.placeholder = ''; });          // 누르면 안내 문구 사라짐
newText.addEventListener('blur', () => { newText.placeholder = '문구 입력...'; });
function addFromInput() {
  const v = newText.value.trim();
  if (!v) { setMsg('textMsg', '추가할 문구를 먼저 입력해 주세요.', 'warn'); $('textMsg').classList.remove('hide'); newText.focus(); return; }
  const it = addItem({ text: v.slice(0, MAX_TEXT) });
  state.sel = it.id; newText.value = ''; $('textMsg').classList.add('hide'); save(); syncUI(); paint();
}
$('addText').addEventListener('click', addFromInput);
$('resetStretch').addEventListener('click', () => { const it = selItem(); if (!it) return; checkpoint(); it.sx = 1; it.sy = 1; syncUI(); paint(); });   // 늘이기 초기화
$('resetRot').addEventListener('click', () => { const it = selItem(); if (!it) return; checkpoint(); it.rot = 0; syncUI(); paint(); });   // 기울기 초기화
newText.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addFromInput(); } });
/* 삭제 확인 창: 취소 / 삭제 */
const dlg = $('dlg');
function confirmDelete(msg, onOk, title = '삭제하기', okLabel = '삭제') {   // 삭제·닫기 확인창 공용
  $('dlgTitle').textContent = title; $('dlgOk').textContent = okLabel; $('dlgOk').classList.toggle('safe', !/삭제|닫기/.test(okLabel));   // 삭제·닫기만 빨간 버튼, 복구·열기는 파란 버튼
  $('dlgMsg').textContent = msg; dlg.classList.add('on'); $('dlgCancel').focus();
  const close = () => { dlg.classList.remove('on'); $('dlgOk').onclick = $('dlgCancel').onclick = null; document.removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  $('dlgCancel').onclick = close;
  $('dlgOk').onclick = () => { close(); onOk(); };
}
dlg.addEventListener('pointerdown', (e) => { if (e.target === dlg) $('dlgCancel').click(); });   // 바깥을 누르면 취소
$('delText').addEventListener('click', () => {
  if (!selItem() && !selPhoto()) return;
  confirmDelete(selItem() ? (selItem().shape ? '선택한 도형을 삭제할까요?' : '선택한 문구를 삭제할까요?') : (selPhoto().blank ? '선택한 그림을 삭제할까요?' : '선택한 사진을 삭제할까요?'), removeSel);
});
inp.addEventListener('input', () => { const it = selItem(); if (!it) return; it.text = inp.value; inp.style.height = 'auto'; inp.style.height = inp.scrollHeight + 'px'; save(); });
inp.addEventListener('keydown', (e) => { if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Escape') { e.preventDefault(); endEdit(); } });
inp.addEventListener('blur', endEdit);
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Delete' || e.key === 'Backspace') && state.sel && !state.editing && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); removeSel(); }
});

let drag = null;
const toCanvas = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * cv.width, y: (e.clientY - r.top) / r.height * cv.height }; };
function blankHit(ph, b, p) {                                  // 빈 그림판 위에서 p 둘레(약 14px)에 그림이 있는지
  const k = (b.r - b.l) / ph.w, sx = (p.x - b.l) / k, sy = (p.y - b.t) / k, rad = 14 / k;
  const x0 = Math.max(0, Math.floor(sx - rad)), y0 = Math.max(0, Math.floor(sy - rad)), x1 = Math.min(ph.w, Math.ceil(sx + rad)), y1 = Math.min(ph.h, Math.ceil(sy + rad));
  if (x1 <= x0 || y1 <= y0) return false;
  const d = ph.canvas.getContext('2d').getImageData(x0, y0, x1 - x0, y1 - y0).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 16) return true;
  return false;
}
function hit(p0) {
  for (let i = lastBoxes.length - 1; i >= 0; i--) {
    const b = lastBoxes[i], pad = b.kind === 'photo' ? 0 : 24;
    let p = p0;
    if (b.rot) {                                                // 기울어진 문구는 점을 반대로 돌려서 판정
      const cx = (b.l + b.r) / 2, cy = (b.t + b.b) / 2, a = -b.rot * Math.PI / 180, dx = p0.x - cx, dy = p0.y - cy;
      p = { x: cx + dx * Math.cos(a) - dy * Math.sin(a), y: cy + dx * Math.sin(a) + dy * Math.cos(a) };
    }
    if (b.r - b.l > 0 && p.x >= b.l - pad && p.x <= b.r + pad && p.y >= b.t - pad && p.y <= b.b + pad) {
      const o = state.items.find((it) => it.id === b.id) || state.photos.find((ph) => ph.id === b.id);
      if (o && o.blank && !blankHit(o, b, p)) continue;          // 그림이 없는 빈 곳은 아래 항목으로 통과
      return o;
    }
  }
  return null;
}
layer.addEventListener('pointerdown', (e) => {
  if (e.target === inp) return;
  if (tool === 'crop') return;                                 // 자르기 중에는 상자(cropBox)만 조작
  if (tool === 'brush' || tool === 'liquify') { brushDown(toCanvas(e), e); return; } // 붓·유동화 중에는 선택·이동 없음
  if (tool === 'cut') { cutDown(toCanvas(e), e); return; }              // 누끼 중에도 선택·이동 없음
  endEdit();
  const p = toCanvas(e), it = hit(p);
  revealedLock = it && it.locked ? it.id : null;                  // 잠긴 항목을 누르면 해제 아이콘을 보여 줌(선택·이동은 안 됨)
  if (it && it.locked) { state.sel = null; selEl.classList.remove('show'); syncUI(); paint(); return; }
  if (it) {
    const b = lastBoxes.find((x) => x.id === it.id);
    interacting = true; checkpoint();
    drag = { id: it.id, dx: p.x - (b.l + b.r) / 2, dy: p.y - (b.t + b.b) / 2 };
    try { layer.setPointerCapture(e.pointerId); } catch (err) { /* 포인터가 이미 끝남 */ }
  }
  state.sel = it ? it.id : null; syncUI(); paint();
  selEl.classList.toggle('show', !!it);
});
layer.addEventListener('pointermove', (e) => {
  const p = toCanvas(e);
  if (tool === 'crop') return;
  if (tool === 'brush' || tool === 'liquify') { brushMove(p); return; }
  if (tool === 'cut') { cutMove(p); return; }
  if (scaling && scaling.photo) {                                   // 사진 늘이기(임시 배율). 너무 커지지 않게 한쪽 6000px·배율 0.1~8로 제한
    const ph = state.photos.find((q) => q.id === scaling.id); if (!ph) return;
    const dx = p.x - scaling.cx, dy = p.y - scaling.cy, a = scaling.rot;
    const loc = scaling.ax === 'x' ? dx * Math.cos(a) - dy * Math.sin(a) : dx * Math.sin(a) + dy * Math.cos(a);
    const f = Math.min(8, Math.max(0.1, Math.abs(loc) / scaling.d0)), key = scaling.ax === 'x' ? 'dsx' : 'dsy', dim = scaling.ax === 'x' ? ph.w : ph.h;
    ph[key] = Math.min(f, 6000 / dim);
    if (scaling.anchor) { const q = scaling.anchor, ox = q.lx * num(ph.dsx, 1), oy = q.ly * num(ph.dsy, 1); ph.x = (q.Cx - (ox * Math.cos(q.a2) - oy * Math.sin(q.a2))) / cv.width * 100; ph.y = (q.Cy - (ox * Math.sin(q.a2) + oy * Math.cos(q.a2))) / cv.height * 100; }   // 그림 가운데가 제자리에 있도록 사진 위치를 보정
    draw(); return;
  }
  if (scaling) {
    const it = state.items.find((q) => q.id === scaling.id); if (!it) return;
    if (scaling.uni) { it.s = Math.round(Math.min(20, Math.max(2, scaling.s0 * Math.hypot(p.x - scaling.cx, p.y - scaling.cy) / scaling.d0)) * 10) / 10; syncUI(); draw(); return; }   // 꼭짓점: 글자·도형 크기(비율 유지)
    const dx = p.x - scaling.cx, dy = p.y - scaling.cy, a = scaling.rot;
    const loc = scaling.ax === 'x' ? dx * Math.cos(a) - dy * Math.sin(a) : dx * Math.sin(a) + dy * Math.cos(a);
    it[scaling.ax === 'x' ? 'sx' : 'sy'] = Math.round(Math.min(5, Math.max(0.2, scaling.s0 * Math.abs(loc) / scaling.d0)) * 100) / 100;
    syncUI(); draw(); return;
  }
  if (rotating) {
    const it = state.items.find((q) => q.id === rotating.id) || state.photos.find((q) => q.id === rotating.id); if (!it) return;
    let r = rotating.r0 + (Math.atan2(p.y - rotating.cy, p.x - rotating.cx) - rotating.a0) * 180 / Math.PI;
    r = ((r + 180) % 360 + 360) % 360 - 180;                    // -180 ~ 180도
    if (e.shiftKey) r = Math.round(r / 15) * 15;                // Shift: 15도 단위
    else for (const t of [0, 90, -90, 180, -180]) if (Math.abs(r - t) < 3) r = t;   // 0·90도 근처에서 자석처럼 붙음
    it.rot = Math.round(r * 10) / 10;
    syncUI(); draw(); return;
  }
  if (resizing) {
    const ph = state.photos.find((q) => q.id === resizing.id); if (!ph) return;
    ph.scale = Math.min(300, Math.max(10, resizing.s0 * Math.hypot(p.x - resizing.cx, p.y - resizing.cy) / resizing.d0));
    if (resizing.around) { const r = ph.scale / resizing.s0; ph.x = (resizing.cx - resizing.ox * r) / cv.width * 100; ph.y = (resizing.cy - resizing.oy * r) / cv.height * 100; }   // 그림 가운데가 제자리에 있도록 사진 위치를 보정
    syncUI(); draw(); return;
  }
  if (!drag) {
    const h = hit(p);
    layer.classList.toggle('over', !!h);
    selEl.classList.toggle('show', !!(h && h.id === state.sel) || selEl.contains(e.target));   // 선택한 사진·문구 위에 마우스를 올릴 때만 파란 선/점 표시
    return;
  }
  const it = state.items.find((i) => i.id === drag.id) || state.photos.find((i) => i.id === drag.id); if (!it) return;
  it.x = Math.min(100, Math.max(0, (p.x - drag.dx) / cv.width * 100));
  it.y = Math.min(100, Math.max(0, (p.y - drag.dy) / cv.height * 100));
  if (window.alignSnap) window.alignSnap(it, e);                // (align.js) 중앙·가장자리 스냅 + 가이드 선(Shift/Alt: 해제)
  draw();                                                       // 프레임당 한 번만 그림
});
layer.addEventListener('pointerleave', () => { brushCur.style.display = 'none'; if (!drag && !resizing && !rotating && !scaling) selEl.classList.remove('show'); });
const endDrag = () => { endStroke(); resizing = null; rotating = null; { const sc = scaling; scaling = null; if (sc && sc.photo) { const q = state.photos.find((o) => o.id === sc.id); if (q) bakeStretch(q); } } if (drag) { drag = null; save(); } if (interacting) { interacting = false; paint(); } };   // 손을 떼면 원본으로 최종 그리기
layer.addEventListener('pointerup', endDrag); layer.addEventListener('pointercancel', endDrag);
layer.addEventListener('dblclick', (e) => {
  if (tool === 'cut') { if (cut.mode === 'lasso') { if (lasso.pts.length > 3) lasso.pts.pop(); closeLasso(); } return; }   // 더블클릭으로 올가미 끝내기(더블클릭 때 찍힌 마지막 점 하나는 뺌)
  const it = hit(toCanvas(e)); if (it && !it.locked && typeof it.text === 'string' && !it.shape) startEdit(it); });

/* ---------- 파일 불러오기 (PNG·JPEG만, 실패해도 기존 작업 유지) ---------- */
function sniff(b) {
  const eq = (a) => a.every((v, i) => b[i] === v);
  if (b.length >= 8 && eq([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'PNG';
  if (b.length >= 3 && eq([0xff, 0xd8, 0xff])) return 'JPEG';
  if (b.length >= 6 && String.fromCharCode(...b.slice(0, 3)) === 'GIF') return 'GIF';
  if (b.length >= 4 && String.fromCharCode(...b.slice(0, 4)) === '8BPS') return 'PSD';
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP') return 'WEBP';
  if (b.length >= 2 && b[0] === 0x42 && b[1] === 0x4d) return 'BMP';
  if (b.length >= 4 && String.fromCharCode(...b.slice(0, 4)) === '%PDF') return 'PDF';
  return null;
}
async function loadFile(file) {
  const fail = (why) => { setMsg('imgMsg', `불러오지 못했습니다: ${file.name} — ${why} 작업 중인 내용은 그대로입니다.`, 'bad'); syncUI(); return { ok: false, why }; };
  if (!file || file.size === 0) return fail('빈 파일(0바이트)입니다.');
  if (file.size > MAX_BYTES) return fail(`파일이 너무 큽니다(${(file.size / 1048576).toFixed(1)}MB, 최대 20MB).`);
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const kind = sniff(head);
  if (kind === 'PSD' && window.PSImport) return window.PSImport.psd(file, fail);                                   // PSD: 레이어를 사진으로 가져옴(pro.js)
  if ((file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) && window.PSImport) return window.PSImport.svg(file, fail);   // SVG: 사진(래스터)으로 가져옴
  if (kind !== 'PNG' && kind !== 'JPEG') return fail(kind ? `지원하지 않는 형식(${kind})입니다. PNG·JPEG·SVG·PSD 만 불러올 수 있습니다.` : '사진 파일이 아니거나 알 수 없는 형식입니다. PNG·JPEG·SVG·PSD 만 불러올 수 있습니다.');
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { return fail('사진 데이터가 손상되어 열 수 없습니다.'); }
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);                  // 재인코딩 경로: 원본 EXIF·텍스트 청크는 버려짐
  endEdit(); checkpoint();
  const ph = { id: uid(), canvas: c, w: bmp.width, h: bmp.height, x: 50, y: 50, scale: 100, name: file.name, z: newPhotoZ() };
  state.photos.push(ph); state.sel = ph.id;
  setMsg('imgMsg', `사진을 추가했습니다: ${file.name} (${kind}, ${bmp.width}×${bmp.height}) · 카메라 정보 등은 제거했습니다.`, 'ok');
  syncUI(); paint(); return { ok: true, kind };
}
$('file').addEventListener('change', async (e) => { for (const f of [...e.target.files]) await loadFile(f); e.target.value = ''; });
// 미리보기 틀 안에 바로 끌어놓아도 사진이 추가됨
const cw = document.querySelector('.canvaswrap');
cw.addEventListener('dragover', (e) => e.preventDefault());
cw.addEventListener('drop', async (e) => { e.preventDefault(); for (const f of e.dataTransfer.files) await loadFile(f); });
$('clearImg').addEventListener('click', () => {
  const n = state.photos.length; if (!n) { toast('삭제할 사진이나 그림이 없습니다.'); return; }
  endEdit(); confirmDelete(`모든 사진·그림 ${n}개를 삭제할까요? 삭제한 뒤에도 되돌리기(Ctrl+Z)로 복구할 수 있습니다.`, () => { checkpoint(); state.photos = []; if (!selItem()) state.sel = null; setMsg('imgMsg', '모든 사진·그림을 삭제했습니다.', 'ok'); syncUI(); paint(); });
});

/* ---------- 합성 샘플 이미지 (저작권·메타데이터 없음) ---------- */
function synth(w, h, alpha) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#ffb86b'); g.addColorStop(.5, '#e0679b'); g.addColorStop(1, '#4b6fe0');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  x.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 6; i++) { x.beginPath(); x.arc(w * (.15 + i * .15), h * (.3 + (i % 3) * .2), Math.min(w, h) * .12, 0, 7); x.fill(); }
  if (alpha) { x.clearRect(0, 0, w * .3, h); x.clearRect(w * .7, 0, w * .3, h); }   // 투명 영역
  return c;
}
const toBlob = (c, type, q) => new Promise((r) => c.toBlob(r, type, q));
async function sampleFile(kind) {
  if (kind === 'png') return new File([await toBlob(synth(1200, 900), 'image/png')], 'sample.png', { type: 'image/png' });
  if (kind === 'jpg') return new File([await toBlob(synth(900, 1200), 'image/jpeg', .9)], 'sample.jpg', { type: 'image/jpeg' });
  if (kind === 'gif') return new File([Uint8Array.from('GIF89a\x01\x00\x01\x00\x00\x00\x00;'.split('').map((ch) => ch.charCodeAt(0)))], 'sample.gif', { type: 'image/gif' });
  return new File(['이건 이미지가 아닙니다'], 'sample.txt', { type: 'text/plain' });
}
document.querySelectorAll('[data-sample]').forEach((b) => b.addEventListener('click', async () => loadFile(await sampleFile(b.dataset.sample))));

/* ---------- 저장 + 미리보기 대조 ---------- */
function hasMetadata(bytes) {
  const s = new TextDecoder('latin1').decode(bytes);
  return /Exif|eXIf|tEXt|iTXt|zTXt|XML:com\.adobe/.test(s);
}
async function roundtrip(canvas, type, q) {
  const blob = await toBlob(canvas, type, q);
  const bmp = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(bmp, 0, 0);
  return { blob, canvas: c, data: x.getImageData(0, 0, c.width, c.height).data };
}
function diff(a, b) {
  if (a.length !== b.length) return { count: -1, mean: 255 };
  let count = 0, sum = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    if (d) count++; sum += d / 3;
  }
  return { count, mean: sum / (a.length / 4) };
}
/* 저장 옵션: 크기 배율(1x·2x·3x)과 JPEG 품질. 메뉴에서 바꾸고 다음 방문에도 기억 */
const exportOpt = { k: 1, q: 92 };
try { const o = JSON.parse(localStorage.getItem('ps-export') || '{}'); if ([1, 2, 3].includes(o.k)) exportOpt.k = o.k; if (o.q >= 50 && o.q <= 100) exportOpt.q = Math.round(o.q); } catch (e) { /* 저장소 차단 */ }
const saveExportOpt = () => { try { localStorage.setItem('ps-export', JSON.stringify(exportOpt)); } catch (e) { /* 무시 */ } };
/** 검정 테두리 안쪽만 잘라 낸 저장용 캔버스. st 는 state 모양이면 무엇이든(다른 카드도) 가능. opt: {k 배율, transparent 투명 배경} */
function buildExport(st, opt = {}) {
  const s = { ...st, k: opt.k || 1, transparent: !!opt.transparent, editing: null };
  const t = document.createElement('canvas'); render(t, s, 'after', false);
  const ins = frameInset(s), iw = t.width - 2 * ins, ih = t.height - 2 * ins;
  const ex = document.createElement('canvas'); ex.width = iw; ex.height = ih;
  ex.getContext('2d').drawImage(t, ins, ins, iw, ih, 0, 0, iw, ih);
  return ex;
}
const fmtBytes = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + 'MB' : Math.max(1, Math.round(n / 1024)) + 'KB');
const stamp = () => { const d = new Date(), z = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${z(d.getMonth() + 1)}${z(d.getDate())}-${z(d.getHours())}${z(d.getMinutes())}${z(d.getSeconds())}`; };
async function exportAs(type, o = {}) {
  const ext = type === 'image/png' ? 'png' : 'jpg';
  const k = o.k || exportOpt.k, transparent = !!o.transparent && ext === 'png' && !state.bg;
  if (o.transparent && state.bg) toast('템플릿 배경은 투명하게 저장할 수 없어 배경을 포함해 저장합니다.');
  endEdit(); paint();                                            // 입력 중이던 문구 확정 + 대기 중인 갱신 반영
  try { if (document.fonts && document.fonts.ready) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1500))]); } catch (e) { /* 글꼴 대기 실패는 무시 */ }   // 웹폰트를 다 받은 뒤에 그림
  paint();
  const plain = k === 1 && !transparent;                         // 미리보기와 픽셀 단위로 비교할 수 있는 기본 저장
  const ins = frameInset(state), iw = off.width - 2 * ins, ih = off.height - 2 * ins;
  const ex = buildExport(state, { k, transparent });
  const pv = plain ? cv.getContext('2d').getImageData(ins, ins, iw, ih).data : null;
  const rt = await roundtrip(ex, type, exportOpt.q / 100);
  const d = plain ? diff(pv, rt.data) : null;
  const bytes = new Uint8Array(await rt.blob.arrayBuffer());
  const meta = hasMetadata(bytes);
  const url = URL.createObjectURL(rt.blob);
  const fname = `photo-studio_${state.ratio.replace(':', 'x')}${k > 1 ? '@' + k + 'x' : ''}${transparent ? '_투명' : ''}_${stamp()}.${ext}`;
  const a = document.createElement('a'); a.href = url; a.download = fname; a.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
  const okPixels = !plain || (ext === 'png' ? d.count === 0 : d.mean < 4);
  const good = okPixels && !meta, sizeTxt = `${rt.canvas.width}×${rt.canvas.height} ${ext.toUpperCase()} · ${fmtBytes(rt.blob.size)}`;
  $('cmpBox').classList.remove('hide');
  setMsg('cmpMsg', good ? `저장했습니다: ${fname} (${sizeTxt})${plain ? ' · 미리보기와 똑같이 저장됨' : transparent ? ' · 배경 투명' : ' · ' + k + '배 크기'} · 카메라 정보 등 개인정보 없음` : (meta ? '저장한 파일에 카메라 정보 등이 남아 있습니다.' : '저장 결과가 미리보기와 다릅니다.'), good ? 'ok' : 'bad');
  toast(good ? `저장했습니다 · ${sizeTxt}` : '저장했지만 확인이 필요합니다. 아래 비교를 열어 보세요.', good ? 'ok' : 'warn');
  const mini = document.createElement('canvas'); mini.width = rt.canvas.width; mini.height = rt.canvas.height; mini.getContext('2d').drawImage(ex, 0, 0);
  $('cmpA').replaceChildren(mini);
  const im = new Image(); im.src = URL.createObjectURL(rt.blob); $('cmpB').replaceChildren(im);
}
/* 창 막대의 ✕ → 사이트 닫기 (브라우저가 탭 닫기를 막으면 빈 페이지로 이동해서 꺼진 것처럼 만듦) */
const closeSite = () => { window.close(); setTimeout(() => { if (!window.closed) location.replace('about:blank'); }, 150); };
$('closeSite').addEventListener('click', () => { endEdit(); confirmDelete('사이트를 닫을까요? 저장하지 않은 작업은 사라집니다.', closeSite, '닫기', '닫기'); });   // 닫기 전에 확인
$('guideBtn').addEventListener('click', () => { const on = $('guide').classList.toggle('on'); $('guideBtn').classList.toggle('on', on); $('guideBtn').setAttribute('aria-pressed', on ? 'true' : 'false'); });   // 가장자리 여백 안내선(켜져 있으면 파란 테두리)
/* 독의 저장하기·불러오기 버튼 → 메뉴. 다른 곳을 누르거나 Esc, 항목을 고르면 닫힘 */
const dockMenus = [[$('saveBtn'), $('saveMenu')], [$('loadBtn'), $('loadMenu')]];
const closeMenus = () => dockMenus.forEach(([b, m]) => { m.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); });
dockMenus.forEach(([b, m]) => {
  b.addEventListener('click', (e) => { e.stopPropagation(); const open = !m.classList.contains('open'); closeMenus(); if (open) { m.classList.add('open'); b.setAttribute('aria-expanded', 'true'); } });
  m.addEventListener('click', closeMenus);
});
document.addEventListener('click', (e) => { if (!dockMenus.some(([, m]) => m.contains(e.target))) closeMenus(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenus(); if (revealedLock) { revealedLock = null; syncLocks(); } } });
$('loadImg').addEventListener('click', () => $('file').click());
let blankSeq = 0;
function addBlankCanvas() {                                         // 투명한 빈 그림판(틀 안쪽 크기)을 새 그림으로 추가하고 바로 그리기 도구로 전환 — 여러 개 만들 수 있음
  const [W, H] = canvasDims(state), i = frameInset(state), c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(W - 2 * i)); c.height = Math.max(2, Math.round(H - 2 * i));
  endEdit(); checkpoint();
  const ph = { id: uid(), canvas: c, w: c.width, h: c.height, x: 50, y: 50, scale: 100, name: '그림 ' + (++blankSeq), blank: true, z: newPhotoZ() };   // blank: 빈 그림판(사진 보정·자르기·터치 보정 등은 숨김)
  state.photos.push(ph); state.sel = ph.id; syncUI(); setTool('brush'); paint();
  const nm = $('layerName'); nm.focus(); nm.select();                // 추가하자마자 이름을 바로 입력할 수 있게
}
$('layerName').addEventListener('input', (e) => { const p = selPhoto(); if (!p || !p.blank) return; p.name = e.target.value.slice(0, 12); renderLayerList(); });   // 이름은 바로 목록·자물쇠 설명에 반영
$('layerName').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.target.blur(); } });
$('layerName').addEventListener('blur', () => { const p = selPhoto(); if (p && p.blank && !p.name.trim()) { p.name = '그림'; $('layerName').value = p.name; renderLayerList(); } });   // 비워 두면 '그림'
$('newCanvas').addEventListener('click', addBlankCanvas);
$('newCanvas2').addEventListener('click', addBlankCanvas);
function renderLayerList() {                                        // 그림 목록: 누르면 그 그림을 선택(그리기 중에도 바꿀 수 있음)
  const box = $('layerList'); box.replaceChildren();
  const cur = selPhoto(), nameEl = $('layerName'); if (cur && cur.blank && document.activeElement !== nameEl) nameEl.value = cur.name || '';   // 입력 중에는 덮어쓰지 않음
  state.photos.filter((q) => q.blank).forEach((q) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pbtn' + (q.id === state.sel ? ' go' : ''); b.textContent = q.name || '그림';
    b.style.cssText = 'flex:none;width:auto;padding:5px 12px';
    b.addEventListener('click', () => { endEdit(); state.sel = q.id; syncUI(); paint(); });
    box.appendChild(b);
  });
};   // 사진 파일 선택창
$('saveAsPng').addEventListener('click', () => exportAs('image/png'));
$('saveAsPngT').addEventListener('click', () => exportAs('image/png', { transparent: true }));
$('saveAsJpg').addEventListener('click', () => exportAs('image/jpeg'));
document.querySelectorAll('#expScale button').forEach((b) => b.addEventListener('click', () => { exportOpt.k = Number(b.dataset.k); saveExportOpt(); syncExportUI(); }));
$('expQ').addEventListener('input', (e) => { exportOpt.q = Number(e.target.value); saveExportOpt(); syncExportUI(); });
function syncExportUI() {
  document.querySelectorAll('#expScale button').forEach((b) => { const on = Number(b.dataset.k) === exportOpt.k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  $('expQ').value = exportOpt.q; $('vexpQ').textContent = exportOpt.q + '%';
  const w = RATIOS[state.ratio] || RATIOS['1:1']; $('expSize').textContent = `${Math.round(w[0] * exportOpt.k)}×${Math.round(w[1] * exportOpt.k)} px`;
}
syncExportUI();
$('saveBtn').addEventListener('click', syncExportUI);
$('saveMenu').querySelector('.opts').addEventListener('click', (e) => e.stopPropagation());   // 옵션을 만져도 메뉴가 닫히지 않게

/* ---------- 배경 템플릿 (공포·사랑스러움·생일) ---------- */
const TEMPLATES = [
  { id: 'horror', name: '공포', src: '공포.jpg', y0: 0.2, y1: 0.85 },
  { id: 'love', name: '사랑스러움', src: '사랑스러움.jpg', y0: 0.1, y1: 0.9 },
  { id: 'birthday', name: '생일', src: '생일.png', y0: 0.27, y1: 0.72 },
];
const tplCache = {};                                            // 이미지 파일(src)별 캐시. id·y0·y1은 템플릿마다 따로 붙임
function loadTemplate(t) {
  const wrap = (c) => ({ canvas: c.canvas, w: c.w, h: c.h, id: t.id, y0: t.y0, y1: t.y1 });
  if (tplCache[t.src]) return Promise.resolve(wrap(tplCache[t.src]));
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); tplCache[t.src] = { canvas: c, w: c.width, h: c.height }; res(wrap(tplCache[t.src])); };
    im.onerror = () => rej(new Error(t.src + ' 을(를) 불러오지 못했습니다.'));
    im.src = encodeURI(t.src);
  });
}
function renderTplButtons() {
  $('tplRow').replaceChildren();
  TEMPLATES.forEach((t) => {
    const b = document.createElement('button'); b.className = 'tplbtn' + (state.bg && state.bg.id === t.id ? ' on' : ''); b.dataset.id = t.id;
    const im = document.createElement('img'); im.src = encodeURI(t.src); im.alt = t.name;
    b.append(im, t.name); b.addEventListener('click', () => pickTemplate(t)); $('tplRow').appendChild(b);
  });
  const off = document.createElement('button'); off.className = 'btn'; off.textContent = '배경 해제';
  off.addEventListener('click', () => { checkpoint(); state.bg = null; renderTplButtons(); setMsg('tplMsg', '배경을 해제했습니다.', 'ok'); draw(); });
  $('tplRow').appendChild(off);
}
async function pickTemplate(t) {
  checkpoint();
  try { state.bg = await loadTemplate(t); }
  catch (e) { setMsg('tplMsg', e.message, 'bad'); return; }
  renderTplButtons(); draw();
  setMsg('tplMsg', `'${t.name}' 템플릿을 배경으로 적용했습니다.`, 'ok');
}
/* ---------- 템플릿 JSON 내보내기·가져오기 ----------
 * 형식: { "format": "photo-studio-templates", "version": 1, "templates": [{ "id", "name", "src", "y0", "y1" }], "selected": "id" | null }
 * 가져오기는 ① JSON 문법 ② 필수 항목·값 범위 ③ 이미지 파일 실제 로드를 모두 통과해야 반영하고,
 * 하나라도 실패하면 기존 템플릿·선택 상태를 전혀 건드리지 않음. */
const TPL_FORMAT = 'photo-studio-templates', TPL_MAX = 20, TPL_FILE_MAX = 200 * 1024;
function validateTemplates(data) {                               // 오류 문구(문자열) 또는 null(정상) 반환
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return 'JSON 최상위가 객체({ })가 아닙니다.';
  if (data.format !== TPL_FORMAT) return `필수 항목 'format'이(가) 없거나 "${TPL_FORMAT}"이(가) 아닙니다.`;
  if (data.version !== 1) return "필수 항목 'version'이(가) 없거나 지원하지 않는 버전입니다(1만 가능).";
  if (!Array.isArray(data.templates)) return "필수 항목 'templates'(목록)이 없습니다.";
  if (data.templates.length < 1 || data.templates.length > TPL_MAX) return `'templates'는 1~${TPL_MAX}개여야 합니다.`;
  const ids = new Set();
  for (let i = 0; i < data.templates.length; i++) {
    const t = data.templates[i], at = `템플릿 ${i + 1}번: `;
    if (t === null || typeof t !== 'object' || Array.isArray(t)) return at + '객체({ })가 아닙니다.';
    for (const k of ['id', 'name', 'src', 'y0', 'y1']) if (!(k in t)) return at + `필수 항목 '${k}'이(가) 없습니다.`;
    if (typeof t.id !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(t.id)) return at + "'id'는 영문 소문자·숫자·_·- 1~32자여야 합니다.";
    if (ids.has(t.id)) return at + `'id' "${t.id}"이(가) 중복됩니다.`;
    ids.add(t.id);
    if (typeof t.name !== 'string' || !t.name.trim() || t.name.length > 20) return at + "'name'은 1~20자 문자열이어야 합니다.";
    if (typeof t.src !== 'string' || !/^[^\/:*?"<>|.][^\/:*?"<>|]*\.(jpe?g|png)$/i.test(t.src) || t.src.includes('..')) return at + "'src'는 폴더 안의 .jpg/.png 파일 이름이어야 합니다(경로·주소 불가).";
    if (typeof t.y0 !== 'number' || typeof t.y1 !== 'number' || !Number.isFinite(t.y0) || !Number.isFinite(t.y1)) return at + "'y0','y1'은 숫자여야 합니다.";
    if (t.y0 < 0 || t.y1 > 1 || t.y1 - t.y0 < 0.05) return at + "'y0'<'y1'이고 0~1 범위, 간격 0.05 이상이어야 합니다.";
  }
  if ('selected' in data && data.selected !== null && !ids.has(data.selected)) return "'selected'가 목록에 없는 id입니다.";
  return null;
}
async function importTemplates(text) {                           // → { ok, msg }  (실패 시 아무것도 바꾸지 않음)
  const fail = (why) => ({ ok: false, msg: `가져오기 실패: ${why} 기존 템플릿은 그대로 유지됩니다.` });
  let data;
  try { data = JSON.parse(text); } catch (e) { return fail('JSON 문법이 올바르지 않습니다(' + e.message + ').'); }
  const err = validateTemplates(data); if (err) return fail(err);
  const list = data.templates.map((t) => ({ id: t.id, name: t.name.trim(), src: t.src, y0: t.y0, y1: t.y1 }));
  let loaded;
  try { loaded = await Promise.all(list.map(loadTemplate)); } catch (e) { return fail(e.message); }
  TEMPLATES.splice(0, TEMPLATES.length, ...list);                 // 여기까지 오면 모든 검사 통과 → 한 번에 반영
  state.bg = data.selected ? loaded[list.findIndex((t) => t.id === data.selected)] : null;
  renderTplButtons(); draw();
  return { ok: true, msg: `템플릿 ${list.length}개를 가져왔습니다${data.selected ? ' (선택: ' + list.find((t) => t.id === data.selected).name + ')' : ''}.` };
}
function exportTemplates() {
  const data = { format: TPL_FORMAT, version: 1, templates: TEMPLATES.map(({ id, name, src, y0, y1 }) => ({ id, name, src, y0, y1 })), selected: state.bg ? state.bg.id : null };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'photo-studio-templates.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`템플릿 ${TEMPLATES.length}개를 JSON 파일로 내보냈습니다.`, 'ok');
}
$('tplExport').addEventListener('click', exportTemplates);
$('tplImport').addEventListener('click', () => $('tplFile').click());
$('tplFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  let r;
  if (f.size === 0) r = { ok: false, msg: '가져오기 실패: 빈 파일입니다. 기존 템플릿은 그대로 유지됩니다.' };
  else if (f.size > TPL_FILE_MAX) r = { ok: false, msg: '가져오기 실패: 파일이 너무 큽니다(최대 200KB). 기존 템플릿은 그대로 유지됩니다.' };
  else r = await importTemplates(await f.text());
  setMsg('tplMsg', r.msg, r.ok ? 'ok' : 'bad'); toast(r.msg, r.ok ? 'ok' : 'bad');
});

renderTplButtons(); syncUI(); draw();
