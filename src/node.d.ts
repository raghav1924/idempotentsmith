/**
 * IdempotentSmith Ambient Node.js 22 Type Definitions
 * Author: Jatin Sharma (https://jatinsh.netlify.app/)
 */

declare namespace NodeJS {
  interface Process {
    argv: string[];
    version: string;
    cwd(): string;
    exit(code?: number): never;
    env: Record<string, string | undefined>;
    platform: string;
    stdout: { write(str: string): boolean };
    stderr: { write(str: string): boolean };
    on(event: string, listener: (...args: any[]) => void): this;
  }
  interface Timeout {}
  interface Immediate {}
}

declare const process: NodeJS.Process;
declare const console: {
  log(...args: any[]): void;
  error(...args: any[]): void;
  warn(...args: any[]): void;
  info(...args: any[]): void;
  table(...args: any[]): void;
};

declare const Buffer: {
  from(str: string | any, encoding?: string): any;
  byteLength(string: string | any, encoding?: string): number;
};

declare function setTimeout(callback: (...args: any[]) => void, ms?: number, ...args: any[]): NodeJS.Timeout;
declare function clearTimeout(timeoutId: NodeJS.Timeout): void;
declare function setInterval(callback: (...args: any[]) => void, ms?: number, ...args: any[]): NodeJS.Timeout;
declare function clearInterval(intervalId: NodeJS.Timeout): void;

declare module 'events' {
  export class EventEmitter {
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
    removeListener(event: string, listener: (...args: any[]) => void): this;
  }
}

declare module 'node:events' {
  export * from 'events';
}

declare module 'http' {
  import { EventEmitter } from 'events';

  export interface IncomingHttpHeaders {
    [header: string]: string | string[] | undefined;
  }

  export interface IncomingMessage extends EventEmitter {
    url?: string;
    method?: string;
    statusCode?: number;
    statusMessage?: string;
    headers: IncomingHttpHeaders;
    on(event: 'data', listener: (chunk: any) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
  }

  export interface ServerResponse extends EventEmitter {
    writeHead(statusCode: number, headers?: Record<string, any>): this;
    setHeader(name: string, value: string | number | readonly string[]): this;
    getHeader(name: string): number | string | string[] | undefined;
    end(chunk?: any, callback?: () => void): this;
  }

  export interface Server extends EventEmitter {
    listen(port: number, callback?: () => void): this;
    listen(port: number, host?: string, callback?: () => void): this;
    close(callback?: (err?: Error) => void): this;
  }

  export function createServer(requestListener?: (req: IncomingMessage, res: ServerResponse) => void): Server;
  export function get(url: any, options?: any, callback?: (res: IncomingMessage) => void): any;
  export function request(url: any, options?: any, callback?: (res: IncomingMessage) => void): any;
  export function request(options: any, callback?: (res: IncomingMessage) => void): any;
}

declare module 'node:http' {
  export * from 'http';
}

declare module 'https' {
  export * from 'http';
}

declare module 'node:https' {
  export * from 'https';
}

declare module 'crypto' {
  export interface Hash {
    update(data: string | any): this;
    digest(encoding?: string): any;
  }
  export function randomBytes(size: number): { toString(encoding: string): string };
  export function randomUUID(): string;
  export function createHash(algorithm: string): Hash;
}

declare module 'node:crypto' {
  export * from 'crypto';
}

declare module 'node:test' {
  export function test(name: string, fn: (t?: any) => void | Promise<void>): void;
  export default test;
}

declare module 'node:assert' {
  export function strictEqual<T>(actual: unknown, expected: T, message?: string | Error): void;
  export function notStrictEqual(actual: unknown, expected: unknown, message?: string | Error): void;
  export function deepStrictEqual<T>(actual: unknown, expected: T, message?: string | Error): void;
  export function ok(value: unknown, message?: string | Error): void;
  const assert: {
    strictEqual: typeof strictEqual;
    notStrictEqual: typeof notStrictEqual;
    deepStrictEqual: typeof deepStrictEqual;
    ok: typeof ok;
  };
  export default assert;
}
