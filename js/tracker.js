// 素材トラッカー
const Tracker = (() => {
  let app; // { state, save }

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
      const name = form.elements.name.value.trim();
      const reqs = [...document.querySelectorAll('#req-rows .req-row')]
        .map((row) => ({
          materialId: row.querySelector('select').value,
          qty: toNum(row.querySelector('input').value),
        }))
        .filter((r) => r.materialId && r.qty > 0);
      if (!name || reqs.length === 0) {
        alert('目標名と、1つ以上の素材（個数1以上）を入力してください');
        return;
      }
      app.state.targets.push({ id: uid(), name, done: false, reqs: mergeReqs(reqs) });
      form.reset();
      document.getElementById('req-rows').replaceChildren();
      addReqRow();
      commit();
    });

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
    const select = form.elements.preset;
    const info = document.getElementById('preset-info');

    select.append(el('option', { value: '', text: 'プリセットを選択' }));
    const groups = new Map();
    for (const p of PRESETS) {
      if (!groups.has(p.group)) {
        groups.set(p.group, el('optgroup', { label: p.group }));
        select.append(groups.get(p.group));
      }
      groups.get(p.group).append(el('option', { value: p.id, text: p.name }));
    }

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
      name: count > 1 ? `${preset.name} ×${count}` : preset.name,
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
      el('input', { type: 'number', min: '1', placeholder: '個数' }),
      el('button', { type: 'button', text: '×', class: 'icon', onclick: () => row.remove() }),
    ]);
    document.getElementById('req-rows').append(row);
  }

  function materialSelect(selectedId = '') {
    const select = el('select', {}, el('option', { value: '', text: '素材を選択' }));
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
      tbody.append(el('tr', {}, el('td', { colSpan: 7, class: 'empty', text: 'まだ素材がありません。上のフォームから追加してください。' })));
      return;
    }

    for (const m of app.state.materials) {
      const need = totals.get(m.id) || 0;
      const short = Math.max(0, need - m.owned);
      const runs = short === 0 ? '—' : m.perRun > 0 ? `約${formatNum(Math.ceil(short / m.perRun))}周` : '—';

      const ownedInput = el('input', {
        type: 'number', min: '0', value: m.owned, class: 'num',
        onchange: (e) => { m.owned = toNum(e.target.value); commit(); },
      });
      const perRunInput = el('input', {
        type: 'number', min: '0', step: '0.01', value: m.perRun || '', class: 'num',
        onchange: (e) => { m.perRun = toNum(e.target.value); commit(); },
      });
      const step = (d) => () => { m.owned = Math.max(0, m.owned + d); commit(); };

      tbody.append(el('tr', { class: short > 0 ? 'short' : need > 0 ? 'ok' : '' }, [
        el('td', {}, el('button', {
          type: 'button', class: 'link', text: m.name, title: 'クリックで名前を変更',
          onclick: () => renameMaterial(m),
        })),
        el('td', {}, el('div', { class: 'stepper' }, [
          el('button', { type: 'button', class: 'icon', text: '−', onclick: step(-1) }),
          ownedInput,
          el('button', { type: 'button', class: 'icon', text: '+', onclick: step(1) }),
        ])),
        el('td', { text: formatNum(need) }),
        el('td', { class: 'short-cell', text: short > 0 ? formatNum(short) : '0' }),
        el('td', {}, perRunInput),
        el('td', { text: runs }),
        el('td', {}, el('button', {
          type: 'button', class: 'icon danger', text: '削除',
          onclick: () => deleteMaterial(m),
        })),
      ]));
    }
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
      list.append(el('p', { class: 'empty', text: 'まだ目標がありません。' }));
      return;
    }

    // 未完了を先に表示
    const sorted = [...app.state.targets].sort((a, b) => a.done - b.done);
    for (const t of sorted) {
      const ready = t.reqs.every((r) => (findMaterial(r.materialId)?.owned || 0) >= r.qty);
      const items = t.reqs.map((r) => {
        const m = findMaterial(r.materialId);
        const owned = m?.owned || 0;
        const enough = t.done || owned >= r.qty;
        return el('li', { class: enough ? 'ok' : 'short' },
          t.done
            ? `${m?.name ?? '(削除済み)'} × ${formatNum(r.qty)}`
            : `${m?.name ?? '(削除済み)'}  ${formatNum(Math.min(owned, r.qty))} / ${formatNum(r.qty)}`);
      });

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

      list.append(el('div', { class: `target ${t.done ? 'done' : ready ? 'ready' : ''}` }, [
        el('div', { class: 'target-head' }, [
          el('strong', { text: t.name }),
          el('span', { class: 'badge', text: t.done ? '完了' : ready ? '素材そろった！' : '収集中' }),
        ]),
        el('ul', {}, items),
        el('div', { class: 'row-buttons' }, buttons),
      ]));
    }
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
      done: false,
      reqs: t.reqs.map((r) => ({ ...r })),
    });
    commit();
  }

  function deleteTarget(t) {
    if (!confirm(`「${t.name}」を削除しますか？（所持数は変わりません）`)) return;
    app.state.targets = app.state.targets.filter((x) => x.id !== t.id);
    commit();
  }

  return { init, render };
})();
