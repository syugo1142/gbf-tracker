// 素材トラッカー: 目標と素材の一覧を表示し、所持数の入力や、目標の追加・完了などを受け付ける
import { el, byId, uid, toNum, formatNum } from './util.ts';
import type { Props, Child } from './util.ts';
import type { Category, Material, Requirement, Target } from './storage.ts';
import { app } from './app.ts';
import { createIcon, fileToIcon, pickImageFile } from './icons.ts';
import { PRESETS, PRESET_RENAMES, PRESET_CATEGORIES, presetCategory, presetLabel } from './presets.ts';
import type { Preset } from './presets.ts';
import { initPresetForm } from './presetForm.ts';

// index.html の要素
const reqRows = byId('req-rows', HTMLDivElement);
const targetForm = byId('target-form', HTMLFormElement);
const allMaterials = byId('all-materials', HTMLDetailsElement);
const materialGrid = byId('material-grid', HTMLDivElement);
const materialNames = byId('material-names', HTMLDataListElement);
const targetList = byId('target-list', HTMLDivElement);
const targetTabs = byId('target-tabs', HTMLDivElement);

// プリセットに出てくる素材の名前（重複なし、最初に出てきた順）。素材名の入力欄の候補に使う
const PRESET_MATERIAL_NAMES = [...new Set(PRESETS.flatMap((p) => p.reqs.map((r) => r.name)))];

// プリセットの目標名 → 分類 の表。分類を持たない以前の目標の分類を、名前から決めるのに使う
const PRESET_LABEL_CATEGORIES = new Map(PRESETS.map((p) => [presetLabel(p), presetCategory(p)]));

// ---------- 開閉の状態 ----------

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
  if (open) {
    openIds.add(id);
  } else {
    openIds.delete(id);
  }
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify([...openIds]));
  } catch {
    // 覚えられなくても、開いている間は開閉できるので何もしない
  }
}

// 開閉状態を覚える <details> を作る
function details(id: string, props: Props, children: Child[]): HTMLDetailsElement {
  const node = el('details', { ...props, open: openIds.has(id) }, children);
  node.addEventListener('toggle', () => setOpen(id, node.open));
  return node;
}

// 「すべて開く」「すべて閉じる」
function setAllTargetsOpen(open: boolean): void {
  for (const t of app.state.targets) {
    setOpen(t.id, open);
  }
  render();
}

// ---------- 目標の一覧のタブ ----------

// 選んでいるタブ。「すべて」か分類の名前。再読み込みしても保つため、この閲覧者のブラウザに覚えておく
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
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    // 覚えられなくても、今のタブは currentTab で分かるので何もしない
  }
}

function selectTab(tab: Tab): void {
  saveTab(tab);
  renderTargets();
}

// 目標を追加したとき、ほかの分類のタブを開いていたら、追加した目標が見えるタブに切り替える
function showCategory(category: Category): void {
  if (currentTab !== 'すべて' && currentTab !== category) saveTab(category);
}

// ---------- 準備 ----------

export function initTracker(): void {
  byId('add-req-row', HTMLButtonElement).addEventListener('click', addReqRow);
  targetForm.addEventListener('submit', (e) => {
    // フォームを送ると、ふつうはページが読み込み直されるので、それを止める
    e.preventDefault();
    addCustomTarget();
  });

  allMaterials.open = openIds.has('all-materials');
  allMaterials.addEventListener('toggle', () => setOpen('all-materials', allMaterials.open));
  byId('open-all', HTMLButtonElement).addEventListener('click', () => setAllTargetsOpen(true));
  byId('close-all', HTMLButtonElement).addEventListener('click', () => setAllTargetsOpen(false));

  migrateMaterialNames();
  initPresetForm(addTargetFromPreset);
  addReqRow();
  render();
}

// ---------- 素材の名前の移行 ----------

// 前の版の仮の名前なら正式名称を、そうでなければそのままの名前を返す
// Object.hasOwn で、移行表に自分で書いた名前だけを見る（「constructor」など、どのオブジェクトにもある名前を拾わないため）
function renamed(name: string): string {
  return Object.hasOwn(PRESET_RENAMES, name) ? PRESET_RENAMES[name] : name;
}

