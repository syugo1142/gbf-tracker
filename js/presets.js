// 目標のプリセット（必要素材データ）
// 出典: GameWith「十天衆を最終上限解放する方法/必要素材」 https://xn--bck3aza1a2if6kra4ee0hf.gamewith.jp/article/show/53662
//       属性は各キャラの GameWith 個別ページで確認（2026-09-29 取得）
// ゲームのアップデートで変わることがあるので、ゲーム内の表示も確認すること。
// 属性ごとの素材（輝き・プシュケーなど）は正式名称を確認できていないため「輝き（水）」のような仮の名前にしている。
const PRESETS = (() => {
  const SOURCE = 'https://xn--bck3aza1a2if6kra4ee0hf.gamewith.jp/article/show/53662';
  const ELEMENTS = ['火', '水', '土', '風', '光', '闇'];

  const TENTEN = [
    { name: 'ウーノ', weapon: '槍', element: '水', job: '守護騎士の証' },
    { name: 'ソーン', weapon: '弓', element: '光', job: '射手の証' },
    { name: 'サラーサ', weapon: '斧', element: '土', job: '剣闘士の証' },
    { name: 'カトル', weapon: '短剣', element: '水', job: '魔剣士の証' },
    { name: 'フュンフ', weapon: '杖', element: '光', job: '聖職者の証' },
    { name: 'シス', weapon: '拳', element: '闇', job: '格闘士の証' },
    { name: 'シエテ', weapon: '剣', element: '風', job: '剣聖の証' },
    { name: 'オクトー', weapon: '刀', element: '土', job: '侍の証' },
    { name: 'ニオ', weapon: '楽器', element: '風', job: '吟遊詩人の証' },
    { name: 'エッセル', weapon: '銃', element: '火', job: '盗賊の証' },
  ];

  // 光は火/風の書を15個ずつ、闇は水/土の書を15個ずつ。それ以外は自属性の書30個
  function bookReqs(element) {
    if (element === '光') return [{ name: '共闘素材の書（火）', qty: 15 }, { name: '共闘素材の書（風）', qty: 15 }];
    if (element === '闇') return [{ name: '共闘素材の書（水）', qty: 15 }, { name: '共闘素材の書（土）', qty: 15 }];
    return [{ name: `共闘素材の書（${element}）`, qty: 30 }];
  }

  const presets = [];

  // 依代6種の作成（全キャラ共通なので1つだけ）
  presets.push({
    id: 'tenten-yorishiro6',
    group: '十天衆 最終上限解放',
    name: '赤・青・黄・緑・白・黒の依代 作成（6種）',
    source: SOURCE,
    note: '別途、各属性の3凸Lv75の朽ちた武器が必要',
    reqs: [
      ...ELEMENTS.map((e) => ({ name: `下位宝珠（${e}）`, qty: 250 })),
      ...ELEMENTS.map((e) => ({ name: `ジーン（${e}）`, qty: 250 })),
      { name: '星晶の欠片', qty: 1500 },
    ],
  });

  for (const c of TENTEN) {
    presets.push({
      id: `tenten-${c.name}-silver`,
      group: '十天衆 最終上限解放',
      name: `${c.name}：銀の依代 最終解放`,
      source: SOURCE,
      reqs: [
        { name: `対応した武器エレメント（${c.name}）`, qty: 300 },
        ...ELEMENTS.map((e) => ({ name: `${e}晶のエレメント`, qty: 300 })),
      ],
    });
    presets.push({
      id: `tenten-${c.name}-gold`,
      group: '十天衆 最終上限解放',
      name: `${c.name}：黄金の依代 作成`,
      source: SOURCE,
      reqs: [
        { name: '赤の依代', qty: 1 },
        { name: '青の依代', qty: 1 },
        { name: '黄の依代', qty: 1 },
        { name: '緑の依代', qty: 1 },
        { name: '白の依代', qty: 1 },
        { name: '黒の依代', qty: 1 },
        { name: 'ヒヒイロカネ', qty: 1 },
        { name: '銀天の輝き', qty: 10 },
        { name: `天星の欠片（${c.name}）`, qty: 100 },
        { name: 'ダマスカス骸晶', qty: 10 },
        { name: '究竟の証', qty: 5 },
        { name: c.job, qty: 30 },
      ],
    });
    presets.push({
      id: `tenten-${c.name}-final`,
      group: '十天衆 最終上限解放',
      name: `${c.name}：最終上限解放`,
      source: SOURCE,
      reqs: [
        { name: `輝き（${c.element}）`, qty: 30 },
        { name: `プシュケー（${c.element}）`, qty: 10 },
        { name: '白き魂 or 黒き魂', qty: 2 },
        ...bookReqs(c.element),
        { name: '虹星晶', qty: 100 },
      ],
    });
  }

  return presets;
})();
