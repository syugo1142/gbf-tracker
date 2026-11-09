// 目標のプリセット（必要素材データ）
// group → sub（任意。十天衆のキャラ名など）→ name の順に選ぶ。目標名は presetLabel() で作る
// 出典はすべて GameWith（2026-09-29 取得）。各プリセットの source に記事の URL を入れている。
// ゲームのアップデートで変わることがあるので、ゲーム内の表示も確認すること。
// 素材名は記事の表記に合わせ、表記ゆれ（「槍エレ」「ダマ骸晶」など）は正式名称にそろえている。
// 素材名は GameWith / 神ゲー攻略 / ゲーム乱舞 のトレジャー一覧と照合済み（2026-10-06）。
//
// ファイルの並び: 型 → どのコンテンツでも使う表と関数 → コンテンツごとの表と、プリセットを作る関数 → 書き出す値（PRESETS など）
// PRESETS はファイルの最後で作る（const の表は上から順に作られるので、使う表を先に書いておく必要があるため）
import type { Category } from './storage.ts';

// ---------- 型 ----------

// 必要な素材1つ分
export interface PresetReq {
  name: string;
  qty: number;
}

// プリセット1件。sub はキャラ名など（ないものもある）、note は注意書き
export interface Preset {
  id: string;
  group: string;
  sub?: string;
  name: string;
  source: string;
  note?: string;
  reqs: PresetReq[];
}

// 段階（4凸、5凸 など）1つ分の必要素材。これを元にプリセットを作る（stagePresets）
interface Stage {
  key: string;     // プリセットの id の最後に付く名前（4、awake15 など）
  name: string;
  note?: string;
  source?: string; // 出典が、同じまとまりのほかの段階と違うときだけ書く
  reqs: PresetReq[];
}

// 同じ group・sub のプリセットのまとまりで、共通の部分
interface PresetBase {
  idPrefix: string; // id の前半。後ろに「-段階の key」が付く
  group: string;
  sub: string;
  source: string;
}

// [素材名, 個数] の組。素材の多い表を短く書くために使う
type Pair = [string, number];

// 属性。「Element」はブラウザの型（画面の要素）と同じ名前になるので Elem にしている
type Elem = '火' | '水' | '土' | '風' | '光' | '闇';
// 光・闇以外の4属性。光・闇の素材は、この4属性の素材を半分ずつ使うことが多い
type Base4 = '火' | '水' | '土' | '風';
// 属性ごとの表には Record<Elem, string> のように型を付ける。1属性でも書き忘れると型チェックでエラーになる

// ---------- どのコンテンツでも使う表 ----------

// GameWith の記事の URL の前半。後ろに記事の番号を付ける
const GW = 'https://xn--bck3aza1a2if6kra4ee0hf.gamewith.jp/article/show/';

const ELEMENTS: Elem[] = ['火', '水', '土', '風', '光', '闇'];
const BASE4: Base4[] = ['火', '水', '土', '風'];
// 光・闇が半分ずつ使う、2つの属性
const SPLIT: Record<'光' | '闇', Base4[]> = { 光: ['火', '風'], 闇: ['水', '土'] };

const GENE: Record<Elem, string> = { 火: 'ファイア・ジーン', 水: 'アクア・ジーン', 土: 'アース・ジーン', 風: 'ウィンド・ジーン', 光: 'ホーリー・ジーン', 闇: 'ダーク・ジーン' };
const SCALE: Record<Elem, string> = { 火: '赤竜鱗', 水: '青竜鱗', 土: '地竜鱗', 風: '風竜鱗', 光: '白竜鱗', 闇: '黒竜鱗' };
// 下位宝珠は火だけ「炎の宝珠」
const ORB: Record<Elem, string> = { 火: '炎の宝珠', 水: '水の宝珠', 土: '土の宝珠', 風: '風の宝珠', 光: '光の宝珠', 闇: '闇の宝珠' };
const STAR: Record<Elem, string> = { 火: '赤星の輝き', 水: '青星の輝き', 土: '黄星の輝き', 風: '緑星の輝き', 光: '白星の輝き', 闇: '黒星の輝き' };
// 共闘（パンデモニウム第4階層）の書は火水土風の4種のみ
const BOOK: Record<Base4, string> = { 火: '灼熱の書', 水: '水分の書', 土: '巨人の書', 風: '風凪の書' };
// 六竜の固有素材
const DRAGON_UNIQUE: Record<Elem, string> = { 火: 'イグナイトラブル', 水: 'アビサルトラジェディー', 土: 'インシュラーコア', 風: 'ゲイルロック', 光: '靂輪', 闇: 'トーデストリープ' };
// 「〇〇の竜珠」の〇〇に入る六竜の名前
const DRAGON: Record<Elem, string> = { 火: 'ウィルナス', 水: 'ワムデュス', 土: 'ガレヲン', 風: 'イーウィヤ', 光: 'ル・オー', 闇: 'フェディエル' };
// 「〇〇のマグナアニマ」の〇〇に入る名前（終末武器・十賢者で使う）
const MAGNA2: Record<Elem, string> = { 火: 'シヴァ', 水: 'エウロペ', 土: 'ブローディア', 風: 'グリームニル', 光: 'メタトロン', 闇: 'アバター' };
// 「〇〇のアニマ」「〇〇のマグナアニマ」の〇〇に入る名前（天星器・十賢者で使う）
const ISLAND: Record<Elem, string> = { 火: 'コロッサス', 水: 'リヴァイアサン', 土: 'ユグドラシル', 風: 'ティアマト', 光: 'シュヴァリエ', 闇: 'セレスト' };

// ---------- どのコンテンツでも使う関数 ----------

function req(name: string, qty: number): PresetReq {
  return { name, qty };
}

// [素材名, 個数] の組の一覧を、必要素材の一覧にする
function pairs(list: Pair[]): PresetReq[] {
  return list.map(([name, qty]) => req(name, qty));
}

// いくつかのプリセット（または段階）の必要素材を、素材名ごとに合計する（最初に出てきた順）
function sumReqs(list: { reqs: PresetReq[] }[]): PresetReq[] {
  const totals = new Map<string, number>();
  for (const item of list) {
    for (const r of item.reqs) {
      totals.set(r.name, (totals.get(r.name) || 0) + r.qty);
    }
  }
  return [...totals].map(([name, qty]) => req(name, qty));
}

// 光か闇か。「element is '光' | '闇'」は、true を返したときは光か闇だと TypeScript に教える書き方
function isLightOrDark(element: Elem): element is '光' | '闇' {
  return element === '光' || element === '闇';
}

// 属性ごとの素材を作る。光・闇は、SPLIT の2属性の素材に半分ずつ分ける
function byElement(element: Elem, table: Record<Base4, string>, qty: number): PresetReq[] {
  if (isLightOrDark(element)) {
    return SPLIT[element].map((x) => req(table[x], qty / 2));
  }
  // ここに来るのは光・闇以外なので、TypeScript も element を Base4 として扱い、table から引ける
  return [req(table[element], qty)];
}

// 段階ごとに、プリセットを1件ずつ作る
function stagePresets(base: PresetBase, stages: Stage[]): Preset[] {
  return stages.map((st) => ({
    id: `${base.idPrefix}-${st.key}`,
    group: base.group,
    sub: base.sub,
    name: st.name,
    source: st.source ?? base.source,
    note: st.note,
    reqs: st.reqs,
  }));
}

// 「全段階まとめて」のように、いくつかの段階を合計したプリセットを作る
function totalPreset(
  base: PresetBase,
  total: { key: string; name: string; note?: string; source?: string; stages: Stage[] },
): Preset {
  return {
    id: `${base.idPrefix}-${total.key}`,
    group: base.group,
    sub: base.sub,
    name: total.name,
    source: total.source ?? base.source,
    note: total.note,
    reqs: sumReqs(total.stages),
  };
}

// ---------- 十天衆 最終上限解放 ----------

interface Tenten {
  name: string;
  no: string;     // 「一番天星の欠片」の「一番」
  weapon: string; // 武器種（「槍のエレメント」の「槍」）
  element: Elem;
  job: string;    // ジョブの証
}

const TENTEN: Tenten[] = [
  { name: 'ウーノ', no: '一番', weapon: '槍', element: '水', job: '守護騎士の証' },
  { name: 'ソーン', no: '二番', weapon: '弓', element: '光', job: '射手の証' },
  { name: 'サラーサ', no: '三番', weapon: '斧', element: '土', job: '剣闘士の証' },
  { name: 'カトル', no: '四番', weapon: '短剣', element: '水', job: '魔剣士の証' },
  { name: 'フュンフ', no: '五番', weapon: '杖', element: '光', job: '聖職者の証' },
  { name: 'シス', no: '六番', weapon: '格闘', element: '闇', job: '格闘士の証' },
  { name: 'シエテ', no: '七番', weapon: '剣', element: '風', job: '剣聖の証' },
  { name: 'オクトー', no: '八番', weapon: '刀', element: '土', job: '侍の証' },
  { name: 'ニオ', no: '九番', weapon: '楽器', element: '風', job: '吟遊詩人の証' },
  { name: 'エッセル', no: '十番', weapon: '銃', element: '火', job: '盗賊の証' },
];