// 仮の名前で登録済みの素材を正式名称に置き換える。同名の素材がすでにあれば1つにまとめる
function migrateMaterialNames(): void {
  let changed = false;
  // 途中で素材を消すことがあるので、写し（[...]）を順に見る
  for (const m of [...app.state.materials]) {
    const newName = renamed(m.name);
    if (newName === m.name) continue;
    const existing = app.state.materials.find((x) => x.name === newName);
    if (existing) {
      mergeMaterialInto(m, existing);
    } else {
      m.name = newName;
    }
    changed = true;
  }
  if (changed) app.save();
}

// 素材 from を素材 to にまとめる。所持数を足し、目標の中の from を to に置き換えて、from を消す
function mergeMaterialInto(from: Material, to: Material): void {
  to.owned += from.owned;
  // 1周平均は、まとめる先に入っていなければ（0 なら）from のものを使う
  to.perRun = to.perRun || from.perRun;
  for (const t of app.state.targets) {
    for (const r of t.reqs) {
      if (r.materialId === from.id) r.materialId = to.id;
    }
    t.reqs = mergeReqs(t.reqs);
  }
  app.state.materials = app.state.materials.filter((x) => x !== from);
}

// ---------- 自分で素材を指定して登録 ----------

// 素材名と個数の入力欄を1行足す
function addReqRow(): void {
  const row = el('div', { class: 'req-row' });
  row.append(
    // list で候補（index.html の <datalist id="material-names">）をつなぐ。autocomplete は、ブラウザが覚えた入力履歴を混ぜないために切る
    el('input', {
      class: 'req-name', list: 'material-names', autocomplete: 'off',
      placeholder: '素材名（入力すると候補が出ます）', 'aria-label': '素材名',
    }),
    el('input', { class: 'req-qty', type: 'number', min: '1', placeholder: '個数', 'aria-label': '個数' }),
    el('button', { type: 'button', text: '×', class: 'icon', 'aria-label': 'この行を削除', onclick: () => row.remove() }),
  );
  reqRows.append(row);
}

// 入力された行を読む。素材名が空の行と、個数が 0 の行は飛ばす
function readReqRows(): { name: string; qty: number }[] {
  const rows: { name: string; qty: number }[] = [];
  for (const row of reqRows.querySelectorAll('.req-row')) {
    // 前の版の仮の名前で入力されても、正式名称にそろえる
    const name = renamed(row.querySelector<HTMLInputElement>('.req-name')?.value.trim() ?? '');
    const qty = toNum(row.querySelector<HTMLInputElement>('.req-qty')?.value);
    if (name && qty > 0) rows.push({ name, qty });
  }
  return rows;
}

// 「目標を登録」: 入力された素材で目標を作る
function addCustomTarget(): void {
  const rows = readReqRows();
  if (rows.length === 0) {
    alert('素材名を1つ以上（個数1以上）入力してください');
    return;
  }
  // 未登録の素材は、ここで所持数0で登録される
  const reqs = mergeReqs(rows.map((r) => ({ materialId: materialByName(r.name).id, qty: r.qty })));
  app.state.targets.push({ id: uid(), name: customTargetName(reqs), done: false, reqs });
  showCategory('その他');
  targetForm.reset();
  reqRows.replaceChildren();
  addReqRow();
  commit();
}

// 自分で指定した目標の名前を、素材から付ける（例:「ヒヒイロカネ ほか2種」）
function customTargetName(reqs: Requirement[]): string {
  const first = findMaterial(reqs[0].materialId)?.name ?? '';
  return reqs.length > 1 ? `${first} ほか${reqs.length - 1}種` : first;
}

// ---------- 目標と素材を作る・探す ----------

// プリセットから目標を作る（presetForm.ts から呼ばれる）。未登録の素材は所持数0で自動追加する
function addTargetFromPreset(preset: Preset, count: number): void {
  const reqs = preset.reqs.map((r) => ({ materialId: materialByName(r.name).id, qty: r.qty * count }));
  const label = presetLabel(preset);
  app.state.targets.push({
    id: uid(),
    name: count > 1 ? `${label} ×${count}` : label,
    category: presetCategory(preset),
    done: false,
    reqs: mergeReqs(reqs),
  });
  showCategory(presetCategory(preset));
  commit();
}

