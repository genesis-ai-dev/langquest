// import { DownloadIndicator } from '@/components/DownloadIndicator';
// import { PageHeader } from '@/components/PageHeader';
// import { ThemeToggle } from '@/components/theme-toggle';
// import {
//   Card,
//   CardContent,
//   CardDescription,
//   CardFooter,
//   CardHeader,
//   CardTitle
// } from '@/components/ui/card';
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue
// } from '@/components/ui/select';
// import { Text } from '@/components/ui/text';
// import { useAuth } from '@/contexts/AuthContext';
// import { useSystem } from '@/contexts/SystemContext';
// import { downloadService } from '@/database_services/downloadService';
// import type { Project } from '@/database_services/projectService';
// import { useAssetDownloadStatus } from '@/hooks/useAssetDownloadStatus';
// import { useTranslation } from '@/hooks/useTranslation';
// import type { Language } from '@/store/localStore';
// import { LegendList } from '@legendapp/list';
// import { toCompilableQuery } from '@powersync/drizzle-driver';
// import { useQuery } from '@powersync/tanstack-react-query';
// import type { Option } from '@rn-primitives/select';
// import { useQueryClient } from '@tanstack/react-query';
// import { useRouter } from 'expo-router';
// import { useState } from 'react';
// import { Pressable, View } from 'react-native';

// export default function Projects() {
//   const { t } = useTranslation();
//   const { db } = useSystem();

//   const { data: projects } = useQuery({
//     queryKey: ['projects'],
//     query: toCompilableQuery(
//       db.query.project.findMany({
//         with: {
//           source_language: {
//             columns: {
//               id: true,
//               native_name: true,
//               english_name: true
//             }
//           },
//           target_language: {
//             columns: {
//               id: true,
//               native_name: true,
//               english_name: true
//             }
//           }
//         }
//       })
//     )
//   });

//   // Get unique source and target languages from projects
//   const sourceLanguages = projects
//     ? [
//         ...new Map(
//           projects.map((p) => [p.source_language.id, p.source_language])
//         ).values()
//       ]
//     : [];
//   const targetLanguages = projects
//     ? [
//         ...new Map(
//           projects.map((p) => [p.target_language.id, p.target_language])
//         ).values()
//       ]
//     : [];

//   // State for selected languages
//   const [selectedSourceLanguage, setSelectedSourceLanguage] =
//     useState<Option>();
//   const [selectedTargetLanguage, setSelectedTargetLanguage] =
//     useState<Option>();

//   // Filter projects based on selected languages
//   const filteredProjects = projects?.filter((project) => {
//     const sourceValue = selectedSourceLanguage?.value;
//     const targetValue = selectedTargetLanguage?.value;
//     const matchesSource =
//       !sourceValue || project.source_language.id === sourceValue;
//     const matchesTarget =
//       !targetValue || project.target_language.id === targetValue;
//     return matchesSource && matchesTarget;
//   });

//   return (
//     <View className="m-safe p-6 flex flex-col gap-6">
//       <ThemeToggle />
//       <PageHeader title={t('projects')} showBackButton={false} />
//       <View className="flex flex-row gap-2 justify-between">
//         <FilterLanguageSelect
//           label={t('source')}
//           languages={sourceLanguages}
//           value={selectedSourceLanguage}
//           onChange={setSelectedSourceLanguage}
//         />
//         <FilterLanguageSelect
//           label={t('target')}
//           languages={targetLanguages}
//           value={selectedTargetLanguage}
//           onChange={setSelectedTargetLanguage}
//         />
//       </View>

//       <LegendList
//         data={filteredProjects ?? []}
//         keyExtractor={(item) => item.id}
//         recycleItems
//         renderItem={({ item }) => <ProjectCard project={item} />}
//       />
//     </View>
//   );
// }

// const ProjectCard = ({
//   project: { source_language, target_language, ...project }
// }: {
//   project: Project & {
//     source_language: Pick<Language, 'id' | 'native_name' | 'english_name'>;
//     target_language: Pick<Language, 'id' | 'native_name' | 'english_name'>;
//   };
// }) => {
//   const router = useRouter();
//   const { currentUser } = useAuth();
//   const { db } = useSystem();