function tentenFinalStages(c: Tenten): Stage[] {
  return [
    {
      key: 'silver',
      name: '最終：銀の依代 最終解放',
      reqs: [req(`${c.weapon}のエレメント`, 300), ...ELEMENTS.map((e) => req(`${e}晶のエレメント`, 300))],
    },
    {
      // 黄金の依代の材料になる依代6種。中身は全キャラ共通
      key: 'yorishiro6',
      name: '最終：依代6種 作成（赤・青・黄・緑・白・黒）',
      note: '別途、各属性の3凸Lv75の朽ちた武器が必要',
      reqs: [
        ...ELEMENTS.map((e) => req(ORB[e], 250)),
        ...ELEMENTS.map((e) => req(GENE[e], 250)),
        req('星晶の欠片', 1500),
      ],
    },
    {
      key: 'gold',
      name: '最終：黄金の依代 作成',
      reqs: [
        req('赤の依代', 1), req('青の依代', 1), req('黄の依代', 1),
        req('緑の依代', 1), req('白の依代', 1), req('黒の依代', 1),
        req('ヒヒイロカネ', 1),
        req('銀天の輝き', 10),
        req(`${c.no}天星の欠片`, 100),
        req('ダマスカス骸晶', 10),
        req('究竟の証', 5),
        req(c.job, 30),
      ],
    },
    {
      key: 'final',
      name: '最終：最終上限解放',
      reqs: [
        req(STAR[c.element], 30),
        req(`${c.element}のプシュケー`, 10),
        // 火風光の十天衆は白き魂、水土闇は黒き魂
        req(['火', '風', '光'].includes(c.element) ? '白き魂' : '黒き魂', 2),
        // 光は火/風の書を15個ずつ、闇は水/土の書を15個ずつ。それ以外は自属性の書30個
        ...byElement(c.element, BOOK, 30),
        req('虹星晶', 100),
      ],
    },
  ];
}

function tentenFinalPresets(): Preset[] {
  const presets: Preset[] = [];
  for (const c of TENTEN) {
    const base = { idPrefix: `tenten-${c.name}`, group: '十天衆', sub: c.name, source: GW + '53662' };
    const stages = tentenFinalStages(c);
    presets.push(...stagePresets(base, stages));
    presets.push({
      id: `${base.idPrefix}-final-all`,
      group: base.group,
      sub: base.sub,
      name: '最終：全段階まとめて',
      source: base.source,
      note: '銀の依代・依代6種・黄金の依代・最終上限解放の合計。依代6種は材料で数えている。別途、各属性の3凸Lv75の朽ちた武器が必要',
      // 赤〜黒の依代は「依代6種 作成」の材料で数えるので、完成品としては数えない
      reqs: sumReqs(stages).filter((r) => !/^[赤青黄緑白黒]の依代$/.test(r.name)),
    });
  }
  return presets;
}

// ---------- 十天衆 限界超越 ----------
// Lv110 は専用トレジャー交換分を含む合計、Lv150 は「雄偉者たちの矜持」の交換素材で数えている
// キャラ名 → 解放する Lv → 素材の一覧
const TRANSCEND: Record<string, Record<number, Pair[]>> = {
  ウーノ: {
    110: [['ヒヒイロカネ', 1], ['槍の銀片', 200], ['アビサルトラジェディー', 50], ['水の光輪', 80], ['ダマスカス骸晶', 20], ['星晶の欠片', 7500], ['水の宝珠', 7500], ['アクア・ジーン', 7500], ['朽ち果てた槍（3凸）', 30], ['ルピ', 100000]],
    120: [['エウロペのマグナアニマ', 50], ['水のプシュケー', 300], ['バハムートの紫電角', 100], ['一番天星の欠片', 50], ['究竟の証', 100], ['蒼天の魂', 1], ['ルピ', 5000000]],
    130: [['碧麗の証', 1]],
    140: [['黒麒麟のマグナアニマ', 30], ['アクア・ブライト', 30], ['槍のエレメント', 2000], ['水晶のエレメント', 2000], ['ワムデュスの竜珠', 300], ['真龍の金鱗', 50], ['ルピ', 5000000]],
    150: [['終末の暗晶', 30], ['漆黒の棘翅', 30], ['狡知の魔角', 30], ['碧麗の証', 1]],
  },
  ソーン: {
    110: [['ヒヒイロカネ', 1], ['弓の銀片', 200], ['靂輪', 50], ['火の光輪', 40], ['風の光輪', 40], ['ダマスカス骸晶', 20], ['星晶の欠片', 7500], ['光の宝珠', 7500], ['ホーリー・ジーン', 7500], ['朽ち果てた弓（3凸）', 30], ['ルピ', 100000]],
    120: [['メタトロンのマグナアニマ', 50], ['光のプシュケー', 300], ['バハムートの紫電角', 100], ['二番天星の欠片', 50], ['究竟の証', 100], ['蒼天の魂', 1], ['ルピ', 5000000]],
    130: [['碧麗の証', 1]],
    140: [['黄龍のマグナアニマ', 30], ['イグニス・ブライト', 15], ['ウェントス・ブライト', 15], ['弓のエレメント', 2000], ['光晶のエレメント', 2000], ['ル・オーの竜珠', 300], ['真龍の金鱗', 50], ['ルピ', 5000000]],
    150: [['終末の暗晶', 30], ['漆黒の棘翅', 30], ['狡知の魔角', 30], ['碧麗の証', 1]],
  },
  サラーサ: {
    110: [['ヒヒイロカネ', 1], ['斧の銀片', 200], ['インシュラーコア', 50], ['土の光輪', 80], ['ダマスカス骸晶', 20], ['星晶の欠片', 7500], ['土の宝珠', 7500], ['アース・ジーン', 7500], ['朽ち果てた斧（3凸）', 30], ['ルピ', 100000]],
    120: [['ブローディアのマグナアニマ', 50], ['土のプシュケー', 300], ['バハムートの紫電角', 100], ['三番天星の欠片', 50], ['究竟の証', 100], ['蒼天の魂', 1], ['ルピ', 5000000]],
    130: [['碧麗の証', 1]],
    140: [['黒麒麟のマグナアニマ', 30], ['テラ・ブライト', 30], ['斧のエレメント', 2000], ['土晶のエレメント', 2000], ['ガレヲンの竜珠', 300], ['真龍の金鱗', 50], ['ルピ', 5000000]],
    150: [['終末の暗晶', 30], ['漆黒の棘翅', 30], ['狡知の魔角', 30], ['碧麗の証', 1]],
  },
  カトル: {
    110: [['ヒヒイロカネ', 1], ['刃の銀片', 200], ['アビサルトラジェディー', 50], ['水の光輪', 80], ['ダマスカス骸晶', 20], ['星晶の欠片', 7500], ['水の宝珠', 7500], ['アクア・ジーン', 7500], ['朽ち果てた短剣（3凸）', 30], ['ルピ', 100000]],
    120: [['エウロペのマグナアニマ', 50], ['水のプシュケー', 300], ['バハムートの紫電角', 100], ['四番天星の欠片', 50], ['究竟の証', 100], ['蒼天の魂', 1], ['ルピ', 5000000]],
    130: [['碧麗の証', 1]],
    140: [['黒麒麟のマグナアニマ', 30], ['アクア・ブライト', 30], ['短剣のエレメント', 2000], ['水晶のエレメント', 2000], ['ワムデュスの竜珠', 300], ['真龍の金鱗', 50], ['ルピ', 5000000]],
    150: [['終末の暗晶', 30], ['漆黒の棘翅', 30], ['狡知の魔角', 30], ['碧麗の証', 1]],
  },
  フュンフ: {
    110: [['ヒヒイロカネ', 1], ['杖の銀片', 200], ['靂輪', 50], ['火の光輪', 40], ['風の光輪', 40], ['ダマスカス骸晶', 20], ['星晶の欠片', 7500], ['光の宝珠', 7500], ['ホーリー・ジーン', 7500], ['朽ち果てた杖（3凸）', 30], ['ルピ', 100000]],
    120: [['メタトロンのマグナアニマ', 50], ['光のプシュケー', 300], ['バハムートの紫電角', 100], ['五番天星の欠片', 50], ['究竟の証', 100], ['蒼天の魂', 1], ['ルピ', 5000000]],
    130: [['碧麗の証', 1]],
    140: [['黄龍のマグナアニマ', 30], ['イグニス・ブライト', 15], ['ウェントス・ブライト', 15], ['杖のエレメント', 2000], ['光晶のエレメント', 2000], ['ル・オーの竜珠', 300], ['真龍の金鱗', 50], ['ルピ', 5000000]],
    150: [['終末の暗晶', 30], ['漆黒の棘翅', 30], ['狡知の魔角', 30], ['碧麗の証', 1]],
  },
  シス: {
    110: [['ヒヒイロカネ', 1], ['手甲の銀片', 200], ['トーデストリープ', 50], ['水の光輪', 40], ['土の光輪', 40], ['ダマスカス骸晶', 20], ['星晶の欠片', 7500], ['闇の宝珠', 7500], ['ダーク・ジーン', 7500], ['朽ち果てた手甲（3凸）', 30], ['ルピ', 100000]],
    120: [['アバターのマグナアニマ', 50], ['闇のプシュケー', 300], ['バハムートの紫電角', 100], ['六番天星の欠片', 50], ['究竟の証', 100], ['蒼天の魂', 1], ['ルピ', 5000000]],
    130: [['碧麗の証', 1]],
    140: [['黒麒麟のマグナアニマ', 30], ['アクア・ブライト', 15], ['テラ・ブライト', 15], ['格闘のエレメント', 2000], ['闇晶のエレメント', 2000], ['フェディエルの竜珠', 300], ['真龍の金鱗', 50], ['ルピ', 5000000]],
    150: [['終末の暗晶', 30], ['漆黒の棘翅', 30], ['狡知の魔角', 30], ['碧麗の証', 1]],
  },
  シエテ: {
    110: [['ヒヒイロカネ', 1], ['剣の銀片', 200], ['ゲイルロック', 50], ['風の光輪', 80], ['ダマスカス骸晶', 20], ['星晶の欠片', 7500], ['風の宝珠', 7500], ['ウィンド・ジーン', 7500], ['朽ち果てた剣（3凸）', 30], ['ルピ', 100000]],
    120: [['グリームニルのマグナアニマ', 50], ['風のプシュケー', 300], ['バハムートの紫電角', 100], ['七番天星の欠片', 50], ['究竟の証', 100], ['蒼天の魂', 1], ['ルピ', 5000000]],
    130: [['碧麗の証', 1]],
    140: [['黄龍のマグナアニマ', 30], ['ウェントス・ブライト', 30], ['剣のエレメント', 2000], ['風晶のエレメント', 2000], ['イーウィヤの竜珠', 300], ['真龍の金鱗', 50], ['ルピ', 5000000]],
    150: [['終末の暗晶', 30], ['漆黒の棘翅', 30], ['狡知の魔角', 30], ['碧麗の証', 1]],
  },
  オクトー: {
    110: [['ヒヒイロカネ', 1], ['太刀の銀片', 200], ['インシュラーコア', 50], ['土の光輪', 80], ['ダマスカス骸晶', 20], ['星晶の欠片', 7500], ['土の宝珠', 7500], ['アース・ジーン', 7500], ['朽ち果てた刀（3凸）', 30], ['ルピ', 100000]],
    120: [['ブローディアのマグナアニマ', 50], ['土のプシュケー', 300], ['バハムートの紫電角', 100], ['八番天星の欠片', 50], ['究竟の証', 100], ['蒼天の魂', 1], ['ルピ', 5000000]],
    130: [['碧麗の証', 1]],
    140: [['黒麒麟のマグナアニマ', 30], ['テラ・ブライト', 30], ['刀のエレメント', 2000], ['土晶のエレメント', 2000], ['ガレヲンの竜珠', 300], ['真龍の金鱗', 50], ['ルピ', 5000000]],
    150: [['終末の暗晶', 30], ['漆黒の棘翅', 30], ['狡知の魔角', 30], ['碧麗の証', 1]],
  },
  ニオ: {
    110: [['ヒヒイロカネ', 1], ['竪琴の銀片', 200], ['ゲイルロック', 50], ['風の光輪', 80], ['ダマスカス骸晶', 20], ['星晶の欠片', 7500], ['風の宝珠', 7500], ['ウィンド・ジーン', 7500], ['朽ち果てた琴（3凸）', 30], ['ルピ', 100000]],
    120: [['グリームニルのマグナアニマ', 50], ['風のプシュケー', 300], ['バハムートの紫電角', 100], ['九番天星の欠片', 50], ['究竟の証', 100], ['蒼天の魂', 1], ['ルピ', 5000000]],
    130: [['碧麗の証', 1]],
    140: [['黄龍のマグナアニマ', 30], ['ウェントス・ブライト', 30], ['楽器のエレメント', 2000], ['風晶のエレメント', 2000], ['イーウィヤの竜珠', 300], ['真龍の金鱗', 50], ['ルピ', 5000000]],
    150: [['終末の暗晶', 30], ['漆黒の棘翅', 30], ['狡知の魔角', 30], ['碧麗の証', 1]],
  },
  エッセル: {
    110: [['ヒヒイロカネ', 1], ['銃の銀片', 200], ['イグナイトラブル', 50], ['火の光輪', 80], ['ダマスカス骸晶', 20], ['星晶の欠片', 7500], ['炎の宝珠', 7500], ['ファイア・ジーン', 7500], ['朽ち果てた銃（3凸）', 30], ['ルピ', 100000]],
    120: [['シヴァのマグナアニマ', 50], ['火のプシュケー', 300], ['バハムートの紫電角', 100], ['十番天星の欠片', 50], ['究竟の証', 100], ['蒼天の魂', 1], ['ルピ', 5000000]],
    130: [['碧麗の証', 1]],
    140: [['黄龍のマグナアニマ', 30], ['イグニス・ブライト', 30], ['銃のエレメント', 2000], ['火晶のエレメント', 2000], ['ウィルナスの竜珠', 300], ['真龍の金鱗', 50], ['ルピ', 5000000]],
    150: [['終末の暗晶', 30], ['漆黒の棘翅', 30], ['狡知の魔角', 30], ['碧麗の証', 1]],
  },
};