// 名前で素材を探す。まだ登録されていなければ所持数0で登録する
function materialByName(name: string): Material {
  const found = app.state.materials.find((m) => m.name === name);
  if (found) return found;
  const created = { id: uid(), name, owned: 0, perRun: 0 };
  app.state.materials.push(created);
  return created;
}

// 素材が見つからないとき（削除済みなど）は undefined
function findMaterial(id: string): Material | undefined {
  return app.state.materials.find((m) => m.id === id);
}

// 同じ素材が複数行にあれば、1行にまとめて個数を足す
function mergeReqs(reqs: Requirement[]): Requirement[] {
  const totals = new Map<string, number>();
  for (const r of reqs) {
    totals.set(r.materialId, (totals.get(r.materialId) || 0) + r.qty);
  }
  return [...totals].map(([materialId, qty]) => ({ materialId, qty }));
}

// 未完了の目標から、素材ごとの必要数を合計する（素材 ID → 必要数）
function requiredTotals(): Map<string, number> {
  const totals = new Map<string, number>();
  for (const t of app.state.targets) {
    if (t.done) continue;
    for (const r of t.reqs) {
      totals.set(r.materialId, (totals.get(r.materialId) || 0) + r.qty);
    }
  }
  return totals;
}

// ---------- 描画 ----------

// 状態を保存して、画面を作り直す
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
  materialNames.replaceChildren(...[...names].map((name) => el('option', { value: name })));
}

// 「全素材の合計」に、素材ごとのタイルを並べる
function renderMaterials(): void {
  materialGrid.replaceChildren();
  if (app.state.materials.length === 0) {
    materialGrid.append(el('p', { class: 'empty', text: 'まだ素材がありません。' }));
    return;
  }
  const totals = requiredTotals();
  for (const m of app.state.materials) {
    materialGrid.append(materialTile(m, totals.get(m.id) || 0));
  }
}

// ---------- 素材1つ分の部品（全素材の合計のタイルと、各目標の中の表で使う） ----------

// 不足していれば short、足りていれば ok（どの目標にも使っていなければ空）。色分けに使う
function statusClass(need: number, short: number): string {
  if (short > 0) return 'short';
  if (need > 0) return 'ok';
  return '';
}

// 不足分を集める周回数の目安
function runsText(m: Material, short: number): string {
  if (short > 0 && m.perRun > 0) return `約${formatNum(Math.ceil(short / m.perRun))}周`;
  return '—';
}

// アイコン（クリックで画像を登録・変更）と、画像を外すボタン
function iconControl(m: Material, size?: number): HTMLSpanElement {
  const action = m.icon ? '変更' : '登録';
  const iconButton = el('button', {
    type: 'button', class: 'icon-button',
    title: `クリックで画像を${action}`,
    'aria-label': `${m.name}の画像を${action}`,
    onclick: () => setMaterialIcon(m),
  }, createIcon(m, size));
  // 画像を登録しているときだけ、外すボタンを出す
  const removeButton = m.icon
    ? el('button', {
        type: 'button', class: 'icon-remove', text: '✕',
        title: '画像を外す', 'aria-label': `${m.name}の画像を外す`,
        onclick: () => removeMaterialIcon(m),
      })
    : null;
  return el('span', { class: 'icon-wrap' }, [iconButton, removeButton]);
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
  input.addEventListener('change', () => {
    m.owned = toNum(input.value);
    commit();
  });
  return el('div', { class: 'stepper' }, [
    el('button', { type: 'button', class: 'icon', text: '−', 'aria-label': `${m.name}を1減らす`, onclick: () => addOwned(m, -1) }),
    input,
    el('button', { type: 'button', class: 'icon', text: '+', 'aria-label': `${m.name}を1増やす`, onclick: () => addOwned(m, 1) }),
  ]);
}

// 所持数を diff だけ増やす（マイナスなら減らす）。0 より下にはしない
function addOwned(m: Material, diff: number): void {
  m.owned = Math.max(0, m.owned + diff);
  commit();
}

// 1周あたりの平均ドロップ数の入力欄
function perRunInput(m: Material): HTMLInputElement {
  const input = el('input', {
    type: 'number', min: '0', step: '0.01', value: m.perRun || '', class: 'num',
    'aria-label': `${m.name}の1周あたり平均ドロップ`,
  });
  input.addEventListener('change', () => {
    m.perRun = toNum(input.value);
    commit();
  });
  return input;
}

