// Import SVG components
import type { ImageSourcePropType } from 'react-native';
import Samuel2 from '../assets/svgs/10_2-Samuel.svg';
import Kings1 from '../assets/svgs/11_1-Kings.svg';
import Kings2 from '../assets/svgs/12_2-Kings.svg';
import Chronicles1 from '../assets/svgs/13_1-Chronicles.svg';
import Chronicles2 from '../assets/svgs/14_2-Chronicles.svg';
import Ezra from '../assets/svgs/15_Ezra.svg';
import Nehemiah from '../assets/svgs/16_Nehemiah.svg';
import Esther from '../assets/svgs/17_Esther.svg';
import Job from '../assets/svgs/18_Job.svg';
import Psalms from '../assets/svgs/19_Psalms.svg';
import Genesis from '../assets/svgs/1_Genesis.svg';
import Proverbs from '../assets/svgs/20_Proverbs.svg';
import Ecclesiastes from '../assets/svgs/21_Ecclesiastes.svg';
import SongOfSolomon from '../assets/svgs/22_Song-of-Solomon.svg';
import Isaiah from '../assets/svgs/23_Isaiah.svg';
import Jeremiah from '../assets/svgs/24_Jeremiah.svg';
import Lamentations from '../assets/svgs/25_Lamentations.svg';
import Ezekiel from '../assets/svgs/26_Ezekiel.svg';
import Daniel from '../assets/svgs/27_Daniel.svg';
import Hosea from '../assets/svgs/28_Hosea.svg';
import Joel from '../assets/svgs/29_Joel.svg';
import Exodus from '../assets/svgs/2_Exodus.svg';
import Amos from '../assets/svgs/30_Amos.svg';
import Obadiah from '../assets/svgs/31_Obadiah.svg';
import Jonah from '../assets/svgs/32_Jonah.svg';
import Micah from '../assets/svgs/33_Micah.svg';
import Nahum from '../assets/svgs/34_Nahum.svg';
import Habakkuk from '../assets/svgs/35_Habakkuk.svg';
import Zephaniah from '../assets/svgs/36_Zephaniah.svg';
import Haggai from '../assets/svgs/37_Haggai.svg';
import Zechariah from '../assets/svgs/38_Zechariah.svg';
import Malachi from '../assets/svgs/39_Malachi.svg';
import Leviticus from '../assets/svgs/3_Leviticus.svg';
import Matthew from '../assets/svgs/40_Matthew.svg';
import Mark from '../assets/svgs/41_Mark.svg';
import Luke from '../assets/svgs/42_Luke.svg';
import John from '../assets/svgs/43_John.svg';
import Acts from '../assets/svgs/44_Acts.svg';
import Romans from '../assets/svgs/45_Romans.svg';
import Corinthians1 from '../assets/svgs/46_1-Corinthians.svg';
import Corinthians2 from '../assets/svgs/47_2-Corinthians.svg';
import Galatians from '../assets/svgs/48_Galatians.svg';
import Ephesians from '../assets/svgs/49_Ephesians.svg';
import Numbers from '../assets/svgs/4_Numbers.svg';
import Philippians from '../assets/svgs/50_Philippians.svg';
import Colossians from '../assets/svgs/51_Colossians.svg';
import Thessalonians1 from '../assets/svgs/52_1-Thessalonians.svg';
import Thessalonians2 from '../assets/svgs/53_2-Thessalonians.svg';
import Timothy1 from '../assets/svgs/54_1-Timothy.svg';
import Timothy2 from '../assets/svgs/55_2-Timothy.svg';
import Titus from '../assets/svgs/56_Titus.svg';
import Philemon from '../assets/svgs/57_Philemon.svg';
import Hebrews from '../assets/svgs/58_Hebrews.svg';
import James from '../assets/svgs/59_James.svg';
import Deuteronomy from '../assets/svgs/5_Deuteronomy.svg';
import Peter1 from '../assets/svgs/60_1-Peter.svg';
import Peter2 from '../assets/svgs/61_2-Peter.svg';
import John1 from '../assets/svgs/62_1-John.svg';
import John2 from '../assets/svgs/63_2-John.svg';
import John3 from '../assets/svgs/64_3-John.svg';
import Jude from '../assets/svgs/65_Jude.svg';
import Revelation from '../assets/svgs/66_Revelation.svg';
import Joshua from '../assets/svgs/6_Joshua.svg';
import Judges from '../assets/svgs/7_Judges.svg';
import Ruth from '../assets/svgs/8_Ruth.svg';
import Samuel1 from '../assets/svgs/9_1-Samuel.svg';