// Lv ごとの注意書き。注意書きがない Lv もあるので Partial（どのキーも、ないことがある）にしている
const TRANSCEND_NOTE: Partial<Record<string, string>> = {
  110: '専用トレジャー交換分を含む合計',
  130: 'Lv130解放のフェイトエピソード挑戦に必要',
  150: '「雄偉者たちの矜持」の交換素材',
};

function tentenTranscendPresets(): Preset[] {
  const presets: Preset[] = [];
  for (const c of TENTEN) {
    const base = { idPrefix: `transcend-${c.name}`, group: '十天衆', sub: c.name, source: GW + '246381' };
    // Object.entries は、Lv の小さい順（110, 120, …）に [Lv, 素材の一覧] の組を返す
    const stages: Stage[] = Object.entries(TRANSCEND[c.name]).map(([lv, items]) => ({
      key: lv,
      name: `限界超越：Lv${lv}解放`,
      note: TRANSCEND_NOTE[lv],
      reqs: pairs(items),
    }));
    presets.push(...stagePresets(base, stages));
    presets.push(totalPreset(base, {
      key: 'all',
      name: '限界超越：全段階まとめて（Lv110〜150）',
      note: 'Lv110〜150の合計（Lv110は専用トレジャー交換分を含む、Lv150は「雄偉者たちの矜持」の交換素材で計上）',
      stages,
    }));
  }
  return presets;
}

// ---------- 天司武器 4凸 ----------
// 光/闇は光輪が2属性に分かれる（光: 火/風 8個ずつ、闇: 水/土 8個ずつ）
const SERAPHIC: { name: string; element: Elem; weapon: string; anima: string; page: string; halos?: [Elem, number][] }[] = [
  { name: 'ソード・オブ・ミカエル', element: '火', weapon: '剣', anima: '黄龍', page: '56677' },
  { name: 'ワンド・オブ・ガブリエル', element: '水', weapon: '杖', anima: '黒麒麟', page: '56678' },
  { name: 'グローブ・オブ・ウリエル', element: '土', weapon: '格闘', anima: '黒麒麟', page: '56679' },
  { name: 'リング・オブ・ラファエル', element: '風', weapon: '弓', anima: '黄龍', page: '56676' },
  { name: 'ハープ・オブ・ハルワアルム', element: '光', weapon: '楽器', anima: '黄龍', page: '144967', halos: [['火', 8], ['風', 8]] },
  { name: 'サイス・オブ・ベリアル', element: '闇', weapon: '斧', anima: '黒麒麟', page: '144968', halos: [['水', 8], ['土', 8]] },
];

function seraphicPresets(): Preset[] {
  return SERAPHIC.map((w) => {
    // 型を書かないと、[[w.element, 16]] が「属性か数が並んだ配列」と推論され、[属性, 個数] の組として扱えない
    const halos: [Elem, number][] = w.halos ?? [[w.element, 16]];
    return {
      id: `seraphic-${w.element}-4`,
      group: '天司武器 4凸',
      name: `${w.name}（${w.element}）：4凸`,
      source: GW + w.page,
      reqs: [
        req(`${w.element}晶のエレメント`, 500),
        req(`${w.weapon}のエレメント`, 255),
        req(`${w.anima}のマグナアニマ`, 5),
        req('バハムートの紫電角', 3),
        req('ダマスカス骸晶', 5),
        req('ジェネシス・フラグメント', 40),
        req(`${w.element}のプシュケー`, 30),
        ...halos.map(([e, n]) => req(`${e}の光輪`, n)),
      ],
    };
  });
}

