// 天井（300連）計算
const Spark = (() => {
  const CEILING = 300;        // 天井に必要な連数
  const CRYSTALS_PER_DRAW = 300; // 単発1回あたりの宝晶石
  const FIELDS = ['crystals', 'singles', 'tens', 'sparks'];

  let app;

  function init(appRef) {
    app = appRef;
    const form = document.getElementById('spark-form');
    for (const key of FIELDS) {
      form.elements[key].value = app.state.spark[key] || '';
    }
    form.addEventListener('input', () => {
      for (const key of FIELDS) {
        app.state.spark[key] = Math.floor(toNum(form.elements[key].value));
      }
      app.save();
      render();
    });
    render();
  }

  // 大きな数字のタイル1枚分
  function statTile(label, value, unit, sub, extraClass = '') {
    return el('div', { class: `stat ${extraClass}` }, [
      el('div', { class: 'stat-label', text: label }),
      el('div', { class: 'stat-value' }, [value, el('span', { class: 'stat-unit', text: unit })]),
      el('div', { class: 'stat-sub', text: sub || ' ' }),
    ]);
  }

  function render() {
    const s = app.state.spark;
    const box = document.getElementById('spark-result');
    const now = Math.floor(s.crystals / CRYSTALS_PER_DRAW) + s.singles + s.tens * 10 + s.sparks;
    const sparkCount = Math.floor(now / CEILING); // 天井何回分か
    const progress = now % CEILING;               // 次の天井に向けて貯まっている連数
    const remaining = CEILING - progress;
    // 端数の宝晶石も使って、あと何個あれば次の天井か
    const needCrystals = remaining * CRYSTALS_PER_DRAW - (s.crystals % CRYSTALS_PER_DRAW);
    // ガチャチケットの宝晶石換算（単発1枚=300個、10連1枚=3000個）
    const singleValue = s.singles * CRYSTALS_PER_DRAW;
    const tenValue = s.tens * CRYSTALS_PER_DRAW * 10;
    const ticketValue = singleValue + tenValue;

    box.replaceChildren(
      el('div', { class: 'stats' }, [
        statTile('いま引ける', formatNum(now), '連', `うちガチャPt ${formatNum(s.sparks)}`),
        statTile('天井', formatNum(sparkCount), '回分',
          sparkCount > 0 && progress > 0 ? `＋${formatNum(progress)} 連` : '', sparkCount > 0 ? 'reached' : ''),
        statTile('宝晶石＋チケット', formatNum(s.crystals + ticketValue), '個', `うちチケット ${formatNum(ticketValue)} 個`),
      ]),
      el('div', { class: 'progress' }, [
        el('div', { class: 'progress-head' }, [
          el('span', { text: sparkCount > 0 ? `${sparkCount + 1} 回目の天井まで` : '天井まで' }),
          el('strong', { text: `あと ${formatNum(remaining)} 連` }),
        ]),
        el('div', { class: 'bar' }, el('div', { class: 'bar-fill', style: `width:${(progress / CEILING) * 100}%` })),
        el('div', { class: 'progress-foot' }, [
          el('span', { text: `${formatNum(progress)} / ${CEILING}` }),
          el('span', { text: `宝晶石なら ${formatNum(needCrystals)} 個` }),
        ]),
      ]),
      el('p', {
        class: 'hint',
        text: `チケット内訳: 単発 ${formatNum(s.singles)} 枚＝${formatNum(singleValue)} 個、10連 ${formatNum(s.tens)} 枚＝${formatNum(tenValue)} 個。宝晶石300個=1連、10連チケット=10連で計算しています。`,
      }),
    );
  }

  return { init, render };
})();
