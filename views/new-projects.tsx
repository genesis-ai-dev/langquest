// import { PageHeader } from '@/components/PageHeader';
// import { ThemeToggle } from '@/components/theme-toggle';
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue
// } from '@/components/ui/select';
// import { Text } from '@/components/ui/text';
// import { useSystem } from '@/contexts/SystemContext';
// import { useTranslation } from '@/hooks/useTranslation';
// import { useQuery } from '@powersync/tanstack-react-query';
// import { View } from 'react-native';

// export default function Projects() {
//   const { t } = useTranslation();
//   const { db } = useSystem();

//   const { data: projects } = useQuery({
//     queryKey: ['projects'],
//     queryFn: () => db.query.project.findMany()
//   });

//   const { data: languages } = useQuery({
//     queryKey: ['languages'],
//     queryFn: () => db.query.language.findMany()
//   });

//   return (
//     <View className="m-safe p-6">
//       <ThemeToggle />
//       <PageHeader title={t('projects')} showBackButton={false} />
//       <SourceLanguageSelect />
//     </View>
//   );
// }

// const SourceLanguageSelect = () => {
//   const { t } = useTranslation();
//   const { db } = useSystem();

//   const { data: languages } = useQuery({
//     queryKey: ['languages'],
//     queryFn: () => db.query.language.findMany()
//   });

//   return (
//     <Select>
//       <Text className="text-muted-foreground">{t('source')}</Text>
//       <SelectTrigger>
//         <SelectValue
//           placeholder={t('selectLanguage')}
//           className="text-foreground"
//         />
//       </SelectTrigger>
//       <SelectContent>
//         {languages?.map((language) => (
//           <SelectItem
//             key={language.id}
//             value={language.id}
//             label={language.native_name}
//           >
//             {language.native_name}
//           </SelectItem>
//         ))}
//       </SelectContent>
//     </Select>
//   );
// };