// ---------- エニアド 4凸 ----------
const ENNEAD: { name: string; boss: string; element: Elem; weapon: string; page: string }[] = [
  { name: 'ベンベネト', boss: 'アトゥム', element: '火', weapon: '槍', page: '344613' },
  { name: 'レルアバド', boss: 'アトゥム', element: '火', weapon: '杖', page: '344614' },
  { name: 'ウラエウス', boss: 'テフヌト', element: '水', weapon: '斧', page: '352613' },
  { name: 'エスナ', boss: 'テフヌト', element: '水', weapon: '杖', page: '352615' },
  { name: 'タァセネン', boss: 'ベンヌ', element: '土', weapon: '短剣', page: '330852' },
  { name: 'イシェド', boss: 'ベンヌ', element: '土', weapon: '弓', page: '330854' },
  { name: 'マンデト', boss: 'ラー', element: '風', weapon: '斧', page: '352617' },
  { name: 'アブシンベル', boss: 'ラー', element: '風', weapon: '格闘', page: '352620' },
  { name: 'ハルシエシス', boss: 'ホルス', element: '光', weapon: '弓', page: '319502' },
  { name: 'ホルアクティ', boss: 'ホルス', element: '光', weapon: '刀', page: '319504' },
  { name: 'ビガ・エドフ', boss: 'オシリス', element: '闇', weapon: '杖', page: '313260' },
  { name: 'アビュドス', boss: 'オシリス', element: '闇', weapon: '短剣', page: '313264' },
];

function enneadPresets(): Preset[] {
  return ENNEAD.map((w) => ({
    id: `ennead-${w.name}-4`,
    group: 'エニアド 4凸',
    name: `${w.name}（${w.boss}${w.weapon}）：4凸`,
    source: GW + w.page,
    reqs: [
      req(`${w.weapon}のエレメント`, 200),
      req(`${w.element}晶のエレメント`, 200),
      req(`${w.element}のプシュケー`, 5),
      req(GENE[w.element], 300),
      req(SCALE[w.element], 50),
      req(`${w.boss}のマグナアニマ`, 10),
    ],
  }));
}

// ---------- 六竜武器（アンセスタル） 4凸 ----------
const ANCESTRAL: { name: string; dragon: string; element: Elem; weapon: string; unique: string; page: string }[] = [
  { name: 'ウィルナス・フィンガー', dragon: 'ウィルナス', element: '火', weapon: '格闘', unique: 'イグナイトラブル', page: '218607' },
  { name: 'ワムデュス・ナイダリア', dragon: 'ワムデュス', element: '水', weapon: '槍', unique: 'アビサルトラジェディー', page: '218603' },
  { name: 'ガレヲン・ジョー', dragon: 'ガレヲン', element: '土', weapon: '銃', unique: 'インシュラーコア', page: '218511' },
  { name: 'イーウィヤビーク', dragon: 'イーウィヤ', element: '風', weapon: '刀', unique: 'ゲイルロック', page: '302526' },
  { name: 'ル・オー・ホーン', dragon: 'ル・オー', element: '光', weapon: '斧', unique: '靂輪', page: '218580' },
  { name: 'フェディエル・スパイン', dragon: 'フェディエル', element: '闇', weapon: '剣', unique: 'トーデストリープ', page: '218602' },
];

function ancestralPresets(): Preset[] {
  return ANCESTRAL.map((w) => ({
    id: `ancestral-${w.dragon}-4`,
    group: '六竜武器 4凸',
    name: `${w.name}（${w.element}）：4凸`,
    source: GW + w.page,
    reqs: [
      req(`${w.weapon}のエレメント`, 200),
      req(`${w.element}晶のエレメント`, 200),
      req(`${w.dragon}の竜珠`, 50),
      req(w.unique, 10),
      req('真龍の金鱗', 30),
      req(SCALE[w.element], 60),
    ],
  }));
}

// ---------- レヴァンスウェポン ----------
// 覚醒Lvは専用トレジャー1個=経験値20。Lv1→15 は1500(75個)、Lv15→20 は9000(450個)
// 特殊強化の専用トレジャーは、同じグループ(火風光 / 水土闇)の3ボス分が必要。武器の属性のものは200個、残り2つは80個
const REVANS_BOSS: Record<Elem, { boss: string; treasure: string; group: Elem[] }> = {
  火: { boss: 'ムゲン', treasure: '滅尽の残気', group: ['火', '風', '光'] },
  風: { boss: 'シエテ', treasure: '星海の刃屑', group: ['火', '風', '光'] },
  光: { boss: 'コスモス', treasure: '調停の裂布', group: ['火', '風', '光'] },
  水: { boss: 'ディアスポラ', treasure: '機神の基板', group: ['水', '土', '闇'] },
  土: { boss: 'ジークフリート', treasure: '滅竜の赫刃', group: ['水', '土', '闇'] },
  闇: { boss: 'アガスティア', treasure: '壊祖の紋装甲', group: ['水', '土', '闇'] },
};
// 4凸のブライト。光/闇は2属性に分かれる
const BRIGHT: Record<Elem, Pair[]> = {
  火: [['イグニス・ブライト', 10]],
  水: [['アクア・ブライト', 10]],
  土: [['テラ・ブライト', 10]],
  風: [['ウェントス・ブライト', 10]],
  光: [['イグニス・ブライト', 5], ['ウェントス・ブライト', 5]],
  闇: [['アクア・ブライト', 5], ['テラ・ブライト', 5]],
};
const REVANS: { name: string; element: Elem; weapon: string }[] = [
  { name: '滅尽剣', element: '火', weapon: '剣' },
  { name: '必滅弓', element: '火', weapon: '弓' },
  { name: 'シュレディンガー', element: '水', weapon: '刀' },
  { name: 'ラグランジュ', element: '水', weapon: '格闘' },
  { name: '竜伐の剛牙', element: '土', weapon: '短剣' },
  { name: '竜伐の撃爪', element: '土', weapon: '斧' },
  { name: 'セッテ・ディ・スパーダ', element: '風', weapon: '剣' },
  { name: 'ビエント・ディ・スパーダ', element: '風', weapon: '斧' },
  { name: 'シンメトリア', element: '光', weapon: '刀' },
  { name: 'コンコルディア', element: '光', weapon: '短剣' },
  { name: 'フォービドゥンアガスティ', element: '闇', weapon: '杖' },
  { name: 'フォーセイクンアガスティ', element: '闇', weapon: '楽器' },
];

function revansStages(element: Elem, weapon: string): Stage[] {
  const { treasure, group } = REVANS_BOSS[element];
  return [
    {
      key: '4',
      name: '4凸',
      reqs: [
        req(`${weapon}のエレメント`, 200),
        req(`${element}晶のエレメント`, 200),
        ...pairs(BRIGHT[element]),
        req(treasure, 50),
      ],
    },
    { key: 'awake15', name: '覚醒Lv1→15', reqs: [req(treasure, 75)] },
    {
      key: 'rebuild',
      name: '特殊強化（リビルド）',
      note: '覚醒Lvの上限が20に、奥義効果も強化される',
      reqs: [
        req(`${weapon}のエレメント`, 500),
        req(`${element}晶のエレメント`, 500),
        req(DRAGON_UNIQUE[element], 50),
        ...group.map((e) => req(REVANS_BOSS[e].treasure, e === element ? 200 : 80)),
      ],
    },
    { key: 'awake20', name: '覚醒Lv15→20', note: '特殊強化（リビルド）後に強化できる', reqs: [req(treasure, 450)] },
  ];
}

function revansPresets(): Preset[] {
  const presets: Preset[] = [];
  for (const w of REVANS) {
    const { boss } = REVANS_BOSS[w.element];
    const base = {
      idPrefix: `revans-${w.name}`,
      group: 'レヴァンスウェポン',
      sub: `${w.name}（${w.element}・${boss}）`,
      source: GW + '411851',
    };
    const stages = revansStages(w.element, w.weapon);
    presets.push(...stagePresets(base, stages));
    presets.push(totalPreset(base, { key: 'all', name: '全段階まとめて', note: '4凸・覚醒Lv15・特殊強化・覚醒Lv20の合計', stages }));
  }
  return presets;
}

