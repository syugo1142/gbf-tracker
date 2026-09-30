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

  function render() {
    const s = app.state.spark;
    const box = document.getElementById('spark-result');
    const now = Math.floor(s.crystals / CRYSTALS_PER_DRAW) + s.singles + s.tens * 10 + s.sparks;
    const remaining = Math.max(0, CEILING - now);
    const pct = Math.min(100, (now / CEILING) * 100);

    const children = [
      el('h2', { text: '現在' }),
      el('p', { class: 'big' }, [`${formatNum(now)} 連分`, el('small', { text: ` / ${CEILING}` })]),
      el('div', { class: 'bar' }, el('div', { class: 'bar-fill', style: `width:${pct}%` })),
    ];

    if (remaining === 0) {
      children.push(el('p', { class: 'good', text: `天井に届いています！（${formatNum(now - CEILING)} 連分の余裕）` }));
    } else {
      // 端数の宝晶石も使って、あと何個あれば天井か
      const needCrystals = remaining * CRYSTALS_PER_DRAW - (s.crystals % CRYSTALS_PER_DRAW);
      children.push(el('p', { text: `あと ${formatNum(remaining)} 連（宝晶石 ${formatNum(needCrystals)} 個）` }));
    }

    children.push(el('p', { class: 'hint', text: '宝晶石300個=1連、10連チケット=10連で計算しています。' }));

    box.replaceChildren(...children);
  }

  return { init, render };
})();
