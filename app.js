(function () {
  'use strict';

  const grid = document.getElementById('app-grid');
  const search = document.getElementById('search');
  const catsEl = document.getElementById('cats');
  const countEl = document.getElementById('count');
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');

  const PAGE_SIZE = 20;
  let DATA = [];

  // 从中文描述归一化出大类：游戏 / 软件工具
  function topCategory(zh) {
    const s = (zh || '');
    // 排除“土坯”这类机器误译（Adobe）后，含“游戏”即归为游戏
    if (s.indexOf('游戏') !== -1) return '游戏';
    return '软件工具';
  }

  function loadData() {
    return fetch('apps.json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (arr) {
        DATA = arr.map(function (it) {
          it._cat = topCategory(it.z);
          return it;
        });
        buildChips();
        state.category = '';
        render();
      })
      .catch(function (e) {
        countEl.textContent = '数据加载失败：' + e.message;
      });
  }

  const state = {
    category: '',
    query: '',
    page: 0,
  };

  function buildChips() {
    const seen = {};
    DATA.forEach(function (d) { seen[d._cat] = (seen[d._cat] || 0) + 1; });
    const order = ['游戏', '软件工具'].filter(function (k) { return seen[k]; });

    const wrap = document.createElement('div');
    const allBtn = document.createElement('button');
    allBtn.className = 'chip';
    allBtn.textContent = '全部 (' + DATA.length + ')';
    allBtn.setAttribute('aria-pressed', 'true');
    allBtn.addEventListener('click', function () { state.category = ''; render(); });
    wrap.appendChild(allBtn);

    order.forEach(function (cat) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = cat + ' (' + seen[cat] + ')';
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('data-cat', cat);
      b.addEventListener('click', function () {
        state.category = (state.category === cat ? '' : cat);
        updateChipsPress();
        state.page = 0;
        render();
      });
      wrap.appendChild(b);
    });

    catsEl.innerHTML = '';
    catsEl.appendChild(wrap);
  }

  function updateChipsPress() {
    Array.prototype.forEach.call(catsEl.querySelectorAll('.chip'), function (b) {
      const press = b.getAttribute('data-cat') === state.category;
      b.setAttribute('aria-pressed', press ? 'true' : 'false');
    });
  }

  function filtered() {
    const q = state.query.trim().toLowerCase();
    let list = DATA;
    if (state.category) list = list.filter(function (d) { return d._cat === state.category; });
    if (q) {
      list = list.filter(function (d) {
        return (d.n || '').toLowerCase().indexOf(q) !== -1 ||
               (d.z || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    return list;
  }

  function render() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (state.page >= pages) state.page = pages - 1;
    if (state.page < 0) state.page = 0;
    const slice = list.slice(state.page * PAGE_SIZE, state.page * PAGE_SIZE + PAGE_SIZE);

    countEl.textContent =
      state.category || state.query
        ? '筛选出 ' + list.length + ' 个应用'
        : '共 ' + DATA.length + ' 个支持意大利语的 Mac 应用';

    grid.innerHTML = '';
    if (!slice.length) {
      const div = document.createElement('div');
      div.className = 'empty';
      div.textContent = '没有匹配的应用，换个关键词试试。';
      grid.appendChild(div);
    } else {
      slice.forEach(function (it) {
        grid.appendChild(renderCard(it));
      });
    }

    pageInfo.textContent = (state.page + 1) + ' / ' + pages;
    prevBtn.disabled = state.page === 0;
    nextBtn.disabled = state.page >= pages - 1;
    prevBtn._pages = pages;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function nativeBadge(it) {
    const arch = (it.a || '').toLowerCase();
    const b = document.createElement('span');
    if (arch.indexOf('arm') !== -1) {
      b.className = 'badge badge-native';
      b.textContent = '原生 Apple 芯片';
      b.title = '原生支持 M 系列 (Apple Silicon)，无需转译';
    } else if (arch.indexOf('x86') !== -1) {
      b.className = 'badge badge-ros';
      b.textContent = 'Intel · 需转译';
      b.title = '仅支持 Intel，在 Apple 芯片上需经 Rosetta 转译运行';
    } else {
      b.className = 'badge badge-unknown';
      b.textContent = '架构未知';
    }
    return b;
  }

  function imgBox(it) {
    const box = document.createElement('div');
    box.className = 'card-img';
    // 优先配图(头图铺满)，其次图标(居中)，都没有则占位
    const chain = [];
    if (it.im) chain.push({ src: it.im, cls: 'media' });
    if (it.ic) chain.push({ src: it.ic, cls: 'icon' });
    if (!chain.length) return box;
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = (it.n || '') + ' 图片';
    let idx = 0;
    const apply = function () {
      if (idx >= chain.length) {
        box.classList.add('img-fail');
        box.setAttribute('data-key', (it.n || '').replace(/[^\u4e00-\u9fff\u0041-\u005a\u0061-\u007a0-9]/g, '').slice(0, 1) || '?');
        return;
      }
      const cur = chain[idx++];
      img.className = cur.cls;
      img.src = cur.src;
    };
    img.addEventListener('error', apply);
    img.addEventListener('load', function () { box.classList.remove('img-fail'); });
    apply();
    box.appendChild(img);
    return box;
  }

  function renderCard(it) {
    const a = document.createElement('article');
    a.className = 'card';
    a.setAttribute('data-id', it.id);
    a.appendChild(imgBox(it));

    const body = document.createElement('div');
    body.className = 'card-body';

    const top = document.createElement('div');
    top.className = 'card-top';
    const h = document.createElement('h3');
    h.className = 'card-title';
    h.textContent = it.n || '未命名';
    const badge = nativeBadge(it);
    top.appendChild(h);
    top.appendChild(badge);
    body.appendChild(top);

    const zh = document.createElement('p');
    zh.className = 'card-zh';
    zh.textContent = it.z || '（暂无中文介绍）';
    body.appendChild(zh);

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    if (it.v) { meta.appendChild(mtag('版本 ' + it.v)); }
    if (it.s) { meta.appendChild(mtag(it.s)); }
    if (it.dt) { meta.appendChild(mtag(it.dt.slice(0, 7))); }
    body.appendChild(meta);

    const link = document.createElement('a');
    link.className = 'card-dl';
    link.href = it.d || '#';
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = '去原站下载 ↗';
    body.appendChild(link);

    a.appendChild(body);
    return a;
  }

  function mtag(text) {
    const s = document.createElement('span');
    s.className = 'mtag';
    s.textContent = text;
    return s;
  }

  let debounce;
  search.addEventListener('input', function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      state.query = search.value;
      state.page = 0;
      render();
    }, 160);
  });

  prevBtn.addEventListener('click', function () {
    if (state.page > 0) { state.page--; render(); }
  });
  nextBtn.addEventListener('click', function () {
    if (!nextBtn.disabled) { state.page++; render(); }
  });

  loadData();
})();