// ---------- 終末武器（終末の神器） ----------
// 各属性に神石用（絶対否定）とマグナ用（永遠拒絶）の2本。必要素材は同じ属性なら共通
// GameWith の記事は恩寵の名前と光・闇の光輪とルピを書いていないので、神ゲー攻略の各武器の記事で確認した（2026-10-27）
// ルピは 4凸 10,000、5凸 50,000、限界超越は各段階 100,000（交換はショップ交換なので不要）
// 恩寵は 5凸が「福音の〇〇恩寵」、Lv240 が「天穹を廻りし〇〇恩寵」（〇〇は下の GRACE_WORD）
const GRACE_WORD: Record<Elem, string> = { 火: '火舞う', 水: '水湧く', 土: '土護る', 風: '風囁く', 光: '光降る', 闇: '闇覆う' };
// Lv240 の光輪。光は火＋風、闇は水＋土を半分ずつ使う
const ULTIMA_HALO: Record<Elem, Pair[]> = {
  火: [['火の光輪', 120]],
  水: [['水の光輪', 120]],
  土: [['土の光輪', 120]],
  風: [['風の光輪', 120]],
  光: [['火の光輪', 60], ['風の光輪', 60]],
  闇: [['水の光輪', 60], ['土の光輪', 60]],
};
const ULTIMA_BRIGHT: Record<Elem, Pair[]> = {
  火: [['イグニス・ブライト', 20]],
  水: [['アクア・ブライト', 20]],
  土: [['テラ・ブライト', 20]],
  風: [['ウェントス・ブライト', 20]],
  光: [['イグニス・ブライト', 10], ['ウェントス・ブライト', 10]],
  闇: [['アクア・ブライト', 10], ['テラ・ブライト', 10]],
};
// kind は、神石用（絶対否定）かマグナ用（永遠拒絶）か
const ULTIMA: { name: string; kind: '神石' | 'マグナ'; element: Elem; weapon: string; page: string }[] = [
  { name: '絶対否定の大鎌', kind: '神石', element: '火', weapon: '斧', page: '147753' },
  { name: '永遠拒絶の大鎌', kind: 'マグナ', element: '火', weapon: '斧', page: '147754' },
  { name: '絶対否定の杖', kind: '神石', element: '水', weapon: '杖', page: '147755' },
  { name: '永遠拒絶の杖', kind: 'マグナ', element: '水', weapon: '杖', page: '147756' },
  { name: '絶対否定の竪琴', kind: '神石', element: '土', weapon: '楽器', page: '147757' },
  { name: '永遠拒絶の竪琴', kind: 'マグナ', element: '土', weapon: '楽器', page: '147758' },
  { name: '絶対否定の槍', kind: '神石', element: '風', weapon: '槍', page: '147759' },
  { name: '永遠拒絶の槍', kind: 'マグナ', element: '風', weapon: '槍', page: '147760' },
  { name: '絶対否定の剣', kind: '神石', element: '光', weapon: '剣', page: '147762' },
  { name: '永遠拒絶の剣', kind: 'マグナ', element: '光', weapon: '剣', page: '147763' },
  { name: '絶対否定の太刀', kind: '神石', element: '闇', weapon: '刀', page: '147765' },
  { name: '永遠拒絶の太刀', kind: 'マグナ', element: '闇', weapon: '刀', page: '147766' },
];
// 限界超越（Lv210〜250）と、全段階まとめての出典。交換〜第3スキル付与は、各武器の記事
const ULTIMA_TRANSCEND_SRC = GW + '146896';

function ultimaStages(e: Elem, weapon: string): Stage[] {
  return [
    { key: 'make', name: '交換（3凸で入手）', reqs: [req(`${e}晶のエレメント`, 500), req(`${weapon}のエレメント`, 255), req('ダークネス・マテリアル', 5)] },
    {
      key: '4',
      name: '4凸',
      reqs: [
        req('ダークネス・マテリアル', 5), req('銀天の輝き', 5), req('覇者の証', 100), req('究竟の証', 10),
        req(`${e}のプシュケー`, 30), req(`${MAGNA2[e]}のマグナアニマ`, 10), req('ルピ', 10000),
      ],
    },
    { key: 'skill2', name: '第2スキル付与（ペンデュラム）', note: '4凸Lv120で付与できる', reqs: [req('ダークネス・マテリアル', 5)] },
    {
      key: '5',
      name: '5凸',
      reqs: [
        req(`福音の${GRACE_WORD[e]}恩寵`, 1), req('終末の暗晶', 5), req('ヒヒイロカネ', 1), req('バハムートの紫電角', 50),
        req('虚ろなる鍵', 50), req('オメガユニット', 50), req('アスタロトのアニマ', 30), req('ルピ', 50000),
      ],
    },
    { key: 'skill3', name: '第3スキル付与（ペンデュラム・チェイン）', note: '5凸Lv200で付与できる', reqs: [req('終末の暗晶', 5), req('ジェネシス・フラグメント', 30)] },
    {
      key: '210',
      name: '限界超越：Lv210',
      source: ULTIMA_TRANSCEND_SRC,
      reqs: [req('終末の暗晶', 60), req('漆黒の棘翅', 60), req('狡知の魔角', 60), req('ダマスカス骸晶', 20), req('究竟の証', 80), req('ルピ', 100000)],
    },
    {
      key: '220',
      name: '限界超越：Lv220',
      source: ULTIMA_TRANSCEND_SRC,
      reqs: [
        req('ニューワールド・クォーツ', 20), req(`${MAGNA2[e]}のマグナアニマ`, 80), req(`${DRAGON[e]}の竜珠`, 240),
        req(`${weapon}のエレメント`, 1200), req(`${e}晶のエレメント`, 1200), req('ルピ', 100000),
      ],
    },
    {
      key: '230',
      name: '限界超越：Lv230',
      source: ULTIMA_TRANSCEND_SRC,
      reqs: [req('終末を齎す黒羽', 10), req(REVANS_BOSS[e].treasure, 60), ...pairs(ULTIMA_BRIGHT[e]), req('ルピ', 100000)],
    },
    {
      key: '240',
      name: '限界超越：Lv240',
      source: ULTIMA_TRANSCEND_SRC,
      reqs: [
        req('終末を齎す黒羽', 15), req(`天穹を廻りし${GRACE_WORD[e]}恩寵`, 1), req('碧麗の証', 1),
        req(`${weapon}のエレメント`, 1200), req(`${e}晶のエレメント`, 1200), ...pairs(ULTIMA_HALO[e]),
        req('ルピ', 100000),
      ],
    },
    {
      key: '250',
      name: '限界超越：Lv250',
      source: ULTIMA_TRANSCEND_SRC,
      reqs: [req('終末を齎す黒羽', 15), req('極理の結晶', 15), req('アルテマメモリ', 15), req('刻の流砂', 1), req('ヒヒイロカネ', 1), req('ルピ', 100000)],
    },
  ];
}

function ultimaPresets(): Preset[] {
  const presets: Preset[] = [];
  for (const w of ULTIMA) {
    const base = {
      idPrefix: `ultima-${w.name}`,
      group: '終末武器',
      sub: `${w.name}（${w.element}・${w.kind}）`,
      source: GW + w.page,
    };
    const stages = ultimaStages(w.element, w.weapon);
    // 限界超越の段階（key が 210 以上の数）
    const transcend = stages.filter((st) => Number(st.key) >= 210);
    presets.push(...stagePresets(base, stages));
    presets.push(totalPreset(base, {
      key: 'transcend-all',
      name: '限界超越：全段階まとめて（Lv210〜250）',
      source: ULTIMA_TRANSCEND_SRC,
      stages: transcend,
    }));
    presets.push(totalPreset(base, {
      key: 'all',
      name: '全段階まとめて（交換〜Lv250）',
      source: ULTIMA_TRANSCEND_SRC,
      stages,
    }));
  }
  return presets;
}

// ---------- ドラゴニックウェポン ----------
// GameWith は特殊強化の素材を「極致の証」と書いているが、神ゲー攻略（各武器と一覧の記事）と estalucia では「究竟の証」。
// 「極致の証」はジョブ強化の仕組みの名前でアイテムではないので、究竟の証にしている。ルピも神ゲー攻略で確認（2026-10-27）
const DRACONIC: { name: string; element: Elem; weapon: string; page: string }[] = [
  { name: '雄渾と灼熱の調べ（ドラゴニックハープ）', element: '火', weapon: '楽器', page: '190117' },
  { name: '溟渤と激流の裁き（ドラゴニックバスター）', element: '水', weapon: '斧', page: '190264' },
  { name: '豊穣と恩愛の寿ぎ（ドラゴニックボウ）', element: '土', weapon: '弓', page: '190297' },
  { name: '狂飆と至高の祈り（ドラゴニックロッド）', element: '風', weapon: '杖', page: '190326' },
  { name: '叡智と廻生の煌き（ドラゴニックブレイド）', element: '光', weapon: '刀', page: '190367' },
  { name: '暁闇と葬送の蝕み（ドラゴニックファイア）', element: '闇', weapon: '銃', page: '190447' },
];

// 「雄渾と灼熱の調べ（ドラゴニックハープ）」の、（）の中の呼び名を取り出す。（）がなければ名前全体
function shortName(name: string): string {
  const match = name.match(/（(.+)）/);
  return match ? match[1] : name;
}

function draconicStages(e: Elem, weapon: string): Stage[] {
  return [
    { key: 'make', name: '交換（3凸で入手）', reqs: [req(`${e}晶のエレメント`, 666), req(`${weapon}のエレメント`, 500), req('真龍の金鱗', 30)] },
    {
      key: '4',
      name: '4凸',
      reqs: [req('真龍の金鱗', 30), req('銀天の輝き', 5), req('栄光の証', 100), req('覇者の証', 50), req(STAR[e], 30), req('ルピ', 10000)],
    },
    {
      key: '5',
      name: '5凸',
      reqs: [
        req(`${weapon}のエレメント`, 200), req(DRAGON_UNIQUE[e], 15), req('ダマスカス骸晶', 5),
        req(SCALE[e], 350), req('マリス・フラグメント', 10), req('究竟の証', 10), req('ルピ', 50000),
      ],
    },
    {
      key: 'special',
      name: '特殊強化',
      reqs: [
        req(`${weapon}のエレメント`, 1000), req(`${e}晶のエレメント`, 1000), req('ダマスカス骸晶', 15),
        req('究竟の証', 10), req(DRAGON_UNIQUE[e], 100), req('極理の結晶', 20), req('刻の流砂', 1),
      ],
    },
  ];
}