import type React from 'react';
import type { SvgProps } from 'react-native-svg';

// Book SVG icons mapping
export const BOOK_GRAPHICS: Record<string, React.FC<SvgProps>> = {
  // Old Testament
  gen: Genesis,
  exo: Exodus,
  lev: Leviticus,
  num: Numbers,
  deu: Deuteronomy,
  jos: Joshua,
  jdg: Judges,
  rut: Ruth,
  '1sa': Samuel1,
  '2sa': Samuel2,
  '1ki': Kings1,
  '2ki': Kings2,
  '1ch': Chronicles1,
  '2ch': Chronicles2,
  ezr: Ezra,
  neh: Nehemiah,
  est: Esther,
  job: Job,
  psa: Psalms,
  pro: Proverbs,
  ecc: Ecclesiastes,
  sng: SongOfSolomon,
  isa: Isaiah,
  jer: Jeremiah,
  lam: Lamentations,
  ezk: Ezekiel,
  dan: Daniel,
  hos: Hosea,
  joe: Joel,
  amo: Amos,
  oba: Obadiah,
  jon: Jonah,
  mic: Micah,
  nah: Nahum,
  hab: Habakkuk,
  zep: Zephaniah,
  hag: Haggai,
  zec: Zechariah,
  mal: Malachi,

  // New Testament
  mat: Matthew,
  mar: Mark,
  luk: Luke,
  joh: John,
  act: Acts,
  rom: Romans,
  '1co': Corinthians1,
  '2co': Corinthians2,
  gal: Galatians,
  eph: Ephesians,
  php: Philippians,
  col: Colossians,
  '1th': Thessalonians1,
  '2th': Thessalonians2,
  '1ti': Timothy1,
  '2ti': Timothy2,
  tit: Titus,
  phm: Philemon,
  heb: Hebrews,
  jas: James,
  '1pe': Peter1,
  '2pe': Peter2,
  '1jo': John1,
  '2jo': John2,
  '3jo': John3,
  jud: Jude,
  rev: Revelation
};

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */
export const BOOK_ICON_MAP: Record<string, ImageSourcePropType> = {
  gen: require('../assets/book-icons/gen.png'),
  exo: require('../assets/book-icons/exo.png'),
  lev: require('../assets/book-icons/lev.png'),
  num: require('../assets/book-icons/num.png'),
  deu: require('../assets/book-icons/deu.png'),
  jos: require('../assets/book-icons/jos.png'),
  jdg: require('../assets/book-icons/jdg.png'),
  rut: require('../assets/book-icons/rut.png'),
  '1sa': require('../assets/book-icons/1sa.png'),
  '2sa': require('../assets/book-icons/2sa.png'),
  '1ki': require('../assets/book-icons/1ki.png'),
  '2ki': require('../assets/book-icons/2ki.png'),
  '1ch': require('../assets/book-icons/1ch.png'),
  '2ch': require('../assets/book-icons/2ch.png'),
  ezr: require('../assets/book-icons/ezr.png'),
  neh: require('../assets/book-icons/neh.png'),
  est: require('../assets/book-icons/est.png'),
  job: require('../assets/book-icons/job.png'),
  psa: require('../assets/book-icons/psa.png'),
  pro: require('../assets/book-icons/pro.png'),
  ecc: require('../assets/book-icons/ecc.png'),
  sng: require('../assets/book-icons/sng.png'),
  isa: require('../assets/book-icons/isa.png'),
  jer: require('../assets/book-icons/jer.png'),
  lam: require('../assets/book-icons/lam.png'),
  ezk: require('../assets/book-icons/ezk.png'),
  dan: require('../assets/book-icons/dan.png'),
  hos: require('../assets/book-icons/hos.png'),
  jol: require('../assets/book-icons/jol.png'),
  amo: require('../assets/book-icons/amo.png'),
  oba: require('../assets/book-icons/oba.png'),
  jon: require('../assets/book-icons/jon.png'),
  mic: require('../assets/book-icons/mic.png'),
  nam: require('../assets/book-icons/nam.png'),
  hab: require('../assets/book-icons/hab.png'),
  zep: require('../assets/book-icons/zep.png'),
  hag: require('../assets/book-icons/hag.png'),
  zec: require('../assets/book-icons/zec.png'),
  mal: require('../assets/book-icons/mal.png'),
  mat: require('../assets/book-icons/mat.png'),
  mrk: require('../assets/book-icons/mrk.png'),
  luk: require('../assets/book-icons/luk.png'),
  jhn: require('../assets/book-icons/jhn.png'),
  act: require('../assets/book-icons/act.png'),
  rom: require('../assets/book-icons/rom.png'),
  '1co': require('../assets/book-icons/1co.png'),
  '2co': require('../assets/book-icons/2co.png'),
  gal: require('../assets/book-icons/gal.png'),
  eph: require('../assets/book-icons/eph.png'),
  php: require('../assets/book-icons/php.png'),
  col: require('../assets/book-icons/col.png'),
  '1th': require('../assets/book-icons/1th.png'),
  '2th': require('../assets/book-icons/2th.png'),
  '1ti': require('../assets/book-icons/1ti.png'),
  '2ti': require('../assets/book-icons/2ti.png'),
  tit: require('../assets/book-icons/tit.png'),
  phm: require('../assets/book-icons/phm.png'),
  heb: require('../assets/book-icons/heb.png'),
  jas: require('../assets/book-icons/jas.png'),
  '1pe': require('../assets/book-icons/1pe.png'),
  '2pe': require('../assets/book-icons/2pe.png'),
  '1jn': require('../assets/book-icons/1jn.png'),
  '2jn': require('../assets/book-icons/2jn.png'),
  '3jn': require('../assets/book-icons/3jn.png'),
  jud: require('../assets/book-icons/jud.png'),
  rev: require('../assets/book-icons/rev.png')
};
/* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */

