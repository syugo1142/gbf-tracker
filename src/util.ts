// 画面の部品（DOM の要素）を作る・取り出すための関数と、数を扱う小さな関数

// el() の props に渡せるもの。class・text・on〇〇（イベント）と、要素のプロパティや属性
export type Props = Record<string, unknown>;
// el() の children に渡せるもの。null や undefined は飛ばす
export type Child = Node | string | number | null | undefined;

// 要素を作る。例: el('button', { class: 'icon', text: '×', onclick: () => row.remove() })
// 文字は textContent で入れるので、HTML として読まれない（XSS の心配がない）
// tag に 'button' を渡すと HTMLButtonElement が返る、のように、タグ名から戻り値の型が決まる
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: Child | Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    setProp(node, key, value);
  }
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null) continue;
    // 文字や数は、文字の部品（テキストノード）として入る
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

// props の1つを要素に入れる
function setProp(node: HTMLElement, key: string, value: unknown): void {
  if (key === 'class') {
    node.className = String(value);
  } else if (key === 'text') {
    node.textContent = value == null ? '' : String(value);
  } else if (key.startsWith('on')) {
    // onclick なら click のイベントとして登録する
    node.addEventListener(key.slice(2), value as EventListener);
  } else if (!setProperty(node, key, value)) {
    // aria-label のようにプロパティにないものは、属性として入れる
    node.setAttribute(key, String(value));
  }
}

// 要素のプロパティ（value・disabled・open など）として入れる。入れられたら true
// プロパティがないときや、input の list のように読み取り専用で入れられないときは false
// （node[key] = value と書くと、読み取り専用のときにエラーになる。Reflect.set は、エラーにせず false を返す）
function setProperty(node: HTMLElement, key: string, value: unknown): boolean {
  if (!(key in node)) return false;
  return Reflect.set(node, key, value);
}

// index.html にある要素を id で取り出す。type には欲しい要素の種類（HTMLButtonElement など）を渡す
// 見つからないときや種類が違うときはエラーにする（index.html の id を変えたときに、すぐ気づけるように）
export function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`#${id} が見つからないか、種類が違います`);
  return node;
}

// フォームの中の入力欄を name で取り出す。考え方は byId と同じ
export function formField<T extends HTMLElement>(form: HTMLFormElement, name: string, type: new () => T): T {
  const node = form.elements.namedItem(name);
  if (!(node instanceof type)) throw new Error(`入力欄 ${name} が見つからないか、種類が違います`);
  return node;
}

// 素材や目標の ID を作る。今の時刻と乱数を、英数字の短い文字列にしてつなぐ
export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 入力された値を、0 以上の数にする（数でないものや、マイナスは 0）
export function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

// 数を 3 桁ごとのカンマ付きにする（1234567 → 1,234,567）
export function formatNum(n: number): string {
  return n.toLocaleString('ja-JP');
}