//   const queryClient = useQueryClient();

//   const { data: downloadData } = useQuery({
//     queryKey: ['isDownloaded', currentUser?.id, project.id],
//     query: toCompilableQuery(
//       db.query.project_download.findFirst({
//         where: (project_download, { and, eq }) =>
//           and(
//             eq(project_download.profile_id, currentUser?.id ?? ''),
//             eq(project_download.project_id, project.id),
//             eq(project_download.active, true)
//           )
//       })
//     ),
//     enabled: !!currentUser?.id
//   });

//   const { data: quests } = useQuery({
//     queryKey: ['assetIds', project.id],
//     query: toCompilableQuery(
//       db.query.quest.findMany({
//         where: (quest, { eq }) => eq(quest.project_id, project.id),
//         columns: {
//           project_id: true
//         },
//         with: {
//           assets: {
//             columns: {
//               asset_id: true
//             }
//           }
//         }
//       })
//     )
//   });

//   const isDownloaded = !!downloadData?.[0]?.active;

//   const { isDownloaded: assetsDownloaded, isLoading } = useAssetDownloadStatus(
//     quests?.flatMap((quest) => quest.assets.map((assets) => assets.asset_id)) ??
//       []
//   );

//   if (!currentUser) return null;

//   return (
//     <Pressable
//       className="pb-2 w-full"
//       key={project.id}
//       onPress={() =>
//         router.push({
//           pathname: '/projects/[projectId]/quests',
//           params: { projectId: project.id }
//         })
//       }
//     >
//       <Card className="w-full">
//         <CardHeader className="flex flex-row items-start justify-between">
//           <View>
//             <CardTitle className="flex flex-row items-between justify-between flex-1">
//               <Text className="line-clamp-1 flex flex-row flex-1">
//                 {project.name}
//               </Text>
//             </CardTitle>
//             <CardDescription>
//               {source_language.native_name ?? source_language.english_name} →{' '}
//               {target_language.native_name ?? target_language.english_name}
//             </CardDescription>
//           </View>
//           <DownloadIndicator
//             isDownloaded={isDownloaded && assetsDownloaded}
//             isLoading={isLoading && isDownloaded}
//             onPress={async () => {
//               await downloadService.setProjectDownload(
//                 currentUser.id,
//                 project.id,
//                 !isDownloaded
//               );
//               await queryClient.invalidateQueries({
//                 queryKey: ['isDownloaded', currentUser.id, project.id]
//               });
//             }}
//           />
//         </CardHeader>
//         <CardContent>
//           <Text>Card Content</Text>
//         </CardContent>
//         <CardFooter>
//           <Text>Card Footer</Text>
//         </CardFooter>
//       </Card>
//     </Pressable>
//   );
// };

// const FilterLanguageSelect = ({
//   languages,
//   label,
//   value,
//   onChange
// }: {
//   label: string;
//   languages: Pick<Language, 'id' | 'native_name' | 'english_name'>[];
//   value?: Option;
//   onChange: (option?: Option) => void;
// }) => {
//   const { t } = useTranslation();

//   const defaultOption = { label: t('all'), value: '' };

//   return (
//     <Select
//       defaultValue={defaultOption}
//       value={value}
//       onValueChange={onChange}
//       className="flex gap-2 flex-1"
//     >
//       <Text className="text-muted-foreground">{label}</Text>
//       <SelectTrigger>
//         <SelectValue placeholder={t('all')} className="text-foreground" />
//       </SelectTrigger>
//       <SelectContent>
//         <SelectItem {...defaultOption} key={`${label}-${defaultOption.value}`}>
//           {defaultOption.label}
//         </SelectItem>
//         {languages.map((language) => (
//           <SelectItem
//             key={`${label}-${language.id}`}
//             value={language.id}
//             label={(language.native_name ?? language.english_name)!}
//           >
//             {(language.native_name ?? language.english_name)!}
//           </SelectItem>
//         ))}
//       </SelectContent>
//     </Select>
//   );
// };