// 全素材の合計の、素材1つ分のタイル。いちばん大事な不足数を大きく出し、1周平均と削除は開いたときだけ出す
function materialTile(m: Material, need: number): HTMLDivElement {
  const short = Math.max(0, need - m.owned);
  const sub = [`必要 ${formatNum(need)}`];
  if (short > 0 && m.perRun > 0) sub.push(runsText(m, short));
  return el('div', { class: `mat-tile ${statusClass(need, short)}` }, [
    el('div', { class: 'mat-name' }, [iconControl(m, 44), nameLabel(m)]),
    el('div', { class: 'mat-main' }, [
      shortStatus(need, short),
      el('div', { class: 'mat-owned' }, [el('span', { class: 'mat-field-label', text: '所持' }), ownedStepper(m)]),
    ]),
    el('p', { class: 'mat-sub', text: sub.join('・') }),
    materialMore(m),
  ]);
}

// タイルの不足数の欄。不足していれば数を大きく出し、足りていれば「✓ OK」
function shortStatus(need: number, short: number): HTMLDivElement {
  if (short > 0) {
    return el('div', { class: 'mat-short' }, [
      el('span', { class: 'mat-short-label', text: '不足' }),
      el('span', { class: 'mat-short-num', text: formatNum(short) }),
    ]);
  }
  return el('div', { class: 'mat-done', text: need > 0 ? '✓ OK' : '使う目標なし' });
}

// タイルの「1周平均・削除」の折りたたみ
function materialMore(m: Material): HTMLDetailsElement {
  return details(`mat-${m.id}`, { class: 'mat-more' }, [
    el('summary', { text: '1周平均・削除' }),
    el('div', { class: 'mat-field' }, [
      el('span', { class: 'mat-field-label', text: '1周平均' }),
      perRunInput(m),
      el('button', { type: 'button', class: 'icon danger mat-delete', text: '削除', onclick: () => deleteMaterial(m) }),
    ]),
  ]);
}

// 目標の中の表の、素材1行分。sharedWith はこの素材を使うほかの目標の名前
function materialRow(m: Material, need: number, sharedWith: string[]): HTMLTableRowElement {
  const short = Math.max(0, need - m.owned);
  // ほかの目標でも使う素材には「共通」の印を付ける
  const sharedBadge = sharedWith.length > 0
    ? el('span', { class: 'badge shared', text: '共通', title: `ほかの目標でも使用: ${sharedWith.join('、')}` })
    : null;
  return el('tr', { class: statusClass(need, short) }, [
    el('td', {}, el('div', { class: 'mat-name' }, [iconControl(m), nameLabel(m), sharedBadge])),
    el('td', {}, ownedStepper(m)),
    el('td', { text: formatNum(need) }),
    el('td', { class: 'short-cell', text: formatNum(short) }),
    el('td', {}, perRunInput(m)),
    el('td', { text: runsText(m, short) }),
  ]);
}

// ---------- 素材の操作 ----------