function draconicPresets(): Preset[] {
  const presets: Preset[] = [];
  for (const w of DRACONIC) {
    const base = {
      idPrefix: `draconic-${w.element}`,
      group: 'ドラゴニックウェポン',
      sub: `${shortName(w.name)}（${w.element}）`,
      source: GW + w.page,
    };
    const stages = draconicStages(w.element, w.weapon);
    presets.push(...stagePresets(base, stages));
    presets.push(totalPreset(base, { key: 'all', name: '全段階まとめて（交換〜特殊強化）', stages }));
  }
  return presets;
}

// ---------- 天星器（十天衆加入） ----------
// 出典: GameWith「十天衆素材の効率よい集め方」(23094)。素材は変更先の属性で決まり、キャラ（武器種）では変わらない
// 第1段階の真化は属性に関係なく光属性の素材を使う
const HIGH_ORB: Record<Elem, string> = { 火: '紅蓮の宝珠', 水: '霧氷の宝珠', 土: '大地の宝珠', 風: '竜巻の宝珠', 光: '煌光の宝珠', 闇: '冥闇の宝珠' };
const TOME: Record<Elem, string> = { 火: '赤の書', 水: '青の書', 土: '茶の書', 風: '緑の書', 光: '白の書', 闇: '黒の書' };
const SCROLL: Record<Elem, string> = { 火: '紅蓮の巻', 水: '霧氷の巻', 土: '大地の巻', 風: '竜巻の巻', 光: '天光の巻', 闇: '冥闇の巻' };
const MAGNA_MAT: Record<Elem, string> = { 火: 'プロミネンスリアクター', 水: '海神の扇尾', 土: '創樹の花蕾', 風: '嵐竜の琥珀眼', 光: 'プライマルビット', 闇: '黒霧の結晶' };

function trueAnima(e: Elem): string {
  return `真なる${e}のアニマ`;
}

function revenantStages(e: Elem): Stage[] {
  return [
    {
      key: '1',
      name: '第1段階：真化',
      note: '天星器を3凸Lv100にしておく。素材は変更先に関係なく光属性',
      reqs: [req('煌光の宝珠', 50), req('天光の巻', 50), req('ホーリー・ジーン', 50), req('白竜鱗', 50), req('栄光の証', 50), req('宝晶石', 100)],
    },
    {
      key: '2',
      name: '第2段階：属性変更（依代武器の作成込み）',
      note: '別途、天星器と同じ武器種の朽ち果てた武器（3凸・Lv最大）が1本必要。天星器のスキルLvを10にしておく',
      reqs: [req(ORB[e], 250), req(GENE[e], 250), req('星晶の欠片', 250), req(trueAnima(e), 3)],
    },
    {
      key: '3',
      name: '第3段階：設備拡充（初回のみ）',
      note: '1回行えば、2本目以降の天星器では不要',
      reqs: [
        req('マインゴーシュ', 1), req('風精の鉤爪槍', 1), req('虹魚鱗飾', 1), req('火精の権杖', 1), req('水精の牧杖', 1),
        req('クリムゾンアックス', 1), req('土精の蛇行剣', 1), req('クラッシュハンド', 1), req('シャインバレル', 1),
        req('シャインナックル', 1), req('シャドウスピア', 1), req('シャドウワンド', 1), req('インペリアルショテル', 1),
        req('スパイククラブ', 1), req('ミスラのアニマ', 5), req('ルピ', 200000),
      ],
    },
    {
      key: '4',
      name: '第4段階',
      reqs: [
        req('柔らかい羽', 300), req('原初の砂', 100), req('固い土', 100), req(ORB[e], 100), req(TOME[e], 100),
        req(SCROLL[e], 150), req(GENE[e], 100), req('覇者の証', 10), req('碧空の結晶', 3), req('宝晶石', 100),
      ],
    },
    {
      key: '5',
      name: '第5段階',
      reqs: [
        req('清らかな水', 100), req('紅黄石', 100), req('虚ろなる魄', 100), req(ORB[e], 150), req(TOME[e], 150),
        req(GENE[e], 150), req(SCALE[e], 30), req('虹星晶', 50), req(trueAnima(e), 3), req('碧空の結晶', 5), req('宝晶石', 200),
      ],
    },
    {
      key: '6',
      name: '第6段階',
      reqs: [
        req('風伯の羽', 300), req('鷹の羽', 100), req('予見の双葉', 80), req(ORB[e], 200), req(HIGH_ORB[e], 100),
        req(GENE[e], 200), req(`${ISLAND[e]}のアニマ`, 100), req('覇者の証', 10), req('碧空の結晶', 7), req('宝晶石', 300),
      ],
    },
    {
      key: '7',
      name: '第7段階',
      reqs: [
        req('渦琥珀', 100), req('ラクリモサ', 100), req('オルディネシュタイン', 80), req(ORB[e], 250), req(GENE[e], 250),
        req(SCALE[e], 50), req('虹星晶', 150), req(trueAnima(e), 3), req('碧空の結晶', 10), req('宝晶石', 400),
      ],
    },
    {
      key: '8',
      name: '第8段階',
      reqs: [
        // 変更先の属性の素材は80個、ほかの5属性は20個ずつ
        ...ELEMENTS.map((x) => req(MAGNA_MAT[x], x === e ? 80 : 20)),
        req('古代布', 100), req('覇者の証', 10), req('碧空の結晶', 15), req('宝晶石', 500),
      ],
    },
    {
      key: '9',
      name: '第9段階（十天衆加入）',
      note: '完了後、武器に対応した十天衆のフェイトエピソードをクリアすると加入',
      reqs: [...ELEMENTS.map((x) => req(trueAnima(x), 3)), req('虹星晶', 250), req('碧空の結晶', 30), req('ヒヒイロカネ', 1), req('宝晶石', 500)],
    },
  ];
}

function revenantPresets(): Preset[] {
  const presets: Preset[] = [];
  for (const e of ELEMENTS) {
    const base = { idPrefix: `revenant-${e}`, group: '天星器（十天衆加入）', sub: `${e}属性に変更`, source: GW + '23094' };
    const stages = revenantStages(e);
    presets.push(...stagePresets(base, stages));
    presets.push(totalPreset(base, {
      key: 'all',
      name: '全段階まとめて（初回：設備拡充込み）',
      note: '別途、朽ち果てた武器（3凸）1本が必要',
      stages,
    }));
    // 第3段階の設備拡充は1回行えば済むので、2人目以降は数えない
    presets.push(totalPreset(base, {
      key: 'all-2nd',
      name: '全段階まとめて（2人目以降：設備拡充なし）',
      note: '別途、朽ち果てた武器（3凸）1本が必要',
      stages: stages.filter((st) => st.key !== '3'),
    }));
  }
  return presets;
}

// ---------- 十賢者（アーカルム） ----------
// 出典: GameWith の各アーカルム召喚石の記事、十賢者の加入(144770)・最終(390463)・限界超越(537602)、新世界の礎武器の各記事
// 光（ザ・スター）は火/風、闇（デス）は水/土の素材を半分ずつ使う

interface Sage {
  sage: string;       // 十賢者の名前
  stone: string;      // アーカルム召喚石の名前
  element: Elem;
  idea: string;       // 「〇〇のイデア」「〇〇のウェリタス」の〇〇
  frag: string;       // 「〇〇・フラグメント」の〇〇
  grande: string;     // 召喚石5凸で使う、十賢者ごとの素材
  weapon: string;     // 新世界の礎武器の名前
  stonePage: string;  // 召喚石の記事の番号
  weaponPage: string; // 礎武器の記事の番号
}

