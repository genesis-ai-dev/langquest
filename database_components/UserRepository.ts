import { VersionedRepository, VersionedEntity } from './VersionedRepository';
import * as Crypto from 'expo-crypto';

export interface User extends VersionedEntity {
  username: string;
  uiLanguage: string;
  password?: string;
}

export class UserRepository extends VersionedRepository<User> {
  protected tableName = 'User';
  protected columns = ['username', 'uiLanguage', 'password'];

  async validateCredentials(username: string, password: string): Promise<User | null> {
    return this.withConnection(async (db) => {
      const statement = await db.prepareAsync(`
        SELECT u1.* 
        FROM ${this.tableName} u1
        INNER JOIN (
          SELECT versionChainId, MAX(versionNum) as maxVersion
          FROM ${this.tableName}
          GROUP BY versionChainId
        ) u2 
        ON u1.versionChainId = u2.versionChainId 
        AND u1.versionNum = u2.maxVersion
        WHERE u1.username = $username
      `);

      try {
        const result = await statement.executeAsync({ $username: username });
        const user = await result.getFirstAsync() as User | null;
        
        if (!user?.password) return null;

        const hashedPassword = await this.hashPassword(password);
        return hashedPassword === user.password ? user : null;
      } finally {
        await statement.finalizeAsync();
      }
    });
  }

  async updatePassword(userId: string, newPassword: string, oldPassword?: string): Promise<void> {
    const user = await this.getById(userId);
    if (!user) throw new Error('User not found');
  
    if (oldPassword) {
      // Compare with stored hash
      const hashedOldPassword = await this.hashPassword(oldPassword);
      if (hashedOldPassword !== user.password) {
        throw new Error('Invalid old password');
      }
    }
  
    // Pass raw password - prepareForInsert will hash it
    await this.addVersion(user, { password: newPassword });
  }

  protected override async prepareForInsert(entity: Omit<User, 'id' | 'rev'>): Promise<Omit<User, 'id' | 'rev'>> {
    const prepared = await super.prepareForInsert(entity);
    
    // Hash password if provided
    if (prepared.password) {
      prepared.password = await this.hashPassword(prepared.password);
    }
    
    return prepared;
  }

  protected override async validateForInsert(entity: Partial<User>): Promise<void> {
    // Basic field validation
    if (!entity.username?.trim()) {
      throw new Error('Username is required');
    }
    if (!entity.uiLanguage?.trim()) {
      throw new Error('UI Language is required');
    }
  
    // Check username uniqueness across ALL records
    const allUsers = await this.getAll();
    const existingUser = allUsers.find(user => 
      user.username === entity.username && 
      // If this is a new version of existing user, allow same username
      user.versionChainId !== entity.versionChainId
    );
  
    if (existingUser) {
      throw new Error('Username already exists');
    }
  }

  private async hashPassword(password: string): Promise<string> {
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      password
    );
  }

  protected getDefaultOrderBy(): string {
    return 'username';
  }

  protected getDependencyChecks(id: string): string[] {
    return [
      `SELECT COUNT(*) as count FROM Language WHERE creator = (
        SELECT username FROM ${this.tableName} WHERE id = $id
      )`,
      `SELECT COUNT(*) as count FROM Project WHERE creator = $id`,
      `SELECT COUNT(*) as count FROM AccessCode WHERE creator = $id`
    ];
  }
}