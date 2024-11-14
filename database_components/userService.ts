import { eq } from 'drizzle-orm';
import { db } from '../db/database';
import { user } from '../db/drizzleSchema';
import { hashPassword } from '../utils/passwordUtils';

export class UserService {
  static async validateCredentials(username: string, password: string) {
    const hashedPassword = await hashPassword(password);
    console.log('hashedPassword', hashedPassword);
    return await db
      .select()
      .from(user)
      .where(eq(user.username, username))
      .then(users => users[0])
      .then(user => user && user.password === hashedPassword ? user : null);
  }

  static async createUser(userData: {
    username: string;
    password: string;
    rev: number;
    versionChainId: string;
    versionNum: number;
  }) {
    const hashedPassword = await hashPassword(userData.password);
    const [newUser] = await db
      .insert(user)
      .values({
        ...userData,
        password: hashedPassword
      })
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