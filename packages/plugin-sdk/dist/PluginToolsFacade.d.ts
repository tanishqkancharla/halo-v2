export type PluginToolResult = {
    ok: true;
    data: unknown;
    http?: {
        status: number;
        headers: Record<string, string>;
    };
} | {
    ok: false;
    error: {
        code: string;
        message: string;
        status?: number;
        details?: unknown;
        retryable?: boolean;
    };
};
export type PluginToolValue = string | number | boolean | PluginToolInput | readonly PluginToolValue[] | null;
export type PluginToolInput = {
    readonly [key: string]: PluginToolValue;
};
export type PluginToolsFacade = {
    readonly [segment: string]: PluginToolsFacade;
} & ((input: PluginToolInput) => Promise<PluginToolResult>);
type PluginToolsFacadeOptions = {
    authorize: (path: string) => Promise<boolean | Error>;
    invoke: (path: string, input: PluginToolInput) => Promise<PluginToolResult | Error>;
};
export declare function createPluginToolsFacade(options: PluginToolsFacadeOptions): PluginToolsFacade;
export {};
