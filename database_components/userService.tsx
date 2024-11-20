import { eq, desc } from 'drizzle-orm';
import { db } from '../db/database';
import { user } from '../db/drizzleSchema';
import { hashPassword } from '../utils/passwordUtils';
import { VersionedService } from './VersionedService';
import { UserSelect, UserInsert } from './types';
import { TextInput, TextDisplay, PasswordInput, Dropdown } from '@/db_dev_view_components/DevUiElements';

export class UserService extends VersionedService<typeof user, UserSelect, UserInsert> {
  constructor() {
    super(user);
  }

  protected getDefaultOrderBy() {
    return desc(this.table.username);
  }

  async validateCredentials(username: string, password: string): Promise<UserSelect | null> {
    const hashedPassword = await hashPassword(password);
    const foundUser = await this.findOneWhere(eq(this.table.username, username));
    return foundUser?.password === hashedPassword ? foundUser : null;
  }

  // Override createNew to handle password hashing
  async createNew(data: {
    username: string;
    password: string;
    uiLanguageId: string;
  }): Promise<UserSelect> {
    const hashedPassword = await hashPassword(data.password);
    return await super.createNew({
      ...data,
      password: hashedPassword,
    });
  }

  // Override addVersion to handle password hashing
  async addVersion(
    baseVersion: UserSelect,
    updates: Partial<{
      username: string;
      password: string;
      uiLanguageId: string;
    }>
  ): Promise<UserSelect> {
    if (updates.password) {
      updates.password = await hashPassword(updates.password);
    }
    return await super.addVersion(baseVersion, updates);
  }

  // Override updateVersion to handle password hashing
  async updateVersion(
    id: string,
    updates: Partial<{
      username: string;
      password: string;
      uiLanguageId: string;
    }>
  ): Promise<UserSelect> {
    if (updates.password) {
      updates.password = await hashPassword(updates.password);
    }
    return await super.updateVersion(id, updates);
  }

  override getDisplayConfig() {
    return {
      card: {
        title: (record: UserSelect): React.ReactNode => (
          <TextDisplay value={record.username} />
        ),
        subtitle: (record: UserSelect): React.ReactNode => (
          <TextDisplay value={`UI Language: ${record.uiLanguageId || 'None'}`} />
        ),
        content: (record: UserSelect): React.ReactNode[] => [
          <TextDisplay key="username" value={record.username} />
        ]
      },
      details: {
        sections: [
          {
            title: 'User Information',
            content: (record: UserSelect): React.ReactNode[] => [
              <TextDisplay key="username" value={`Username: ${record.username}`} />,
              <TextDisplay key="uiLanguage" value={`UI Language: ${record.uiLanguageId || 'None'}`} />
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
          username: {
            component: TextInput,
            props: {
              required: true,
              placeholder: 'Enter username'
            }
          },
          password: {
            component: PasswordInput,
            props: {
              required: true,
              placeholder: 'Enter password'
            }
          },
          uiLanguageId: {
            component: Dropdown,
            props: {
              source: 'languages',
              placeholder: 'Select UI language'
            }
          },
          id:{
            component: () => null,
            props: {}            
          },
          createdAt:{
            component: () => null,
            props: {}
          },
          lastUpdated:{
            component: () => null,
            props: {}
          },
          versionChainId:{
            component: () => null,
            props: {}
          },
          versionNum:{
            component: () => null,
            props: {}
          },
        })
      },
      edit: {
        fields: (record: UserSelect) => ({
          username: {
            component: TextInput,
            props: {
              value: record.username,
              placeholder: 'Enter username'
            }
          },
          password: {
            component: PasswordInput,
            props: {
              placeholder: 'Enter new password'
            }
          },
          uiLanguageId: {
            component: Dropdown,
            props: {
              value: record.uiLanguageId || '',
              source: 'languages',
              placeholder: 'Select UI language'
            }
          },
          //create null fields for versioned fields
          id:{
            component: () => null,
            props: {}            
          },
          createdAt:{
            component: () => null,
            props: {}
          },
          lastUpdated:{
            component: () => null,
            props: {}
          },
          versionChainId:{
            component: () => null,
            props: {}
          },
          versionNum:{
            component: () => null,
            props: {}
          },
        })
      }
    };
  }
}

export const userService = new UserService();