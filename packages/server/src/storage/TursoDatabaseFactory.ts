import { Database } from "@tursodatabase/database/compat";
import type {
  SqliteDatabase,
  SqliteDatabaseFactory,
  SqliteStatement,
} from "@earendil-works/pi-session-backend-sqlite-node";

// Pi's database boundary requires synchronous methods and thrown errors.
export class TursoDatabaseFactory implements SqliteDatabaseFactory {
  async open(path: string) {
    return this.wrap(new Database(path));
  }

  async openExisting(path: string) {
    return this.wrap(new Database(path, { fileMustExist: true }));
  }

  async openReadOnly(path: string) {
    const database = new Database(path, {
      fileMustExist: true,
      readonly: true,
    });
    // Turso 0.7.2 ignores readonly while another connection to the file is open.
    database.exec("PRAGMA query_only = 1");
    return this.wrap(database);
  }

  private wrap(database: Database): SqliteDatabase {
    return {
      exec(sql) {
        database.exec(sql);
      },
      prepare(sql): SqliteStatement {
        // SAFETY: Turso's synchronous statements match Pi's interface; Pi owns the SQL row types.
        return database.prepare(sql) as SqliteStatement;
      },
      transaction<T>(callback: () => T): T {
        // SAFETY: Turso 0.7.2 exposes .immediate at runtime but omits it from its types.
        const transaction = database.transaction(callback) as (() => T) & {
          immediate(): T;
        };
        return transaction.immediate();
      },
      close() {
        database.close();
      },
    };
  }
}
