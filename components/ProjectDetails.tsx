import type { project } from '@/db/drizzleSchema';
import { languoid, project_language_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import { borderRadius, colors, fontSizes, spacing } from '@/styles/theme';
import { useHybridData } from '@/views/new/useHybridData';
import { Icon } from '@/components/ui/icon';
import { Languages, Info } from 'lucide-react-native';
import { toCompilableQuery } from '@powersync/drizzle-driver';
import { and, eq } from 'drizzle-orm';
import { default as React } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Project = typeof project.$inferSelect;
type Languoid = typeof languoid.$inferSelect;

interface ProjectDetailsProps {
  project: Project;
  onClose: () => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({
  project,
  onClose
}) => {
  // Fetch project source languoids from project_language_link
  const { data: sourceLanguoids = [] } = useHybridData<
    Pick<Languoid, 'id' | 'name'>,
    Languoid
  >({
    dataType: 'project-source-languoids',
    queryKeyParams: [project.id],
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          id: languoid.id,
          name: languoid.name
        })
        .from(project_language_link)
        .innerJoin(languoid, eq(project_language_link.languoid_id, languoid.id))
        .where(
          and(
            eq(project_language_link.project_id, project.id),
            eq(project_language_link.language_type, 'source')
          )
        )
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project_language_link')
        .select('languoid:languoid_id(id, name)')
        .eq('project_id', project.id)
        .eq('language_type', 'source')
        .not('languoid_id', 'is', null)
        .overrideTypes<{ languoid: Languoid }[]>();
      if (error) throw error;
      return data.map((row) => row.languoid).filter(Boolean);
    },
    transformCloudData: (lang) => ({
      id: lang.id,
      name: lang.name
    })
  });

  // Fetch target languoid from project_language_link
  const { data: targetLanguoidArr = [] } = useHybridData<
    Pick<Languoid, 'id' | 'name'>,
    Languoid
  >({
    dataType: 'project-target-languoid',
    queryKeyParams: [project.id],
    offlineQuery: toCompilableQuery(
      system.db
        .select({
          id: languoid.id,
          name: languoid.name
        })
        .from(project_language_link)
        .innerJoin(languoid, eq(project_language_link.languoid_id, languoid.id))
        .where(
          and(
            eq(project_language_link.project_id, project.id),
            eq(project_language_link.language_type, 'target')
          )
        )
        .limit(1)
    ),
    cloudQueryFn: async () => {
      const { data, error } = await system.supabaseConnector.client
        .from('project_language_link')
        .select('languoid:languoid_id(id, name)')
        .eq('project_id', project.id)
        .eq('language_type', 'target')
        .not('languoid_id', 'is', null)
        .limit(1)
        .overrideTypes<{ languoid: Languoid }[]>();
      if (error) throw error;
      return data.map((row) => row.languoid).filter(Boolean);
    },
    transformCloudData: (lang) => ({
      id: lang.id,
      name: lang.name
    })
  });

  const targetLanguoid = targetLanguoidArr[0];

  return (
    <View style={styles.overlay}>
      <TouchableOpacity style={styles.closeArea} onPress={onClose} />
      <View style={styles.modal}>
        <Text style={styles.title}>{project.name}</Text>

        <View style={styles.infoRow}>
          <Icon as={Languages} size={20} className="text-foreground" />
          <Text style={styles.infoText}>
            {sourceLanguoids.length
              ? sourceLanguoids
                  .map((l) => l.name)
                  .filter(Boolean)
                  .join(', ')
              : '—'}{' '}
            → {targetLanguoid?.name || '—'}
          </Text>
        </View>

        {project.description && (
          <View style={styles.infoRow}>
            <Icon as={Info} size={20} className="text-foreground" />
            <Text style={styles.infoText}>{project.description}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  closeArea: {
    ...StyleSheet.absoluteFillObject
  },
  modal: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    padding: spacing.large,
    width: '80%',
    maxHeight: '80%'
  },
  title: {
    fontSize: fontSizes.xlarge,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.medium
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.medium
  },
  infoText: {
    fontSize: fontSizes.medium,
    color: colors.text,
    paddingHorizontal: spacing.small
  },
  exploreButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    padding: spacing.medium,
    alignItems: 'center',
    marginTop: spacing.large
  },
  exploreButtonText: {
    color: colors.buttonText,
    fontSize: fontSizes.medium,
    fontWeight: 'bold'
  }
});
