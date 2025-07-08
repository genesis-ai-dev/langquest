import { useAuth } from '@/contexts/AuthProvider';
import { language, profile_project_link } from '@/db/drizzleSchema';
import { system } from '@/db/powersync/system';
import type { Language } from '@/hooks/db/useLanguages';
import type { Project } from '@/hooks/db/useProjects';
import { useQuery } from '@powersync/tanstack-react-query';
import { eq } from 'drizzle-orm';
import type { ReactNode } from 'react';
import React, { createContext, useContext } from 'react';

interface UserMembership {
  project_id: string;
  membership: 'owner' | 'member';
  active: boolean;
}

interface SessionCacheContextType {
  // Languages
  languages: Language[] | undefined;
  isLanguagesLoading: boolean;
  getLanguageById: (id: string) => Language | undefined;

  // User Memberships
  userMemberships: UserMembership[] | undefined;
  isUserMembershipsLoading: boolean;
  getUserMembership: (projectId: string) => UserMembership | undefined;
  isUserOwner: (projectId: string) => boolean;
  isUserMember: (projectId: string) => boolean;

  // Project Cache (basic info for inheritance)
  cachedProjects: Map<string, Project>;
  setCachedProject: (project: Project) => void;
  getCachedProject: (projectId: string) => Project | undefined;
}

const SessionCacheContext = createContext<SessionCacheContextType | undefined>(
  undefined
);

export function SessionCacheProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const { db, supabaseConnector } = system;

  // Cache all languages for the session
  const { data: languages, isLoading: isLanguagesLoading } = useQuery({
    queryKey: ['session-languages'],
    queryFn: async () => {
      try {
        // Try online first
        const { data, error } = await supabaseConnector.client
          .from('language')
          .select('*')
          .eq('active', true)
          .overrideTypes<Language[]>();

        if (!error) return data;

        // Fallback to offline
        return await db.query.language.findMany({
          where: eq(language.active, true)
        });
      } catch (error) {
        console.error('Error fetching session languages:', error);
        // Final fallback to offline
        return await db.query.language.findMany({
          where: eq(language.active, true)
        });
      }
    },
    staleTime: 60 * 60 * 1000, // 1 hour - languages rarely change
    gcTime: 2 * 60 * 60 * 1000 // 2 hours
  });

  // Cache user memberships for the session
  const { data: userMemberships, isLoading: isUserMembershipsLoading } =
    useQuery({
      queryKey: ['session-user-memberships', currentUser?.id],
      queryFn: async () => {
        if (!currentUser?.id) return [];

        try {
          // Try online first
          const { data, error } = await supabaseConnector.client
            .from('profile_project_link')
            .select('project_id, membership, active')
            .eq('profile_id', currentUser.id)
            .eq('active', true)
            .overrideTypes<UserMembership[]>();

          if (!error) return data;

          // Fallback to offline
          return (await db.query.profile_project_link.findMany({
            where: eq(profile_project_link.profile_id, currentUser.id),
            columns: {
              project_id: true,
              membership: true,
              active: true
            }
          })) as UserMembership[];
        } catch (error) {
          console.error('Error fetching user memberships:', error);
          // Final fallback to offline
          return (await db.query.profile_project_link.findMany({
            where: eq(profile_project_link.profile_id, currentUser.id),
            columns: {
              project_id: true,
              membership: true,
              active: true
            }
          })) as UserMembership[];
        }
      },
      enabled: !!currentUser?.id,
      staleTime: 10 * 60 * 1000, // 10 minutes - memberships don't change often
      gcTime: 30 * 60 * 1000 // 30 minutes
    });

  // Project cache for inheritance (in-memory)
  const [cachedProjects, setCachedProjectsState] = React.useState<
    Map<string, Project>
  >(new Map());

  // Helper functions
  const getLanguageById = React.useCallback(
    (id: string): Language | undefined => {
      return languages?.find((lang) => lang.id === id);
    },
    [languages]
  );

  const getUserMembership = React.useCallback(
    (projectId: string): UserMembership | undefined => {
      return userMemberships?.find(
        (membership) => membership.project_id === projectId && membership.active
      );
    },
    [userMemberships]
  );

  const isUserOwner = React.useCallback(
    (projectId: string): boolean => {
      const membership = getUserMembership(projectId);
      return membership?.membership === 'owner';
    },
    [getUserMembership]
  );

  const isUserMember = React.useCallback(
    (projectId: string): boolean => {
      const membership = getUserMembership(projectId);
      return !!membership; // Either owner or member
    },
    [getUserMembership]
  );

  const setCachedProject = React.useCallback((project: Project) => {
    setCachedProjectsState((prev) => new Map(prev.set(project.id, project)));
  }, []);

  const getCachedProject = React.useCallback(
    (projectId: string): Project | undefined => {
      return cachedProjects.get(projectId);
    },
    [cachedProjects]
  );

  const contextValue: SessionCacheContextType = {
    // Languages
    languages,
    isLanguagesLoading,
    getLanguageById,

    // User Memberships
    userMemberships,
    isUserMembershipsLoading,
    getUserMembership,
    isUserOwner,
    isUserMember,

    // Project Cache
    cachedProjects,
    setCachedProject,
    getCachedProject
  };

  return (
    <SessionCacheContext.Provider value={contextValue}>
      {children}
    </SessionCacheContext.Provider>
  );
}

export function useSessionCache(): SessionCacheContextType {
  const context = useContext(SessionCacheContext);
  if (context === undefined) {
    throw new Error(
      'useSessionCache must be used within a SessionCacheProvider'
    );
  }
  return context;
}

// Convenience hooks for specific session data
export function useSessionLanguages() {
  const { languages, isLanguagesLoading, getLanguageById } = useSessionCache();
  return { languages, isLanguagesLoading, getLanguageById };
}

export function useSessionMemberships() {
  const {
    userMemberships,
    isUserMembershipsLoading,
    getUserMembership,
    isUserOwner,
    isUserMember
  } = useSessionCache();

  return {
    userMemberships,
    isUserMembershipsLoading,
    getUserMembership,
    isUserOwner,
    isUserMember
  };
}

export function useSessionProjects() {
  const { cachedProjects, setCachedProject, getCachedProject } =
    useSessionCache();
  return { cachedProjects, setCachedProject, getCachedProject };
}
