import { eq, desc, and, SQL, asc } from 'drizzle-orm';
import { user, language } from '../db/drizzleSchema';
import { VersionedService } from './VersionedService';
import { 
  LanguageSelect, 
  LanguageInsert, 
  LanguageWithRelations,
  NewLanguageData,
  LanguageUpdate 
} from './types';
import { db } from '../db/database';
import { TextInput, TextDisplay, Switch } from '@/db_dev_view_components/DevUiElements';

export class LanguageService extends VersionedService<
  typeof language,
  LanguageSelect,
  LanguageInsert
> {
  constructor() {
    super(language);
  }

  // protected getDefaultOrderBy(): SQL<unknown> {
  //   return desc(this.table.lastUpdated);
  // }

  async getUiReadyLanguages(): Promise<LanguageSelect[]> {
    const subquery = this.getLatestVersionsSubquery();
    
    const results = await db
      .select()
      .from(this.table)
      .innerJoin(
        subquery,
        and(
          eq(this.table.versionChainId, subquery.versionChainId),
          eq(this.table.versionNum, subquery.maxVersion)
        )
      )
      .where(eq(this.table.uiReady, true))
      .orderBy(this.getDefaultOrderBy());
  
    // Map to extract just the language data from each row
    return results.map(row => row.Language) as LanguageSelect[];
  }

  async getWithRelations(id: string): Promise<LanguageWithRelations | undefined> {
    const language = await this.findById(id);
    if (!language) return undefined;
  
    // Get the language with its creator
    const [result] = await db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .leftJoin(user, eq(this.table.creatorId, user.id));
  
    // Get users who have this as their UI language
    const uiUsers = await db
      .select()
      .from(user)
      .where(eq(user.uiLanguageId, id));
  
    // Combine the results
    return {
      ...result.Language,
      creator: result.User ? result.User : undefined,
      uiUsers: uiUsers
    } as LanguageWithRelations;
  }

  async create(data: NewLanguageData): Promise<LanguageSelect> {
    await this.validateForCreate(data);
    return await super.createNew(data);
  }

  async update(id: string, data: LanguageUpdate): Promise<LanguageSelect> {
    await this.validateForUpdate(data);
    return await super.update(id, data);
  }

  protected getDefaultOrderBy(): SQL<unknown> {
    return asc(this.table.nativeName);
  }

  private async validateForCreate(data: NewLanguageData): Promise<void> {
    if (!data.nativeName?.trim() && !data.englishName?.trim()) {
      throw new Error('Either native name or English name is required');
    }
    if (data.iso639_3 && data.iso639_3.length !== 3) {
      throw new Error('ISO 639-3 code must be exactly 3 characters');
    }
  }

  private async validateForUpdate(data: LanguageUpdate): Promise<void> {
    if (data.nativeName === '' && data.englishName === '') {
      throw new Error('Cannot remove both native name and English name');
    }
    if (data.iso639_3 && data.iso639_3.length !== 3) {
      throw new Error('ISO 639-3 code must be exactly 3 characters');
    }
  }

  override getDisplayConfig() {
    return {
      card: {
        title: (record: LanguageSelect): React.ReactNode => (
          <TextDisplay value={record.nativeName || record.englishName || 'Unnamed Language'} />
        ),
        subtitle: (record: LanguageSelect): React.ReactNode => (
          <TextDisplay value={record.iso639_3 || 'No ISO code'} />
        ),
        content: (record: LanguageSelect): React.ReactNode[] => [
          <TextDisplay key="status" value={`UI Ready: ${record.uiReady ? 'Yes' : 'No'}`} />
        ]
      },
      details: {
        sections: [
          {
            title: 'Language Information',
            content: (record: LanguageSelect): React.ReactNode[] => [
              <TextDisplay key="native" value={`Native Name: ${record.nativeName || 'None'}`} />,
              <TextDisplay key="english" value={`English Name: ${record.englishName || 'None'}`} />,
              <TextDisplay key="iso" value={`ISO 639-3: ${record.iso639_3 || 'None'}`} />,
              <TextDisplay key="uiReady" value={`UI Ready: ${record.uiReady ? 'Yes' : 'No'}`} />
            ]
          }
        ],
        versionControls: {
          onPreviousVersion: this.getPreviousVersion.bind(this),
          onNextVersion: this.getNextVersion.bind(this),
          getVersionInfo: this.getVersionInfo.bind(this)
        }
      },
      create: {
        fields: () => ({
          nativeName: {
            component: TextInput,
            props: {
              placeholder: 'Enter native name'
            }
          },
          englishName: {
            component: TextInput,
            props: {
              placeholder: 'Enter English name'
            }
          },
          iso639_3: {
            component: TextInput,
            props: {
              placeholder: 'Enter ISO 639-3 code'
            }
          },
          uiReady: {
            component: Switch,
            props: {
              value: false
            }
          },
          creatorId: {
            component: () => null,
            props: {}
          },
          id: {
            component: () => null,
            props: {}
          },
          createdAt: {
            component: () => null,
            props: {}
          },
          lastUpdated: {
            component: () => null,
            props: {}
          },
          versionChainId: {
            component: () => null,
            props: {}
          },
          versionNum: {
            component: () => null,
            props: {}
          }
        })
      },
      edit: {
        fields: (record: LanguageSelect) => ({
          nativeName: {
            component: TextInput,
            props: {
              value: record.nativeName || '',
              placeholder: 'Enter native name'
            }
          },
          englishName: {
            component: TextInput,
            props: {
              value: record.englishName || '',
              placeholder: 'Enter English name'
            }
          },
          iso639_3: {
            component: TextInput,
            props: {
              value: record.iso639_3 || '',
              placeholder: 'Enter ISO 639-3 code'
            }
          },
          uiReady: {
            component: Switch,
            props: {
              value: record.uiReady
            }
          },
          creatorId: {
            component: () => null,
            props: {}
          },
          id: {
            component: () => null,
            props: {}
          },
          createdAt: {
            component: () => null,
            props: {}
          },
          lastUpdated: {
            component: () => null,
            props: {}
          },
          versionChainId: {
            component: () => null,
            props: {}
          },
          versionNum: {
            component: () => null,
            props: {}
          }
        })
      }
    };
  }
}

export const languageService = new LanguageService();