async function setMaterialIcon(m: Material): Promise<void> {
  const file = await pickImageFile();
  if (!file) return;
  let icon: string;
  try {
    icon = await fileToIcon(file);
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
  const message = used.length > 0
    ? `「${m.name}」は ${used.length} 件の目標で使われています。目標からも取り除いて削除しますか？`
    : `「${m.name}」を削除しますか？`;
  if (!confirm(message)) return;
  app.state.materials = app.state.materials.filter((x) => x.id !== m.id);
  for (const t of app.state.targets) {
    t.reqs = t.reqs.filter((r) => r.materialId !== m.id);
  }
  commit();
}

// ---------- 目標の一覧 ----------

// 分類ごとにまとめた、未完了の目標
interface CategoryGroup {
  category: Category;
  items: Target[];
}

function renderTargets(): void {
  targetList.replaceChildren();
  targetTabs.replaceChildren();
  if (app.state.targets.length === 0) {
    targetList.append(el('p', { class: 'empty', text: 'まだ目標がありません。上のフォームから追加してください。' }));
    return;
  }

  const active = app.state.targets.filter((t) => !t.done);
  const done = app.state.targets.filter((t) => t.done);
  const groups = groupByCategory(active);
  // 選んでいた分類の目標がなくなったときは「すべて」に戻す
  if (currentTab !== 'すべて' && !groups.some((g) => g.category === currentTab)) saveTab('すべて');

  if (active.length > 0) renderTabs(active.length, groups);
  renderActiveTargets(groups, active);
  if (active.length === 0) targetList.append(el('p', { class: 'empty', text: '未完了の目標はありません。' }));
  renderDoneTargets(done, active);
}

// 未完了の目標を、キャラ・武器・その他（自分で素材を指定した目標）に分ける。目標がない分類は除く
function groupByCategory(active: Target[]): CategoryGroup[] {
  return PRESET_CATEGORIES
    .map((category) => ({ category, items: active.filter((t) => categoryOf(t) === category) }))
    .filter((g) => g.items.length > 0);
}

// 分類のタブ（「すべて」と、未完了の目標がある分類）を並べる
function renderTabs(activeCount: number, groups: CategoryGroup[]): void {
  targetTabs.append(
    tabButton('すべて', activeCount),
    ...groups.map((g) => tabButton(g.category, g.items.length)),
  );
}

function tabButton(tab: Tab, count: number): HTMLButtonElement {
  // aria-pressed は、押されている（選ばれている）ボタンを読み上げソフトに伝える
  return el('button', {
    type: 'button', class: 'tab', 'aria-pressed': String(tab === currentTab), onclick: () => selectTab(tab),
  }, [tab, el('span', { class: 'tab-count', text: String(count) })]);
}

// 未完了の目標を並べる。「すべて」では分類ごとに見出しを付け、ほかのタブでは選んだ分類だけを並べる
// active は未完了の目標の一覧（「共通」の印を付けるのに使う）
function renderActiveTargets(groups: CategoryGroup[], active: Target[]): void {
  if (currentTab === 'すべて') {
    for (const g of groups) {
      targetList.append(groupHeading(g), ...g.items.map((t) => targetCard(t, active)));
    }
    return;
  }
  const group = groups.find((g) => g.category === currentTab);
  if (group) targetList.append(...group.items.map((t) => targetCard(t, active)));
}

// 「すべて」のタブの、分類の見出し（「キャラ 3件」など）
function groupHeading(g: CategoryGroup): HTMLHeadingElement {
  return el('h3', { class: 'target-group' }, [g.category, el('span', { class: 'target-group-count', text: `${g.items.length}件` })]);
}

// 完了済みの目標を、折りたたみの中に並べる
function renderDoneTargets(done: Target[], active: Target[]): void {
  const shown = currentTab === 'すべて' ? done : done.filter((t) => categoryOf(t) === currentTab);
  if (shown.length === 0) return;
  targetList.append(details('done-list', { class: 'done-list' }, [
    el('summary', { text: `完了済み（${shown.length}件）` }),
    ...shown.map((t) => targetCard(t, active)),
  ]));
}

// 目標の大分類。分類を持たない以前の目標は、名前からプリセットを探して決める
function categoryOf(t: Target): Category {
  if (t.category) return t.category;
  // 「（コピー）」と「 ×2」のような個数を外して、プリセットの目標名に戻す
  const base = t.name.replace(/(（コピー）)+$/, '').replace(/ ×\d+$/, '');
  return PRESET_LABEL_CATEGORIES.get(base) || 'その他';
}

// 素材ごとの達成率の平均（ルピのように桁が大きい素材があっても偏らないように）と、足りている素材の数
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

// ---------- 目標1つ分のカード ----------

// active は未完了の目標の一覧（「共通」の印を付けるのに使う）
function targetCard(t: Target, active: Target[]): HTMLDetailsElement {
  const { ratio, readyCount } = progressOf(t);
  const ready = readyCount === t.reqs.length;
  const body = t.done ? doneItems(t) : requirementTable(t, active);
  // 完了済みの目標には、「共通」の説明を出さない
  const hint = t.done ? null : el('p', { class: 'hint', text: '「共通」の素材はほかの目標でも使います。合計の不足は下の「全素材の合計」で確認できます。' });
  return details(t.id, { class: `target ${targetState(t, ready)}` }, [
    targetSummary(t, ratio, targetStatus(t, ready, readyCount)),
    el('div', { class: 'target-body' }, [
      body,
      hint,
      el('div', { class: 'row-buttons' }, targetButtons(t, ready)),
    ]),
  ]);
}

// カードの色分けに使う状態。完了済みは done、素材が足りていれば ready
function targetState(t: Target, ready: boolean): string {
  if (t.done) return 'done';
  if (ready) return 'ready';
  return '';
}

// バッジの文字。「完了」は完了ボタンを押した目標にだけ使い、素材が足りただけの目標は「OK」にして区別する
function targetStatus(t: Target, ready: boolean, readyCount: number): string {
  if (t.done) return '完了';
  if (ready) return 'OK';
  return `${readyCount}/${t.reqs.length}種OK`;
}

// カードの見出し（目標名・バッジ・進捗バー）。クリックで開閉する
function targetSummary(t: Target, ratio: number, status: string): HTMLElement {
  const head = el('div', { class: 'target-head' }, [
    el('strong', { text: t.name }),
    el('span', { class: 'badge', text: status }),
  ]);
  // 完了済みの目標には、進捗バーを出さない
  const bar = t.done ? null : el('div', { class: 'bar small' }, el('div', { class: 'bar-fill', style: `width:${ratio * 100}%` }));
  return el('summary', {}, [head, bar]);
}

// 完了済みの目標の中身: 使った素材の一覧
function doneItems(t: Target): HTMLUListElement {
  const items = t.reqs.map((r) => {
    const m = findMaterial(r.materialId);
    const name = m?.name ?? '(削除済み)';
    return el('li', {}, [m ? createIcon(m, 20) : null, `${name} × ${formatNum(r.qty)}`]);
  });
  return el('ul', { class: 'done-items' }, items);
}

// 未完了の目標の中身: 素材ごとの所持数・必要数・不足数の表
function requirementTable(t: Target, active: Target[]): HTMLDivElement {
  const rows: HTMLTableRowElement[] = [];
  for (const r of t.reqs) {
    const m = findMaterial(r.materialId);
    // 削除済みの素材は、表に出さない
    if (!m) continue;
    rows.push(materialRow(m, r.qty, sharedTargetNames(m, t, active)));
  }
  const headers = ['素材', '所持', '必要', '不足', '1周平均', '目安周回'];
  return el('div', { class: 'table-wrap' }, el('table', { class: 'target-table' }, [
    el('thead', {}, el('tr', {}, headers.map((h) => el('th', { text: h })))),
    el('tbody', {}, rows),
  ]));
}

// 素材 m を使う、t のほかの未完了の目標の名前
function sharedTargetNames(m: Material, t: Target, active: Target[]): string[] {
  return active
    .filter((other) => other !== t && other.reqs.some((r) => r.materialId === m.id))
    .map((other) => other.name);
}

// カードの下のボタン（完了／未完了に戻す・複製・削除）
function targetButtons(t: Target, ready: boolean): HTMLButtonElement[] {
  return [
    t.done ? undoButton(t) : completeButton(t, ready),
    el('button', { type: 'button', text: '複製', onclick: () => duplicateTarget(t) }),
    el('button', { type: 'button', class: 'danger', text: '削除', onclick: () => deleteTarget(t) }),
  ];
}

// 素材が足りるまでは押せない
function completeButton(t: Target, ready: boolean): HTMLButtonElement {
  return el('button', {
    type: 'button', text: '完了（素材を消費）', disabled: !ready,
    title: ready ? '' : '素材が足りていません',
    onclick: () => completeTarget(t),
  });
}

function undoButton(t: Target): HTMLButtonElement {
  return el('button', { type: 'button', text: '未完了に戻す', onclick: () => undoTarget(t) });
}

// ---------- 目標の操作 ----------

// 目標を完了にして、使う素材を所持数から差し引く
function completeTarget(t: Target): void {
  if (!confirm(`「${t.name}」を完了にして、所持数から素材を差し引きますか？`)) return;
  for (const r of t.reqs) {
    const m = findMaterial(r.materialId);
    if (m) m.owned = Math.max(0, m.owned - r.qty);
  }
  t.done = true;
  commit();
}

// 完了を取り消して、差し引いた素材を所持数に戻す
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
    // 素材の行も写す（同じものを指すと、片方を変えたときにもう片方も変わってしまうため）
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