const SAGES: Sage[] = [
  { sage: 'アラナン', stone: 'ザ・サン', element: '火', idea: '太陽', frag: 'アクイラ', grande: '修行者の覚書', weapon: 'ヒート・オブ・ザ・サン', stonePage: '81834', weaponPage: '245167' },
  { sage: 'フラウ', stone: 'ザ・デビル', element: '火', idea: '悪魔', frag: 'アクイラ', grande: 'レムペッパー', weapon: 'キス・オブ・ザ・デビル', stonePage: '81836', weaponPage: '245168' },
  { sage: 'マリア・テレサ', stone: 'ジャスティス', element: '水', idea: '正義', frag: 'ベラトール', grande: 'トキシックフラワー', weapon: 'ライズ・オブ・ジャスティス', stonePage: '81844', weaponPage: '245166' },
  { sage: 'ハーゼリーラ', stone: 'ザ・ムーン', element: '水', idea: '月', frag: 'ベラトール', grande: '透き通るような絹', weapon: 'リフレクト・オブ・ザ・ムーン', stonePage: '81835', weaponPage: '245170' },
  { sage: 'カイム', stone: 'ザ・ハングドマン', element: '土', idea: '刑死者', frag: 'アクイラ', grande: 'ベスティエフルーツ', weapon: 'タイ・オブ・ザ・ハングドマン', stonePage: '81837', weaponPage: '245171' },
  { sage: 'ロベリア', stone: 'ザ・タワー', element: '土', idea: '塔', frag: 'ケルサス', grande: '割れたティーカップ', weapon: 'クラッシュ・オブ・ザ・タワー', stonePage: '81841', weaponPage: '245165' },
  { sage: 'カッツェリーラ', stone: 'ジャッジメント', element: '風', idea: '審判', frag: 'ベラトール', grande: '埃まみれの書物', weapon: 'メロディ・オブ・ジャッジメント', stonePage: '81838', weaponPage: '245172' },
  { sage: 'エスタリオラ', stone: 'テンペランス', element: '風', idea: '節制', frag: 'ケルサス', grande: 'クルーガーハープ', weapon: 'プレイ・オブ・テンペランス', stonePage: '81842', weaponPage: '245169' },
  { sage: 'ガイゼンボーガ', stone: 'ザ・スター', element: '光', idea: '星', frag: 'ケルサス', grande: '錆びついた掛瓦', weapon: 'ショット・オブ・ザ・スター', stonePage: '81840', weaponPage: '245162' },
  { sage: 'ニーア', stone: 'デス', element: '闇', idea: '死神', frag: 'ケルサス', grande: '巨獣骨', weapon: 'ペイン・オブ・デス', stonePage: '81843', weaponPage: '245164' },
];
const OLD_ANIMA: Record<Elem, string> = { 火: 'フラム＝グラス', 水: 'マキュラ・マリウス', 土: 'メドゥーサ', 風: 'ナタク', 光: 'アポロン', 闇: 'オリヴィエ' };
const NEW_ANIMA: Record<Elem, string> = { 火: 'アテナ', 水: 'グラニ', 土: 'バアル', 風: 'ガルーダ', 光: 'オーディン', 闇: 'リッチ' };
const SERAPH_ANIMA: Record<Base4, string> = { 火: 'ミカエルのアニマ', 水: 'ガブリエルのアニマ', 土: 'ウリエルのアニマ', 風: 'ラファエルのアニマ' };
const SHOWDOWN: Record<Elem, string> = { 火: '灼滅の焔角', 水: '氷獄の結晶', 土: '裁考の水晶', 風: '人馬の円盤', 光: '妃光の水晶', 闇: '幻魔の破片' };
const SHARD: Record<Base4, string> = { 火: '業火の石片', 水: '玉水の石片', 土: '荒土の石片', 風: '狂風の石片' };
const BRIGHT_NAME: Record<Base4, string> = { 火: 'イグニス・ブライト', 水: 'アクア・ブライト', 土: 'テラ・ブライト', 風: 'ウェントス・ブライト' };
const GOSPEL: Record<Base4, string> = { 火: 'エゲイラ・ゴスペル', 水: 'アナリプシア・ゴスペル', 土: 'テュシア・ゴスペル', 風: 'ゲネア・ゴスペル' };
const HAZE: Record<Elem, string> = { 火: 'オーロラ・ヘイズ', 風: 'オーロラ・ヘイズ', 光: 'オーロラ・ヘイズ', 水: 'カオティック・ヘイズ', 土: 'カオティック・ヘイズ', 闇: 'カオティック・ヘイズ' };
const VERUM: Record<Base4, string> = { 火: 'ヴェルム文書・火', 水: 'ヴェルム文書・水', 土: 'ヴェルム文書・土', 風: 'ヴェルム文書・風' };
const SAGE_JOIN_SRC = GW + '144770';
const SAGE_FINAL_SRC = GW + '390463';
const SAGE_TRANSCEND_SRC = GW + '537602';

// プリセットの sub に使う名前（例: アラナン（ザ・サン・火））
function sageSub(s: Sage): string {
  return `${s.sage}（${s.stone}・${s.element}）`;
}

// 十賢者ごとに名前が変わる素材
function sageMaterials(s: Sage): { astra: string; idea: string; frag: string; veritas: string } {
  return {
    astra: `${s.element}精のアストラ`,
    idea: `${s.idea}のイデア`,
    frag: `${s.frag}・フラグメント`,
    veritas: `${s.idea}のウェリタス`,
  };
}

// アーカルムの共通素材（セフィラストーン・アストラ・イデア・ヴェルム文書・ヘイズ）。それぞれの個数を受け取る
function arcanumReqs(s: Sage, n: { stone: number; astra: number; idea: number; verum: number; haze: number }): PresetReq[] {
  const { astra, idea } = sageMaterials(s);
  return [
    req('セフィラストーン', n.stone),
    req(astra, n.astra),
    req(idea, n.idea),
    ...byElement(s.element, VERUM, n.verum),
    req(HAZE[s.element], n.haze),
  ];
}

// 召喚石の交換〜5凸と、加入（カードの交換）の段階
function sageJoinStages(s: Sage): Stage[] {
  const e = s.element;
  const { astra, idea, frag } = sageMaterials(s);
  return [
    {
      key: 'make',
      name: '召喚石：交換（SR）',
      reqs: [...arcanumReqs(s, { stone: 2, astra: 3, idea: 2, verum: 6, haze: 1 }), req('星晶塊', 100), req(`${ISLAND[e]}のマグナアニマ`, 30)],
    },
    {
      key: 'sr1',
      name: '召喚石：SR1凸',
      reqs: [...arcanumReqs(s, { stone: 5, astra: 5, idea: 3, verum: 16, haze: 3 }), req('虹星晶', 100), req(`${e}晶のエレメント`, 100)],
    },
    {
      key: 'sr2',
      name: '召喚石：SR2凸',
      reqs: [...arcanumReqs(s, { stone: 10, astra: 10, idea: 5, verum: 30, haze: 7 }), req(`${OLD_ANIMA[e]}のアニマ`, 30)],
    },
    {
      key: 'sr3',
      name: '召喚石：SR3凸',
      reqs: [...arcanumReqs(s, { stone: 15, astra: 15, idea: 7, verum: 50, haze: 16 }), req(`${NEW_ANIMA[e]}のアニマ`, 30), req('究竟の証', 3)],
    },
    {
      key: 'ssr',
      name: '召喚石：SSR化',
      reqs: [
        ...arcanumReqs(s, { stone: 30, astra: 30, idea: 15, verum: 80, haze: 24 }),
        req('銀天の輝き', 5), ...byElement(e, SERAPH_ANIMA, 20), req('金剛晶', 1),
      ],
    },
    {
      key: '4',
      name: '召喚石：4凸',
      reqs: [...arcanumReqs(s, { stone: 45, astra: 45, idea: 25, verum: 120, haze: 32 }), req(`${MAGNA2[e]}のマグナアニマ`, 10), req(frag, 10)],
    },
    {
      key: '5',
      name: '召喚石：5凸',
      reqs: [
        req(SHOWDOWN[e], 100), ...byElement(e, SHARD, 50), ...byElement(e, VERUM, 250), req('ジェネシス・フラグメント', 80),
        req('バハムートの紫電角', 10), req(frag, 20), req(s.grande, 50),
      ],
    },
    {
      key: 'join',
      name: '加入：カード交換',
      note: '召喚石5凸後、「○○が描かれたカード」を交換してフェイトエピソードをクリアすると加入',
      source: SAGE_JOIN_SRC,
      reqs: [req('セフィラストーン', 30), req(astra, 200), req(idea, 20), req('セフィラ玉髄', 1)],
    },
  ];
}

// 新世界の礎武器（交換〜5凸）の段階
function sageWeaponStages(s: Sage): Stage[] {
  const e = s.element;
  const { astra, idea, frag, veritas } = sageMaterials(s);
  // ブライトとヴェルム文書。光・闇は2属性に半分ずつ分ける
  const brights = (qty: number) => byElement(e, BRIGHT_NAME, qty);
  const verum = (qty: number) => byElement(e, VERUM, qty);
  return [
    { key: 'make', name: '礎武器：交換', reqs: [req('ニューワールド・クォーツ', 5), ...brights(isLightOrDark(e) ? 6 : 5), req(veritas, 20)] },
    {
      key: '1',
      name: '礎武器：1凸',
      reqs: [req('ニューワールド・クォーツ', 5), ...brights(isLightOrDark(e) ? 14 : 15), req(veritas, 70), req('マリス・フラグメント', 30), ...verum(100), req(astra, 30)],
    },
    {
      key: '2',
      name: '礎武器：2凸',
      reqs: [req('ニューワールド・クォーツ', 10), ...brights(30), req(veritas, 100), req('蒼翠の結晶', 20), ...verum(150), req(astra, 50), req(idea, 30)],
    },
    {
      key: '3',
      name: '礎武器：3凸',
      reqs: [req('ニューワールド・クォーツ', 20), ...brights(50), req(veritas, 130), req(`${DRAGON[e]}の竜珠`, 20), ...verum(200), req(astra, 100), req(idea, 70)],
    },
    {
      key: '4',
      name: '礎武器：4凸',
      reqs: [req('ニューワールド・クォーツ', 20), ...brights(60), req(veritas, 150), req(`${DRAGON[e]}の竜珠`, 30), ...verum(250), req(astra, 120), req(idea, 100)],
    },
    {
      key: '5',
      name: '礎武器：5凸',
      reqs: [req('ニューワールド・クォーツ', 30), ...brights(70), req(veritas, 170), req(DRAGON_UNIQUE[e], 30), req(frag, 30), req(astra, 140), req(idea, 130), req('刻の流砂', 3)],
    },
  ];
}

