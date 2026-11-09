// 素材アイコン: 登録した画像があればそれを、なければ属性の色＋頭文字のアイコンを表示する
import { el } from './util.ts';
import type { Material } from './storage.ts';

// 保存する画像の一辺(px)
const ICON_SIZE = 64;

// 素材名から属性を推定するためのキーワード。上から順に調べ、最初に当たった属性にする
// 型を書かないと「文字列か文字列の配列が並んだ配列」と推論され、[属性, キーワード] の組として扱えないので書いておく
const ELEMENT_KEYWORDS: [string, string[]][] = [
  ['fire', ['火', '炎', '灼熱', 'ファイア', 'イグニス', 'イグナイト', '赤竜鱗', '赤の依代', '赤星', 'ウィルナス', 'アトゥム', 'シヴァ']],
  ['water', ['水', 'アクア', 'アビサル', '青竜鱗', '青の依代', '青星', 'ワムデュス', 'テフヌト', 'エウロペ']],
  ['earth', ['土', 'アース', 'テラ', 'インシュラー', '地竜鱗', '黄の依代', '黄星', 'ブローディア', '巨人', 'ガレヲン', 'ベンヌ', 'ゴブロ']],
  ['wind', ['風', 'ウィンド', 'ウェントス', 'ゲイル', '緑の依代', '緑星', 'イーウィヤ', 'グリームニル', 'ラーの']],
  ['light', ['光', 'ホーリー', '靂輪', '白竜鱗', '白の依代', '白星', 'ル・オー', 'ホルス', 'メタトロン']],
  ['dark', ['闇', 'ダーク', 'トーデス', '黒竜鱗', '黒の依代', '黒星', 'フェディエル', 'オシリス', 'アバター']],
];

// 属性の名前（CSS のクラス名 el-fire などに使う）。どれにも当たらなければ none
function elementOf(name: string): string {
  for (const [element, words] of ELEMENT_KEYWORDS) {
    if (words.some((w) => name.includes(w))) return element;
  }
  return 'none';
}

// 表示用のアイコン要素を作る
export function createIcon(material: Material, size = 32): HTMLSpanElement {
  const box = el('span', { class: `mat-icon el-${elementOf(material.name)}` });
  box.style.setProperty('--size', `${size}px`);
  if (material.icon) {
    box.append(el('img', { src: material.icon, alt: '' }));
  } else {
    box.append(material.name.charAt(0));
  }
  return box;
}

// 画像ファイルを正方形に切り抜いて縮小し、data URL（画像を文字にしたもの）にする
export async function fileToIcon(file: File): Promise<string> {
  // ファイルをブラウザの中だけで使える URL にする。読み込んだら revokeObjectURL で捨てる
  const url = URL.createObjectURL(file);
  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const canvas = document.createElement('canvas');
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  // 描画の機能が使えないブラウザでは null が返る
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('画像を縮小できませんでした');
  // 縦と横の短いほうに合わせて、真ん中の正方形を切り抜く
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, ICON_SIZE, ICON_SIZE);
  // WebP 非対応のブラウザでは PNG になる
  return canvas.toDataURL('image/webp', 0.85);
}

// 画像を <img> に読み込む。読み込めたら（onload）img を、画像として読めなければ（onerror）エラーを返す
// onload・onerror のように「終わったら呼ばれる関数」で知らせる仕組みを、await で待てる Promise にしている
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('画像を読み込めませんでした'));
    img.src = url;
  });
}

// 画像ファイルを選ばせる。キャンセル時は null
export function pickImageFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept: 'image/*' });
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    input.click();
  });
}
