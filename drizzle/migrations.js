// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_fixed_blade.sql';
import m0001 from './0001_rich_white_tiger.sql';
import m0002 from './0002_productive_king_bedlam.sql';
import m0003 from './0003_dry_gargoyle.sql';
import m0004 from './0004_free_madripoor.sql';
import m0005 from './0005_normal_wraith.sql';
import m0006 from './0006_noisy_wrecker.sql';
import m0007 from './0007_worried_randall_flagg.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007
    }
  }
  