// 至賢の領域・最終上限解放・4アビの段階
function sageFinalStages(s: Sage): Stage[] {
  const e = s.element;
  const { astra, idea, frag, veritas } = sageMaterials(s);
  return [
    {
      key: 'domain',
      name: '至賢の領域：全解放（合計）',
      note: '記事の合計値。領域の解放には礎武器の上限解放も必要',
      reqs: [
        req(veritas, 80), req(astra, 110), req(idea, 110), req(frag, 30), ...byElement(e, BRIGHT_NAME, 20), ...byElement(e, VERUM, 360), req(HAZE[e], 50),
        req('セフィラストーン', 50), req(`${e}のプシュケー`, 30), req(DRAGON_UNIQUE[e], 30), req('ジェネシス・フラグメント', 30),
        req(`${MAGNA2[e]}のマグナアニマ`, 10),
      ],
    },
    {
      key: 'final',
      name: '最終上限解放',
      note: '至賢の領域の全解放と礎武器5凸、エリア・ムンドゥスのディフェンダー全討伐が条件',
      reqs: [req('セフィラ玉髄', 1), ...byElement(e, GOSPEL, 50), ...byElement(e, BRIGHT_NAME, 50), req('セフィラストーン', 200)],
    },
    {
      key: '4th',
      name: '4アビ取得（ザ・ワールドが描かれたカード）',
      note: 'Lv100到達とザ・ワールド討伐後に交換できる',
      reqs: [req('金剛晶', 1), req('世界のイデア', 100), req('ニューワールド・クォーツ', 30), req('ダマスカス骸晶', 10)],
    },
  ];
}

function sagePresets(): Preset[] {
  const presets: Preset[] = [];
  for (const s of SAGES) {
    const sub = sageSub(s);
    const stoneBase = { idPrefix: `sage-${s.stone}`, group: '十賢者', sub, source: GW + s.stonePage };
    const weaponBase = { idPrefix: `sage-${s.stone}-weapon`, group: '十賢者', sub, source: GW + s.weaponPage };
    const finalBase = { idPrefix: `sage-${s.stone}`, group: '十賢者', sub, source: SAGE_FINAL_SRC };
    const joinStages = sageJoinStages(s);
    const weaponStages = sageWeaponStages(s);
    const finalStages = sageFinalStages(s);
    const [domain, final, fourth] = finalStages;

    // 召喚石の交換〜加入
    presets.push(...stagePresets(stoneBase, joinStages));
    presets.push(totalPreset(stoneBase, {
      key: 'join-all',
      name: '加入：全段階まとめて（召喚石の交換〜加入）',
      source: SAGE_JOIN_SRC,
      stages: joinStages,
    }));
    // 新世界の礎武器
    presets.push(...stagePresets(weaponBase, weaponStages));
    presets.push(totalPreset(weaponBase, { key: 'all', name: `礎武器：全段階まとめて（${s.weapon}）`, stages: weaponStages }));
    // 至賢の領域・最終上限解放・4アビ。まとめには礎武器（交換〜5凸）も入れる
    presets.push(...stagePresets(finalBase, finalStages));
    presets.push(totalPreset(finalBase, {
      key: 'final-all',
      name: '最終：全段階まとめて（至賢の領域・礎武器5凸・最終・4アビ）',
      stages: [domain, ...weaponStages, final, fourth],
    }));
  }
  return presets;
}

// 十賢者の限界超越 Lv110（2026-10 時点で記事に素材が載っているのはマリア・テレサとカイムのみ）
const SAGE_TRANSCEND: { sage: string; stone: string; reqs: Pair[] }[] = [
  { sage: 'マリア・テレサ', stone: 'ジャスティス', reqs: [['ジャスティスビリーフ', 40], ['アクアホイール', 8], ['異律のアゲート', 1], ['ニューワールド・クォーツ', 20], ['ニフイヴィンテの魔核', 60], ['正義のイデア', 120], ['水精のアストラ', 240]] },
  { sage: 'カイム', stone: 'ザ・ハングドマン', reqs: [['ザ・ハングドマンビリーフ', 40], ['テラホイール', 8], ['異律のアゲート', 1], ['ニューワールド・クォーツ', 20], ['ナロフィルミダスの魔核', 60], ['刑死者のイデア', 120], ['土精のアストラ', 240]] },
];

function sageTranscendPresets(): Preset[] {
  return SAGE_TRANSCEND.map((t) => {
    const s = SAGES.find((x) => x.sage === t.sage);
    // find は見つからないと undefined を返す。名前の書き間違いにすぐ気づけるよう、エラーにする
    if (!s) throw new Error(`十賢者が見つかりません: ${t.sage}`);
    return {
      id: `sage-${t.stone}-transcend-110`,
      group: '十賢者',
      sub: sageSub(s),
      name: '限界超越：Lv110解放',
      source: SAGE_TRANSCEND_SRC,
      note: 'ソロモナスの賢者を進めると解放される',
      reqs: pairs(t.reqs),
    };
  });
}

// ---------- 書き出す値 ----------

// すべてのプリセット。この順に、選ぶ欄に並ぶ
export const PRESETS: Preset[] = [
  ...tentenFinalPresets(),
  ...tentenTranscendPresets(),
  ...seraphicPresets(),
  ...enneadPresets(),
  ...ancestralPresets(),
  ...revansPresets(),
  ...ultimaPresets(),
  ...draconicPresets(),
  ...revenantPresets(),
  ...sagePresets(),
  ...sageTranscendPresets(),
];

// 以前の版で仮の名前にしていた素材の、正式名称への対応表を作る（保存データの移行用）
function createRenames(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const c of TENTEN) {
    map[`天星の欠片（${c.name}）`] = `${c.no}天星の欠片`;
    map[`対応した武器エレメント（${c.name}）`] = `${c.weapon}のエレメント`;
  }
  for (const e of ELEMENTS) {
    map[`プシュケー（${e}）`] = `${e}のプシュケー`;
    map[`ジーン（${e}）`] = GENE[e];
    map[`下位宝珠（${e}）`] = ORB[e];
  }
  // 「ゴブロ」は「ゴッドガード・ブローディア」の略称。十天衆超越の記事の表記をそのまま使っていた
  map['ゴブロのマグナアニマ'] = 'ブローディアのマグナアニマ';
  // 2026-10-06 に正式名称を確認したもの
  map['火の宝珠'] = '炎の宝珠';
  for (const e of ELEMENTS) {
    map[`輝き（${e}）`] = STAR[e];
  }
  for (const e of BASE4) {
    map[`共闘素材の書（${e}）`] = BOOK[e];
  }
  for (const b of ['イグニス', 'アクア', 'テラ', 'ウェントス']) {
    map[`${b}ブライト`] = `${b}・ブライト`;
  }
  for (const e of BASE4) {
    map[`光輪（${e}・要確認）`] = `${e}の光輪`;
  }
  // 2026-10-27 に終末武器の恩寵の正式名称を確認したもの。光・闇の「光輪（属性・要確認）」は2種類に分かれたので移せない
  // 5凸の恩寵は、風だけ前から正式名称（福音の風囁く恩寵）だったので、仮の名前がない
  for (const e of ELEMENTS.filter((x) => x !== '風')) {
    map[`恩寵（${e}）`] = `福音の${GRACE_WORD[e]}恩寵`;
  }
  for (const e of ELEMENTS) {
    map[`新恩寵（${e}）`] = `天穹を廻りし${GRACE_WORD[e]}恩寵`;
  }
  // ドラゴニックウェポンの特殊強化。GameWith の「極致の証」は究竟の証の書き間違い（2026-10-27 確認）
  map['極致の証'] = '究竟の証';
  return map;
}

// 以前の版で仮の名前にしていた素材の、正式名称への対応表。旧名 → 新名
export const PRESET_RENAMES = createRenames();

// コンテンツの大分類。プリセットの選択肢と目標リストをこの順に分けて並べる
export const PRESET_CATEGORIES: Category[] = ['キャラ', '武器', 'その他'];
// 大分類が「キャラ」になるコンテンツ。ほかは「武器」
const CHARACTER_GROUPS = ['十天衆', '十賢者', '天星器（十天衆加入）'];

export function presetCategory(p: Preset): Category {
  return CHARACTER_GROUPS.includes(p.group) ? 'キャラ' : '武器';
}

// 目標に付ける名前（キャラ名などの sub があれば「ウーノ：最終：銀の依代 最終解放」のように前に付ける）
export function presetLabel(p: Preset): string {
  return p.sub ? `${p.sub}：${p.name}` : p.name;
}
