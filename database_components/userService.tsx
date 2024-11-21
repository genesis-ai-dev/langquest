import { eq } from 'drizzle-orm';
import { db } from '../db/database';
import { user } from '../db/drizzleSchema';
import { hashPassword } from '../utils/passwordUtils';
import { randomUUID } from 'expo-crypto';

export class UserService {
  async validateCredentials(username: string, password: string) {
    const hashedPassword = await hashPassword(password);
    const [foundUser] = await db
      .select()
      .from(user)
      .where(eq(user.username, username));
    
    return foundUser?.password === hashedPassword ? foundUser : null;
  }

  async createNew(data: {
    username: string;
    password: string;
    uiLanguageId: string;
  }) {
    const hashedPassword = await hashPassword(data.password);
    const [newUser] = await db
      .insert(user)
      .values({
        versionChainId: randomUUID(),
        username: data.username,
        password: hashedPassword,
        uiLanguageId: data.uiLanguageId,
        rev: 1,
      })
      .returning();
    
    return newUser;
  }
}

export const userService = new UserService();