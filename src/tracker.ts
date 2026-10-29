import { el, byId, formField, uid, toNum, formatNum } from './util.ts';
import type { Props, Child } from './util.ts';
import type { AppState, Category, Material, Requirement, Target } from './storage.ts';
import { MaterialIcon } from './icons.ts';
import { PRESETS, PRESET_RENAMES, PRESET_CATEGORIES, presetCategory, presetLabel } from './presets.ts';
import type { Preset } from './presets.ts';

// init に渡すアプリの状態（app.ts の app）の形
interface App {
  state: AppState;
  save(): boolean;
}

// 素材トラッカー
export const Tracker = (() => {
  let app: App;

  // 開いている目標などの ID。再描画しても開閉状態を保つため、この閲覧者のブラウザに覚えておく
  const OPEN_KEY = 'gbf-tools-open';
  const openIds = new Set(loadOpenIds());

  function loadOpenIds(): string[] {
    try {
      const raw = localStorage.getItem(OPEN_KEY);
      // 保存されている値はどんな形か分からないので、文字列の配列のときだけ使う
      const ids: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  function setOpen(id: string, open: boolean): void {
    if (open) openIds.add(id);
    else openIds.delete(id);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...openIds])); } catch {}
  }

  // 開閉状態を覚える <details> を作る
  function details(id: string, props: Props, children: Child[]): HTMLDetailsElement {
    const node = el('details', { ...props, open: openIds.has(id) }, children);
    node.addEventListener('toggle', () => setOpen(id, node.open));
    return node;
  }

  function init(appRef: App): void {
    app = appRef;

    byId('add-req-row', HTMLButtonElement).addEventListener('click', () => addReqRow());

    const targetForm = byId('target-form', HTMLFormElement);
    targetForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rows = [...document.querySelectorAll('#req-rows .req-row')]
        .map((row) => ({
          // 前の版の仮の名前で入力されても、正式名称にそろえる
          name: renamed(row.querySelector<HTMLInputElement>('.req-name')?.value.trim() ?? ''),
          qty: toNum(row.querySelector<HTMLInputElement>('.req-qty')?.value),
        }))
        .filter((r) => r.name && r.qty > 0);
      if (rows.length === 0) {
        alert('素材名を1つ以上（個数1以上）入力してください');
        return;
      }
      // 未登録の素材はここで登録される
      const merged = mergeReqs(rows.map((r) => ({ materialId: materialByName(r.name).id, qty: r.qty })));
      // 目標名は素材から自動で付ける（例:「ヒヒイロカネ ほか2種」）
      const first = findMaterial(merged[0].materialId)?.name ?? '';
      const name = merged.length > 1 ? `${first} ほか${merged.length - 1}種` : first;
      app.state.targets.push({ id: uid(), name, done: false, reqs: merged });
      showCategory('その他');
      targetForm.reset();
      byId('req-rows', HTMLDivElement).replaceChildren();
      addReqRow();
      commit();
    });

    const all = byId('all-materials', HTMLDetailsElement);
    all.open = openIds.has('all-materials');
    all.addEventListener('toggle', () => setOpen('all-materials', all.open));

    const toggleTargets = (open: boolean) => {
      for (const t of app.state.targets) setOpen(t.id, open);
      render();
    };
    byId('open-all', HTMLButtonElement).addEventListener('click', () => toggleTargets(true));
    byId('close-all', HTMLButtonElement).addEventListener('click', () => toggleTargets(false));

    migrateMaterialNames();
    initPresets();
    addReqRow();
    render();
  }

  // 前の版の仮の名前なら正式名称を、そうでなければそのままの名前を返す
  // Object.hasOwn で、移行表に自分で書いた名前だけを見る（「constructor」など、どのオブジェクトにもある名前を拾わないため）
  function renamed(name: string): string {
    return Object.hasOwn(PRESET_RENAMES, name) ? PRESET_RENAMES[name] : name;
  }

  // 仮の名前で登録済みの素材を正式名称に置き換える。同名の素材がすでにあれば1つにまとめる
  function migrateMaterialNames(): void {
    let changed = false;
    for (const m of [...app.state.materials]) {
      const to = renamed(m.name);
      if (to === m.name) continue;
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

  // プリセットに出てくる素材の名前（重複なし、最初に出てきた順）。素材名の入力欄の候補に使う
  const PRESET_MATERIAL_NAMES = [...new Set(PRESETS.flatMap((p) => p.reqs.map((r) => r.name)))];

  // プリセットを選ぶ欄で、2段目（キャラ名など）を何と呼ぶか。ここにないコンテンツは「武器」
  const SUB_LABELS: Record<string, string> = { 十天衆: 'キャラ', 十賢者: 'キャラ', '天星器（十天衆加入）': '変更先の属性' };

  function initPresets(): void {
    const form = byId('preset-form', HTMLFormElement);
    const groupSelect = formField(form, 'group', HTMLSelectElement);
    const subSelect = formField(form, 'sub', HTMLSelectElement);
    const select = formField(form, 'preset', HTMLSelectElement);
    const countInput = formField(form, 'count', HTMLInputElement);
    const info = byId('preset-info', HTMLParagraphElement);

    // コンテンツ → (キャラ名など。sub があるコンテンツのみ) → プリセット
    // キャラ・武器などの大分類ごとに見出しを付けて並べる
    groupSelect.append(el('option', { value: '', text: 'コンテンツを選択' }));
    for (const category of PRESET_CATEGORIES) {
      const groups = [...new Set(PRESETS.filter((p) => presetCategory(p) === category).map((p) => p.group))];
      if (groups.length === 0) continue;
      groupSelect.append(el('optgroup', { label: category }, groups.map((g) => el('option', { value: g, text: g }))));
    }

    function fillPresets(items: Preset[], emptyText: string): void {
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
      // sub がないプリセットは除く。(s): s is string は「true を返したものは文字列」と TypeScript に教える書き方
      const subs = [...new Set(items.map((p) => p.sub).filter((s): s is string => Boolean(s)))];
      subLabel = SUB_LABELS[groupSelect.value] || '武器';
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
      const count = Math.max(1, Math.floor(toNum(countInput.value)));
      addTargetFromPreset(p, count);
    });
  }

  // 名前で素材を探す。まだ登録されていなければ所持数0で登録する
  function materialByName(name: string): Material {
    let m = app.state.materials.find((x) => x.name === name);
    if (!m) {
      m = { id: uid(), name, owned: 0, perRun: 0 };
      app.state.materials.push(m);
    }
    return m;
  }

  // プリセットから目標を作る。未登録の素材は所持数0で自動追加する
  function addTargetFromPreset(preset: Preset, count: number): void {
    const reqs = preset.reqs.map((r) => ({ materialId: materialByName(r.name).id, qty: r.qty * count }));
    app.state.targets.push({
      id: uid(),
      name: count > 1 ? `${presetLabel(preset)} ×${count}` : presetLabel(preset),
      category: presetCategory(preset),
      done: false,
      reqs: mergeReqs(reqs),
    });
    showCategory(presetCategory(preset));
    commit();
  }

  // 同じ素材が複数行に入力されていたら合算する
  function mergeReqs(reqs: Requirement[]): Requirement[] {
    const map = new Map<string, number>();
    for (const r of reqs) map.set(r.materialId, (map.get(r.materialId) || 0) + r.qty);
    return [...map].map(([materialId, qty]) => ({ materialId, qty }));
  }

  function addReqRow(): void {
    // 削除ボタンの中で row 自身を使うので、型を先に書いておく（書かないと TypeScript が型を決められない）
    const row: HTMLDivElement = el('div', { class: 'req-row' }, [
      // list で候補（index.html の <datalist id="material-names">）をつなぐ。autocomplete は、ブラウザが覚えた入力履歴を混ぜないために切る
      el('input', {
        class: 'req-name', list: 'material-names', autocomplete: 'off',
        placeholder: '素材名（入力すると候補が出ます）', 'aria-label': '素材名',
      }),
      el('input', { class: 'req-qty', type: 'number', min: '1', placeholder: '個数', 'aria-label': '個数' }),
      el('button', { type: 'button', text: '×', class: 'icon', 'aria-label': 'この行を削除', onclick: () => row.remove() }),
    ]);
    byId('req-rows', HTMLDivElement).append(row);
  }

  // 素材が見つからないとき（削除済みなど）は undefined
  function findMaterial(id: string): Material | undefined {
    return app.state.materials.find((m) => m.id === id);
  }

  // 未完了の目標から素材ごとの必要数を集計（素材 ID → 必要数）
  function requiredTotals(): Map<string, number> {
    const totals = new Map<string, number>();
    for (const t of app.state.targets) {
      if (t.done) continue;
      for (const r of t.reqs) totals.set(r.materialId, (totals.get(r.materialId) || 0) + r.qty);
    }
    return totals;
  }

  function commit(): void {
    app.save();
    render();
  }

  function render(): void {
    renderMaterials();
    renderTargets();
    refreshMaterialNames();
  }

  // 素材名の入力欄の候補を、登録済みの素材（先に並べる）とプリセットに出てくる素材に合わせる
  function refreshMaterialNames(): void {
    const names = new Set([...app.state.materials.map((m) => m.name), ...PRESET_MATERIAL_NAMES]);
    byId('material-names', HTMLDataListElement).replaceChildren(...[...names].map((name) => el('option', { value: name })));
  }

  function renderMaterials(): void {
    const grid = byId('material-grid', HTMLDivElement);
    const totals = requiredTotals();
    grid.replaceChildren();

    if (app.state.materials.length === 0) {
      grid.append(el('p', { class: 'empty', text: 'まだ素材がありません。' }));
      return;
    }
    for (const m of app.state.materials) {
      grid.append(materialTile(m, totals.get(m.id) || 0));
    }
  }

  // ---------- 素材1つ分の部品（全素材の合計のタイルと、各目標の中の表で使う） ----------

  // 不足していれば short、足りていれば ok（どの目標にも使っていなければ空）。色分けに使う
  function statusClass(need: number, short: number): string {
    return short > 0 ? 'short' : need > 0 ? 'ok' : '';
  }

  // 不足分を集める周回数の目安
  function runsText(m: Material, short: number): string {
    return short > 0 && m.perRun > 0 ? `約${formatNum(Math.ceil(short / m.perRun))}周` : '—';
  }

  // アイコン（クリックで画像を登録・変更）と、画像を外すボタン
  function iconControl(m: Material, size?: number): HTMLSpanElement {
    return el('span', { class: 'icon-wrap' }, [
      el('button', {
        type: 'button', class: 'icon-button',
        title: m.icon ? 'クリックで画像を変更' : 'クリックで画像を登録',
        'aria-label': `${m.name}の画像を${m.icon ? '変更' : '登録'}`,
        onclick: () => setMaterialIcon(m),
      }, MaterialIcon.create(m, size)),
      m.icon ? el('button', {
        type: 'button', class: 'icon-remove', text: '✕',
        title: '画像を外す', 'aria-label': `${m.name}の画像を外す`,
        onclick: () => removeMaterialIcon(m),
      }) : null,
    ]);
  }

  // 素材名（クリックで名前を変更）
  function nameLabel(m: Material): HTMLSpanElement {
    return el('span', { class: 'mat-label' }, [
      el('button', {
        type: 'button', class: 'link', text: m.name, title: 'クリックで名前を変更',
        onclick: () => renameMaterial(m),
      }),
    ]);
  }

  // 所持数の入力欄と −・+ ボタン
  function ownedStepper(m: Material): HTMLDivElement {
    const input = el('input', {
      type: 'number', min: '0', value: m.owned, class: 'num',
      'aria-label': `${m.name}の所持数`,
    });
    input.addEventListener('change', () => { m.owned = toNum(input.value); commit(); });
    const step = (d: number) => () => { m.owned = Math.max(0, m.owned + d); commit(); };
    return el('div', { class: 'stepper' }, [
      el('button', { type: 'button', class: 'icon', text: '−', 'aria-label': `${m.name}を1減らす`, onclick: step(-1) }),
      input,
      el('button', { type: 'button', class: 'icon', text: '+', 'aria-label': `${m.name}を1増やす`, onclick: step(1) }),
    ]);
  }

  // 1周あたりの平均ドロップ数の入力欄
  function perRunInput(m: Material): HTMLInputElement {
    const input = el('input', {
      type: 'number', min: '0', step: '0.01', value: m.perRun || '', class: 'num',
      'aria-label': `${m.name}の1周あたり平均ドロップ`,
    });
    input.addEventListener('change', () => { m.perRun = toNum(input.value); commit(); });
    return input;
  }

  // 全素材の合計の、素材1つ分のタイル。いちばん大事な不足数を大きく出し、1周平均と削除は開いたときだけ出す
  function materialTile(m: Material, need: number): HTMLDivElement {
    const short = Math.max(0, need - m.owned);
    const status = short > 0
      ? el('div', { class: 'mat-short' }, [
          el('span', { class: 'mat-short-label', text: '不足' }),
          el('span', { class: 'mat-short-num', text: formatNum(short) }),
        ])
      : el('div', { class: 'mat-done', text: need > 0 ? '✓ OK' : '使う目標なし' });
    const sub = [`必要 ${formatNum(need)}`];
    if (short > 0 && m.perRun > 0) sub.push(runsText(m, short));
    return el('div', { class: `mat-tile ${statusClass(need, short)}` }, [
      el('div', { class: 'mat-name' }, [iconControl(m, 44), nameLabel(m)]),
      el('div', { class: 'mat-main' }, [
        status,
        el('div', { class: 'mat-owned' }, [el('span', { class: 'mat-field-label', text: '所持' }), ownedStepper(m)]),
      ]),
      el('p', { class: 'mat-sub', text: sub.join('・') }),
      details(`mat-${m.id}`, { class: 'mat-more' }, [
        el('summary', { text: '1周平均・削除' }),
        el('div', { class: 'mat-field' }, [
          el('span', { class: 'mat-field-label', text: '1周平均' }),
          perRunInput(m),
          el('button', { type: 'button', class: 'icon danger mat-delete', text: '削除', onclick: () => deleteMaterial(m) }),
        ]),
      ]),
    ]);
  }

  // 目標の中の表の、素材1行分。sharedWith はこの素材を使うほかの目標の名前
  function materialRow(m: Material, need: number, sharedWith: string[]): HTMLTableRowElement {
    const short = Math.max(0, need - m.owned);
    return el('tr', { class: statusClass(need, short) }, [
      el('td', {}, el('div', { class: 'mat-name' }, [
        iconControl(m),
        nameLabel(m),
        sharedWith.length ? el('span', {
          class: 'badge shared', text: '共通',
          title: `ほかの目標でも使用: ${sharedWith.join('、')}`,
        }) : null,
      ])),
      el('td', {}, ownedStepper(m)),
      el('td', { text: formatNum(need) }),
      el('td', { class: 'short-cell', text: formatNum(short) }),
      el('td', {}, perRunInput(m)),
      el('td', { text: runsText(m, short) }),
    ]);
  }

  async function setMaterialIcon(m: Material): Promise<void> {
    const file = await MaterialIcon.pickFile();
    if (!file) return;
    let icon: string;
    try {
      icon = await MaterialIcon.fileToIcon(file);
    } catch (e) {
      // catch で受け取る値は Error とは限らないので確かめる
      alert(e instanceof Error ? e.message : String(e));
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

  function removeMaterialIcon(m: Material): void {
    if (!confirm(`「${m.name}」の画像を外しますか？`)) return;
    delete m.icon;
    commit();
  }

  function renameMaterial(m: Material): void {
    const name = prompt('新しい素材名', m.name)?.trim();
    if (!name || name === m.name) return;
    if (app.state.materials.some((x) => x.name === name)) {
      alert('同じ名前の素材がすでにあります');
      return;
    }
    m.name = name;
    commit();
  }

  function deleteMaterial(m: Material): void {
    const used = app.state.targets.filter((t) => t.reqs.some((r) => r.materialId === m.id));
    const msg = used.length
      ? `「${m.name}」は ${used.length} 件の目標で使われています。目標からも取り除いて削除しますか？`
      : `「${m.name}」を削除しますか？`;
    if (!confirm(msg)) return;
    app.state.materials = app.state.materials.filter((x) => x.id !== m.id);
    for (const t of app.state.targets) t.reqs = t.reqs.filter((r) => r.materialId !== m.id);
    commit();
  }

  // 目標の一覧で選んでいるタブ。「すべて」か分類の名前。再読み込みしても保つため、この閲覧者のブラウザに覚えておく
  type Tab = Category | 'すべて';
  const TAB_KEY = 'gbf-tools-tab';
  let currentTab: Tab = loadTab();

  function loadTab(): Tab {
    try {
      // 保存されている値が分類の名前のときだけ使う
      const saved = localStorage.getItem(TAB_KEY);
      return PRESET_CATEGORIES.find((c) => c === saved) ?? 'すべて';
    } catch {
      return 'すべて';
    }
  }

  function saveTab(tab: Tab): void {
    currentTab = tab;
    try { localStorage.setItem(TAB_KEY, tab); } catch {}
  }

  function selectTab(tab: Tab): void {
    saveTab(tab);
    renderTargets();
  }

  // 目標を追加したとき、ほかの分類のタブを開いていたら、追加した目標が見えるタブに切り替える
  function showCategory(category: Category): void {
    if (currentTab !== 'すべて' && currentTab !== category) saveTab(category);
  }

  function renderTargets(): void {
    const list = byId('target-list', HTMLDivElement);
    const tabs = byId('target-tabs', HTMLDivElement);
    list.replaceChildren();
    tabs.replaceChildren();

    if (app.state.targets.length === 0) {
      list.append(el('p', { class: 'empty', text: 'まだ目標がありません。上のフォームから追加してください。' }));
      return;
    }

    const active = app.state.targets.filter((t) => !t.done);
    const done = app.state.targets.filter((t) => t.done);
    // キャラ・武器・その他（自分で素材を指定した目標）に分ける。未完了の目標がある分類だけタブにする
    const groups = PRESET_CATEGORIES
      .map((category) => ({ category, items: active.filter((t) => categoryOf(t) === category) }))
      .filter((g) => g.items.length > 0);
    // 選んでいた分類の目標がなくなったときは「すべて」に戻す
    if (currentTab !== 'すべて' && !groups.some((g) => g.category === currentTab)) saveTab('すべて');
    const tab = currentTab;

    if (active.length) {
      // aria-pressed は、押されている（選ばれている）ボタンを読み上げソフトに伝える
      const tabButton = (name: Tab, count: number) => el('button', {
        type: 'button', class: 'tab', 'aria-pressed': String(name === tab), onclick: () => selectTab(name),
      }, [name, el('span', { class: 'tab-count', text: String(count) })]);
      tabs.append(tabButton('すべて', active.length), ...groups.map((g) => tabButton(g.category, g.items.length)));
    }

    if (tab === 'すべて') {
      // 「すべて」では分類ごとに見出しを付けて並べる
      for (const g of groups) {
        list.append(el('h3', { class: 'target-group' }, [g.category, el('span', { class: 'target-group-count', text: `${g.items.length}件` })]));
        for (const t of g.items) list.append(targetCard(t, active));
      }
    } else {
      for (const t of groups.find((g) => g.category === tab)?.items ?? []) list.append(targetCard(t, active));
    }
    if (active.length === 0) list.append(el('p', { class: 'empty', text: '未完了の目標はありません。' }));

    const shownDone = tab === 'すべて' ? done : done.filter((t) => categoryOf(t) === tab);
    if (shownDone.length) {
      list.append(details('done-list', { class: 'done-list' }, [
        el('summary', { text: `完了済み（${shownDone.length}件）` }),
        ...shownDone.map((t) => targetCard(t, active)),
      ]));
    }
  }

  // 目標の大分類。分類を持たない以前の目標は、名前からプリセットを探して決める
  // 目標名 → 分類 の表。初めて使うときに作る
  let labelCategories: Map<string, Category> | undefined;
  function categoryOf(t: Target): Category {
    if (t.category) return t.category;
    if (!labelCategories) {
      labelCategories = new Map(PRESETS.map((p) => [presetLabel(p), presetCategory(p)]));
    }
    const base = t.name.replace(/(（コピー）)+$/, '').replace(/ ×\d+$/, '');
    return labelCategories.get(base) || 'その他';
  }

  // 素材ごとの達成率の平均（ルピのように桁が大きい素材があっても偏らないように）
  function progressOf(t: Target): { ratio: number; readyCount: number } {
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

  // active は未完了の目標の一覧（「共通」の表示に使う）
  function targetCard(t: Target, active: Target[]): HTMLDetailsElement {
    const { ratio, readyCount } = progressOf(t);
    const ready = readyCount === t.reqs.length;
    // 「完了」は完了ボタンを押した目標にだけ使う。素材が足りただけの目標は「OK」にして区別する
    const status = t.done ? '完了' : ready ? 'OK' : `${readyCount}/${t.reqs.length}種OK`;

    const summary = el('summary', {}, [
      el('div', { class: 'target-head' }, [
        el('strong', { text: t.name }),
        el('span', { class: 'badge', text: status }),
      ]),
      t.done ? null : el('div', { class: 'bar small' }, el('div', { class: 'bar-fill', style: `width:${ratio * 100}%` })),
    ]);

    let body: HTMLElement;
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
        return materialRow(m, r.qty, sharedWith);
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

  function completeTarget(t: Target): void {
    if (!confirm(`「${t.name}」を完了にして、所持数から素材を差し引きますか？`)) return;
    for (const r of t.reqs) {
      const m = findMaterial(r.materialId);
      if (m) m.owned = Math.max(0, m.owned - r.qty);
    }
    t.done = true;
    commit();
  }

  function undoTarget(t: Target): void {
    if (!confirm(`「${t.name}」を未完了に戻して、消費した素材を所持数に戻しますか？`)) return;
    for (const r of t.reqs) {
      const m = findMaterial(r.materialId);
      if (m) m.owned += r.qty;
    }
    t.done = false;
    commit();
  }

  function duplicateTarget(t: Target): void {
    app.state.targets.push({
      id: uid(),
      name: `${t.name}（コピー）`,
      category: categoryOf(t),
      done: false,
      reqs: t.reqs.map((r) => ({ ...r })),
    });
    commit();
  }

  function deleteTarget(t: Target): void {
    if (!confirm(`「${t.name}」を削除しますか？（所持数は変わりません）`)) return;
    app.state.targets = app.state.targets.filter((x) => x.id !== t.id);
    setOpen(t.id, false);
    commit();
  }

  return { init };
})();
