import type { SupportedLanguage } from '@/services/localizations';

interface BookName {
  name: string;
  abbrev: string;
}

type BibleBookNames = Record<
  string,
  Partial<Record<SupportedLanguage, BookName>>
>;

/**
 * Localized Bible book names and abbreviations for all supported UI languages.
 * Book IDs match the BIBLE_BOOKS constant in bibleStructure.ts.
 */
export const BIBLE_BOOK_NAMES: BibleBookNames = {
  // ============================================================================
  // OLD TESTAMENT
  // ============================================================================
  gen: {
    english: { name: 'Genesis', abbrev: 'Gen' },
    spanish: { name: 'Génesis', abbrev: 'Gén' },
    brazilian_portuguese: { name: 'Gênesis', abbrev: 'Gn' },
    tok_pisin: { name: 'Jenesis', abbrev: 'Jen' },
    indonesian: { name: 'Kejadian', abbrev: 'Kej' },
    nepali: { name: 'उत्पत्ति', abbrev: 'उत्प' },
    hindi: { name: 'उत्पत्ति', abbrev: 'उत्प' },
    burmese: { name: 'ကမ္ဘာဦးကျမ်း', abbrev: 'ကမ္ဘာ' },
    thai: { name: 'ปฐมกาล', abbrev: 'ปฐก' },
    mandarin: { name: '创世记', abbrev: '创' }
  },
  exo: {
    english: { name: 'Exodus', abbrev: 'Exod' },
    spanish: { name: 'Éxodo', abbrev: 'Éxo' },
    brazilian_portuguese: { name: 'Êxodo', abbrev: 'Êx' },
    tok_pisin: { name: 'Kisim Bek', abbrev: 'Kis' },
    indonesian: { name: 'Keluaran', abbrev: 'Kel' },
    nepali: { name: 'प्रस्थान', abbrev: 'प्रस्थ' },
    hindi: { name: 'निर्गमन', abbrev: 'निर्ग' },
    burmese: { name: 'ထွက်မြောက်ရာကျမ်း', abbrev: 'ထွက်' },
    thai: { name: 'อพยพ', abbrev: 'อพย' },
    mandarin: { name: '出埃及记', abbrev: '出' }
  },
  lev: {
    english: { name: 'Leviticus', abbrev: 'Lev' },
    spanish: { name: 'Levítico', abbrev: 'Lev' },
    brazilian_portuguese: { name: 'Levítico', abbrev: 'Lv' },
    tok_pisin: { name: 'Wok Pris', abbrev: 'Wok' },
    indonesian: { name: 'Imamat', abbrev: 'Im' },
    nepali: { name: 'लेवीहरू', abbrev: 'लेवी' },
    hindi: { name: 'लैव्यव्यवस्था', abbrev: 'लैव्य' },
    burmese: { name: 'ယဇ်ပုရောဟိတ်ကျမ်း', abbrev: 'ယဇ်' },
    thai: { name: 'เลวีนิติ', abbrev: 'ลนต' },
    mandarin: { name: '利未记', abbrev: '利' }
  },
  num: {
    english: { name: 'Numbers', abbrev: 'Num' },
    spanish: { name: 'Números', abbrev: 'Núm' },
    brazilian_portuguese: { name: 'Números', abbrev: 'Nm' },
    tok_pisin: { name: 'Namba', abbrev: 'Nam' },
    indonesian: { name: 'Bilangan', abbrev: 'Bil' },
    nepali: { name: 'गन्ती', abbrev: 'गन्ती' },
    hindi: { name: 'गिनती', abbrev: 'गिन' },
    burmese: { name: 'တောလည်ရာကျမ်း', abbrev: 'တော' },
    thai: { name: 'กันดารวิถี', abbrev: 'กนว' },
    mandarin: { name: '民数记', abbrev: '民' }
  },
  deu: {
    english: { name: 'Deuteronomy', abbrev: 'Deut' },
    spanish: { name: 'Deuteronomio', abbrev: 'Deut' },
    brazilian_portuguese: { name: 'Deuteronômio', abbrev: 'Dt' },
    tok_pisin: { name: 'Lo Namba Tu', abbrev: 'Lo2' },
    indonesian: { name: 'Ulangan', abbrev: 'Ul' },
    nepali: { name: 'व्यवस्था', abbrev: 'व्यव' },
    hindi: { name: 'व्यवस्थाविवरण', abbrev: 'व्यव' },
    burmese: { name: 'တရားဟောရာကျမ်း', abbrev: 'တရား' },
    thai: { name: 'เฉลยธรรมบัญญัติ', abbrev: 'ฉธบ' },
    mandarin: { name: '申命记', abbrev: '申' }
  },
  jos: {
    english: { name: 'Joshua', abbrev: 'Josh' },
    spanish: { name: 'Josué', abbrev: 'Jos' },
    brazilian_portuguese: { name: 'Josué', abbrev: 'Js' },
    tok_pisin: { name: 'Josua', abbrev: 'Jos' },
    indonesian: { name: 'Yosua', abbrev: 'Yos' },
    nepali: { name: 'यहोशू', abbrev: 'यहो' },
    hindi: { name: 'यहोशू', abbrev: 'यहो' },
    burmese: { name: 'ယောရှုကျမ်း', abbrev: 'ယောရှု' },
    thai: { name: 'โยชูวา', abbrev: 'ยชว' },
    mandarin: { name: '约书亚记', abbrev: '书' }
  },
  jdg: {
    english: { name: 'Judges', abbrev: 'Judg' },
    spanish: { name: 'Jueces', abbrev: 'Jue' },
    brazilian_portuguese: { name: 'Juízes', abbrev: 'Jz' },
    tok_pisin: { name: 'Jas', abbrev: 'Jas' },
    indonesian: { name: 'Hakim-hakim', abbrev: 'Hak' },
    nepali: { name: 'न्यायकर्ता', abbrev: 'न्या' },
    hindi: { name: 'न्यायाधीश', abbrev: 'न्या' },
    burmese: { name: 'တရားသူကြီးကျမ်း', abbrev: 'တရား' },
    thai: { name: 'ผู้วินิจฉัย', abbrev: 'วนฉ' },
    mandarin: { name: '士师记', abbrev: '士' }
  },
  rut: {
    english: { name: 'Ruth', abbrev: 'Ruth' },
    spanish: { name: 'Rut', abbrev: 'Rut' },
    brazilian_portuguese: { name: 'Rute', abbrev: 'Rt' },
    tok_pisin: { name: 'Rut', abbrev: 'Rut' },
    indonesian: { name: 'Rut', abbrev: 'Rut' },
    nepali: { name: 'रूथ', abbrev: 'रूथ' },
    hindi: { name: 'रूत', abbrev: 'रूत' },
    burmese: { name: 'ရုသကျမ်း', abbrev: 'ရုသ' },
    thai: { name: 'รูธ', abbrev: 'รธ' },
    mandarin: { name: '路得记', abbrev: '得' }
  },
  '1sa': {
    english: { name: '1 Samuel', abbrev: '1 Sam' },
    spanish: { name: '1 Samuel', abbrev: '1 Sam' },
    brazilian_portuguese: { name: '1 Samuel', abbrev: '1Sm' },
    tok_pisin: { name: '1 Samuel', abbrev: '1Sam' },
    indonesian: { name: '1 Samuel', abbrev: '1Sam' },
    nepali: { name: '१ शमूएल', abbrev: '१शमू' },
    hindi: { name: '१ शमूएल', abbrev: '१शमू' },
    burmese: { name: '၁ ရှမွေလ', abbrev: '၁ရှမွေ' },
    thai: { name: '๑ ซามูเอล', abbrev: '๑ซมอ' },
    mandarin: { name: '撒母耳记上', abbrev: '撒上' }
  },
  '2sa': {
    english: { name: '2 Samuel', abbrev: '2 Sam' },
    spanish: { name: '2 Samuel', abbrev: '2 Sam' },
    brazilian_portuguese: { name: '2 Samuel', abbrev: '2Sm' },
    tok_pisin: { name: '2 Samuel', abbrev: '2Sam' },
    indonesian: { name: '2 Samuel', abbrev: '2Sam' },
    nepali: { name: '२ शमूएल', abbrev: '२शमू' },
    hindi: { name: '२ शमूएल', abbrev: '२शमू' },
    burmese: { name: '၂ ရှမွေလ', abbrev: '၂ရှမွေ' },
    thai: { name: '๒ ซามูเอล', abbrev: '๒ซมอ' },
    mandarin: { name: '撒母耳记下', abbrev: '撒下' }
  },
  '1ki': {
    english: { name: '1 Kings', abbrev: '1 Kgs' },
    spanish: { name: '1 Reyes', abbrev: '1 Rey' },
    brazilian_portuguese: { name: '1 Reis', abbrev: '1Rs' },
    tok_pisin: { name: '1 King', abbrev: '1Kin' },
    indonesian: { name: '1 Raja-raja', abbrev: '1Raj' },
    nepali: { name: '१ राजा', abbrev: '१राजा' },
    hindi: { name: '१ राजा', abbrev: '१राजा' },
    burmese: { name: '၁ ဓမ္မရာဇဝင်ချုပ်', abbrev: '၁ရာဇ' },
    thai: { name: '๑ พงศ์กษัตริย์', abbrev: '๑พกษ' },
    mandarin: { name: '列王纪上', abbrev: '王上' }
  },
  '2ki': {
    english: { name: '2 Kings', abbrev: '2 Kgs' },
    spanish: { name: '2 Reyes', abbrev: '2 Rey' },
    brazilian_portuguese: { name: '2 Reis', abbrev: '2Rs' },
    tok_pisin: { name: '2 King', abbrev: '2Kin' },
    indonesian: { name: '2 Raja-raja', abbrev: '2Raj' },
    nepali: { name: '२ राजा', abbrev: '२राजा' },
    hindi: { name: '२ राजा', abbrev: '२राजा' },
    burmese: { name: '၂ ဓမ္မရာဇဝင်ချုပ်', abbrev: '၂ရာဇ' },
    thai: { name: '๒ พงศ์กษัตริย์', abbrev: '๒พกษ' },
    mandarin: { name: '列王纪下', abbrev: '王下' }
  },
  '1ch': {
    english: { name: '1 Chronicles', abbrev: '1 Chr' },
    spanish: { name: '1 Crónicas', abbrev: '1 Cró' },
    brazilian_portuguese: { name: '1 Crônicas', abbrev: '1Cr' },
    tok_pisin: { name: '1 Kronikel', abbrev: '1Kro' },
    indonesian: { name: '1 Tawarikh', abbrev: '1Taw' },
    nepali: { name: '१ इतिहास', abbrev: '१इति' },
    hindi: { name: '१ इतिहास', abbrev: '१इति' },
    burmese: { name: '၁ ရာဇဝင်ချုပ်', abbrev: '၁ရာဇ' },
    thai: { name: '๑ พงศาวดาร', abbrev: '๑พศด' },
    mandarin: { name: '历代志上', abbrev: '代上' }
  },
  '2ch': {
    english: { name: '2 Chronicles', abbrev: '2 Chr' },
    spanish: { name: '2 Crónicas', abbrev: '2 Cró' },
    brazilian_portuguese: { name: '2 Crônicas', abbrev: '2Cr' },
    tok_pisin: { name: '2 Kronikel', abbrev: '2Kro' },
    indonesian: { name: '2 Tawarikh', abbrev: '2Taw' },
    nepali: { name: '२ इतिहास', abbrev: '२इति' },
    hindi: { name: '२ इतिहास', abbrev: '२इति' },
    burmese: { name: '၂ ရာဇဝင်ချုပ်', abbrev: '၂ရာဇ' },
    thai: { name: '๒ พงศาวดาร', abbrev: '๒พศด' },
    mandarin: { name: '历代志下', abbrev: '代下' }
  },
  ezr: {
    english: { name: 'Ezra', abbrev: 'Ezra' },
    spanish: { name: 'Esdras', abbrev: 'Esd' },
    brazilian_portuguese: { name: 'Esdras', abbrev: 'Ed' },
    tok_pisin: { name: 'Esra', abbrev: 'Esr' },
    indonesian: { name: 'Ezra', abbrev: 'Ezr' },
    nepali: { name: 'एज्रा', abbrev: 'एज्रा' },
    hindi: { name: 'एज्रा', abbrev: 'एज्रा' },
    burmese: { name: 'ဧဇရာကျမ်း', abbrev: 'ဧဇရာ' },
    thai: { name: 'เอสรา', abbrev: 'อสร' },
    mandarin: { name: '以斯拉记', abbrev: '拉' }
  },
  neh: {
    english: { name: 'Nehemiah', abbrev: 'Neh' },
    spanish: { name: 'Nehemías', abbrev: 'Neh' },
    brazilian_portuguese: { name: 'Neemias', abbrev: 'Ne' },
    tok_pisin: { name: 'Nehemia', abbrev: 'Neh' },
    indonesian: { name: 'Nehemia', abbrev: 'Neh' },
    nepali: { name: 'नहेम्याह', abbrev: 'नहे' },
    hindi: { name: 'नहेम्याह', abbrev: 'नहे' },
    burmese: { name: 'နေဟမိကျမ်း', abbrev: 'နေဟမိ' },
    thai: { name: 'เนหะมีย์', abbrev: 'นหม' },
    mandarin: { name: '尼希米记', abbrev: '尼' }
  },
  est: {
    english: { name: 'Esther', abbrev: 'Esth' },
    spanish: { name: 'Ester', abbrev: 'Est' },
    brazilian_portuguese: { name: 'Ester', abbrev: 'Et' },
    tok_pisin: { name: 'Esta', abbrev: 'Est' },
    indonesian: { name: 'Ester', abbrev: 'Est' },
    nepali: { name: 'एस्तर', abbrev: 'एस्त' },
    hindi: { name: 'एस्तेर', abbrev: 'एस्त' },
    burmese: { name: 'ဧသတာကျမ်း', abbrev: 'ဧသတာ' },
    thai: { name: 'เอสเธอร์', abbrev: 'อสธ' },
    mandarin: { name: '以斯帖记', abbrev: '斯' }
  },
  job: {
    english: { name: 'Job', abbrev: 'Job' },
    spanish: { name: 'Job', abbrev: 'Job' },
    brazilian_portuguese: { name: 'Jó', abbrev: 'Jó' },
    tok_pisin: { name: 'Jop', abbrev: 'Jop' },
    indonesian: { name: 'Ayub', abbrev: 'Ayb' },
    nepali: { name: 'अय्यूब', abbrev: 'अय्यू' },
    hindi: { name: 'अय्यूब', abbrev: 'अय्यू' },
    burmese: { name: 'ယောဘကျမ်း', abbrev: 'ယောဘ' },
    thai: { name: 'โยบ', abbrev: 'ยบ' },
    mandarin: { name: '约伯记', abbrev: '伯' }
  },
  psa: {
    english: { name: 'Psalms', abbrev: 'Ps' },
    spanish: { name: 'Salmos', abbrev: 'Sal' },
    brazilian_portuguese: { name: 'Salmos', abbrev: 'Sl' },
    tok_pisin: { name: 'Buk Song', abbrev: 'Sng' },
    indonesian: { name: 'Mazmur', abbrev: 'Mzm' },
    nepali: { name: 'भजनसंग्रह', abbrev: 'भज' },
    hindi: { name: 'भजन संहिता', abbrev: 'भज' },
    burmese: { name: 'ဆာလံကျမ်း', abbrev: 'ဆာလံ' },
    thai: { name: 'สดุดี', abbrev: 'สดด' },
    mandarin: { name: '诗篇', abbrev: '诗' }
  },
  pro: {
    english: { name: 'Proverbs', abbrev: 'Prov' },
    spanish: { name: 'Proverbios', abbrev: 'Prov' },
    brazilian_portuguese: { name: 'Provérbios', abbrev: 'Pv' },
    tok_pisin: { name: 'Gutpela Tok', abbrev: 'Gut' },
    indonesian: { name: 'Amsal', abbrev: 'Ams' },
    nepali: { name: 'हितोपदेश', abbrev: 'हितो' },
    hindi: { name: 'नीतिवचन', abbrev: 'नीति' },
    burmese: { name: 'သုတ္တံကျမ်း', abbrev: 'သုတ္တံ' },
    thai: { name: 'สุภาษิต', abbrev: 'สภษ' },
    mandarin: { name: '箴言', abbrev: '箴' }
  },
  ecc: {
    english: { name: 'Ecclesiastes', abbrev: 'Eccl' },
    spanish: { name: 'Eclesiastés', abbrev: 'Ecl' },
    brazilian_portuguese: { name: 'Eclesiastes', abbrev: 'Ec' },
    tok_pisin: { name: 'Saveman', abbrev: 'Sav' },
    indonesian: { name: 'Pengkhotbah', abbrev: 'Pkh' },
    nepali: { name: 'उपदेशक', abbrev: 'उपदे' },
    hindi: { name: 'सभोपदेशक', abbrev: 'सभो' },
    burmese: { name: 'ဒေသနာကျမ်း', abbrev: 'ဒေသနာ' },
    thai: { name: 'ปัญญาจารย์', abbrev: 'ปญจ' },
    mandarin: { name: '传道书', abbrev: '传' }
  },
  sng: {
    english: { name: 'Song of Solomon', abbrev: 'Song' },
    spanish: { name: 'Cantares', abbrev: 'Cant' },
    brazilian_portuguese: { name: 'Cânticos', abbrev: 'Ct' },
    tok_pisin: { name: 'Song Solomon', abbrev: 'Son' },
    indonesian: { name: 'Kidung Agung', abbrev: 'Kid' },
    nepali: { name: 'श्रेष्ठगीत', abbrev: 'श्रेष्ठ' },
    hindi: { name: 'श्रेष्ठगीत', abbrev: 'श्रेष्ठ' },
    burmese: { name: 'ဒေသနာကျမ်း', abbrev: 'ဒေသနာ' },
    thai: { name: 'เพลงซาโลมอน', abbrev: 'พซม' },
    mandarin: { name: '雅歌', abbrev: '歌' }
  },
  isa: {
    english: { name: 'Isaiah', abbrev: 'Isa' },
    spanish: { name: 'Isaías', abbrev: 'Isa' },
    brazilian_portuguese: { name: 'Isaías', abbrev: 'Is' },
    tok_pisin: { name: 'Aisaia', abbrev: 'Ais' },
    indonesian: { name: 'Yesaya', abbrev: 'Yes' },
    nepali: { name: 'यशैया', abbrev: 'यशै' },
    hindi: { name: 'यशायाह', abbrev: 'यशा' },
    burmese: { name: 'ဟေရှာယကျမ်း', abbrev: 'ဟေရှာယ' },
    thai: { name: 'อิสยาห์', abbrev: 'อสย' },
    mandarin: { name: '以赛亚书', abbrev: '赛' }
  },
  jer: {
    english: { name: 'Jeremiah', abbrev: 'Jer' },
    spanish: { name: 'Jeremías', abbrev: 'Jer' },
    brazilian_portuguese: { name: 'Jeremias', abbrev: 'Jr' },
    tok_pisin: { name: 'Jeremaia', abbrev: 'Jer' },
    indonesian: { name: 'Yeremia', abbrev: 'Yer' },
    nepali: { name: 'यर्मिया', abbrev: 'यर्मि' },
    hindi: { name: 'यिर्मयाह', abbrev: 'यिर्म' },
    burmese: { name: 'ယေရမိကျမ်း', abbrev: 'ယေရမိ' },
    thai: { name: 'เยเรมีย์', abbrev: 'ยรม' },
    mandarin: { name: '耶利米书', abbrev: '耶' }
  },
  lam: {
    english: { name: 'Lamentations', abbrev: 'Lam' },
    spanish: { name: 'Lamentaciones', abbrev: 'Lam' },
    brazilian_portuguese: { name: 'Lamentações', abbrev: 'Lm' },
    tok_pisin: { name: 'Krai', abbrev: 'Kra' },
    indonesian: { name: 'Ratapan', abbrev: 'Rat' },
    nepali: { name: 'विलाप', abbrev: 'विला' },
    hindi: { name: 'विलापगीत', abbrev: 'विला' },
    burmese: { name: 'မြည်တမ်းစကားကျမ်း', abbrev: 'မြည်' },
    thai: { name: 'เพลงคร่ำครวญ', abbrev: 'พคค' },
    mandarin: { name: '耶利米哀歌', abbrev: '哀' }
  },
  ezk: {
    english: { name: 'Ezekiel', abbrev: 'Ezek' },
    spanish: { name: 'Ezequiel', abbrev: 'Eze' },
    brazilian_portuguese: { name: 'Ezequiel', abbrev: 'Ez' },
    tok_pisin: { name: 'Esekiel', abbrev: 'Ese' },
    indonesian: { name: 'Yehezkiel', abbrev: 'Yeh' },
    nepali: { name: 'इजकिएल', abbrev: 'इज' },
    hindi: { name: 'यहेजकेल', abbrev: 'यहे' },
    burmese: { name: 'ယေဇကျေလကျမ်း', abbrev: 'ယေဇကျေ' },
    thai: { name: 'เอเสเคียล', abbrev: 'อสค' },
    mandarin: { name: '以西结书', abbrev: '结' }
  },
  dan: {
    english: { name: 'Daniel', abbrev: 'Dan' },
    spanish: { name: 'Daniel', abbrev: 'Dan' },
    brazilian_portuguese: { name: 'Daniel', abbrev: 'Dn' },
    tok_pisin: { name: 'Daniel', abbrev: 'Dan' },
    indonesian: { name: 'Daniel', abbrev: 'Dan' },
    nepali: { name: 'दानिएल', abbrev: 'दानि' },
    hindi: { name: 'दानियेल', abbrev: 'दानि' },
    burmese: { name: 'ဒံယေလကျမ်း', abbrev: 'ဒံယေလ' },
    thai: { name: 'ดาเนียล', abbrev: 'ดนล' },
    mandarin: { name: '但以理书', abbrev: '但' }
  },
  hos: {
    english: { name: 'Hosea', abbrev: 'Hos' },
    spanish: { name: 'Oseas', abbrev: 'Ose' },
    brazilian_portuguese: { name: 'Oséias', abbrev: 'Os' },
    tok_pisin: { name: 'Hosea', abbrev: 'Hos' },
    indonesian: { name: 'Hosea', abbrev: 'Hos' },
    nepali: { name: 'होशे', abbrev: 'होशे' },
    hindi: { name: 'होशे', abbrev: 'होशे' },
    burmese: { name: 'ဟောရှေကျမ်း', abbrev: 'ဟောရှေ' },
    thai: { name: 'โฮเชยา', abbrev: 'ฮชย' },
    mandarin: { name: '何西阿书', abbrev: '何' }
  },
  joe: {
    english: { name: 'Joel', abbrev: 'Joel' },
    spanish: { name: 'Joel', abbrev: 'Joel' },
    brazilian_portuguese: { name: 'Joel', abbrev: 'Jl' },
    tok_pisin: { name: 'Joel', abbrev: 'Joe' },
    indonesian: { name: 'Yoël', abbrev: 'Yoë' },
    nepali: { name: 'योएल', abbrev: 'योएल' },
    hindi: { name: 'योएल', abbrev: 'योएल' },
    burmese: { name: 'ယောလကျမ်း', abbrev: 'ယောလ' },
    thai: { name: 'โยเอล', abbrev: 'ยอล' },
    mandarin: { name: '约珥书', abbrev: '珥' }
  },
  amo: {
    english: { name: 'Amos', abbrev: 'Amos' },
    spanish: { name: 'Amós', abbrev: 'Amós' },
    brazilian_portuguese: { name: 'Amós', abbrev: 'Am' },
    tok_pisin: { name: 'Amos', abbrev: 'Amo' },
    indonesian: { name: 'Amos', abbrev: 'Amo' },
    nepali: { name: 'आमोस', abbrev: 'आमो' },
    hindi: { name: 'आमोस', abbrev: 'आमो' },
    burmese: { name: 'အာမုတ်ကျမ်း', abbrev: 'အာမုတ်' },
    thai: { name: 'อาโมส', abbrev: 'อมส' },
    mandarin: { name: '阿摩司书', abbrev: '摩' }
  },
  oba: {
    english: { name: 'Obadiah', abbrev: 'Obad' },
    spanish: { name: 'Abdías', abbrev: 'Abd' },
    brazilian_portuguese: { name: 'Obadias', abbrev: 'Ob' },
    tok_pisin: { name: 'Obadia', abbrev: 'Oba' },
    indonesian: { name: 'Obaja', abbrev: 'Ob' },
    nepali: { name: 'ओबदिया', abbrev: 'ओब' },
    hindi: { name: 'ओबद्याह', abbrev: 'ओब' },
    burmese: { name: 'ဩဗဒိန်ကျမ်း', abbrev: 'ဩဗဒိန်' },
    thai: { name: 'โอบาดีห์', abbrev: 'อบด' },
    mandarin: { name: '俄巴底亚书', abbrev: '俄' }
  },
  jon: {
    english: { name: 'Jonah', abbrev: 'Jonah' },
    spanish: { name: 'Jonás', abbrev: 'Jon' },
    brazilian_portuguese: { name: 'Jonas', abbrev: 'Jn' },
    tok_pisin: { name: 'Jona', abbrev: 'Jon' },
    indonesian: { name: 'Yunus', abbrev: 'Yun' },
    nepali: { name: 'योना', abbrev: 'योना' },
    hindi: { name: 'योना', abbrev: 'योना' },
    burmese: { name: 'ယောနကျမ်း', abbrev: 'ယောန' },
    thai: { name: 'โยนาห์', abbrev: 'ยนาห์' },
    mandarin: { name: '约拿书', abbrev: '拿' }
  },
  mic: {
    english: { name: 'Micah', abbrev: 'Mic' },
    spanish: { name: 'Miqueas', abbrev: 'Miq' },
    brazilian_portuguese: { name: 'Miquéias', abbrev: 'Mq' },
    tok_pisin: { name: 'Maika', abbrev: 'Mai' },
    indonesian: { name: 'Mikha', abbrev: 'Mik' },
    nepali: { name: 'मीका', abbrev: 'मीका' },
    hindi: { name: 'मीका', abbrev: 'मीका' },
    burmese: { name: 'မိက္ခာကျမ်း', abbrev: 'မိက္ခာ' },
    thai: { name: 'มีคาห์', abbrev: 'มคา' },
    mandarin: { name: '弥迦书', abbrev: '弥' }
  },
  nah: {
    english: { name: 'Nahum', abbrev: 'Nah' },
    spanish: { name: 'Nahúm', abbrev: 'Nah' },
    brazilian_portuguese: { name: 'Naum', abbrev: 'Na' },
    tok_pisin: { name: 'Nahum', abbrev: 'Nah' },
    indonesian: { name: 'Nahum', abbrev: 'Nah' },
    nepali: { name: 'नहूम', abbrev: 'नहू' },
    hindi: { name: 'नहूम', abbrev: 'नहू' },
    burmese: { name: 'နာဟုံကျမ်း', abbrev: 'နာဟုံ' },
    thai: { name: 'นาฮูม', abbrev: 'นหม' },
    mandarin: { name: '那鸿书', abbrev: '鸿' }
  },
  hab: {
    english: { name: 'Habakkuk', abbrev: 'Hab' },
    spanish: { name: 'Habacuc', abbrev: 'Hab' },
    brazilian_portuguese: { name: 'Habacuque', abbrev: 'Hc' },
    tok_pisin: { name: 'Habakuk', abbrev: 'Hab' },
    indonesian: { name: 'Habakuk', abbrev: 'Hab' },
    nepali: { name: 'हबक्कूक', abbrev: 'हब' },
    hindi: { name: 'हबक्कूक', abbrev: 'हब' },
    burmese: { name: 'ဟဗက္ကုတ်ကျမ်း', abbrev: 'ဟဗက္ကုတ်' },
    thai: { name: 'ฮาบากุก', abbrev: 'ฮบก' },
    mandarin: { name: '哈巴谷书', abbrev: '哈' }
  },
  zep: {
    english: { name: 'Zephaniah', abbrev: 'Zeph' },
    spanish: { name: 'Sofonías', abbrev: 'Sof' },
    brazilian_portuguese: { name: 'Sofonias', abbrev: 'Sf' },
    tok_pisin: { name: 'Sefanaia', abbrev: 'Sef' },
    indonesian: { name: 'Zefanya', abbrev: 'Zef' },
    nepali: { name: 'सपन्याह', abbrev: 'सप' },
    hindi: { name: 'सपन्याह', abbrev: 'सप' },
    burmese: { name: 'ဇေဖနိကျမ်း', abbrev: 'ဇေဖနိ' },
    thai: { name: 'เศฟันยาห์', abbrev: 'ศฟย' },
    mandarin: { name: '西番雅书', abbrev: '番' }
  },
  hag: {
    english: { name: 'Haggai', abbrev: 'Hag' },
    spanish: { name: 'Hageo', abbrev: 'Hag' },
    brazilian_portuguese: { name: 'Ageu', abbrev: 'Ag' },
    tok_pisin: { name: 'Hagai', abbrev: 'Hag' },
    indonesian: { name: 'Hagai', abbrev: 'Hag' },
    nepali: { name: 'हाग्गै', abbrev: 'हाग्गै' },
    hindi: { name: 'हाग्गै', abbrev: 'हाग्गै' },
    burmese: { name: 'ဟဂ္ဂဲကျမ်း', abbrev: 'ဟဂ္ဂဲ' },
    thai: { name: 'ฮักกัย', abbrev: 'ฮกก' },
    mandarin: { name: '哈该书', abbrev: '该' }
  },
  zec: {
    english: { name: 'Zechariah', abbrev: 'Zech' },
    spanish: { name: 'Zacarías', abbrev: 'Zac' },
    brazilian_portuguese: { name: 'Zacarias', abbrev: 'Zc' },
    tok_pisin: { name: 'Sekaraia', abbrev: 'Sek' },
    indonesian: { name: 'Zakharia', abbrev: 'Zak' },
    nepali: { name: 'जकरिया', abbrev: 'जक' },
    hindi: { name: 'जकर्याह', abbrev: 'जक' },
    burmese: { name: 'ဇာခရိကျမ်း', abbrev: 'ဇာခရိ' },
    thai: { name: 'เศคาริยาห์', abbrev: 'ศคย' },
    mandarin: { name: '撒迦利亚书', abbrev: '亚' }
  },
  mal: {
    english: { name: 'Malachi', abbrev: 'Mal' },
    spanish: { name: 'Malaquías', abbrev: 'Mal' },
    brazilian_portuguese: { name: 'Malaquias', abbrev: 'Ml' },
    tok_pisin: { name: 'Malakai', abbrev: 'Mal' },
    indonesian: { name: 'Maleakhi', abbrev: 'Mal' },
    nepali: { name: 'मलाकी', abbrev: 'मला' },
    hindi: { name: 'मलाकी', abbrev: 'मला' },
    burmese: { name: 'မာလခိကျမ်း', abbrev: 'မာလခိ' },
    thai: { name: 'มาลาคี', abbrev: 'มลค' },
    mandarin: { name: '玛拉基书', abbrev: '玛' }
  },

  // ============================================================================
  // NEW TESTAMENT
  // ============================================================================
  mat: {
    english: { name: 'Matthew', abbrev: 'Matt' },
    spanish: { name: 'Mateo', abbrev: 'Mat' },
    brazilian_portuguese: { name: 'Mateus', abbrev: 'Mt' },
    tok_pisin: { name: 'Matyu', abbrev: 'Mat' },
    indonesian: { name: 'Matius', abbrev: 'Mat' },
    nepali: { name: 'मत्ती', abbrev: 'मत्ती' },
    hindi: { name: 'मत्ती', abbrev: 'मत्ती' },
    burmese: { name: 'မဿဲခရစ်ဝင်ကျမ်း', abbrev: 'မဿဲ' },
    thai: { name: 'มัทธิว', abbrev: 'มธ' },
    mandarin: { name: '马太福音', abbrev: '太' }
  },
  mar: {
    english: { name: 'Mark', abbrev: 'Mark' },
    spanish: { name: 'Marcos', abbrev: 'Mar' },
    brazilian_portuguese: { name: 'Marcos', abbrev: 'Mc' },
    tok_pisin: { name: 'Mak', abbrev: 'Mak' },
    indonesian: { name: 'Markus', abbrev: 'Mrk' },
    nepali: { name: 'मर्कूस', abbrev: 'मर्कू' },
    hindi: { name: 'मरकुस', abbrev: 'मरकुस' },
    burmese: { name: 'မာကုခရစ်ဝင်ကျမ်း', abbrev: 'မာကု' },
    thai: { name: 'มาระโก', abbrev: 'มก' },
    mandarin: { name: '马可福音', abbrev: '可' }
  },
  luk: {
    english: { name: 'Luke', abbrev: 'Luke' },
    spanish: { name: 'Lucas', abbrev: 'Luc' },
    brazilian_portuguese: { name: 'Lucas', abbrev: 'Lc' },
    tok_pisin: { name: 'Luk', abbrev: 'Luk' },
    indonesian: { name: 'Lukas', abbrev: 'Luk' },
    nepali: { name: 'लूका', abbrev: 'लूका' },
    hindi: { name: 'लूका', abbrev: 'लूका' },
    burmese: { name: 'လုကာခရစ်ဝင်ကျမ်း', abbrev: 'လုကာ' },
    thai: { name: 'ลูกา', abbrev: 'ลก' },
    mandarin: { name: '路加福音', abbrev: '路' }
  },
  jhn: {
    english: { name: 'John', abbrev: 'John' },
    spanish: { name: 'Juan', abbrev: 'Juan' },
    brazilian_portuguese: { name: 'João', abbrev: 'Jo' },
    tok_pisin: { name: 'Jon', abbrev: 'Jon' },
    indonesian: { name: 'Yohanes', abbrev: 'Yoh' },
    nepali: { name: 'यूहन्ना', abbrev: 'यूहन्' },
    hindi: { name: 'यूहन्ना', abbrev: 'यूहन्' },
    burmese: { name: 'ယောဟန်ခရစ်ဝင်ကျမ်း', abbrev: 'ယောဟန်' },
    thai: { name: 'ยอห์น', abbrev: 'ยน' },
    mandarin: { name: '约翰福音', abbrev: '约' }
  },
  act: {
    english: { name: 'Acts', abbrev: 'Acts' },
    spanish: { name: 'Hechos', abbrev: 'Hch' },
    brazilian_portuguese: { name: 'Atos', abbrev: 'At' },
    tok_pisin: { name: 'Wok', abbrev: 'Wok' },
    indonesian: { name: 'Kisah Para Rasul', abbrev: 'Kis' },
    nepali: { name: 'प्रेरित', abbrev: 'प्रेरि' },
    hindi: { name: 'प्रेरितों के काम', abbrev: 'प्रेरि' },
    burmese: { name: 'တမန်တော်ဝတ္ထု', abbrev: 'တမန်' },
    thai: { name: 'กิจการ', abbrev: 'กจ' },
    mandarin: { name: '使徒行传', abbrev: '徒' }
  },
  rom: {
    english: { name: 'Romans', abbrev: 'Rom' },
    spanish: { name: 'Romanos', abbrev: 'Rom' },
    brazilian_portuguese: { name: 'Romanos', abbrev: 'Rm' },
    tok_pisin: { name: 'Rom', abbrev: 'Rom' },
    indonesian: { name: 'Roma', abbrev: 'Rom' },
    nepali: { name: 'रोमी', abbrev: 'रोमी' },
    hindi: { name: 'रोमियों', abbrev: 'रोमी' },
    burmese: { name: 'ရောမဩဝါဒစာ', abbrev: 'ရောမ' },
    thai: { name: 'โรม', abbrev: 'รม' },
    mandarin: { name: '罗马书', abbrev: '罗' }
  },
  '1co': {
    english: { name: '1 Corinthians', abbrev: '1 Cor' },
    spanish: { name: '1 Corintios', abbrev: '1 Cor' },
    brazilian_portuguese: { name: '1 Coríntios', abbrev: '1Co' },
    tok_pisin: { name: '1 Korin', abbrev: '1Kor' },
    indonesian: { name: '1 Korintus', abbrev: '1Kor' },
    nepali: { name: '१ कोरिन्थी', abbrev: '१कोरि' },
    hindi: { name: '१ कुरिन्थियों', abbrev: '१कोरि' },
    burmese: { name: '၁ ကောရိန္ဒူးဩဝါဒစာ', abbrev: '၁ကော' },
    thai: { name: '๑ โครินธ์', abbrev: '๑คร' },
    mandarin: { name: '哥林多前书', abbrev: '林前' }
  },
  '2co': {
    english: { name: '2 Corinthians', abbrev: '2 Cor' },
    spanish: { name: '2 Corintios', abbrev: '2 Cor' },
    brazilian_portuguese: { name: '2 Coríntios', abbrev: '2Co' },
    tok_pisin: { name: '2 Korin', abbrev: '2Kor' },
    indonesian: { name: '2 Korintus', abbrev: '2Kor' },
    nepali: { name: '२ कोरिन्थी', abbrev: '२कोरि' },
    hindi: { name: '२ कुरिन्थियों', abbrev: '२कोरि' },
    burmese: { name: '၂ ကောရိန္ဒူးဩဝါဒစာ', abbrev: '၂ကော' },
    thai: { name: '๒ โครินธ์', abbrev: '๒คร' },
    mandarin: { name: '哥林多后书', abbrev: '林后' }
  },
  gal: {
    english: { name: 'Galatians', abbrev: 'Gal' },
    spanish: { name: 'Gálatas', abbrev: 'Gál' },
    brazilian_portuguese: { name: 'Gálatas', abbrev: 'Gl' },
    tok_pisin: { name: 'Galesia', abbrev: 'Gal' },
    indonesian: { name: 'Galatia', abbrev: 'Gal' },
    nepali: { name: 'गलाती', abbrev: 'गला' },
    hindi: { name: 'गलातियों', abbrev: 'गला' },
    burmese: { name: 'ဂလာတိဩဝါဒစာ', abbrev: 'ဂလာတိ' },
    thai: { name: 'กาลาเทีย', abbrev: 'กท' },
    mandarin: { name: '加拉太书', abbrev: '加' }
  },
  eph: {
    english: { name: 'Ephesians', abbrev: 'Eph' },
    spanish: { name: 'Efesios', abbrev: 'Efe' },
    brazilian_portuguese: { name: 'Efésios', abbrev: 'Ef' },
    tok_pisin: { name: 'Efesus', abbrev: 'Efe' },
    indonesian: { name: 'Efesus', abbrev: 'Ef' },
    nepali: { name: 'एफिसी', abbrev: 'एफि' },
    hindi: { name: 'इफिसियों', abbrev: 'इफि' },
    burmese: { name: 'ဧဖက်ဩဝါဒစာ', abbrev: 'ဧဖက်' },
    thai: { name: 'เอเฟซัส', abbrev: 'อฟ' },
    mandarin: { name: '以弗所书', abbrev: '弗' }
  },
  phi: {
    english: { name: 'Philippians', abbrev: 'Phil' },
    spanish: { name: 'Filipenses', abbrev: 'Fil' },
    brazilian_portuguese: { name: 'Filipenses', abbrev: 'Fp' },
    tok_pisin: { name: 'Filipai', abbrev: 'Fil' },
    indonesian: { name: 'Filipi', abbrev: 'Flp' },
    nepali: { name: 'फिलिप्पी', abbrev: 'फिलि' },
    hindi: { name: 'फिलिप्पियों', abbrev: 'फिलि' },
    burmese: { name: 'ဖိလိပ္ပဩဝါဒစာ', abbrev: 'ဖိလိပ္ပ' },
    thai: { name: 'ฟิลิปปี', abbrev: 'ฟป' },
    mandarin: { name: '腓立比书', abbrev: '腓' }
  },
  col: {
    english: { name: 'Colossians', abbrev: 'Col' },
    spanish: { name: 'Colosenses', abbrev: 'Col' },
    brazilian_portuguese: { name: 'Colossenses', abbrev: 'Cl' },
    tok_pisin: { name: 'Kolosi', abbrev: 'Kol' },
    indonesian: { name: 'Kolose', abbrev: 'Kol' },
    nepali: { name: 'कलस्सी', abbrev: 'कल' },
    hindi: { name: 'कुलुस्सियों', abbrev: 'कल' },
    burmese: { name: 'ကောလောသဲဩဝါဒစာ', abbrev: 'ကောလော' },
    thai: { name: 'โคโลสี', abbrev: 'คส' },
    mandarin: { name: '歌罗西书', abbrev: '西' }
  },
  '1th': {
    english: { name: '1 Thessalonians', abbrev: '1 Thess' },
    spanish: { name: '1 Tesalonicenses', abbrev: '1 Tes' },
    brazilian_portuguese: { name: '1 Tessalonicenses', abbrev: '1Ts' },
    tok_pisin: { name: '1 Tesalonaika', abbrev: '1Tes' },
    indonesian: { name: '1 Tesalonika', abbrev: '1Tes' },
    nepali: { name: '१ थेस्सलोनिकी', abbrev: '१थेस्स' },
    hindi: { name: '१ थिस्सलुनीकियों', abbrev: '१थेस्स' },
    burmese: { name: '၁ သက်သာလောနိတ်ဩဝါဒစာ', abbrev: '၁သက်' },
    thai: { name: '๑ เธสะโลนิกา', abbrev: '๑ธส' },
    mandarin: { name: '帖撒罗尼迦前书', abbrev: '帖前' }
  },
  '2th': {
    english: { name: '2 Thessalonians', abbrev: '2 Thess' },
    spanish: { name: '2 Tesalonicenses', abbrev: '2 Tes' },
    brazilian_portuguese: { name: '2 Tessalonicenses', abbrev: '2Ts' },
    tok_pisin: { name: '2 Tesalonaika', abbrev: '2Tes' },
    indonesian: { name: '2 Tesalonika', abbrev: '2Tes' },
    nepali: { name: '२ थेस्सलोनिकी', abbrev: '२थेस्स' },
    hindi: { name: '२ थिस्सलुनीकियों', abbrev: '२थेस्स' },
    burmese: { name: '၂ သက်သာလောနိတ်ဩဝါဒစာ', abbrev: '၂သက်' },
    thai: { name: '๒ เธสะโลนิกา', abbrev: '๒ธส' },
    mandarin: { name: '帖撒罗尼迦后书', abbrev: '帖后' }
  },
  '1ti': {
    english: { name: '1 Timothy', abbrev: '1 Tim' },
    spanish: { name: '1 Timoteo', abbrev: '1 Tim' },
    brazilian_portuguese: { name: '1 Timóteo', abbrev: '1Tm' },
    tok_pisin: { name: '1 Timoti', abbrev: '1Tim' },
    indonesian: { name: '1 Timotius', abbrev: '1Tim' },
    nepali: { name: '१ तिमोथी', abbrev: '१तिमो' },
    hindi: { name: '१ तीमुथियुस', abbrev: '१तिमो' },
    burmese: { name: '၁ တိမောသေဩဝါဒစာ', abbrev: '၁တိမော' },
    thai: { name: '๑ ทิโมธี', abbrev: '๑ทธ' },
    mandarin: { name: '提摩太前书', abbrev: '提前' }
  },
  '2ti': {
    english: { name: '2 Timothy', abbrev: '2 Tim' },
    spanish: { name: '2 Timoteo', abbrev: '2 Tim' },
    brazilian_portuguese: { name: '2 Timóteo', abbrev: '2Tm' },
    tok_pisin: { name: '2 Timoti', abbrev: '2Tim' },
    indonesian: { name: '2 Timotius', abbrev: '2Tim' },
    nepali: { name: '२ तिमोथी', abbrev: '२तिमो' },
    hindi: { name: '२ तीमुथियुस', abbrev: '२तिमो' },
    burmese: { name: '၂ တိမောသေဩဝါဒစာ', abbrev: '၂တိမော' },
    thai: { name: '๒ ทิโมธี', abbrev: '๒ทธ' },
    mandarin: { name: '提摩太后书', abbrev: '提后' }
  },
  tit: {
    english: { name: 'Titus', abbrev: 'Titus' },
    spanish: { name: 'Tito', abbrev: 'Tit' },
    brazilian_portuguese: { name: 'Tito', abbrev: 'Tt' },
    tok_pisin: { name: 'Taitus', abbrev: 'Tai' },
    indonesian: { name: 'Titus', abbrev: 'Tit' },
    nepali: { name: 'तीतस', abbrev: 'तीत' },
    hindi: { name: 'तीतुस', abbrev: 'तीत' },
    burmese: { name: 'တိတုဩဝါဒစာ', abbrev: 'တိတု' },
    thai: { name: 'ทิตัส', abbrev: 'ทต' },
    mandarin: { name: '提多书', abbrev: '多' }
  },
  phm: {
    english: { name: 'Philemon', abbrev: 'Phlm' },
    spanish: { name: 'Filemón', abbrev: 'Flm' },
    brazilian_portuguese: { name: 'Filemom', abbrev: 'Fm' },
    tok_pisin: { name: 'Filemon', abbrev: 'Fil' },
    indonesian: { name: 'Filemon', abbrev: 'Flm' },
    nepali: { name: 'फिलेमोन', abbrev: 'फिले' },
    hindi: { name: 'फिलेमोन', abbrev: 'फिले' },
    burmese: { name: 'ဖိလေမုန်ဩဝါဒစာ', abbrev: 'ဖိလေ' },
    thai: { name: 'ฟีเลโมน', abbrev: 'ฟม' },
    mandarin: { name: '腓利门书', abbrev: '门' }
  },
  heb: {
    english: { name: 'Hebrews', abbrev: 'Heb' },
    spanish: { name: 'Hebreos', abbrev: 'Heb' },
    brazilian_portuguese: { name: 'Hebreus', abbrev: 'Hb' },
    tok_pisin: { name: 'Hibru', abbrev: 'Hib' },
    indonesian: { name: 'Ibrani', abbrev: 'Ibr' },
    nepali: { name: 'हिब्रू', abbrev: 'हिब्रू' },
    hindi: { name: 'इब्रानियों', abbrev: 'इब्रा' },
    burmese: { name: 'ဟေဗြဲဩဝါဒစာ', abbrev: 'ဟေဗြဲ' },
    thai: { name: 'ฮีบรู', abbrev: 'ฮบ' },
    mandarin: { name: '希伯来书', abbrev: '来' }
  },
  jas: {
    english: { name: 'James', abbrev: 'Jas' },
    spanish: { name: 'Santiago', abbrev: 'Sant' },
    brazilian_portuguese: { name: 'Tiago', abbrev: 'Tg' },
    tok_pisin: { name: 'Jems', abbrev: 'Jem' },
    indonesian: { name: 'Yakobus', abbrev: 'Yak' },
    nepali: { name: 'याकूब', abbrev: 'याकू' },
    hindi: { name: 'याकूब', abbrev: 'याकू' },
    burmese: { name: 'ယာကုပ်ဩဝါဒစာ', abbrev: 'ယာကုပ်' },
    thai: { name: 'ยากอบ', abbrev: 'ยก' },
    mandarin: { name: '雅各书', abbrev: '雅' }
  },
  '1pe': {
    english: { name: '1 Peter', abbrev: '1 Pet' },
    spanish: { name: '1 Pedro', abbrev: '1 Ped' },
    brazilian_portuguese: { name: '1 Pedro', abbrev: '1Pe' },
    tok_pisin: { name: '1 Pita', abbrev: '1Pit' },
    indonesian: { name: '1 Petrus', abbrev: '1Ptr' },
    nepali: { name: '१ पत्रुस', abbrev: '१पत्रु' },
    hindi: { name: '१ पतरस', abbrev: '१पत्रु' },
    burmese: { name: '၁ ပေတရုဩဝါဒစာ', abbrev: '၁ပေ' },
    thai: { name: '๑ เปโตร', abbrev: '๑ปต' },
    mandarin: { name: '彼得前书', abbrev: '彼前' }
  },
  '2pe': {
    english: { name: '2 Peter', abbrev: '2 Pet' },
    spanish: { name: '2 Pedro', abbrev: '2 Ped' },
    brazilian_portuguese: { name: '2 Pedro', abbrev: '2Pe' },
    tok_pisin: { name: '2 Pita', abbrev: '2Pit' },
    indonesian: { name: '2 Petrus', abbrev: '2Ptr' },
    nepali: { name: '२ पत्रुस', abbrev: '२पत्रु' },
    hindi: { name: '२ पतरस', abbrev: '२पत्रु' },
    burmese: { name: '၂ ပေတရုဩဝါဒစာ', abbrev: '၂ပေ' },
    thai: { name: '๒ เปโตร', abbrev: '๒ปต' },
    mandarin: { name: '彼得后书', abbrev: '彼后' }
  },
  '1jn': {
    english: { name: '1 John', abbrev: '1 John' },
    spanish: { name: '1 Juan', abbrev: '1 Jn' },
    brazilian_portuguese: { name: '1 João', abbrev: '1Jo' },
    tok_pisin: { name: '1 Jon', abbrev: '1Jon' },
    indonesian: { name: '1 Yohanes', abbrev: '1Yoh' },
    nepali: { name: '१ यूहन्ना', abbrev: '१यूहन्' },
    hindi: { name: '१ यूहन्ना', abbrev: '१यूहन्' },
    burmese: { name: '၁ ယောဟန်ဩဝါဒစာ', abbrev: '၁ယောဟန်' },
    thai: { name: '๑ ยอห์น', abbrev: '๑ยน' },
    mandarin: { name: '约翰一书', abbrev: '约一' }
  },
  '2jn': {
    english: { name: '2 John', abbrev: '2 John' },
    spanish: { name: '2 Juan', abbrev: '2 Jn' },
    brazilian_portuguese: { name: '2 João', abbrev: '2Jo' },
    tok_pisin: { name: '2 Jon', abbrev: '2Jon' },
    indonesian: { name: '2 Yohanes', abbrev: '2Yoh' },
    nepali: { name: '२ यूहन्ना', abbrev: '२यूहन्' },
    hindi: { name: '२ यूहन्ना', abbrev: '२यूहन्' },
    burmese: { name: '၂ ယောဟန်ဩဝါဒစာ', abbrev: '၂ယောဟန်' },
    thai: { name: '๒ ยอห์น', abbrev: '๒ยน' },
    mandarin: { name: '约翰二书', abbrev: '约二' }
  },
  '3jn': {
    english: { name: '3 John', abbrev: '3 John' },
    spanish: { name: '3 Juan', abbrev: '3 Jn' },
    brazilian_portuguese: { name: '3 João', abbrev: '3Jo' },
    tok_pisin: { name: '3 Jon', abbrev: '3Jon' },
    indonesian: { name: '3 Yohanes', abbrev: '3Yoh' },
    nepali: { name: '३ यूहन्ना', abbrev: '३यूहन्' },
    hindi: { name: '३ यूहन्ना', abbrev: '३यूहन्' },
    burmese: { name: '၃ ယောဟန်ဩဝါဒစာ', abbrev: '၃ယောဟန်' },
    thai: { name: '๓ ยอห์น', abbrev: '๓ยน' },
    mandarin: { name: '约翰三书', abbrev: '约三' }
  },
  jud: {
    english: { name: 'Jude', abbrev: 'Jude' },
    spanish: { name: 'Judas', abbrev: 'Jud' },
    brazilian_portuguese: { name: 'Judas', abbrev: 'Jd' },
    tok_pisin: { name: 'Jut', abbrev: 'Jut' },
    indonesian: { name: 'Yudas', abbrev: 'Yud' },
    nepali: { name: 'यहूदा', abbrev: 'यहू' },
    hindi: { name: 'यहूदा', abbrev: 'यहू' },
    burmese: { name: 'ယုဒဩဝါဒစာ', abbrev: 'ယုဒ' },
    thai: { name: 'ยูดา', abbrev: 'ยด' },
    mandarin: { name: '犹大书', abbrev: '犹' }
  },
  rev: {
    english: { name: 'Revelation', abbrev: 'Rev' },
    spanish: { name: 'Apocalipsis', abbrev: 'Apoc' },
    brazilian_portuguese: { name: 'Apocalipse', abbrev: 'Ap' },
    tok_pisin: { name: 'Kamapim Tok Hait', abbrev: 'Kam' },
    indonesian: { name: 'Wahyu', abbrev: 'Why' },
    nepali: { name: 'प्रकाश', abbrev: 'प्रका' },
    hindi: { name: 'प्रकाशितवाक्य', abbrev: 'प्रका' },
    burmese: { name: 'ဗျာဒိတ်ကျမ်း', abbrev: 'ဗျာ' },
    thai: { name: 'วิวรณ์', abbrev: 'วว' },
    mandarin: { name: '启示录', abbrev: '启' }
  }
};

/**
 * Get localized book name and abbreviation for a given book ID and language.
 * Falls back to English if the language is not available.
 */
export function getLocalizedBookName(
  bookId: string,
  language: SupportedLanguage
): BookName {
  const bookNames = BIBLE_BOOK_NAMES[bookId.toLowerCase()];
  if (!bookNames) {
    // Return the book ID as fallback
    return { name: bookId.toUpperCase(), abbrev: bookId.toUpperCase() };
  }

  // Try requested language, then fall back to English
  return (
    bookNames[language] ??
    bookNames.english ?? {
      name: bookId.toUpperCase(),
      abbrev: bookId.toUpperCase()
    }
  );
}
