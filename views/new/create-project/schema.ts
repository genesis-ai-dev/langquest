import { templateOptions } from '@/db/constants';
import type { LocalizationKey } from '@/services/localizations';
import { z } from 'zod';

type Translate = (
  key: LocalizationKey,
  params?: Record<string, string | number>
) => string;

export type ProjectTemplate = (typeof templateOptions)[number];

function createProjectCoreFields(t: Translate) {
  const selectLanguage = t('selectLanguage');

  return {
    target_languoid_id: z.string().trim().min(1, selectLanguage),
    name: z
      .string({ error: t('nameRequired') })
      .trim()
      .min(1, t('nameRequired')),
    description: z
      .string()
      .trim()
      .max(1024, t('descriptionTooLong', { max: 1024 }))
      .optional(),
    private: z.boolean(),
    visible: z.boolean()
  };
}

const createProjectDetailsStepPick = {
  name: true,
  description: true,
  private: true,
  visible: true
} as const;

const createProjectLanguageStepPickFia = {
  target_languoid_id: true,
  source_languoid_id: true
} as const;

const createProjectLanguageStepPickOther = {
  target_languoid_id: true
} as const;

function createProjectSubmitUnionMembers(t: Translate) {
  const core = createProjectCoreFields(t);
  const shared = {
    target_languoid_id: core.target_languoid_id,
    name: core.name,
    description: core.description,
    private: core.private,
    visible: core.visible
  };

  return {
    fia: z.object({
      template: z.literal('fia'),
      source_languoid_id: z
        .string()
        .trim()
        .min(1, t('fiaContentLanguage')),
      ...shared
    }),
    unstructured: z.object({
      template: z.literal('unstructured'),
      ...shared
    }),
    bible: z.object({
      template: z.literal('bible'),
      ...shared
    })
  } as const;
}

export function createProjectTemplateStepSchema(t: Translate) {
  return z.object({
    template: z.enum(templateOptions, { error: t('selectTemplate') })
  });
}

export function createProjectDetailsStepSchema(t: Translate) {
  return createProjectSubmitUnionMembers(t)
    .unstructured.pick(createProjectDetailsStepPick)
    .extend({
      private: z.boolean().default(true),
      visible: z.boolean().default(true)
    });
}

export function createProjectSubmitSchema(t: Translate) {
  const members = createProjectSubmitUnionMembers(t);
  return z.discriminatedUnion('template', [
    members.fia,
    members.unstructured,
    members.bible
  ]);
}

export type CreateProjectTemplateStepValues = z.infer<
  ReturnType<typeof createProjectTemplateStepSchema>
>;

export type CreateProjectDetailsStepFormValues = z.input<
  ReturnType<typeof createProjectDetailsStepSchema>
>;

export type CreateProjectDetailsStepValues = z.output<
  ReturnType<typeof createProjectDetailsStepSchema>
>;

export type CreateProjectSubmitValues = z.infer<
  ReturnType<typeof createProjectSubmitSchema>
>;

export function createProjectLanguageStepSchema(
  t: Translate,
  template: ProjectTemplate
) {
  const members = createProjectSubmitUnionMembers(t);

  if (template === 'fia') {
    return members.fia.pick(createProjectLanguageStepPickFia);
  }

  return members[template].pick(createProjectLanguageStepPickOther);
}

type CreateProjectSubmitMembers = ReturnType<
  typeof createProjectSubmitUnionMembers
>;

export type FiaLanguageStepValues = Pick<
  z.infer<CreateProjectSubmitMembers['fia']>,
  keyof typeof createProjectLanguageStepPickFia
>;

export type NonFiaLanguageStepValues = Pick<
  z.infer<CreateProjectSubmitMembers['unstructured']>,
  keyof typeof createProjectLanguageStepPickOther
>;

export type CreateProjectLanguageStepValues =
  | FiaLanguageStepValues
  | NonFiaLanguageStepValues;

const createProjectFieldStep = {
  template: 1,
  target_languoid_id: 2,
  source_languoid_id: 2
} as const;

export function getCreateProjectErrorStep(
  field: string | undefined
): 1 | 2 | 3 {
  if (!field) return 3;
  return createProjectFieldStep[field as keyof typeof createProjectFieldStep] ?? 3;
}
