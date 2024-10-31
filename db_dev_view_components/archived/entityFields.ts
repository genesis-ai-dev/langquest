import { DevFormField } from './DevTypes';
import { Language } from '@/database_components/LanguageRepository';
import { User } from '@/database_components/UserRepository';
import { userRepository } from '@/database_components/repositories';

export const languageFields: DevFormField[] = [
  {
    key: 'nativeName',
    type: 'text',
    label: 'Native Name',
    placeholder: 'Enter native name'
  },
  {
    key: 'englishName',
    type: 'text',
    label: 'English Name',
    placeholder: 'Enter English name'
  },
  {
    key: 'iso639_3',
    type: 'text',
    label: 'ISO 639-3',
    placeholder: 'Enter ISO code'
  },
  {
    key: 'uiUsers',
    type: 'relationList',
    label: 'UI Users',
    relationConfig: {
      repository: userRepository,
      foreignKey: 'uiLanguage',
      displayField: 'username'
    }
  },
  {
    key: 'creator',
    type: 'dropdown',
    label: 'Creator',
    getOptionLabel: (user: User) => user.username,
    getOptionValue: (user: User) => user.username
  },
  {
    key: 'uiReady',
    type: 'switch',
    label: 'UI Ready'
  }
];

export const userFields: DevFormField[] = [
  {
    key: 'username',
    type: 'text',
    label: 'Username',
    placeholder: 'Enter username'
  },
  {
    key: 'password',
    type: 'password',
    label: 'Password',
    placeholder: 'Enter password'
  },
  {
    key: 'uiLanguage',
    type: 'dropdown',
    label: 'UI Language',
    getOptionLabel: (lang: Language) => lang.englishName,
    getOptionValue: (lang: Language) => lang.id
  }
];