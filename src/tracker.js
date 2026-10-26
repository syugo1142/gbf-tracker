import { el, uid, toNum, formatNum } from './util.ts';
import { MaterialIcon } from './icons.js';
import { MaterialSource } from './sources.js';
import { PRESETS, PRESET_RENAMES, PRESET_CATEGORIES, presetCategory, presetLabel } from './presets.js';

// 素材トラッカー
export const Tracker = (() => {
  let app; // { state, save }

  // 開いている目標などの ID。再描画しても開閉状態を保つため、この閲覧者のブラウザに覚えておく
  const OPEN_KEY = 'gbf-tools-open';
  const openIds = new Set(loadOpenIds());

  function loadOpenIds() {
    try {
      return JSON.parse(localStorage.getItem(OPEN_KEY)) || [];
    } catch {
      return [];
    }
  }

  function setOpen(id, open) {
    if (open) openIds.add(id);
    else openIds.delete(id);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...openIds])); } catch {}
  }

  // 開閉状態を覚える <details> を作る
  function details(id, props, children) {
    const node = el('details', { ...props, open: openIds.has(id) }, children);
    node.addEventListener('toggle', () => setOpen(id, node.open));
    return node;
  }

  function init(appRef) {
    app = appRef;

    document.getElementById('material-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const name = form.elements.name.value.trim();
      if (!name) return;
      if (app.state.materials.some((m) => m.name === name)) {
        alert('同じ名前の素材がすでにあります');
        return;
      }
      app.state.materials.push({
        id: uid(),
        name,
        owned: toNum(form.elements.owned.value),
        perRun: toNum(form.elements.perRun.value),
      });
      form.reset();
      commit();
    });

    document.getElementById('add-req-row').addEventListener('click', () => addReqRow());

    document.getElementById('target-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const reqs = [...document.querySelectorAll('#req-rows .req-row')]
        .map((row) => ({
          materialId: row.querySelector('select').value,
          qty: toNum(row.querySelector('input').value),
        }))
        .filter((r) => r.materialId && r.qty > 0);
      if (reqs.length === 0) {
        alert('素材を1つ以上（個数1以上）選んでください');
        return;
      }
      const merged = mergeReqs(reqs);
      // 目標名は素材から自動で付ける（例:「ヒヒイロカネ ほか2種」）
      const first = findMaterial(merged[0].materialId).name;
      const name = merged.length > 1 ? `${first} ほか${merged.length - 1}種` : first;
      app.state.targets.push({ id: uid(), name, done: false, reqs: merged });
      form.reset();
      document.getElementById('req-rows').replaceChildren();
      addReqRow();
      commit();
    });

    const all = document.getElementById('all-materials');
    all.open = openIds.has('all-materials');
    all.addEventListener('toggle', () => setOpen('all-materials', all.open));

    const toggleTargets = (open) => {
      for (const t of app.state.targets) setOpen(t.id, open);
      render();
    };
    document.getElementById('open-all').addEventListener('click', () => toggleTargets(true));
    document.getElementById('close-all').addEventListener('click', () => toggleTargets(false));

    migrateMaterialNames();
    initPresets();
    addReqRow();
    render();
  }

  // 仮の名前で登録済みの素材を正式名称に置き換える。同名の素材がすでにあれば1つにまとめる
  function migrateMaterialNames() {
    let changed = false;
    for (const m of [...app.state.materials]) {
      const to = PRESET_RENAMES[m.name];
      if (!to) continue;
      const existing = app.state.materials.find((x) => x.name === to);
      if (existing) {
        existing.owned += m.owned;
        existing.perRun = existing.perRun || m.perRun;
        for (const t of app.state.targets) {
          for (const r of t.reqs) if (r.materialId === m.id) r.materialId = existing.id;
          t.reqs = mergeReqs(t.reqs);
        }
        app.state.materials = app.state.materials.filter((x) => x !== m);
      } else {
        m.name = to;
      }
      changed = true;
    }
    if (changed) app.save();
  }

  function initPresets() {
    const form = document.getElementById('preset-form');
    const groupSelect = form.elements.group;
    const subSelect = form.elements.sub;
    const select = form.elements.preset;
    const info = document.getElementById('preset-info');

    // コンテンツ → (キャラ名など。sub があるコンテンツのみ) → プリセット
    // キャラ・武器などの大分類ごとに見出しを付けて並べる
    groupSelect.append(el('option', { value: '', text: 'コンテンツを選択' }));
    for (const category of PRESET_CATEGORIES) {
      const groups = [...new Set(PRESETS.filter((p) => presetCategory(p) === category).map((p) => p.group))];
      if (groups.length === 0) continue;
      groupSelect.append(el('optgroup', { label: category }, groups.map((g) => el('option', { value: g, text: g }))));
    }

    function fillPresets(items, emptyText) {
      select.replaceChildren(
        el('option', { value: '', text: items.length ? 'プリセットを選択' : emptyText }),
        ...items.map((p) => el('option', { value: p.id, text: p.name })),
      );
      select.disabled = items.length === 0;
      info.replaceChildren();
    }

    let subLabel = '';
    groupSelect.addEventListener('change', () => {
      const items = PRESETS.filter((p) => p.group === groupSelect.value);
      const subs = [...new Set(items.map((p) => p.sub).filter(Boolean))];
      subLabel = { 十天衆: 'キャラ', 十賢者: 'キャラ', '天星器（十天衆加入）': '変更先の属性' }[groupSelect.value] || '武器';
      subSelect.hidden = subs.length === 0;
      subSelect.setAttribute('aria-label', subLabel);
      subSelect.replaceChildren(
        el('option', { value: '', text: `${subLabel}を選択` }),
        ...subs.map((s) => el('option', { value: s, text: s })),
      );
      if (subs.length) fillPresets([], `先に${subLabel}を選択`);
      else fillPresets(items, '先にコンテンツを選択');
    });

    subSelect.addEventListener('change', () => {
      const items = PRESETS.filter((p) => p.group === groupSelect.value && p.sub === subSelect.value);
      fillPresets(items, `先に${subLabel}を選択`);
    });
    groupSelect.dispatchEvent(new Event('change'));

    select.addEventListener('change', () => {
      const p = PRESETS.find((x) => x.id === select.value);
      info.replaceChildren();
      if (!p) return;
      info.append(
        p.reqs.map((r) => `${r.name}×${formatNum(r.qty)}`).join('、'),
        el('br'),
        p.note ? `※${p.note}　` : '',
        el('a', { href: p.source, target: '_blank', rel: 'noopener', text: '出典' }),
      );
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const p = PRESETS.find((x) => x.id === select.value);
      if (!p) return;
      const count = Math.max(1, Math.floor(toNum(form.elements.count.value)));
      addTargetFromPreset(p, count);
    });
  }

  // プリセットから目標を作る。未登録の素材は所持数0で自動追加する
  function addTargetFromPreset(preset, count) {
    const reqs = preset.reqs.map((r) => {
      let m = app.state.materials.find((x) => x.name === r.name);
      if (!m) {
        m = { id: uid(), name: r.name, owned: 0, perRun: 0 };
        app.state.materials.push(m);
      }
      return { materialId: m.id, qty: r.qty * count };
    });
    app.state.targets.push({
      id: uid(),
      name: count > 1 ? `${presetLabel(preset)} ×${count}` : presetLabel(preset),
      category: presetCategory(preset),
      done: false,
      reqs: mergeReqs(reqs),
    });
    commit();
  }

  // 同じ素材が複数行に入力されていたら合算する
  function mergeReqs(reqs) {
    const map = new Map();
    for (const r of reqs) map.set(r.materialId, (map.get(r.materialId) || 0) + r.qty);
    return [...map].map(([materialId, qty]) => ({ materialId, qty }));
  }

  function addReqRow() {
    const row = el('div', { class: 'req-row' }, [
      materialSelect(),
      el('input', { type: 'number', min: '1', placeholder: '個数', 'aria-label': '個数' }),
      el('button', { type: 'button', text: '×', class: 'icon', 'aria-label': 'この行を削除', onclick: () => row.remove() }),
    ]);
    document.getElementById('req-rows').append(row);
  }

  function materialSelect(selectedId = '') {
    const select = el('select', { 'aria-label': '素材' }, el('option', { value: '', text: '素材を選択' }));
    for (const m of app.state.materials) {
      select.append(el('option', { value: m.id, text: m.name, selected: m.id === selectedId }));
    }
    return select;
  }

  function findMaterial(id) {
    return app.state.materials.find((m) => m.id === id);
  }

  // 未完了の目標から素材ごとの必要数を集計
  function requiredTotals() {
    const totals = new Map();
    for (const t of app.state.targets) {
      if (t.done) continue;
      for (const r of t.reqs) totals.set(r.materialId, (totals.get(r.materialId) || 0) + r.qty);
    }
    return totals;
  }

  function commit() {
    app.save();
    render();
  }

  function render() {
    renderMaterials();
    renderTargets();
    refreshSelects();
  }

  // 目標登録フォームの素材プルダウンを最新の素材一覧に合わせる（選択は維持）
  function refreshSelects() {
    for (const select of document.querySelectorAll('#req-rows select')) {
      select.replaceWith(materialSelect(select.value));
    }
  }

  function renderMaterials() {
    const tbody = document.querySelector('#material-table tbody');
    const totals = requiredTotals();
    tbody.replaceChildren();

    if (app.state.materials.length === 0) {
      tbody.append(el('tr', {}, el('td', { colSpan: 7, class: 'empty', text: 'まだ素材がありません。' })));
      return;
    }
    for (const m of app.state.materials) {
      tbody.append(materialRow(m, totals.get(m.id) || 0, { deletable: true }));
    }
  }

  // 素材1行分。全素材の合計表と、各目標の中の表で使う
  function materialRow(m, need, { deletable = false, sharedWith = [] } = {}) {
    const short = Math.max(0, need - m.owned);
    const runs = short === 0 ? '—' : m.perRun > 0 ? `約${formatNum(Math.ceil(short / m.perRun))}周` : '—';

    const ownedInput = el('input', {
      type: 'number', min: '0', value: m.owned, class: 'num',
      'aria-label': `${m.name}の所持数`,
      onchange: (e) => { m.owned = toNum(e.target.value); commit(); },
    });
    const perRunInput = el('input', {
      type: 'number', min: '0', step: '0.01', value: m.perRun || '', class: 'num',
      'aria-label': `${m.name}の1周あたり平均ドロップ`,
      onchange: (e) => { m.perRun = toNum(e.target.value); commit(); },
    });
    const step = (d) => () => { m.owned = Math.max(0, m.owned + d); commit(); };

    return el('tr', { class: short > 0 ? 'short' : need > 0 ? 'ok' : '' }, [
      el('td', {}, el('div', { class: 'mat-name' }, [
        el('span', { class: 'icon-wrap' }, [
          el('button', {
            type: 'button', class: 'icon-button',
            title: m.icon ? 'クリックで画像を変更' : 'クリックで画像を登録',
            'aria-label': `${m.name}の画像を${m.icon ? '変更' : '登録'}`,
            onclick: () => setMaterialIcon(m),
          }, MaterialIcon.create(m)),
          m.icon ? el('button', {
            type: 'button', class: 'icon-remove', text: '✕',
            title: '画像を外す', 'aria-label': `${m.name}の画像を外す`,
            onclick: () => removeMaterialIcon(m),
          }) : null,
        ]),
        el('span', { class: 'mat-label' }, [
          el('button', {
            type: 'button', class: 'link', text: m.name, title: 'クリックで名前を変更',
            onclick: () => renameMaterial(m),
          }),
          MaterialSource.of(m.name) ? el('small', { class: 'mat-source', text: `入手: ${MaterialSource.of(m.name)}` }) : null,
        ]),
        sharedWith.length ? el('span', {
          class: 'badge shared', text: '共通',
          title: `ほかの目標でも使用: ${sharedWith.join('、')}`,
        }) : null,
      ])),
      el('td', {}, el('div', { class: 'stepper' }, [
        el('button', { type: 'button', class: 'icon', text: '−', 'aria-label': `${m.name}を1減らす`, onclick: step(-1) }),
        ownedInput,
        el('button', { type: 'button', class: 'icon', text: '+', 'aria-label': `${m.name}を1増やす`, onclick: step(1) }),
      ])),
      el('td', { text: formatNum(need) }),
      el('td', { class: 'short-cell', text: short > 0 ? formatNum(short) : '0' }),
      el('td', {}, perRunInput),
      el('td', { text: runs }),
      deletable ? el('td', {}, el('button', {
        type: 'button', class: 'icon danger', text: '削除',
        onclick: () => deleteMaterial(m),
      })) : null,
    ]);
  }

  async function setMaterialIcon(m) {
    const file = await MaterialIcon.pickFile();
    if (!file) return;
    let icon;
    try {
      icon = await MaterialIcon.fileToIcon(file);
    } catch (e) {
      alert(e.message);
      return;
    }
    const prev = m.icon;
    m.icon = icon;
    if (!app.save()) {
      m.icon = prev;
      alert('保存容量が足りないため、画像を登録できませんでした。使っていない素材の画像を外してから試してください。');
      return;
    }
    render();
  }

  function removeMaterialIcon(m) {
    if (!confirm(`「${m.name}」の画像を外しますか？`)) return;
    delete m.icon;
    commit();
  }

  function renameMaterial(m) {
    const name = prompt('新しい素材名', m.name)?.trim();
    if (!name || name === m.name) return;
    if (app.state.materials.some((x) => x.name === name)) {
      alert('同じ名前の素材がすでにあります');
      return;
    }
    m.name = name;
    commit();
  }

  function deleteMaterial(m) {
    const used = app.state.targets.filter((t) => t.reqs.some((r) => r.materialId === m.id));
    const msg = used.length
      ? `「${m.name}」は ${used.length} 件の目標で使われています。目標からも取り除いて削除しますか？`
      : `「${m.name}」を削除しますか？`;
    if (!confirm(msg)) return;
    app.state.materials = app.state.materials.filter((x) => x.id !== m.id);
    for (const t of app.state.targets) t.reqs = t.reqs.filter((r) => r.materialId !== m.id);
    commit();
  }

  function renderTargets() {
    const list = document.getElementById('target-list');
    list.replaceChildren();

    if (app.state.targets.length === 0) {
      list.append(el('p', { class: 'empty', text: 'まだ目標がありません。上のフォームから追加してください。' }));
      return;
    }

    const active = app.state.targets.filter((t) => !t.done);
    const done = app.state.targets.filter((t) => t.done);
    // キャラ・武器・その他（自分で素材を指定した目標）に分けて並べる
    for (const category of PRESET_CATEGORIES) {
      const items = active.filter((t) => categoryOf(t) === category);
      if (items.length === 0) continue;
      list.append(el('h3', { class: 'target-group' }, [category, el('span', { class: 'target-group-count', text: `${items.length}件` })]));
      for (const t of items) list.append(targetCard(t, active));
    }
    if (active.length === 0) list.append(el('p', { class: 'empty', text: '未完了の目標はありません。' }));

    if (done.length) {
      list.append(details('done-list', { class: 'done-list' }, [
        el('summary', { text: `完了済み（${done.length}件）` }),
        ...done.map((t) => targetCard(t, active)),
      ]));
    }
  }

  // 目標の大分類。分類を持たない以前の目標は、名前からプリセットを探して決める
  let labelCategories;
  function categoryOf(t) {
    if (t.category) return t.category;
    if (!labelCategories) {
      labelCategories = new Map(PRESETS.map((p) => [presetLabel(p), presetCategory(p)]));
    }
    const base = t.name.replace(/(（コピー）)+$/, '').replace(/ ×\d+$/, '');
    return labelCategories.get(base) || 'その他';
  }

  // 素材ごとの達成率の平均（ルピのように桁が大きい素材があっても偏らないように）
  function progressOf(t) {
    if (t.reqs.length === 0) return { ratio: 1, readyCount: 0 };
    let sum = 0;
    let readyCount = 0;
    for (const r of t.reqs) {
      const owned = findMaterial(r.materialId)?.owned || 0;
      sum += Math.min(1, owned / r.qty);
      if (owned >= r.qty) readyCount++;
    }
    return { ratio: sum / t.reqs.length, readyCount };
  }

  function targetCard(t, active) {
    const { ratio, readyCount } = progressOf(t);
    const ready = readyCount === t.reqs.length;
    const status = t.done ? '完了' : ready ? '素材そろった！' : `${readyCount}/${t.reqs.length}種そろった`;

    const summary = el('summary', {}, [
      el('div', { class: 'target-head' }, [
        el('strong', { text: t.name }),
        el('span', { class: 'badge', text: status }),
      ]),
      t.done ? null : el('div', { class: 'bar small' }, el('div', { class: 'bar-fill', style: `width:${ratio * 100}%` })),
    ]);

    let body;
    if (t.done) {
      // 完了済みは使った素材を一覧で表示するだけ
      body = el('ul', { class: 'done-items' }, t.reqs.map((r) => {
        const m = findMaterial(r.materialId);
        return el('li', {}, [m ? MaterialIcon.create(m, 20) : null, `${m?.name ?? '(削除済み)'} × ${formatNum(r.qty)}`]);
      }));
    } else {
      const rows = t.reqs.map((r) => {
        const m = findMaterial(r.materialId);
        if (!m) return null;
        const sharedWith = active
          .filter((o) => o !== t && o.reqs.some((x) => x.materialId === m.id))
          .map((o) => o.name);
        return materialRow(m, r.qty, { sharedWith });
      });
      body = el('div', { class: 'table-wrap' }, el('table', { class: 'target-table' }, [
        el('thead', {}, el('tr', {}, ['素材', '所持', '必要', '不足', '1周平均', '目安周回'].map((h) => el('th', { text: h })))),
        el('tbody', {}, rows),
      ]));
    }

    const buttons = t.done
      ? [el('button', { type: 'button', text: '未完了に戻す', onclick: () => undoTarget(t) })]
      : [el('button', {
          type: 'button', text: '完了（素材を消費）', disabled: !ready,
          title: ready ? '' : '素材が足りていません',
          onclick: () => completeTarget(t),
        })];
    buttons.push(
      el('button', { type: 'button', text: '複製', onclick: () => duplicateTarget(t) }),
      el('button', { type: 'button', class: 'danger', text: '削除', onclick: () => deleteTarget(t) }),
    );

    return details(t.id, { class: `target ${t.done ? 'done' : ready ? 'ready' : ''}` }, [
      summary,
      el('div', { class: 'target-body' }, [
        body,
        t.done ? null : el('p', { class: 'hint', text: '「共通」の素材はほかの目標でも使います。合計の不足は下の「全素材の合計」で確認できます。' }),
        el('div', { class: 'row-buttons' }, buttons),
      ]),
    ]);
  }

  function completeTarget(t) {
    if (!confirm(`「${t.name}」を完了にして、所持数から素材を差し引きますか？`)) return;
    for (const r of t.reqs) {
      const m = findMaterial(r.materialId);
      if (m) m.owned = Math.max(0, m.owned - r.qty);
    }
    t.done = true;
    commit();
  }

  function undoTarget(t) {
    if (!confirm(`「${t.name}」を未完了に戻して、消費した素材を所持数に戻しますか？`)) return;
    for (const r of t.reqs) {
      const m = findMaterial(r.materialId);
      if (m) m.owned += r.qty;
    }
    t.done = false;
    commit();
  }

  function duplicateTarget(t) {
    app.state.targets.push({
      id: uid(),
      name: `${t.name}（コピー）`,
      category: categoryOf(t),
      done: false,
      reqs: t.reqs.map((r) => ({ ...r })),
    });
    commit();
  }

  function deleteTarget(t) {
    if (!confirm(`「${t.name}」を削除しますか？（所持数は変わりません）`)) return;
    app.state.targets = app.state.targets.filter((x) => x.id !== t.id);
    setOpen(t.id, false);
    commit();
  }

  return { init };
})();
