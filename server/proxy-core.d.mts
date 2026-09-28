import type { IncomingMessage, ServerResponse } from 'node:http';

export declare const PROXY_PATH: string;
export declare function handleProxy(req: IncomingMessage, res: ServerResponse): Promise<void>;
