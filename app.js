/* ==========================================================================
   디자인 아카이브 — 로컬 전용 스크립트
   · fetch/XHR/모듈 import를 쓰지 않으므로 file:// 로 열어도 그대로 동작합니다.
   · window.ARCHIVE_DATA (data.js) 를 읽어 2D 캔버스에 배치합니다.
   ========================================================================== */
(function () {
  'use strict';

  var DATA = Array.isArray(window.ARCHIVE_DATA) ? window.ARCHIVE_DATA.slice() : [];
  var CATS = ['그래픽 레퍼런스', '편집 디자인', '북디자인', '타이포그래피', '인쇄·제본'];

  // 핀터레스트 검색은 영문 디자인 키워드 조합에서 결과가 훨씬 풍부하다.
  // 자료에 영문 키워드(pinKeywords)가 있으면 그것을 쓰고, 없으면 아래 표로
  // 카테고리·태그를 영문으로 옮겨 검색어를 만든다.
  var PIN_CAT = {
    '그래픽 레퍼런스': 'graphic design',
    '편집 디자인': 'editorial design',
    '북디자인': 'book design',
    '타이포그래피': 'typography',
    '인쇄·제본': 'risograph print'
  };

  var TAG_EN = {
    '포스터': 'poster', '콜라주': 'collage', '텍스처': 'texture', '전시': 'exhibition',
    '그리드': 'grid', '타이포그래피': 'typography', '커스텀서체': 'custom typeface',
    '디스플레이서체': 'display typeface', '세리프': 'serif', '블랙레터': 'blackletter',
    '타입시스템': 'type system', '타입패밀리': 'type family', '타입파운드리': 'type foundry',
    '아이덴티티': 'identity', '리브랜딩': 'rebranding', '브랜드확장': 'brand extension',
    '미니멀': 'minimal', '기하학': 'geometric', '심볼': 'symbol', '픽토그램': 'pictogram',
    '패키지': 'packaging', '머천다이즈': 'merchandise', '그라디언트': 'gradient',
    '페스티벌': 'festival', '캠페인': 'campaign', '문화행사': 'cultural event',
    '미술관': 'museum', '초현실주의': 'surrealism', '포토콜라주': 'photo collage',
    '리디자인': 'redesign', '슬랩세리프': 'slab serif', '편집디자인': 'editorial design',
    '패션매거진': 'fashion magazine', '에디토리얼': 'editorial', '매거진': 'magazine',
    '독립매거진': 'independent magazine', '마스트헤드': 'masthead', '일러스트레이션': 'illustration',
    '도해': 'diagram', '체커보드': 'checkerboard', '푸드': 'food',
    '아트북': 'art book', '아카이브': 'archive', '페미니즘': 'feminism', '스티커': 'sticker',
    '포토북': 'photobook', '축구': 'football', '팬문화': 'fan culture', '데콜라주': 'decollage',
    '인쇄문화': 'print culture', '리스그래프': 'risograph', '진': 'zine', '제본': 'bookbinding',
    '워크북': 'workbook', '템플릿': 'template', '여행': 'travel', 'DIY인쇄': 'diy printing',
    '언더그라운드': 'underground print', '스포츠브랜딩': 'sports branding', '레드': 'red',
    '700페이지': '700 pages', '여성서체': 'women typeface', '세트': 'box set', '클럽문화': 'club culture'
  };

  var COLS = [400, 372, 418, 386, 404, 376];  // 열 너비 패턴(합계가 월 폭)
  var GAP_Y = 76;           // 같은 열 안 항목 사이 간격
  var GAP_X = 0;            // 열 사이 여백은 열 너비에 포함
  var TILE_GAP = 480;       // 타일과 타일 사이 여백(무한 반복 시 보이는 간격)
  var EDGE = 260;           // 내용 밖으로 이동할 수 있는 여유
  var DIM_HINT_DELAY = 900;

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    canvas: $('canvas'),
    ground: $('ground'),
    statusLabel: $('statusLabel'),
    statusCount: $('statusCount'),
    menuBtn: $('menuBtn'),
    drawer: $('drawer'),
    drawerClose: $('drawerClose'),
    scrim: $('scrim'),
    search: $('search'),
    filters: $('filters'),
    modal: $('modal'),
    modalInner: $('modalInner'),
    modalBody: $('modalBody'),
    modalClose: $('modalClose'),
    hint: $('hint'),
    empty: $('empty'),
    emptyText: $('emptyText'),
    emptyReset: $('emptyReset'),
    footCount: $('footCount')
  };

  var state = {
    filter: '전체',
    query: '',
    panX: 0,
    panY: 0,
    vw: window.innerWidth,
    vh: window.innerHeight,
    contentW: 0,
    contentH: 0,
    tileW: 0,
    tileH: 0,
    wrap: false,
    nodes: [],
    dragging: false,
    moved: false,
    lastX: 0,
    lastY: 0,
    vx: 0,
    vy: 0,
    raf: 0,
    drawerOpen: false,
    hintTimer: 0,
    lastFocus: null
  };

  /* ── 유틸 ─────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function isNarrow() { return window.matchMedia('(max-width: 1024px)').matches; }

  /* ── 필터링 ───────────────────────────────────────────────────────── */
  function matches(item, q) {
    if (!q) return true;
    var hay = [
      item.ko, item.en, item.cat, item.maker, item.year, item.kind, item.license,
      (item.tags || []).join(' '), (item.points || []).join(' ')
    ].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function visibleItems() {
    var q = state.query.trim().toLowerCase();
    return DATA.filter(function (i) {
      return (state.filter === '전체' || i.cat === state.filter) && matches(i, q);
    });
  }

  // 카테고리를 번갈아 섞어 한 화면에 성격이 다른 자료가 섞이게 한다.
  function interleave(items) {
    var groups = {};
    var order = [];
    items.forEach(function (i) {
      if (!groups[i.cat]) { groups[i.cat] = []; order.push(i.cat); }
      groups[i.cat].push(i);
    });
    var out = [];
    var max = 0;
    order.forEach(function (c) { max = Math.max(max, groups[c].length); });
    for (var k = 0; k < max; k++) {
      order.forEach(function (c) { if (groups[c][k]) out.push(groups[c][k]); });
    }
    return out;
  }

  /* ── 배치 계산 (열 기반 메이슨리 + 산개) ───────────────────────────── */
  //  이미지 비율을 지키면서 6개 열에 차례로 채우고, 열마다 폭과 시작 위치를
  //  조금씩 어긋나게 두어 격자처럼 딱딱하지 않게 흩뜨린다.
  function layout(items) {
    var colX = [];
    var acc = 0;
    COLS.forEach(function (w) { colX.push(acc); acc += w; });

    var colY = COLS.map(function () { return 0; });
    var placed = [];

    items.forEach(function (item, idx) {
      var col = 0;
      for (var c = 1; c < COLS.length; c++) {
        if (colY[c] < colY[col] - 0.5) col = c;
      }
      var colW = COLS[col];
      var ar = (item.w || 4) / (item.h || 3);

      var w;
      if (ar >= 1.12) w = colW - 6;          // 가로형은 열 폭 가득
      else if (ar <= 0.74) w = colW * 0.82;  // 세로로 긴 자료는 조금 좁게
      else w = colW * 0.93;

      var h = w / ar;
      var jx = (((idx * 37) % 5) - 2) * 5;    // -10 ~ +10
      var jy = (((idx * 61) % 5) - 2) * 7;    // -14 ~ +14
      var x = colX[col] + (colW - w) / 2 + jx;
      var y = colY[col] + jy;

      placed.push({ item: item, x: x, y: y, w: w, h: h });
      colY[col] = y + h + GAP_Y;
    });

    state.contentW = acc;
    state.contentH = Math.max.apply(null, colY.concat([0])) - GAP_Y;
    state.tileW = acc + TILE_GAP;
    state.tileH = state.contentH + TILE_GAP;
    return placed;
  }

  /* ── 렌더 ─────────────────────────────────────────────────────────── */
  function render(resetView) {
    var ordered = interleave(visibleItems());
    var placed = layout(ordered);

    el.ground.textContent = '';
    state.nodes = [];

    placed.forEach(function (p, i) {
      var item = p.item;

      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.dataset.id = item.id;
      card.style.width = p.w.toFixed(1) + 'px';
      card.style.animationDelay = Math.min(i * 22, 420) + 'ms';
      card.setAttribute('aria-label', item.ko + ' — ' + item.cat + ' 상세 보기');

      var frame = document.createElement('span');
      frame.className = 'card__frame';

      var img = document.createElement('img');
      img.src = item.img;
      img.alt = item.ko + ' (' + item.en + ')';
      img.width = item.w;
      img.height = item.h;
      img.loading = i < 9 ? 'eager' : 'lazy';
      img.decoding = 'async';
      img.draggable = false;
      img.addEventListener('error', function () { card.classList.add('is-broken'); });
      frame.appendChild(img);

      var cap = document.createElement('span');
      cap.className = 'card__caption';
      cap.innerHTML = '<b>' + esc(item.ko) + '</b> <span>' + esc(item.cat) + '</span>';

      card.appendChild(frame);
      card.appendChild(cap);

      card.addEventListener('click', function () {
        if (state.moved) return;
        openModal(item, card);
      });

      el.ground.appendChild(card);
      state.nodes.push({ el: card, x: p.x, y: p.y });
    });

    state.wrap = placed.length >= 8 &&
      state.tileW >= state.vw * 0.95 &&
      state.tileH >= state.vh * 0.95;

    if (resetView || !state.nodes.length) centerContent();

    clampPan();
    placeAll();
    updateStatus();
  }

  function centerContent() {
    // 내용이 화면보다 작으면 가운데, 크면 왼쪽 위에서 여유를 두고 시작한다.
    state.panX = state.contentW + 120 < state.vw
      ? (state.vw - state.contentW) / 2
      : 44;
    state.panY = state.contentH + 120 < state.vh
      ? (state.vh - state.contentH) / 2
      : 92;
  }

  function clampPan() {
    if (state.wrap) return;

    var minX = state.vw - state.contentW - EDGE;
    var maxX = EDGE;
    if (minX > maxX) { var t = minX; minX = maxX; maxX = t; }
    state.panX = Math.min(Math.max(state.panX, minX), maxX);

    var minY = state.vh - state.contentH - EDGE;
    var maxY = EDGE;
    if (minY > maxY) { var u = minY; minY = maxY; maxY = u; }
    state.panY = Math.min(Math.max(state.panY, minY), maxY);
  }

  function placeAll() {
    var cx = state.vw / 2;
    var cy = state.vh / 2;
    for (var i = 0; i < state.nodes.length; i++) {
      var n = state.nodes[i];
      var x = n.x + state.panX;
      var y = n.y + state.panY;
      if (state.wrap) {
        x += Math.round((cx - x) / state.tileW) * state.tileW;
        y += Math.round((cy - y) / state.tileH) * state.tileH;
      }
      n.el.style.transform = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0)';
    }
  }

  /* ── 상태 표시 ─────────────────────────────────────────────────────── */
  function updateStatus() {
    var n = visibleItems().length;
    var label = state.filter;
    if (state.query.trim()) label = '검색';

    el.statusLabel.textContent = label;
    el.statusCount.textContent = n;
    el.footCount.textContent = '자료 ' + n + '건 · 전체 ' + DATA.length + '건';

    el.empty.hidden = n !== 0;
    if (n === 0) {
      var what = state.query.trim() || state.filter;
      el.emptyText.textContent = '‘' + what + '’에 맞는 자료가 없습니다.';
    }
  }

  /* ── 드로어 ───────────────────────────────────────────────────────── */
  function openDrawer() {
    state.drawerOpen = true;
    el.drawer.classList.add('is-open');
    el.drawer.setAttribute('aria-hidden', 'false');
    el.menuBtn.setAttribute('aria-expanded', 'true');
    if (isNarrow()) {
      el.scrim.hidden = false;
      el.scrim.classList.add('is-visible');
    }
    setTimeout(function () { el.search.focus({ preventScroll: true }); }, 260);
  }

  function closeDrawer() {
    if (!state.drawerOpen) return;
    state.drawerOpen = false;
    el.drawer.classList.remove('is-open');
    el.drawer.setAttribute('aria-hidden', 'true');
    el.menuBtn.setAttribute('aria-expanded', 'false');
    el.scrim.classList.remove('is-visible');
    el.scrim.hidden = true;
  }

  function buildFilters() {
    var counts = { '전체': DATA.length };
    CATS.forEach(function (c) {
      counts[c] = DATA.filter(function (i) { return i.cat === c; }).length;
    });

    el.filters.textContent = '';
    ['전체'].concat(CATS).forEach(function (cat) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'filter-btn' + (state.filter === cat ? ' is-active' : '');
      b.dataset.cat = cat;
      b.innerHTML = '<span>' + esc(cat) + '</span><span class="num">' + counts[cat] + '</span>';
      b.addEventListener('click', function () {
        state.filter = cat;
        Array.prototype.forEach.call(el.filters.children, function (c) {
          c.classList.toggle('is-active', c.dataset.cat === cat);
        });
        render(true);
      });
      el.filters.appendChild(b);
    });
  }

  /* ── 핀터레스트 검색어 ─────────────────────────────────────────────── */
  //  영문 제목에서 괄호·연도·구두점을 덜어 검색에 쓸 수 있는 형태로 다듬는다.
  function cleanEn(s) {
    return String(s == null ? '' : s)
      .replace(/\([^)]*\)/g, ' ')
      .replace(/[—–]/g, ' ')
      .split(':')[0]
      .replace(/\b(19|20)\d{2}\b/g, ' ')
      .replace(/[^A-Za-z0-9&'\- ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  //  ① 자료의 영문 키워드 → ② 영문 제목 + 카테고리 영문명 →
  //  ③ 번역된 태그 → ④ 국문 제목 (핀터레스트 검색어가 비지 않도록 하는 최종 대비책)
  function hasPhrase(text, phrase) {
    var hay = ' ' + String(text).toLowerCase().replace(/\s+/g, ' ') + ' ';
    return phrase.toLowerCase().split(/\s+/).every(function (w) {
      return w && hay.indexOf(' ' + w + ' ') !== -1;
    });
  }

  function pinQuery(item) {
    var words = [];

    if (Array.isArray(item.pinKeywords) && item.pinKeywords.length) {
      words = item.pinKeywords.slice(0, 3);
    } else {
      var en = cleanEn(item.en);
      var cat = PIN_CAT[item.cat] || '';

      if (en) {
        // 영문 제목에 '디자인' 어휘(카테고리 영문명)를 보태 검색이 디자인 자료로 향하게 한다.
        words = cat ? [en, cat] : [en];
      } else {
        // 영문 제목이 없는 자료는 카테고리 어휘 + 새로 번역된 태그 2개까지.
        var tagWords = [];
        (item.tags || []).forEach(function (t) {
          var w = TAG_EN[t];
          if (!w || tagWords.length >= 2) return;
          if (hasPhrase([cat].concat(tagWords).join(' '), w)) return;
          tagWords.push(w);
        });
        words = cat ? [cat].concat(tagWords) : tagWords;

        // 영문으로 옮길 말이 하나도 없으면 국문 제목 그대로 검색한다.
        if (!tagWords.length) {
          words = item.ko ? [item.ko] : (words.length ? words : ['design']);
        }
      }
    }

    return words.join(' ').replace(/\s+/g, ' ').trim();
  }

  function pinHref(item) {
    return 'https://www.pinterest.com/search/pins/?q=' + encodeURIComponent(pinQuery(item));
  }

  /* ── 상세 모달 ─────────────────────────────────────────────────────── */
  function detailHTML(item) {
    var points = (item.points || []).map(function (p) {
      return '<li>' + esc(p) + '</li>';
    }).join('');

    var tags = (item.tags || []).map(function (t) {
      return '<span class="tag">' + esc(t) + '</span>';
    }).join('');

    var pinKeywords = pinQuery(item);

    return '' +
      '<div class="detail__media"><img src="' + esc(item.img) + '" alt="' + esc(item.ko) + ' (' + esc(item.en) + ')" width="' + item.w + '" height="' + item.h + '"></div>' +
      '<div class="detail__panel">' +
        '<div class="detail__cat"><span>' + esc(item.cat) + '</span><span class="dot"></span><span>' + esc(item.kind || '') + '</span></div>' +
        '<h2 class="detail__ko">' + esc(item.ko) + '</h2>' +
        '<p class="detail__en">' + esc(item.en) + '</p>' +
        '<div class="detail__meta">' +
          '<div><span>제작</span><b>' + esc(item.maker) + '</b></div>' +
          '<div><span>연도</span><b>' + esc(item.year) + '</b></div>' +
        '</div>' +
        '<h3 class="detail__h">디자인 포인트</h3>' +
        '<ol class="detail__points">' + points + '</ol>' +
        '<div class="detail__tags">' + tags + '</div>' +
        '<div class="detail__pin">' +
          '<a class="pin-btn" href="' + esc(pinHref(item)) + '" target="_blank" rel="noopener noreferrer"' +
             ' title="새 탭에서 핀터레스트 검색 열기">' +
            '<svg class="pin-btn__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
              '<circle cx="6.9" cy="6.9" r="4.6"></circle>' +
              '<path d="M10.4 10.4 14 14"></path>' +
            '</svg>' +
            '<span class="pin-btn__label">핀터레스트에서 관련 디자인 찾기</span>' +
            '<span class="pin-btn__arrow" aria-hidden="true">↗</span>' +
          '</a>' +
          '<p class="detail__pin-note">영문 키워드 검색 · <b>' + esc(pinKeywords) + '</b></p>' +
        '</div>' +
        '<p class="detail__credit">출처 · ' + esc(item.credit) +
          '<span class="detail__license">' + esc(item.license) + '</span>' +
          '<a href="' + esc(item.link) + '" target="_blank" rel="noopener">원본 페이지 열기 ↗</a>' +
        '</p>' +
      '</div>';
  }

  function openModal(item, opener) {
    state.lastFocus = opener || document.activeElement;
    el.modalBody.innerHTML = detailHTML(item);
    el.modal.hidden = false;
    el.modalClose.focus({ preventScroll: true });
  }

  function closeModal() {
    if (el.modal.hidden) return;
    el.modal.hidden = true;
    el.modalBody.textContent = '';
    if (state.lastFocus && state.lastFocus.focus) {
      state.lastFocus.focus({ preventScroll: true });
    }
    state.lastFocus = null;
  }

  /* ── 이동 ─────────────────────────────────────────────────────────── */
  function dimHint() {
    if (el.hint.classList.contains('is-dim')) return;
    clearTimeout(state.hintTimer);
    state.hintTimer = setTimeout(function () {
      el.hint.classList.add('is-dim');
    }, DIM_HINT_DELAY);
  }

  function startInertia() {
    if (state.raf) cancelAnimationFrame(state.raf);

    function step() {
      state.vx *= 0.92;
      state.vy *= 0.92;
      state.panX += state.vx;
      state.panY += state.vy;
      clampPan();
      placeAll();
      if (Math.abs(state.vx) > 0.08 || Math.abs(state.vy) > 0.08) {
        state.raf = requestAnimationFrame(step);
      } else {
        state.raf = 0;
      }
    }
    state.raf = requestAnimationFrame(step);
  }

  /* ── 이벤트 ───────────────────────────────────────────────────────── */
  function bindEvents() {
    el.menuBtn.addEventListener('click', function () {
      if (state.drawerOpen) closeDrawer();
      else openDrawer();
    });
    el.drawerClose.addEventListener('click', closeDrawer);
    el.scrim.addEventListener('click', closeDrawer);

    el.search.addEventListener('input', function () {
      state.query = el.search.value;
      render(true);
    });

    el.emptyReset.addEventListener('click', function () {
      state.query = '';
      state.filter = '전체';
      el.search.value = '';
      Array.prototype.forEach.call(el.filters.children, function (c) {
        c.classList.toggle('is-active', c.dataset.cat === '전체');
      });
      render(true);
    });

    el.modalClose.addEventListener('click', closeModal);
    el.modal.addEventListener('click', function (e) {
      if (e.target === el.modal) closeModal();
    });

    // 캔버스 드래그 — 포인터 캡처를 쓰지 않고 window에서 추적해야
    //               카드 클릭(상세 열기)이 브라우저에서 정상 동작합니다.
    el.canvas.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (state.drawerOpen) {
        var narrow = isNarrow();
        if (narrow || e.clientX < state.vw - 400) closeDrawer();
      }

      state.dragging = true;
      state.moved = false;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.vx = 0;
      state.vy = 0;
      if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
      el.canvas.classList.add('is-dragging');
      dimHint();
    });

    window.addEventListener('pointermove', function (e) {
      if (!state.dragging) return;
      var dx = e.clientX - state.lastX;
      var dy = e.clientY - state.lastY;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      if (Math.abs(dx) + Math.abs(dy) > 2) state.moved = true;
      state.panX += dx;
      state.panY += dy;
      state.vx = dx;
      state.vy = dy;
      clampPan();
      placeAll();
    });

    function endDrag() {
      if (!state.dragging) return;
      state.dragging = false;
      el.canvas.classList.remove('is-dragging');
      if (state.moved) startInertia();
    }

    window.addEventListener('pointerup', endDrag);
    window.addEventListener('pointercancel', endDrag);
    window.addEventListener('blur', endDrag);

    // 휠 · 트랙패드 (상하좌우)
    el.canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var unit = e.deltaMode === 1 ? 18 : e.deltaMode === 2 ? state.vh : 1;
      state.panX -= e.deltaX * unit;
      state.panY -= e.deltaY * unit;
      clampPan();
      placeAll();
      dimHint();
    }, { passive: false });

    // 키보드
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (!el.modal.hidden) { closeModal(); return; }
        if (state.drawerOpen) { closeDrawer(); return; }
      }
      var t = e.target;
      var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (typing || !el.modal.hidden) return;

      var step = e.shiftKey ? 320 : 104;
      if (e.key === 'ArrowLeft') { state.panX += step; }
      else if (e.key === 'ArrowRight') { state.panX -= step; }
      else if (e.key === 'ArrowUp') { state.panY += step; }
      else if (e.key === 'ArrowDown') { state.panY -= step; }
      else if (e.key === 'Home') { centerContent(); }
      else return;

      e.preventDefault();
      if (state.raf) { cancelAnimationFrame(state.raf); state.raf = 0; }
      clampPan();
      placeAll();
      dimHint();
    });

    // 창 크기 변경
    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        state.vw = window.innerWidth;
        state.vh = window.innerHeight;
        render(true);
      }, 140);
    });
  }

  /* ── 시작 ─────────────────────────────────────────────────────────── */
  function init() {
    if (!DATA.length) {
      el.statusCount.textContent = '0';
      el.empty.hidden = false;
      el.emptyText.textContent = '자료(data.js)를 찾지 못했습니다. 폴더 구성이 그대로인지 확인해 주세요.';
      return;
    }
    state.vw = window.innerWidth;
    state.vh = window.innerHeight;
    buildFilters();
    bindEvents();
    render(true);
    setTimeout(function () { el.hint.classList.add('is-dim'); }, 6000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
