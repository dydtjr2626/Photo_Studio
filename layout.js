/* layout.js — 컨트롤 재배치(캔버스를 크게 쓰기 위해).
   다른 스크립트(zoom/ux/align)가 만든 요소를 ID 그대로 옮기기만 한다(기능·ID 불변). 마지막에 로드됨. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const wbody = document.querySelector('.window .wbody'), react = wbody && wbody.querySelector('.react');
  if (!wbody || !react) return;

  const mk = (cls, label) => { const d = document.createElement('div'); d.className = cls; if (label) { d.setAttribute('role', 'group'); d.setAttribute('aria-label', label); } return d; };
  const mv = (box, ids) => ids.forEach((id) => { const e = $(id); if (e) box.appendChild(e); });

  /* 1) 캔버스 위 한 줄 툴바: [줌] ........ [복제 되돌리기 잠금 안내선] */
  const tools = mk('ps-tools'); tools.setAttribute('role', 'toolbar'); tools.setAttribute('aria-label', '미리보기 도구');
  const zg = mk('ps-zoom', '줌'), eg = mk('ps-edit', '편집');
  mv(zg, ['zOut', 'zPct', 'zIn', 'zFit', 'z100']);
  mv(eg, ['dupBtn', 'undoBtn', 'lockBtn', 'guideBtn']);
  tools.appendChild(zg); tools.appendChild(eg);
  react.insertAdjacentElement('afterend', tools);

  /* 1-2) 헤더(로고·저장·불러오기·단축키·✕)·화면비·툴바를 왼쪽 사이드 맨 위로: 가운데는 캔버스만 남겨 크게 쓴다 */
  const side = document.querySelector('aside.side'), head = document.querySelector('.window .wbar');
  if (side && head) {
    const top = mk('ps-sidetop');
    top.appendChild(head); top.appendChild(react); top.appendChild(tools);
    side.insertBefore(top, side.firstChild);
    /* 900px 이하는 한 줄로 쌓이고 사이드가 맨 아래로 가므로, 이 블록만 캔버스 위로 올린다 */
    const grid = document.getElementById('editor'), win = document.querySelector('.window'), mq = window.matchMedia('(max-width:900px)');
    const place = () => {
      if (!grid || !win) return;
      if (mq.matches) { if (top.parentNode !== grid) grid.insertBefore(top, win); }
      else if (top.parentNode !== side) side.insertBefore(top, side.firstChild);
    };
    place(); (mq.addEventListener ? mq.addEventListener('change', place) : mq.addListener(place));
  }

  /* 사이트 닫기(✕)는 헤더에서 빼서 왼쪽 패널 맨 아래로(실수로 누르기 쉬운 위치였음) */
  { const cl = $('closeSite'); if (cl && side) { cl.textContent = '✕ 사이트 닫기'; side.appendChild(cl); } }

  /* 비게 된 옛 줄은 숨김(독에는 숨은 파일 입력이 있어 DOM 에는 남겨 둠) */
  const ob = wbody.querySelector('.orderbar'); if (ob) ob.classList.add('ps-gone');
  const dock = wbody.querySelector('.dock'); if (dock) dock.classList.add('ps-gone');

  /* 2) 정렬·수치 입력과 선택 힌트는 오른쪽 패널 맨 위(세로 공간이 넉넉함) */
  const main = document.querySelector('aside.main');
  if (main) {
    const hint = wbody.querySelector('.ux-hint') || document.querySelector('.ux-hint'), ab = $('alignBar');
    if (hint) main.insertBefore(hint, main.firstChild);
    if (ab) main.insertBefore(ab, main.firstChild);
  }
})();
