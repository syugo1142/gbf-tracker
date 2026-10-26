// DOM 生成ヘルパー。文字列は textContent で入れるので XSS の心配がない

// el() の props に渡せるもの。class・text・on〇〇（イベント）と、要素のプロパティや属性
type Props = Record<string, unknown>;
// el() の children に渡せるもの。null や undefined は飛ばす
type Child = Node | string | number | null | undefined;

// tag に 'button' を渡すと HTMLButtonElement が返る、のように、タグ名から戻り値の型が決まる
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: Child | Child[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = String(value);
    else if (key === 'text') node.textContent = value == null ? '' : String(value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value as EventListener);
    else if (key in node) Reflect.set(node, key, value);
    else node.setAttribute(key, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child == null) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

// index.html にある要素を id で取り出す。type には欲しい要素の種類（HTMLButtonElement など）を渡す
// 見つからないときや種類が違うときはエラーにする（index.html の id を変えたときに、すぐ気づけるように）
export function byId<T extends HTMLElement>(id: string, type: new () => T): T {
  const node = document.getElementById(id);
  if (!(node instanceof type)) throw new Error(`#${id} が見つからないか、種類が違います`);
  return node;
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 数値入力を 0 以上の数に丸める
export function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function formatNum(n: number): string {
  return n.toLocaleString('ja-JP');
}