// Simple emoji mapping for performance (used when USE_SVG_ICONS = false)
export const BOOK_EMOJIS: Record<string, string> = {
  // Old Testament
  gen: '🌱',
  exo: '🚶',
  lev: '⚖️',
  num: '🔢',
  deu: '📜',
  jos: '⚔️',
  jdg: '👨‍⚖️',
  rut: '🌾',
  '1sa': '👑',
  '2sa': '🏰',
  '1ki': '👑',
  '2ki': '🏰',
  '1ch': '📚',
  '2ch': '📖',
  ezr: '🏗️',
  neh: '🧱',
  est: '👸',
  job: '😢',
  psa: '🎵',
  pro: '💡',
  ecc: '🤔',
  sng: '💕',
  isa: '👁️',
  jer: '😭',
  lam: '💧',
  ezk: '🔥',
  dan: '🦁',
  hos: '💔',
  joe: '🦗',
  amo: '🏔️',
  oba: '⚡',
  jon: '🐋',
  mic: '⚖️',
  nah: '🌪️',
  hab: '❓',
  zep: '🔥',
  hag: '🏗️',
  zec: '👁️',
  mal: '💰',

  // New Testament
  mat: '👨',
  mar: '🦁',
  luk: '🐂',
  joh: '🦅',
  act: '🔥',
  rom: '🏛️',
  '1co': '💕',
  '2co': '🪖',
  gal: '🗽',
  eph: '⚔️',
  php: '😊',
  col: '👑',
  '1th': '🎺',
  '2th': '⏰',
  '1ti': '👨‍💼',
  '2ti': '📝',
  tit: '🏗️',
  phm: '🤝',
  heb: '🎪',
  jas: '⚖️',
  '1pe': '🪨',
  '2pe': '🔥',
  '1jo': '📝',
  '2jo': '✉️',
  '3jo': '✍️',
  jud: '⚡',
  rev: '👁️'
};
