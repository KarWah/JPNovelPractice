/**
 * Kangxi Radicals (部首) reference data
 * Covers the 214 traditional radicals plus common variant forms.
 */

export interface RadicalInfo {
  number: number;
  radical: string;
  variants?: string[];
  name: string;      // Japanese reading / name (e.g. ごんべん)
  meaning: string;   // English core meaning
  strokes: number;
}

export const KANGXI_RADICALS: RadicalInfo[] = [
  // 1 stroke
  { number: 1, radical: "一", name: "いち", meaning: "one", strokes: 1 },
  { number: 2, radical: "丨", name: "ぼう", meaning: "line, rod", strokes: 1 },
  { number: 3, radical: "丶", name: "てん", meaning: "dot", strokes: 1 },
  { number: 4, radical: "丿", name: "の", meaning: "slash, bend", strokes: 1 },
  { number: 5, radical: "乙", variants: ["乚"], name: "おつ", meaning: "second", strokes: 1 },
  { number: 6, radical: "亅", name: "はねぼう", meaning: "hook", strokes: 1 },

  // 2 strokes
  { number: 7, radical: "二", name: "に", meaning: "two", strokes: 2 },
  { number: 8, radical: "亠", name: "なべぶた", meaning: "lid, top", strokes: 2 },
  { number: 9, radical: "人", variants: ["亻", "𠆢"], name: "ひと / にんべん", meaning: "person, human", strokes: 2 },
  { number: 10, radical: "儿", name: "ひとあし", meaning: "legs, human", strokes: 2 },
  { number: 11, radical: "入", name: "いる", meaning: "enter", strokes: 2 },
  { number: 12, radical: "八", variants: ["丷"], name: "はち", meaning: "eight, divide", strokes: 2 },
  { number: 13, radical: "冂", name: "けいがまえ / まきがまえ", meaning: "enclosure, border", strokes: 2 },
  { number: 14, radical: "冖", name: "わかんむり", meaning: "cover, crown", strokes: 2 },
  { number: 15, radical: "冫", name: "にすい", meaning: "ice", strokes: 2 },
  { number: 16, radical: "几", name: "きにょう", meaning: "table, desk", strokes: 2 },
  { number: 17, radical: "凵", name: "かんにょう", meaning: "container, open box", strokes: 2 },
  { number: 18, radical: "刀", variants: ["刂"], name: "かたな / りっとう", meaning: "knife, sword", strokes: 2 },
  { number: 19, radical: "力", name: "ちから", meaning: "power, strength", strokes: 2 },
  { number: 20, radical: "勹", name: "つつみがまえ", meaning: "wrap, embrace", strokes: 2 },
  { number: 21, radical: "匕", name: "ひ", meaning: "spoon", strokes: 2 },
  { number: 22, radical: "匚", name: "はこがまえ", meaning: "box, basket", strokes: 2 },
  { number: 23, radical: "匸", name: "かくしがまえ", meaning: "hiding enclosure", strokes: 2 },
  { number: 24, radical: "十", name: "じゅう", meaning: "ten, complete", strokes: 2 },
  { number: 25, radical: "卜", name: "ぼく", meaning: "divination", strokes: 2 },
  { number: 26, radical: "卩", variants: ["⺋"], name: "ふしづくり", meaning: "seal, kneeling person", strokes: 2 },
  { number: 27, radical: "厂", name: "がんだれ", meaning: "cliff", strokes: 2 },
  { number: 28, radical: "厶", name: "む", meaning: "private", strokes: 2 },
  { number: 29, radical: "又", name: "また", meaning: "again, right hand", strokes: 2 },

  // 3 strokes
  { number: 30, radical: "口", name: "くち / くちへん", meaning: "mouth, opening", strokes: 3 },
  { number: 31, radical: "囗", name: "くにがまえ", meaning: "enclosure, border", strokes: 3 },
  { number: 32, radical: "土", name: "つち / つちへん", meaning: "earth, soil, ground", strokes: 3 },
  { number: 33, radical: "士", name: "さむらい", meaning: "scholar, warrior", strokes: 3 },
  { number: 34, radical: "夂", name: "ふゆがしら", meaning: "winter, go slowly", strokes: 3 },
  { number: 35, radical: "夊", name: "すいにょう", meaning: "slow walk", strokes: 3 },
  { number: 36, radical: "夕", name: "ゆうべ", meaning: "evening", strokes: 3 },
  { number: 37, radical: "大", name: "だい", meaning: "big, large", strokes: 3 },
  { number: 38, radical: "女", name: "おんな / おんなへん", meaning: "woman, female", strokes: 3 },
  { number: 39, radical: "子", name: "こ / こへん", meaning: "child, son", strokes: 3 },
  { number: 40, radical: "宀", name: "うかんむり", meaning: "roof, house", strokes: 3 },
  { number: 41, radical: "寸", name: "すん", meaning: "inch, measure", strokes: 3 },
  { number: 42, radical: "小", variants: ["⺌"], name: "しょう", meaning: "small, little", strokes: 3 },
  { number: 43, radical: "尢", variants: ["尣"], name: "だいのまげあし", meaning: "lame, crooked leg", strokes: 3 },
  { number: 44, radical: "尸", name: "しかばね", meaning: "corpse, body, flag", strokes: 3 },
  { number: 45, radical: "屮", name: "てつ", meaning: "sprout", strokes: 3 },
  { number: 46, radical: "山", name: "やま / やまへん", meaning: "mountain", strokes: 3 },
  { number: 47, radical: "巛", variants: ["川"], name: "かわ", meaning: "river", strokes: 3 },
  { number: 48, radical: "工", name: "たくみ", meaning: "craft, work, construction", strokes: 3 },
  { number: 49, radical: "己", variants: ["已", "巳"], name: "おのれ", meaning: "oneself", strokes: 3 },
  { number: 50, radical: "巾", name: "はば / はばへん", meaning: "towel, cloth", strokes: 3 },
  { number: 51, radical: "干", name: "かん", meaning: "dry, shield", strokes: 3 },
  { number: 52, radical: "幺", name: "いとがしら", meaning: "short thread", strokes: 3 },
  { number: 53, radical: "广", name: "まだれ", meaning: "slanted roof, building", strokes: 3 },
  { number: 54, radical: "廴", name: "えんにょう", meaning: "long stride", strokes: 3 },
  { number: 55, radical: "廾", name: "にじゅうあし", meaning: "two hands folded", strokes: 3 },
  { number: 56, radical: "弋", name: "しきがまえ", meaning: "ceremony, arrow", strokes: 3 },
  { number: 57, radical: "弓", name: "ゆみ / ゆみへん", meaning: "bow (archery)", strokes: 3 },
  { number: 58, radical: "彐", variants: ["彑"], name: "けいがしら", meaning: "pig snout", strokes: 3 },
  { number: 59, radical: "彡", name: "さんづくり", meaning: "hair, bristles", strokes: 3 },
  { number: 60, radical: "彳", name: "ぎょうにんべん", meaning: "step, stroll", strokes: 3 },

  // 4 strokes
  { number: 61, radical: "心", variants: ["忄", "⺗"], name: "こころ / りっしんべん", meaning: "heart, mind, spirit", strokes: 4 },
  { number: 62, radical: "戈", name: "ほこ / かのほこ", meaning: "spear, halberd", strokes: 4 },
  { number: 63, radical: "戶", variants: ["户", "戸"], name: "と / とびらのと", meaning: "door, household", strokes: 4 },
  { number: 64, radical: "手", variants: ["扌"], name: "て / てへん", meaning: "hand", strokes: 4 },
  { number: 65, radical: "支", name: "しにょう", meaning: "branch", strokes: 4 },
  { number: 66, radical: "攴", variants: ["攵"], name: "のぶん / ぼくづくり", meaning: "action, strike", strokes: 4 },
  { number: 67, radical: "文", name: "ぶん", meaning: "literature, culture", strokes: 4 },
  { number: 68, radical: "斗", name: "とます", meaning: "dipper, ladle", strokes: 4 },
  { number: 69, radical: "斤", name: "おの / おのづくり", meaning: "axe", strokes: 4 },
  { number: 70, radical: "方", name: "ほう / ほうへん", meaning: "direction, square", strokes: 4 },
  { number: 71, radical: "无", variants: ["旡"], name: "なし", meaning: "not, without", strokes: 4 },
  { number: 72, radical: "日", name: "ひ / ひへん", meaning: "sun, day", strokes: 4 },
  { number: 73, radical: "曰", name: "ひらび", meaning: "say, speak", strokes: 4 },
  { number: 74, radical: "月", name: "つき / にくづき", meaning: "moon, month; body, flesh", strokes: 4 },
  { number: 75, radical: "木", name: "き / きへん", meaning: "tree, wood", strokes: 4 },
  { number: 76, radical: "欠", name: "あくび", meaning: "lack, yawn", strokes: 4 },
  { number: 77, radical: "止", name: "とめる", meaning: "stop, halt", strokes: 4 },
  { number: 78, radical: "歹", variants: ["歺"], name: "がつへん", meaning: "death, decay", strokes: 4 },
  { number: 79, radical: "殳", name: "るまた", meaning: "weapon, pike", strokes: 4 },
  { number: 80, radical: "毋", variants: ["母"], name: "なかれ / はは", meaning: "mother, do not", strokes: 4 },
  { number: 81, radical: "比", name: "くらべる", meaning: "compare", strokes: 4 },
  { number: 82, radical: "毛", name: "け", meaning: "hair, fur", strokes: 4 },
  { number: 83, radical: "氏", name: "うじ", meaning: "clan, family", strokes: 4 },
  { number: 84, radical: "气", name: "きがまえ", meaning: "steam, air, breath", strokes: 4 },
  { number: 85, radical: "水", variants: ["氵", "氺"], name: "みず / さんずい", meaning: "water", strokes: 4 },
  { number: 86, radical: "火", variants: ["灬"], name: "ひ / れっか", meaning: "fire", strokes: 4 },
  { number: 87, radical: "爪", variants: ["爫"], name: "つめ", meaning: "claw, nail", strokes: 4 },
  { number: 88, radical: "父", name: "ちち", meaning: "father", strokes: 4 },
  { number: 89, radical: "爻", name: "こう", meaning: "double cross", strokes: 4 },
  { number: 90, radical: "爿", name: "しょうへん", meaning: "split wood", strokes: 4 },
  { number: 91, radical: "片", name: "かた", meaning: "slice, fragment", strokes: 4 },
  { number: 92, radical: "牙", name: "きば", meaning: "fang, tooth", strokes: 4 },
  { number: 93, radical: "牛", variants: ["牜"], name: "うし / うしへん", meaning: "cow, ox", strokes: 4 },
  { number: 94, radical: "犬", variants: ["犭"], name: "いぬ / けものへん", meaning: "dog, beast", strokes: 4 },

  // 5 strokes
  { number: 95, radical: "玄", name: "げん", meaning: "dark, mysterious", strokes: 5 },
  { number: 96, radical: "玉", variants: ["王"], name: "たま / おうへん", meaning: "jade, king", strokes: 5 },
  { number: 97, radical: "瓜", name: "うり", meaning: "melon", strokes: 5 },
  { number: 98, radical: "瓦", name: "かわら", meaning: "tile", strokes: 5 },
  { number: 99, radical: "甘", name: "あまい", meaning: "sweet", strokes: 5 },
  { number: 100, radical: "生", name: "せい / うまれる", meaning: "life, birth", strokes: 5 },
  { number: 101, radical: "用", name: "もちいる", meaning: "use", strokes: 5 },
  { number: 102, radical: "田", name: "た / たへん", meaning: "rice field", strokes: 5 },
  { number: 103, radical: "疋", variants: ["⺪"], name: "ひき", meaning: "bolt of cloth", strokes: 5 },
  { number: 104, radical: "疒", name: "やまいだれ", meaning: "sickness, disease", strokes: 5 },
  { number: 105, radical: "癶", name: "はつがしら", meaning: "footsteps", strokes: 5 },
  { number: 106, radical: "白", name: "しろ / しろへん", meaning: "white", strokes: 5 },
  { number: 107, radical: "皮", name: "けがわ", meaning: "skin, hide", strokes: 5 },
  { number: 108, radical: "皿", name: "さら", meaning: "dish, plate", strokes: 5 },
  { number: 109, radical: "目", variants: ["⺫"], name: "め / めへん", meaning: "eye", strokes: 5 },
  { number: 110, radical: "矛", name: "ほこ", meaning: "spear", strokes: 5 },
  { number: 111, radical: "矢", name: "や / やへん", meaning: "arrow", strokes: 5 },
  { number: 112, radical: "石", name: "いし / いしへん", meaning: "stone, rock", strokes: 5 },
  { number: 113, radical: "示", variants: ["礻"], name: "しめす / しめすへん", meaning: "altar, spirit, show", strokes: 5 },
  { number: 114, radical: "禸", name: "ぐうのあし", meaning: "track, footprint", strokes: 5 },
  { number: 115, radical: "禾", name: "のぎ / のぎへん", meaning: "grain, wheat", strokes: 5 },
  { number: 116, radical: "穴", name: "あな / あなかんむり", meaning: "cave, hole", strokes: 5 },
  { number: 117, radical: "立", name: "たつ / たつへん", meaning: "stand, establish", strokes: 5 },

  // 6 strokes
  { number: 118, radical: "竹", variants: ["⺮"], name: "たけ / たけかんむり", meaning: "bamboo", strokes: 6 },
  { number: 119, radical: "米", name: "こめ / こめへん", meaning: "rice", strokes: 6 },
  { number: 120, radical: "糸", variants: ["糹"], name: "いと / いとへん", meaning: "thread, silk", strokes: 6 },
  { number: 121, radical: "缶", name: "ほとぎ", meaning: "jar, can", strokes: 6 },
  { number: 122, radical: "网", variants: ["罒", "罓"], name: "あみがしら", meaning: "net", strokes: 6 },
  { number: 123, radical: "羊", variants: ["⺶"], name: "ひつじ", meaning: "sheep", strokes: 6 },
  { number: 124, radical: "羽", name: "はね", meaning: "feather, wing", strokes: 6 },
  { number: 125, radical: "老", variants: ["耂"], name: "おい / おいかんむり", meaning: "old, aged", strokes: 6 },
  { number: 126, radical: "而", name: "しかして", meaning: "and yet, rake", strokes: 6 },
  { number: 127, radical: "耒", name: "らいすき", meaning: "plow", strokes: 6 },
  { number: 128, radical: "耳", name: "みみ / みみへん", meaning: "ear", strokes: 6 },
  { number: 129, radical: "聿", variants: ["⺻"], name: "ふでづくり", meaning: "brush, pen", strokes: 6 },
  { number: 130, radical: "肉", variants: ["⺼"], name: "にく", meaning: "meat, flesh", strokes: 6 },
  { number: 131, radical: "臣", name: "しん", meaning: "minister, retainer", strokes: 6 },
  { number: 132, radical: "自", name: "みずから", meaning: "self, nose", strokes: 6 },
  { number: 133, radical: "至", name: "いたる", meaning: "arrive, climax", strokes: 6 },
  { number: 134, radical: "臼", name: "うす", meaning: "mortar", strokes: 6 },
  { number: 135, radical: "舌", name: "した", meaning: "tongue", strokes: 6 },
  { number: 136, radical: "舛", name: "ます", meaning: "opposite, diverge", strokes: 6 },
  { number: 137, radical: "舟", name: "ふね / ふねへん", meaning: "boat, ship", strokes: 6 },
  { number: 138, radical: "艮", name: "うしとら", meaning: "stopping, good", strokes: 6 },
  { number: 139, radical: "色", name: "いろ", meaning: "color, appearance", strokes: 6 },
  { number: 140, radical: "艸", variants: ["艹"], name: "くさ / くさかんむり", meaning: "grass, vegetation", strokes: 6 },
  { number: 141, radical: "虍", name: "とらがしら", meaning: "tiger stripes", strokes: 6 },
  { number: 142, radical: "虫", name: "むし / むしへん", meaning: "insect, bug", strokes: 6 },
  { number: 143, radical: "血", name: "ち", meaning: "blood", strokes: 6 },
  { number: 144, radical: "行", name: "ぎょう / ぎょうがまえ", meaning: "go, conduct", strokes: 6 },
  { number: 145, radical: "衣", variants: ["衤"], name: "ころも / ころもへん", meaning: "clothes, garment", strokes: 6 },
  { number: 146, radical: "襾", variants: ["西", "覀"], name: "にし", meaning: "cover, west", strokes: 6 },

  // 7 strokes
  { number: 147, radical: "見", name: "みる", meaning: "see, view", strokes: 7 },
  { number: 148, radical: "角", name: "つの", meaning: "horn, corner", strokes: 7 },
  { number: 149, radical: "言", name: "ことば / ごんべん", meaning: "speech, words", strokes: 7 },
  { number: 150, radical: "谷", name: "たに", meaning: "valley", strokes: 7 },
  { number: 151, radical: "豆", name: "まめ", meaning: "bean", strokes: 7 },
  { number: 152, radical: "豕", name: "いのこ", meaning: "pig, boar", strokes: 7 },
  { number: 153, radical: "豸", name: "むじな", meaning: "badger", strokes: 7 },
  { number: 154, radical: "貝", name: "かい / かいへん", meaning: "shell, value", strokes: 7 },
  { number: 155, radical: "赤", name: "あか", meaning: "red", strokes: 7 },
  { number: 156, radical: "走", variants: ["赱"], name: "はしる / そうにょう", meaning: "run", strokes: 7 },
  { number: 157, radical: "足", variants: ["⻊"], name: "あし / あしへん", meaning: "foot, leg", strokes: 7 },
  { number: 158, radical: "身", name: "み / みへん", meaning: "body", strokes: 7 },
  { number: 159, radical: "車", name: "くるま / くるまへん", meaning: "cart, vehicle, car", strokes: 7 },
  { number: 160, radical: "辛", name: "からい", meaning: "spicy, bitter", strokes: 7 },
  { number: 161, radical: "辰", name: "しんのたつ", meaning: "dragon, sign of dragon", strokes: 7 },
  { number: 162, radical: "辵", variants: ["辶"], name: "しんにょう", meaning: "road, walk, advance", strokes: 7 },
  { number: 163, radical: "邑", variants: ["阝"], name: "おおざと", meaning: "village, right ear", strokes: 7 },
  { number: 164, radical: "酉", name: "ひよみのとり / とりへん", meaning: "wine vessel, sake", strokes: 7 },
  { number: 165, radical: "釆", name: "のごめ", meaning: "divide, separate", strokes: 7 },
  { number: 166, radical: "里", name: "さと / さとへん", meaning: "village, home", strokes: 7 },

  // 8 strokes
  { number: 167, radical: "金", variants: ["釒"], name: "かね / かねへん", meaning: "metal, gold, iron", strokes: 8 },
  { number: 168, radical: "長", name: "ながい", meaning: "long, leader", strokes: 8 },
  { number: 169, radical: "門", name: "もん / もんがまえ", meaning: "gate, doors", strokes: 8 },
  { number: 170, radical: "阜", variants: ["阝"], name: "こざとへん", meaning: "mound, left ear", strokes: 8 },
  { number: 171, radical: "隶", name: "れいづくり", meaning: "slave, capture", strokes: 8 },
  { number: 172, radical: "隹", name: "ふるとり", meaning: "small bird", strokes: 8 },
  { number: 173, radical: "雨", name: "あめ / あめかんむり", meaning: "rain", strokes: 8 },
  { number: 174, radical: "靑", variants: ["青"], name: "あお", meaning: "blue, green", strokes: 8 },
  { number: 175, radical: "非", name: "あらず", meaning: "wrong, non-", strokes: 8 },

  // 9 strokes
  { number: 176, radical: "面", name: "めん", meaning: "face, surface", strokes: 9 },
  { number: 177, radical: "革", name: "かわへん", meaning: "leather, hide", strokes: 9 },
  { number: 178, radical: "韋", name: "なめしがわ", meaning: "tanned leather", strokes: 9 },
  { number: 179, radical: "韭", name: "にら", meaning: "leek", strokes: 9 },
  { number: 180, radical: "音", name: "おと / おとへん", meaning: "sound, tone", strokes: 9 },
  { number: 181, radical: "頁", name: "おおがい", meaning: "leaf, page, head", strokes: 9 },
  { number: 182, radical: "風", name: "かぜ", meaning: "wind", strokes: 9 },
  { number: 183, radical: "飛", name: "とぶ", meaning: "fly", strokes: 9 },
  { number: 184, radical: "食", variants: ["飠"], name: "しょく / しょくへん", meaning: "food, eat", strokes: 9 },
  { number: 185, radical: "首", name: "くび", meaning: "neck, head, chief", strokes: 9 },
  { number: 186, radical: "香", name: "こう", meaning: "fragrance, incense", strokes: 9 },

  // 10 strokes
  { number: 187, radical: "馬", name: "うま / うまへん", meaning: "horse", strokes: 10 },
  { number: 188, radical: "骨", name: "ほね / ほねへん", meaning: "bone", strokes: 10 },
  { number: 189, radical: "高", name: "たかい", meaning: "tall, high", strokes: 10 },
  { number: 190, radical: "髟", name: "かみがしら", meaning: "long hair", strokes: 10 },
  { number: 191, radical: "鬥", name: "とうがまえ", meaning: "fight, struggle", strokes: 10 },
  { number: 192, radical: "鬯", name: "ちょう", meaning: "sacrificial wine", strokes: 10 },
  { number: 193, radical: "鬲", name: "かなえ", meaning: "cauldron, tripod", strokes: 10 },
  { number: 194, radical: "鬼", name: "おに", meaning: "demon, ghost", strokes: 10 },

  // 11 strokes
  { number: 195, radical: "魚", name: "うお / うおへん", meaning: "fish", strokes: 11 },
  { number: 196, radical: "鳥", name: "とり / とりへん", meaning: "bird", strokes: 11 },
  { number: 197, radical: "鹵", name: "ろ", meaning: "salt", strokes: 11 },
  { number: 198, radical: "鹿", name: "しか", meaning: "deer", strokes: 11 },
  { number: 199, radical: "麥", variants: ["麦"], name: "むぎ", meaning: "wheat, barley", strokes: 11 },
  { number: 200, radical: "麻", name: "あさ", meaning: "hemp", strokes: 11 },

  // 12 strokes
  { number: 201, radical: "黃", variants: ["黄"], name: "きいろ", meaning: "yellow", strokes: 12 },
  { number: 202, radical: "黍", name: "きび", meaning: "millet", strokes: 12 },
  { number: 203, radical: "黑", variants: ["黒"], name: "くろ", meaning: "black", strokes: 12 },
  { number: 204, radical: "黹", name: "ふつ", meaning: "embroidery", strokes: 12 },

  // 13 strokes
  { number: 205, radical: "黽", name: "べん", meaning: "frog, toad", strokes: 13 },
  { number: 206, radical: "鼎", name: "かなえ", meaning: "sacrificial tripod", strokes: 13 },
  { number: 207, radical: "鼓", name: "つづみ", meaning: "drum", strokes: 13 },
  { number: 208, radical: "鼠", name: "ねずみ", meaning: "rat, mouse", strokes: 13 },

  // 14 strokes
  { number: 209, radical: "鼻", name: "はな", meaning: "nose", strokes: 14 },
  { number: 210, radical: "齊", variants: ["斉"], name: "せい", meaning: "even, uniform", strokes: 14 },

  // 15 strokes
  { number: 211, radical: "齒", variants: ["歯"], name: "は", meaning: "tooth, teeth", strokes: 15 },

  // 16 strokes
  { number: 212, radical: "龍", variants: ["竜"], name: "りゅう", meaning: "dragon", strokes: 16 },
  { number: 213, radical: "龜", variants: ["亀"], name: "かめ", meaning: "turtle, tortoise", strokes: 16 },

  // 17 strokes
  { number: 214, radical: "龠", name: "やく", meaning: "flute, pipe", strokes: 17 },
];

