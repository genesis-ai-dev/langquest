import { eq } from 'drizzle-orm';
import { db } from '../db/database';
import { user } from '../db/drizzleSchema';

export class UserService {
  static async validateCredentials(username: string, password: string) {
    return await db
      .select()
      .from(user)
      .where(eq(user.username, username))
      .then(users => users[0])
      .then(user => user && user.password === password ? user : null);
  }

  static async createUser(userData: {
    username: string;
    password: string;
    rev: number;
    versionChainId: string;
    versionNum: number;
  }) {
    const [newUser] = await db
      .insert(user)
      .values(userData)
      .returning();
    
    return newUser;
  }

  static async findById(id: string) {
    return await db
      .select()
      .from(user)
      .where(eq(user.id, id))
      .then(users => users[0]);
  }
}