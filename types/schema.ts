import { type InferSelectModel } from 'drizzle-orm';
import { language, user } from '../db/drizzleSchema';

export type Language = InferSelectModel<typeof language>;
export type User = InferSelectModel<typeof user>;