// Quick lookup map: character/variant -> RadicalInfo
const RADICAL_MAP = new Map<string, RadicalInfo>();

for (const info of KANGXI_RADICALS) {
  RADICAL_MAP.set(info.radical, info);
  if (info.variants) {
    for (const v of info.variants) {
      RADICAL_MAP.set(v, info);
    }
  }
}

// Common non-Kangxi kanji components that appear frequently in decompositions
const COMMON_COMPONENTS: Record<string, { name: string; meaning: string }> = {
  "龶": { name: "せい", meaning: "growing vegetation / raw" },
  "𠮟": { name: "しかる", meaning: "scold" },
  "𡗗": { name: "そう", meaning: "spring vegetation" },
  "化": { name: "ばけ", meaning: "change, transform" },
  "元": { name: "もと", meaning: "origin, foundation" },
  "古": { name: "ふるい", meaning: "old, ancient" },
  "寺": { name: "てら", meaning: "temple" },
  "寸": { name: "すん", meaning: "inch, measurement" },
  "少": { name: "すくない", meaning: "few, little" },
  "平": { name: "たいら", meaning: "flat, calm" },
  "包": { name: "つつむ", meaning: "wrap" },
  "北": { name: "きた", meaning: "north" },
  "半": { name: "なかば", meaning: "half" },
  "正": { name: "ただしい", meaning: "correct, right" },
  "主": { name: "ぬし", meaning: "master, main" },
  "令": { name: "れい", meaning: "orders, command" },
};

/**
 * Lookup info for any radical or component character
 */
export function getRadicalInfo(element: string): { name: string; meaning: string; isKangxi: boolean; number?: number } | null {
  if (!element) return null;
  const kangxi = RADICAL_MAP.get(element);
  if (kangxi) {
    return {
      name: kangxi.name,
      meaning: kangxi.meaning,
      isKangxi: true,
      number: kangxi.number,
    };
  }
  const common = COMMON_COMPONENTS[element];
  if (common) {
    return {
      name: common.name,
      meaning: common.meaning,
      isKangxi: false,
    };
  }
  return null;
}
