import { languageRepository, userRepository } from '@/database_components/repositories';
import { DevTableConfigs, FieldPath } from './DevTypes';

// Field definitions
const languageFields = {
  nativeName: { field: 'nativeName' },
  englishName: { field: 'englishName' },
  iso639_3: { field: 'iso639_3' },
  uiReady: { field: 'uiReady' },
  creator: {
    field: 'creator',
    through: {
      repository: userRepository,
      displayField: 'username',
      relationship: {
        type: 'toOne' as const,
        relationName: 'creator'
      }
    }
  },
  uiUsers: {
    field: 'uiUsers',
    isVirtual: true,
    through: {
      repository: userRepository,
      displayField: 'username',
      relationship: {
        type: 'toMany' as const,
        relationName: 'uiUsers'
      }
    }
  }
} as const;

const userFields = {
  username: { field: 'username' },
  password: { field: 'password' },
  versionNum: { field: 'versionNum' },
  uiLanguage: {
    field: 'uiLanguage',
    through: {
      repository: languageRepository,
      displayField: 'nativeName',
      relationship: {
        type: 'toOne' as const,
        relationName: 'uiLanguage'
      }
    }
  },
  createdLanguages: {
    field: 'createdLanguages',
    isVirtual: true,
    through: {
      repository: languageRepository,
      displayField: 'nativeName',
      relationship: {
        type: 'toMany' as const,
        relationName: 'createdLanguages'
      }
    }
  }
} as const;

// Edit field configurations
const languageEditFields = {
  nativeName: {
    type: 'text' as const,
    required: true,
    label: 'Native Name',
    placeholder: 'Enter native name',
    fieldPath: languageFields.nativeName,
    validation: (value: unknown) => 
      typeof value !== 'string' || !value.trim() ? 'Native name is required' : null
  },
  englishName: {
    type: 'text' as const,
    required: true,
    label: 'English Name',
    placeholder: 'Enter English name',
    fieldPath: languageFields.englishName,
    validation: (value: unknown) => 
      typeof value !== 'string' || !value.trim() ? 'English name is required' : null
  },
  iso639_3: {
    type: 'text' as const,
    label: 'ISO 639-3',
    placeholder: 'Enter ISO code',
    fieldPath: languageFields.iso639_3
  },
  uiReady: {
    type: 'switch' as const,
    label: 'UI Ready',
    fieldPath: languageFields.uiReady
  },
  creator: {
    type: 'entitySelect' as const,
    label: 'Creator',
    fieldPath: languageFields.creator
  },
  uiUsers: {
    type: 'relationList' as const,
    label: 'UI Users',
    fieldPath: languageFields.uiUsers
  }
} as const;

const userEditFields = {
  username: {
    type: 'text' as const,
    required: true,
    label: 'Username',
    placeholder: 'Enter username',
    fieldPath: userFields.username,
    validation: (value: unknown) => 
      typeof value !== 'string' || !value.trim() ? 'Username is required' : null
  },
  password: {
    type: 'password' as const,
    label: 'Password',
    placeholder: 'Enter password',
    fieldPath: userFields.password,
    validation: (value: unknown, context?: { isNew?: boolean }) => {
      if (typeof value !== 'string') return 'Password must be a string';
      if (context?.isNew && !value.trim()) return 'Password is required for new users';
      if (value && value.length < 8) return 'Password must be at least 8 characters';
      return null;
    }
  },
  uiLanguage: {
    type: 'entitySelect' as const,
    required: true,
    label: 'UI Language',
    fieldPath: userFields.uiLanguage,
    validation: (value: unknown) => !value ? 'UI Language is required' : null
  }
} as const;

export const tableConfig: DevTableConfigs = {
  Language: {
    repository: languageRepository,
    card: {
      title: languageFields.nativeName,
      subtitle: languageFields.englishName,
      properties: [
        languageFields.iso639_3,
        languageFields.uiReady,
        languageFields.creator
      ]
    },
    details: {
      sections: [
        {
          title: 'Basic Information',
          fields: [
            languageFields.nativeName,
            languageFields.englishName,
            languageFields.iso639_3
          ]
        },
        {
          title: 'Settings',
          fields: [
            languageFields.uiReady,
            languageFields.creator
          ]
        },
        {
          title: 'Relations',
          fields: [languageFields.uiUsers]
        }
      ]
    },
    edit: {
      fields: languageEditFields
    }
  },

  User: {
    repository: userRepository,
    card: {
      title: userFields.username,
      subtitle: userFields.uiLanguage,
      properties: [userFields.versionNum]
    },
    details: {
      sections: [
        {
          title: 'User Information',
          fields: [
            userFields.username,
            userFields.uiLanguage
          ]
        },
        {
          title: 'Security',
          fields: [userFields.password]
        },
        {
          title: 'Relations',
          fields: [userFields.createdLanguages]
        }
      ]
    },
    edit: {
      fields: userEditFields
    }
  }
};