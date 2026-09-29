// 天井（300連）計算
const Spark = (() => {
  const CEILING = 300;        // 天井に必要な連数
  const CRYSTALS_PER_DRAW = 300; // 単発1回あたりの宝晶石

  let app;

  function init(appRef) {
    app = appRef;
    const form = document.getElementById('spark-form');
    for (const [key, value] of Object.entries(app.state.spark)) {
      if (form.elements[key]) form.elements[key].value = value || '';
    }
    form.addEventListener('input', () => {
      const s = app.state.spark;
      for (const key of ['crystals', 'singles', 'tens', 'sparks', 'daily', 'extra']) {
        s[key] = Math.floor(toNum(form.elements[key].value));
      }
      s.date = form.elements.date.value;
      app.save();
      render();
    });
    render();
  }

  // 今日から目標日までの日数（目標日当日の分は含めない）
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const target = new Date(y, m - 1, d);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.round((target - today) / 86400000);
  }

  function drawsFrom(s, crystals) {
    return Math.floor(crystals / CRYSTALS_PER_DRAW) + s.singles + s.tens * 10 + s.sparks;
  }

  function render() {
    const s = app.state.spark;
    const box = document.getElementById('spark-result');
    const now = drawsFrom(s, s.crystals);
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
      if (s.daily > 0) {
        const days = Math.ceil(needCrystals / s.daily);
        const reach = new Date();
        reach.setDate(reach.getDate() + days);
        children.push(el('p', {
          class: 'hint',
          text: `1日 ${formatNum(s.daily)} 個ペースだと約 ${formatNum(days)} 日後（${reach.toLocaleDateString('ja-JP')}ごろ）に到達`,
        }));
      }
    }

    const days = daysUntil(s.date);
    if (days !== null) {
      children.push(el('h2', { text: '目標日の予測' }));
      if (days < 0) {
        children.push(el('p', { class: 'hint', text: '目標日が過ぎています。' }));
      } else {
        const future = drawsFrom(s, s.crystals + s.daily * days) + s.extra;
        const ok = future >= CEILING;
        children.push(
          el('p', { text: `${s.date} まで残り ${days} 日` }),
          el('p', { class: 'big' }, [`${formatNum(future)} 連分`, el('small', { text: ` / ${CEILING}` })]),
          el('p', {
            class: ok ? 'good' : 'bad',
            text: ok
              ? `天井に届く見込みです（${formatNum(future - CEILING)} 連分の余裕）`
              : `${formatNum(CEILING - future)} 連分足りない見込みです`,
          }),
        );
      }
    }

    children.push(el('p', {
      class: 'hint',
      text: '宝晶石300個=1連、10連チケット=10連で計算しています。「追加見込み」には無料ガチャやイベントで増えるチケットなどを入れてください。',
    }));

    box.replaceChildren(...children);
  }

  return { init, render };
})();
