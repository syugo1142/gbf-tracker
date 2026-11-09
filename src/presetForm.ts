// 目標の「プリセットから追加」のフォーム。コンテンツ → （キャラ名など）→ プリセット の順に選ぶ
// 目標を作るのは tracker.ts。このファイルは、選ばれたプリセットと個数を onAdd に渡すだけ
import { el, byId, formField, toNum, formatNum } from './util.ts';
import { PRESETS, PRESET_CATEGORIES, presetCategory } from './presets.ts';
import type { Preset } from './presets.ts';

// 2段目（sub。キャラ名など）を何と呼ぶか。ここにないコンテンツは「武器」
const SUB_LABELS: Record<string, string> = {
  十天衆: 'キャラ',
  十賢者: 'キャラ',
  '天星器（十天衆加入）': '変更先の属性',
};

const form = byId('preset-form', HTMLFormElement);
const groupSelect = formField(form, 'group', HTMLSelectElement);
const subSelect = formField(form, 'sub', HTMLSelectElement);
const presetSelect = formField(form, 'preset', HTMLSelectElement);
const countInput = formField(form, 'count', HTMLInputElement);
const info = byId('preset-info', HTMLParagraphElement);

// onAdd は、選ばれたプリセットと個数を受け取って、目標を作る関数
export function initPresetForm(onAdd: (preset: Preset, count: number) => void): void {
  fillGroups();
  groupSelect.addEventListener('change', onGroupChange);
  subSelect.addEventListener('change', onSubChange);
  presetSelect.addEventListener('change', showPresetInfo);
  form.addEventListener('submit', (e) => {
    // フォームを送ると、ふつうはページが読み込み直されるので、それを止める
    e.preventDefault();
    const preset = selectedPreset();
    if (!preset) return;
    const count = Math.max(1, Math.floor(toNum(countInput.value)));
    onAdd(preset, count);
  });
  // まだ何も選んでいない状態の、2段目とプリセットの欄を作る
  onGroupChange();
}

// コンテンツの選択肢を、キャラ・武器などの大分類ごとに見出し（optgroup）を付けて並べる
function fillGroups(): void {
  groupSelect.append(el('option', { value: '', text: 'コンテンツを選択' }));
  for (const category of PRESET_CATEGORIES) {
    const groups = unique(PRESETS.filter((p) => presetCategory(p) === category).map((p) => p.group));
    if (groups.length === 0) continue;
    const options = groups.map((g) => el('option', { value: g, text: g }));
    groupSelect.append(el('optgroup', { label: category }, options));
  }
}

// コンテンツを選んだとき: 2段目（キャラ名など）の選択肢を作り直す。2段目がないコンテンツは、すぐにプリセットを並べる
function onGroupChange(): void {
  const items = PRESETS.filter((p) => p.group === groupSelect.value);
  const subs = unique(items.map((p) => p.sub ?? '').filter((sub) => sub !== ''));
  const label = subLabel();
  subSelect.hidden = subs.length === 0;
  subSelect.setAttribute('aria-label', label);
  subSelect.replaceChildren(
    el('option', { value: '', text: `${label}を選択` }),
    ...subs.map((sub) => el('option', { value: sub, text: sub })),
  );
  if (subs.length > 0) {
    fillPresets([], `先に${label}を選択`);
  } else {
    fillPresets(items, '先にコンテンツを選択');
  }
}

// 2段目を選んだとき: そのキャラなどのプリセットを並べる
function onSubChange(): void {
  const items = PRESETS.filter((p) => p.group === groupSelect.value && p.sub === subSelect.value);
  fillPresets(items, `先に${subLabel()}を選択`);
}

// 今選んでいるコンテンツの、2段目の呼び名
function subLabel(): string {
  return SUB_LABELS[groupSelect.value] ?? '武器';
}

// プリセットの選択肢を items にする。items が空のときは選べなくし、emptyText で何を先に選ぶかを知らせる
function fillPresets(items: Preset[], emptyText: string): void {
  presetSelect.replaceChildren(
    el('option', { value: '', text: items.length > 0 ? 'プリセットを選択' : emptyText }),
    ...items.map((p) => el('option', { value: p.id, text: p.name })),
  );
  presetSelect.disabled = items.length === 0;
  info.replaceChildren();
}

// 選んだプリセットの必要素材と出典を、フォームの下に出す
function showPresetInfo(): void {
  info.replaceChildren();
  const preset = selectedPreset();
  if (!preset) return;
  const reqText = preset.reqs.map((r) => `${r.name}×${formatNum(r.qty)}`).join('、');
  const note = preset.note ? `※${preset.note}　` : '';
  const link = el('a', { href: preset.source, target: '_blank', rel: 'noopener', text: '出典' });
  info.append(reqText, el('br'), note, link);
}

// 今選んでいるプリセット。選んでいなければ undefined
function selectedPreset(): Preset | undefined {
  return PRESETS.find((p) => p.id === presetSelect.value);
}

// 重複を除いた一覧（最初に出てきた順）。Set は同じ値を1つしか持たない
function unique(values: string[]): string[] {
  return [...new Set(values)];
}
