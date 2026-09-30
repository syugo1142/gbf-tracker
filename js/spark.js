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
    const sparkCount = Math.floor(now / CEILING); // 天井何回分か
    const progress = now % CEILING;               // 次の天井に向けて貯まっている連数
    const remaining = CEILING - progress;
    // 端数の宝晶石も使って、あと何個あれば次の天井か
    const needCrystals = remaining * CRYSTALS_PER_DRAW - (s.crystals % CRYSTALS_PER_DRAW);

    const children = [
      el('h2', { text: '現在' }),
      el('p', { class: 'big' }, [`${formatNum(now)} 連分`]),
      el('p', { class: sparkCount > 0 ? 'good' : '' }, [
        '天井 ',
        el('strong', { class: 'spark-count', text: formatNum(sparkCount) }),
        ` 回分${sparkCount > 0 && progress > 0 ? `（＋${formatNum(progress)} 連）` : ''}`,
      ]),
      el('div', { class: 'bar' }, el('div', { class: 'bar-fill', style: `width:${(progress / CEILING) * 100}%` })),
      el('p', {
        text: `${sparkCount > 0 ? `${sparkCount + 1} 回目の天井` : '天井'}まで あと ${formatNum(remaining)} 連（宝晶石 ${formatNum(needCrystals)} 個）`,
      }),
    ];

    children.push(el('p', { class: 'hint', text: '宝晶石300個=1連、10連チケット=10連で計算しています。' }));

    box.replaceChildren(...children);
  }

  return { init, render };
})();
