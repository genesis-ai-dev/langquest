import { languageRepository, userRepository } from '@/database_components/repositories';
import { DevTableConfigs } from './DevTypes';

export const tableConfig: DevTableConfigs = {
  Language: {
    repository: languageRepository,
    card: {
      title: 'nativeName',
      subtitle: 'englishName',
      properties: ['iso639_3', 'uiReady', 'creator']
    },
    details: {
      sections: [
        {
          title: 'Basic Information',
          fields: ['nativeName', 'englishName', 'iso639_3']
        },
        {
          title: 'Settings',
          fields: ['uiReady', 'creator']
        },
        {
          title: 'Relations',
          fields: ['uiUsers']
        }
      ]
    },
    edit: {
      fields: {
        nativeName: {
          type: 'text',
          required: true,
          label: 'Native Name',
          placeholder: 'Enter native name',
          validation: (value: unknown) => 
            typeof value !== 'string' || !value.trim() ? 'Native name is required' : null
        },
        englishName: {
          type: 'text',
          required: true,
          label: 'English Name',
          placeholder: 'Enter English name',
          validation: (value: unknown) => 
            typeof value !== 'string' || !value.trim() ? 'English name is required' : null
        },
        iso639_3: {
          type: 'text',
          label: 'ISO 639-3',
          placeholder: 'Enter ISO code'
        },
        uiReady: {
          type: 'switch',
          label: 'UI Ready'
        },
        creator: {
          type: 'dropdown',
          label: 'Creator',
          source: 'users',
          linkedEntity: {
            repository: userRepository,
            displayField: 'username'
          }
        },
        uiUsers: {
          type: 'relationList',
          label: 'UI Users',
          relationConfig: {
            repository: userRepository,
            relationName: 'uiUsers',
            displayField: 'username'
          }
        },
        // sourceProjects: {
        //   type: 'relationList',
        //   label: 'Source Language Projects',
        //   relationConfig: {
        //     repository: projectRepository,
        //     relationName: *****************************
        //     displayField: 'name'
        //   }
        // },
        // targetProjects: {
        //   type: 'relationList',
        //   label: 'Target Language Projects',
        //   relationConfig: {
        //     repository: projectRepository,
        //     relationName: *******************************
        //     displayField: 'name'
        //   }
        // }
      }
    }
  },


  User: {
    repository: userRepository,
    card: {
      title: 'username',
      subtitle: 'uiLanguage',
      properties: ['versionNum']
    },
    details: {
      sections: [
        {
          title: 'User Information',
          fields: ['username', 'uiLanguage']
        },
        {
          title: 'Security',
          fields: ['password']
        },
        {
          title: 'Relations',
          fields: ['createdLanguages'] //'leadProjects', 'memberProjects'
        }
      ]
    },
    edit: {
      fields: {
        username: {
          type: 'text',
          required: true,
          label: 'Username',
          placeholder: 'Enter username',
          validation: (value: unknown) => 
            typeof value !== 'string' || !value.trim() ? 'Username is required' : null
        },
        password: {
          type: 'password',
          label: 'Password',
          placeholder: 'Enter password',
          validation: (value: unknown, context?: { isNew?: boolean }) => {
            // Type guard to ensure value is string
            if (typeof value !== 'string') {
              return 'Password must be a string';
            }
        
            // Only require password for new users
            if (context?.isNew && !value.trim()) {
              return 'Password is required for new users';
            }
        
            // Password strength validation
            if (value && value.length < 8) {
              return 'Password must be at least 8 characters';
            }
        
            return null; // validation passed
          }
        },
        uiLanguage: {
          type: 'dropdown',
          required: true,
          label: 'UI Language',
          source: 'languages',
          linkedEntity: {
            repository: languageRepository,
            displayField: 'nativeName'
          },
          validation: (value: unknown) => 
            !value ? 'UI Language is required' : null
        },
        // leadProjects: {
        //   type: 'relationList',
        //   label: 'Projects (as Leader)',
        //   relationConfig: {
        //     repository: projectRepository,
        //     relationName: *******************************
        //     displayField: 'name'
        //   }
        // },
        // memberProjects: {
        //   type: 'relationList',
        //   label: 'Projects (as Member)',
        //   relationConfig: {
        //     repository: projectRepository,
        //     relationName: *******************************
        //     displayField: 'name'
        //   }
        // },
        createdLanguages: {
          type: 'relationList',
          label: 'Created Languages',
          relationConfig: {
            repository: languageRepository,
            relationName: 'createdLanguages',
            displayField: 'nativeName'
          }
        }
      }
    }
  }
};