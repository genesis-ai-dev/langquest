import type { SupportedLanguage } from '@/services/localizations';

interface BookName {
  name: string;
  abbrev: string;
}

type BibleBookNames = Record<string, Partial<Record<SupportedLanguage, BookName>>>;

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
    nepali: { name: 'उत्पत्ति', abbrev: 'उत्प' }
  },
  exo: {
    english: { name: 'Exodus', abbrev: 'Exod' },
    spanish: { name: 'Éxodo', abbrev: 'Éxo' },
    brazilian_portuguese: { name: 'Êxodo', abbrev: 'Êx' },
    tok_pisin: { name: 'Kisim Bek', abbrev: 'Kis' },
    indonesian: { name: 'Keluaran', abbrev: 'Kel' },
    nepali: { name: 'प्रस्थान', abbrev: 'प्रस्थ' }
  },
  lev: {
    english: { name: 'Leviticus', abbrev: 'Lev' },
    spanish: { name: 'Levítico', abbrev: 'Lev' },
    brazilian_portuguese: { name: 'Levítico', abbrev: 'Lv' },
    tok_pisin: { name: 'Wok Pris', abbrev: 'Wok' },
    indonesian: { name: 'Imamat', abbrev: 'Im' },
    nepali: { name: 'लेवीहरू', abbrev: 'लेवी' }
  },
  num: {
    english: { name: 'Numbers', abbrev: 'Num' },
    spanish: { name: 'Números', abbrev: 'Núm' },
    brazilian_portuguese: { name: 'Números', abbrev: 'Nm' },
    tok_pisin: { name: 'Namba', abbrev: 'Nam' },
    indonesian: { name: 'Bilangan', abbrev: 'Bil' },
    nepali: { name: 'गन्ती', abbrev: 'गन्ती' }
  },
  deu: {
    english: { name: 'Deuteronomy', abbrev: 'Deut' },
    spanish: { name: 'Deuteronomio', abbrev: 'Deut' },
    brazilian_portuguese: { name: 'Deuteronômio', abbrev: 'Dt' },
    tok_pisin: { name: 'Lo Namba Tu', abbrev: 'Lo2' },
    indonesian: { name: 'Ulangan', abbrev: 'Ul' },
    nepali: { name: 'व्यवस्था', abbrev: 'व्यव' }
  },
  jos: {
    english: { name: 'Joshua', abbrev: 'Josh' },
    spanish: { name: 'Josué', abbrev: 'Jos' },
    brazilian_portuguese: { name: 'Josué', abbrev: 'Js' },
    tok_pisin: { name: 'Josua', abbrev: 'Jos' },
    indonesian: { name: 'Yosua', abbrev: 'Yos' },
    nepali: { name: 'यहोशू', abbrev: 'यहो' }
  },
  jdg: {
    english: { name: 'Judges', abbrev: 'Judg' },
    spanish: { name: 'Jueces', abbrev: 'Jue' },
    brazilian_portuguese: { name: 'Juízes', abbrev: 'Jz' },
    tok_pisin: { name: 'Jas', abbrev: 'Jas' },
    indonesian: { name: 'Hakim-hakim', abbrev: 'Hak' },
    nepali: { name: 'न्यायकर्ता', abbrev: 'न्या' }
  },
  rut: {
    english: { name: 'Ruth', abbrev: 'Ruth' },
    spanish: { name: 'Rut', abbrev: 'Rut' },
    brazilian_portuguese: { name: 'Rute', abbrev: 'Rt' },
    tok_pisin: { name: 'Rut', abbrev: 'Rut' },
    indonesian: { name: 'Rut', abbrev: 'Rut' },
    nepali: { name: 'रूथ', abbrev: 'रूथ' }
  },
  '1sa': {
    english: { name: '1 Samuel', abbrev: '1 Sam' },
    spanish: { name: '1 Samuel', abbrev: '1 Sam' },
    brazilian_portuguese: { name: '1 Samuel', abbrev: '1Sm' },
    tok_pisin: { name: '1 Samuel', abbrev: '1Sam' },
    indonesian: { name: '1 Samuel', abbrev: '1Sam' },
    nepali: { name: '१ शमूएल', abbrev: '१शमू' }
  },
  '2sa': {
    english: { name: '2 Samuel', abbrev: '2 Sam' },
    spanish: { name: '2 Samuel', abbrev: '2 Sam' },
    brazilian_portuguese: { name: '2 Samuel', abbrev: '2Sm' },
    tok_pisin: { name: '2 Samuel', abbrev: '2Sam' },
    indonesian: { name: '2 Samuel', abbrev: '2Sam' },
    nepali: { name: '२ शमूएल', abbrev: '२शमू' }
  },
  '1ki': {
    english: { name: '1 Kings', abbrev: '1 Kgs' },
    spanish: { name: '1 Reyes', abbrev: '1 Rey' },
    brazilian_portuguese: { name: '1 Reis', abbrev: '1Rs' },
    tok_pisin: { name: '1 King', abbrev: '1Kin' },
    indonesian: { name: '1 Raja-raja', abbrev: '1Raj' },
    nepali: { name: '१ राजा', abbrev: '१राजा' }
  },
  '2ki': {
    english: { name: '2 Kings', abbrev: '2 Kgs' },
    spanish: { name: '2 Reyes', abbrev: '2 Rey' },
    brazilian_portuguese: { name: '2 Reis', abbrev: '2Rs' },
    tok_pisin: { name: '2 King', abbrev: '2Kin' },
    indonesian: { name: '2 Raja-raja', abbrev: '2Raj' },
    nepali: { name: '२ राजा', abbrev: '२राजा' }
  },
  '1ch': {
    english: { name: '1 Chronicles', abbrev: '1 Chr' },
    spanish: { name: '1 Crónicas', abbrev: '1 Cró' },
    brazilian_portuguese: { name: '1 Crônicas', abbrev: '1Cr' },
    tok_pisin: { name: '1 Kronikel', abbrev: '1Kro' },
    indonesian: { name: '1 Tawarikh', abbrev: '1Taw' },
    nepali: { name: '१ इतिहास', abbrev: '१इति' }
  },
  '2ch': {
    english: { name: '2 Chronicles', abbrev: '2 Chr' },
    spanish: { name: '2 Crónicas', abbrev: '2 Cró' },
    brazilian_portuguese: { name: '2 Crônicas', abbrev: '2Cr' },
    tok_pisin: { name: '2 Kronikel', abbrev: '2Kro' },
    indonesian: { name: '2 Tawarikh', abbrev: '2Taw' },
    nepali: { name: '२ इतिहास', abbrev: '२इति' }
  },
  ezr: {
    english: { name: 'Ezra', abbrev: 'Ezra' },
    spanish: { name: 'Esdras', abbrev: 'Esd' },
    brazilian_portuguese: { name: 'Esdras', abbrev: 'Ed' },
    tok_pisin: { name: 'Esra', abbrev: 'Esr' },
    indonesian: { name: 'Ezra', abbrev: 'Ezr' },
    nepali: { name: 'एज्रा', abbrev: 'एज्रा' }
  },
  neh: {
    english: { name: 'Nehemiah', abbrev: 'Neh' },
    spanish: { name: 'Nehemías', abbrev: 'Neh' },
    brazilian_portuguese: { name: 'Neemias', abbrev: 'Ne' },
    tok_pisin: { name: 'Nehemia', abbrev: 'Neh' },
    indonesian: { name: 'Nehemia', abbrev: 'Neh' },
    nepali: { name: 'नहेम्याह', abbrev: 'नहे' }
  },
  est: {
    english: { name: 'Esther', abbrev: 'Esth' },
    spanish: { name: 'Ester', abbrev: 'Est' },
    brazilian_portuguese: { name: 'Ester', abbrev: 'Et' },
    tok_pisin: { name: 'Esta', abbrev: 'Est' },
    indonesian: { name: 'Ester', abbrev: 'Est' },
    nepali: { name: 'एस्तर', abbrev: 'एस्त' }
  },
  job: {
    english: { name: 'Job', abbrev: 'Job' },
    spanish: { name: 'Job', abbrev: 'Job' },
    brazilian_portuguese: { name: 'Jó', abbrev: 'Jó' },
    tok_pisin: { name: 'Jop', abbrev: 'Jop' },
    indonesian: { name: 'Ayub', abbrev: 'Ayb' },
    nepali: { name: 'अय्यूब', abbrev: 'अय्यू' }
  },
  psa: {
    english: { name: 'Psalms', abbrev: 'Ps' },
    spanish: { name: 'Salmos', abbrev: 'Sal' },
    brazilian_portuguese: { name: 'Salmos', abbrev: 'Sl' },
    tok_pisin: { name: 'Buk Song', abbrev: 'Sng' },
    indonesian: { name: 'Mazmur', abbrev: 'Mzm' },
    nepali: { name: 'भजनसंग्रह', abbrev: 'भज' }
  },
  pro: {
    english: { name: 'Proverbs', abbrev: 'Prov' },
    spanish: { name: 'Proverbios', abbrev: 'Prov' },
    brazilian_portuguese: { name: 'Provérbios', abbrev: 'Pv' },
    tok_pisin: { name: 'Gutpela Tok', abbrev: 'Gut' },
    indonesian: { name: 'Amsal', abbrev: 'Ams' },
    nepali: { name: 'हितोपदेश', abbrev: 'हितो' }
  },
  ecc: {
    english: { name: 'Ecclesiastes', abbrev: 'Eccl' },
    spanish: { name: 'Eclesiastés', abbrev: 'Ecl' },
    brazilian_portuguese: { name: 'Eclesiastes', abbrev: 'Ec' },
    tok_pisin: { name: 'Saveman', abbrev: 'Sav' },
    indonesian: { name: 'Pengkhotbah', abbrev: 'Pkh' },
    nepali: { name: 'उपदेशक', abbrev: 'उपदे' }
  },
  sng: {
    english: { name: 'Song of Solomon', abbrev: 'Song' },
    spanish: { name: 'Cantares', abbrev: 'Cant' },
    brazilian_portuguese: { name: 'Cânticos', abbrev: 'Ct' },
    tok_pisin: { name: 'Song Solomon', abbrev: 'Son' },
    indonesian: { name: 'Kidung Agung', abbrev: 'Kid' },
    nepali: { name: 'श्रेष्ठगीत', abbrev: 'श्रेष्ठ' }
  },
  isa: {
    english: { name: 'Isaiah', abbrev: 'Isa' },
    spanish: { name: 'Isaías', abbrev: 'Isa' },
    brazilian_portuguese: { name: 'Isaías', abbrev: 'Is' },
    tok_pisin: { name: 'Aisaia', abbrev: 'Ais' },
    indonesian: { name: 'Yesaya', abbrev: 'Yes' },
    nepali: { name: 'यशैया', abbrev: 'यशै' }
  },
  jer: {
    english: { name: 'Jeremiah', abbrev: 'Jer' },
    spanish: { name: 'Jeremías', abbrev: 'Jer' },
    brazilian_portuguese: { name: 'Jeremias', abbrev: 'Jr' },
    tok_pisin: { name: 'Jeremaia', abbrev: 'Jer' },
    indonesian: { name: 'Yeremia', abbrev: 'Yer' },
    nepali: { name: 'यर्मिया', abbrev: 'यर्मि' }
  },
  lam: {
    english: { name: 'Lamentations', abbrev: 'Lam' },
    spanish: { name: 'Lamentaciones', abbrev: 'Lam' },
    brazilian_portuguese: { name: 'Lamentações', abbrev: 'Lm' },
    tok_pisin: { name: 'Krai', abbrev: 'Kra' },
    indonesian: { name: 'Ratapan', abbrev: 'Rat' },
    nepali: { name: 'विलाप', abbrev: 'विला' }
  },
  ezk: {
    english: { name: 'Ezekiel', abbrev: 'Ezek' },
    spanish: { name: 'Ezequiel', abbrev: 'Eze' },
    brazilian_portuguese: { name: 'Ezequiel', abbrev: 'Ez' },
    tok_pisin: { name: 'Esekiel', abbrev: 'Ese' },
    indonesian: { name: 'Yehezkiel', abbrev: 'Yeh' },
    nepali: { name: 'इजकिएल', abbrev: 'इज' }
  },
  dan: {
    english: { name: 'Daniel', abbrev: 'Dan' },
    spanish: { name: 'Daniel', abbrev: 'Dan' },
    brazilian_portuguese: { name: 'Daniel', abbrev: 'Dn' },
    tok_pisin: { name: 'Daniel', abbrev: 'Dan' },
    indonesian: { name: 'Daniel', abbrev: 'Dan' },
    nepali: { name: 'दानिएल', abbrev: 'दानि' }
  },
  hos: {
    english: { name: 'Hosea', abbrev: 'Hos' },
    spanish: { name: 'Oseas', abbrev: 'Ose' },
    brazilian_portuguese: { name: 'Oséias', abbrev: 'Os' },
    tok_pisin: { name: 'Hosea', abbrev: 'Hos' },
    indonesian: { name: 'Hosea', abbrev: 'Hos' },
    nepali: { name: 'होशे', abbrev: 'होशे' }
  },
  joe: {
    english: { name: 'Joel', abbrev: 'Joel' },
    spanish: { name: 'Joel', abbrev: 'Joel' },
    brazilian_portuguese: { name: 'Joel', abbrev: 'Jl' },
    tok_pisin: { name: 'Joel', abbrev: 'Joe' },
    indonesian: { name: 'Yoël', abbrev: 'Yoë' },
    nepali: { name: 'योएल', abbrev: 'योएल' }
  },
  amo: {
    english: { name: 'Amos', abbrev: 'Amos' },
    spanish: { name: 'Amós', abbrev: 'Amós' },
    brazilian_portuguese: { name: 'Amós', abbrev: 'Am' },
    tok_pisin: { name: 'Amos', abbrev: 'Amo' },
    indonesian: { name: 'Amos', abbrev: 'Amo' },
    nepali: { name: 'आमोस', abbrev: 'आमो' }
  },
  oba: {
    english: { name: 'Obadiah', abbrev: 'Obad' },
    spanish: { name: 'Abdías', abbrev: 'Abd' },
    brazilian_portuguese: { name: 'Obadias', abbrev: 'Ob' },
    tok_pisin: { name: 'Obadia', abbrev: 'Oba' },
    indonesian: { name: 'Obaja', abbrev: 'Ob' },
    nepali: { name: 'ओबदिया', abbrev: 'ओब' }
  },
  jon: {
    english: { name: 'Jonah', abbrev: 'Jonah' },
    spanish: { name: 'Jonás', abbrev: 'Jon' },
    brazilian_portuguese: { name: 'Jonas', abbrev: 'Jn' },
    tok_pisin: { name: 'Jona', abbrev: 'Jon' },
    indonesian: { name: 'Yunus', abbrev: 'Yun' },
    nepali: { name: 'योना', abbrev: 'योना' }
  },
  mic: {
    english: { name: 'Micah', abbrev: 'Mic' },
    spanish: { name: 'Miqueas', abbrev: 'Miq' },
    brazilian_portuguese: { name: 'Miquéias', abbrev: 'Mq' },
    tok_pisin: { name: 'Maika', abbrev: 'Mai' },
    indonesian: { name: 'Mikha', abbrev: 'Mik' },
    nepali: { name: 'मीका', abbrev: 'मीका' }
  },
  nah: {
    english: { name: 'Nahum', abbrev: 'Nah' },
    spanish: { name: 'Nahúm', abbrev: 'Nah' },
    brazilian_portuguese: { name: 'Naum', abbrev: 'Na' },
    tok_pisin: { name: 'Nahum', abbrev: 'Nah' },
    indonesian: { name: 'Nahum', abbrev: 'Nah' },
    nepali: { name: 'नहूम', abbrev: 'नहू' }
  },
  hab: {
    english: { name: 'Habakkuk', abbrev: 'Hab' },
    spanish: { name: 'Habacuc', abbrev: 'Hab' },
    brazilian_portuguese: { name: 'Habacuque', abbrev: 'Hc' },
    tok_pisin: { name: 'Habakuk', abbrev: 'Hab' },
    indonesian: { name: 'Habakuk', abbrev: 'Hab' },
    nepali: { name: 'हबक्कूक', abbrev: 'हब' }
  },
  zep: {
    english: { name: 'Zephaniah', abbrev: 'Zeph' },
    spanish: { name: 'Sofonías', abbrev: 'Sof' },
    brazilian_portuguese: { name: 'Sofonias', abbrev: 'Sf' },
    tok_pisin: { name: 'Sefanaia', abbrev: 'Sef' },
    indonesian: { name: 'Zefanya', abbrev: 'Zef' },
    nepali: { name: 'सपन्याह', abbrev: 'सप' }
  },
  hag: {
    english: { name: 'Haggai', abbrev: 'Hag' },
    spanish: { name: 'Hageo', abbrev: 'Hag' },
    brazilian_portuguese: { name: 'Ageu', abbrev: 'Ag' },
    tok_pisin: { name: 'Hagai', abbrev: 'Hag' },
    indonesian: { name: 'Hagai', abbrev: 'Hag' },
    nepali: { name: 'हाग्गै', abbrev: 'हाग्गै' }
  },
  zec: {
    english: { name: 'Zechariah', abbrev: 'Zech' },
    spanish: { name: 'Zacarías', abbrev: 'Zac' },
    brazilian_portuguese: { name: 'Zacarias', abbrev: 'Zc' },
    tok_pisin: { name: 'Sekaraia', abbrev: 'Sek' },
    indonesian: { name: 'Zakharia', abbrev: 'Zak' },
    nepali: { name: 'जकरिया', abbrev: 'जक' }
  },
  mal: {
    english: { name: 'Malachi', abbrev: 'Mal' },
    spanish: { name: 'Malaquías', abbrev: 'Mal' },
    brazilian_portuguese: { name: 'Malaquias', abbrev: 'Ml' },
    tok_pisin: { name: 'Malakai', abbrev: 'Mal' },
    indonesian: { name: 'Maleakhi', abbrev: 'Mal' },
    nepali: { name: 'मलाकी', abbrev: 'मला' }
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
    nepali: { name: 'मत्ती', abbrev: 'मत्ती' }
  },
  mar: {
    english: { name: 'Mark', abbrev: 'Mark' },
    spanish: { name: 'Marcos', abbrev: 'Mar' },
    brazilian_portuguese: { name: 'Marcos', abbrev: 'Mc' },
    tok_pisin: { name: 'Mak', abbrev: 'Mak' },
    indonesian: { name: 'Markus', abbrev: 'Mrk' },
    nepali: { name: 'मर्कूस', abbrev: 'मर्कू' }
  },
  luk: {
    english: { name: 'Luke', abbrev: 'Luke' },
    spanish: { name: 'Lucas', abbrev: 'Luc' },
    brazilian_portuguese: { name: 'Lucas', abbrev: 'Lc' },
    tok_pisin: { name: 'Luk', abbrev: 'Luk' },
    indonesian: { name: 'Lukas', abbrev: 'Luk' },
    nepali: { name: 'लूका', abbrev: 'लूका' }
  },
  jhn: {
    english: { name: 'John', abbrev: 'John' },
    spanish: { name: 'Juan', abbrev: 'Juan' },
    brazilian_portuguese: { name: 'João', abbrev: 'Jo' },
    tok_pisin: { name: 'Jon', abbrev: 'Jon' },
    indonesian: { name: 'Yohanes', abbrev: 'Yoh' },
    nepali: { name: 'यूहन्ना', abbrev: 'यूहन्' }
  },
  act: {
    english: { name: 'Acts', abbrev: 'Acts' },
    spanish: { name: 'Hechos', abbrev: 'Hch' },
    brazilian_portuguese: { name: 'Atos', abbrev: 'At' },
    tok_pisin: { name: 'Wok', abbrev: 'Wok' },
    indonesian: { name: 'Kisah Para Rasul', abbrev: 'Kis' },
    nepali: { name: 'प्रेरित', abbrev: 'प्रेरि' }
  },
  rom: {
    english: { name: 'Romans', abbrev: 'Rom' },
    spanish: { name: 'Romanos', abbrev: 'Rom' },
    brazilian_portuguese: { name: 'Romanos', abbrev: 'Rm' },
    tok_pisin: { name: 'Rom', abbrev: 'Rom' },
    indonesian: { name: 'Roma', abbrev: 'Rom' },
    nepali: { name: 'रोमी', abbrev: 'रोमी' }
  },
  '1co': {
    english: { name: '1 Corinthians', abbrev: '1 Cor' },
    spanish: { name: '1 Corintios', abbrev: '1 Cor' },
    brazilian_portuguese: { name: '1 Coríntios', abbrev: '1Co' },
    tok_pisin: { name: '1 Korin', abbrev: '1Kor' },
    indonesian: { name: '1 Korintus', abbrev: '1Kor' },
    nepali: { name: '१ कोरिन्थी', abbrev: '१कोरि' }
  },
  '2co': {
    english: { name: '2 Corinthians', abbrev: '2 Cor' },
    spanish: { name: '2 Corintios', abbrev: '2 Cor' },
    brazilian_portuguese: { name: '2 Coríntios', abbrev: '2Co' },
    tok_pisin: { name: '2 Korin', abbrev: '2Kor' },
    indonesian: { name: '2 Korintus', abbrev: '2Kor' },
    nepali: { name: '२ कोरिन्थी', abbrev: '२कोरि' }
  },
  gal: {
    english: { name: 'Galatians', abbrev: 'Gal' },
    spanish: { name: 'Gálatas', abbrev: 'Gál' },
    brazilian_portuguese: { name: 'Gálatas', abbrev: 'Gl' },
    tok_pisin: { name: 'Galesia', abbrev: 'Gal' },
    indonesian: { name: 'Galatia', abbrev: 'Gal' },
    nepali: { name: 'गलाती', abbrev: 'गला' }
  },
  eph: {
    english: { name: 'Ephesians', abbrev: 'Eph' },
    spanish: { name: 'Efesios', abbrev: 'Efe' },
    brazilian_portuguese: { name: 'Efésios', abbrev: 'Ef' },
    tok_pisin: { name: 'Efesus', abbrev: 'Efe' },
    indonesian: { name: 'Efesus', abbrev: 'Ef' },
    nepali: { name: 'एफिसी', abbrev: 'एफि' }
  },
  phi: {
    english: { name: 'Philippians', abbrev: 'Phil' },
    spanish: { name: 'Filipenses', abbrev: 'Fil' },
    brazilian_portuguese: { name: 'Filipenses', abbrev: 'Fp' },
    tok_pisin: { name: 'Filipai', abbrev: 'Fil' },
    indonesian: { name: 'Filipi', abbrev: 'Flp' },
    nepali: { name: 'फिलिप्पी', abbrev: 'फिलि' }
  },
  col: {
    english: { name: 'Colossians', abbrev: 'Col' },
    spanish: { name: 'Colosenses', abbrev: 'Col' },
    brazilian_portuguese: { name: 'Colossenses', abbrev: 'Cl' },
    tok_pisin: { name: 'Kolosi', abbrev: 'Kol' },
    indonesian: { name: 'Kolose', abbrev: 'Kol' },
    nepali: { name: 'कलस्सी', abbrev: 'कल' }
  },
  '1th': {
    english: { name: '1 Thessalonians', abbrev: '1 Thess' },
    spanish: { name: '1 Tesalonicenses', abbrev: '1 Tes' },
    brazilian_portuguese: { name: '1 Tessalonicenses', abbrev: '1Ts' },
    tok_pisin: { name: '1 Tesalonaika', abbrev: '1Tes' },
    indonesian: { name: '1 Tesalonika', abbrev: '1Tes' },
    nepali: { name: '१ थेस्सलोनिकी', abbrev: '१थेस्स' }
  },
  '2th': {
    english: { name: '2 Thessalonians', abbrev: '2 Thess' },
    spanish: { name: '2 Tesalonicenses', abbrev: '2 Tes' },
    brazilian_portuguese: { name: '2 Tessalonicenses', abbrev: '2Ts' },
    tok_pisin: { name: '2 Tesalonaika', abbrev: '2Tes' },
    indonesian: { name: '2 Tesalonika', abbrev: '2Tes' },
    nepali: { name: '२ थेस्सलोनिकी', abbrev: '२थेस्स' }
  },
  '1ti': {
    english: { name: '1 Timothy', abbrev: '1 Tim' },
    spanish: { name: '1 Timoteo', abbrev: '1 Tim' },
    brazilian_portuguese: { name: '1 Timóteo', abbrev: '1Tm' },
    tok_pisin: { name: '1 Timoti', abbrev: '1Tim' },
    indonesian: { name: '1 Timotius', abbrev: '1Tim' },
    nepali: { name: '१ तिमोथी', abbrev: '१तिमो' }
  },
  '2ti': {
    english: { name: '2 Timothy', abbrev: '2 Tim' },
    spanish: { name: '2 Timoteo', abbrev: '2 Tim' },
    brazilian_portuguese: { name: '2 Timóteo', abbrev: '2Tm' },
    tok_pisin: { name: '2 Timoti', abbrev: '2Tim' },
    indonesian: { name: '2 Timotius', abbrev: '2Tim' },
    nepali: { name: '२ तिमोथी', abbrev: '२तिमो' }
  },
  tit: {
    english: { name: 'Titus', abbrev: 'Titus' },
    spanish: { name: 'Tito', abbrev: 'Tit' },
    brazilian_portuguese: { name: 'Tito', abbrev: 'Tt' },
    tok_pisin: { name: 'Taitus', abbrev: 'Tai' },
    indonesian: { name: 'Titus', abbrev: 'Tit' },
    nepali: { name: 'तीतस', abbrev: 'तीत' }
  },
  phm: {
    english: { name: 'Philemon', abbrev: 'Phlm' },
    spanish: { name: 'Filemón', abbrev: 'Flm' },
    brazilian_portuguese: { name: 'Filemom', abbrev: 'Fm' },
    tok_pisin: { name: 'Filemon', abbrev: 'Fil' },
    indonesian: { name: 'Filemon', abbrev: 'Flm' },
    nepali: { name: 'फिलेमोन', abbrev: 'फिले' }
  },
  heb: {
    english: { name: 'Hebrews', abbrev: 'Heb' },
    spanish: { name: 'Hebreos', abbrev: 'Heb' },
    brazilian_portuguese: { name: 'Hebreus', abbrev: 'Hb' },
    tok_pisin: { name: 'Hibru', abbrev: 'Hib' },
    indonesian: { name: 'Ibrani', abbrev: 'Ibr' },
    nepali: { name: 'हिब्रू', abbrev: 'हिब्रू' }
  },
  jas: {
    english: { name: 'James', abbrev: 'Jas' },
    spanish: { name: 'Santiago', abbrev: 'Sant' },
    brazilian_portuguese: { name: 'Tiago', abbrev: 'Tg' },
    tok_pisin: { name: 'Jems', abbrev: 'Jem' },
    indonesian: { name: 'Yakobus', abbrev: 'Yak' },
    nepali: { name: 'याकूब', abbrev: 'याकू' }
  },
  '1pe': {
    english: { name: '1 Peter', abbrev: '1 Pet' },
    spanish: { name: '1 Pedro', abbrev: '1 Ped' },
    brazilian_portuguese: { name: '1 Pedro', abbrev: '1Pe' },
    tok_pisin: { name: '1 Pita', abbrev: '1Pit' },
    indonesian: { name: '1 Petrus', abbrev: '1Ptr' },
    nepali: { name: '१ पत्रुस', abbrev: '१पत्रु' }
  },
  '2pe': {
    english: { name: '2 Peter', abbrev: '2 Pet' },
    spanish: { name: '2 Pedro', abbrev: '2 Ped' },
    brazilian_portuguese: { name: '2 Pedro', abbrev: '2Pe' },
    tok_pisin: { name: '2 Pita', abbrev: '2Pit' },
    indonesian: { name: '2 Petrus', abbrev: '2Ptr' },
    nepali: { name: '२ पत्रुस', abbrev: '२पत्रु' }
  },
  '1jn': {
    english: { name: '1 John', abbrev: '1 John' },
    spanish: { name: '1 Juan', abbrev: '1 Jn' },
    brazilian_portuguese: { name: '1 João', abbrev: '1Jo' },
    tok_pisin: { name: '1 Jon', abbrev: '1Jon' },
    indonesian: { name: '1 Yohanes', abbrev: '1Yoh' },
    nepali: { name: '१ यूहन्ना', abbrev: '१यूहन्' }
  },
  '2jn': {
    english: { name: '2 John', abbrev: '2 John' },
    spanish: { name: '2 Juan', abbrev: '2 Jn' },
    brazilian_portuguese: { name: '2 João', abbrev: '2Jo' },
    tok_pisin: { name: '2 Jon', abbrev: '2Jon' },
    indonesian: { name: '2 Yohanes', abbrev: '2Yoh' },
    nepali: { name: '२ यूहन्ना', abbrev: '२यूहन्' }
  },
  '3jn': {
    english: { name: '3 John', abbrev: '3 John' },
    spanish: { name: '3 Juan', abbrev: '3 Jn' },
    brazilian_portuguese: { name: '3 João', abbrev: '3Jo' },
    tok_pisin: { name: '3 Jon', abbrev: '3Jon' },
    indonesian: { name: '3 Yohanes', abbrev: '3Yoh' },
    nepali: { name: '३ यूहन्ना', abbrev: '३यूहन्' }
  },
  jud: {
    english: { name: 'Jude', abbrev: 'Jude' },
    spanish: { name: 'Judas', abbrev: 'Jud' },
    brazilian_portuguese: { name: 'Judas', abbrev: 'Jd' },
    tok_pisin: { name: 'Jut', abbrev: 'Jut' },
    indonesian: { name: 'Yudas', abbrev: 'Yud' },
    nepali: { name: 'यहूदा', abbrev: 'यहू' }
  },
  rev: {
    english: { name: 'Revelation', abbrev: 'Rev' },
    spanish: { name: 'Apocalipsis', abbrev: 'Apoc' },
    brazilian_portuguese: { name: 'Apocalipse', abbrev: 'Ap' },
    tok_pisin: { name: 'Kamapim Tok Hait', abbrev: 'Kam' },
    indonesian: { name: 'Wahyu', abbrev: 'Why' },
    nepali: { name: 'प्रकाश', abbrev: 'प्रका' }
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
    bookNames.english ?? { name: bookId.toUpperCase(), abbrev: bookId.toUpperCase() }
  );
}
