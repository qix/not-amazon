declare module "sql.js" {
  interface Database {
    run(sql: string, params?: (string | number | null | Uint8Array)[]): void;
    exec(sql: string, params?: (string | number | null | Uint8Array)[]): QueryExecResult[];
    export(): Uint8Array;
    close(): void;
  }

  interface QueryExecResult {
    columns: string[];
    values: (string | number | null | Uint8Array)[][];
  }

  interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
  }

  export type { Database, QueryExecResult, SqlJsStatic };

  export default function initSqlJs(config?: Record<string, unknown>): Promise<SqlJsStatic>;
}
