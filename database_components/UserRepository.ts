import { BaseRepository } from './BaseRepository';
import { User } from '@/utils/databaseService';

export class UserRepository extends BaseRepository<User> {
  protected tableName = 'User';
  protected columns = ['username', 'uiLanguage', 'password'];

  // Validate required fields and business rules before insert
  protected async validateForInsert(entity: Partial<User>): Promise<void> {
    if (!entity.username?.trim()) {
      throw new Error('Username is required');
    }
    
    if (!entity.uiLanguage?.trim()) {
      throw new Error('UI Language is required');
    }

    // Check username uniqueness among latest versions
    const db = await this.getDatabase();
    try {
      const statement = await db.prepareAsync(`
        SELECT COUNT(*) as count
        FROM User u1
        INNER JOIN (
          SELECT versionChainId, MAX(versionNum) as maxVersion
          FROM User
          GROUP BY versionChainId
        ) u2 
        ON u1.versionChainId = u2.versionChainId 
        AND u1.versionNum = u2.maxVersion
        WHERE u1.username = $username
      `);
      
      try {
        const result = await statement.executeAsync({ 
          $username: entity.username 
        });
        const { count } = await result.getFirstAsync() as { count: number };
        if (count > 0) {
          throw new Error('Username already exists');
        }
      } finally {
        await statement.finalizeAsync();
      }
    } finally {
      await db.closeAsync();
    }
  }

  // Default ordering for user lists
  protected getDefaultOrderBy(): string {
    return 'username';
  }

  // SQL queries to check if this user is referenced anywhere
  protected getDependencyChecks(id: string): string[] {
    return [
      // Check if user is creator of any languages
      `SELECT COUNT(*) as count 
       FROM Language 
       WHERE creator = (SELECT username FROM User WHERE id = '${id}')`,
      
      // Check if user is creator of any projects
      `SELECT COUNT(*) as count 
       FROM Project 
       WHERE creator = '${id}'`,
       
      // Check if user is creator of any access codes
      `SELECT COUNT(*) as count 
       FROM AccessCode 
       WHERE creator = '${id}'`
    ];
  }

  async getLatestUsers(): Promise<User[]> {
    // This can now use the base class method
    return this.getLatest();
  }
}