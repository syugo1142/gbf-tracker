// 素材アイコン: 登録した画像があればそれを、なければ属性の色＋頭文字のアイコンを表示する
const MaterialIcon = (() => {
  const ICON_SIZE = 64; // 保存する画像の一辺(px)

  // 素材名から属性を推定するためのキーワード。上から順に調べ、最初に当たった属性にする
  const ELEMENT_KEYWORDS = [
    ['fire', ['火', 'ファイア', 'イグニス', 'イグナイト', '赤竜鱗', '赤の依代', 'ウィルナス', 'アトゥム', 'シヴァ']],
    ['water', ['水', 'アクア', 'アビサル', '青竜鱗', '青の依代', 'ワムデュス', 'テフヌト', 'エウロペ']],
    ['earth', ['土', 'アース', 'テラ', 'インシュラー', '地竜鱗', '黄の依代', 'ガレヲン', 'ベンヌ', 'ゴブロ']],
    ['wind', ['風', 'ウィンド', 'ウェントス', 'ゲイル', '緑の依代', 'イーウィヤ', 'グリームニル', 'ラーの']],
    ['light', ['光', 'ホーリー', '靂輪', '白竜鱗', '白の依代', 'ル・オー', 'ホルス', 'メタトロン']],
    ['dark', ['闇', 'ダーク', 'トーデス', '黒竜鱗', '黒の依代', 'フェディエル', 'オシリス', 'アバター']],
  ];

  function elementOf(name) {
    for (const [element, words] of ELEMENT_KEYWORDS) {
      if (words.some((w) => name.includes(w))) return element;
    }
    return 'none';
  }

  // 表示用のアイコン要素を作る
  function create(material, size = 32) {
    const box = el('span', { class: `mat-icon el-${elementOf(material.name)}` });
    box.style.setProperty('--size', `${size}px`);
    if (material.icon) {
      box.append(el('img', { src: material.icon, alt: '' }));
    } else {
      box.append(material.name.charAt(0));
    }
    return box;
  }

  // 画像ファイルを正方形に切り抜いて縮小し、data URL にする
  function fileToIcon(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = ICON_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, side, side, 0, 0, ICON_SIZE, ICON_SIZE);
        URL.revokeObjectURL(url);
        // WebP 非対応のブラウザでは PNG になる
        resolve(canvas.toDataURL('image/webp', 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('画像を読み込めませんでした'));
      };
      img.src = url;
    });
  }

  // 画像ファイルを選ばせる。キャンセル時は null
  function pickFile() {
    return new Promise((resolve) => {
      const input = el('input', { type: 'file', accept: 'image/*' });
      input.addEventListener('change', () => resolve(input.files[0] || null));
      input.click();
    });
  }

  return { create, fileToIcon, pickFile, elementOf };
})();
