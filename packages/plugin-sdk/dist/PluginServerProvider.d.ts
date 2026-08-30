import type { AnyRouter, RouterClient } from "@orpc/server";
import * as errore from "errore";
import { type ReactNode } from "react";
export type PluginServerValue = {
    pluginId: string;
    server?: RouterClient<AnyRouter>;
};
export declare const PluginServerProviderContext: import("react").Context<PluginServerValue | undefined>;
export declare function PluginServerProvider(args: {
    pluginId: string;
    server?: RouterClient<AnyRouter>;
    children: ReactNode;
}): import("react").FunctionComponentElement<import("react").ProviderProps<PluginServerValue | undefined>>;
declare const PluginServerMissingError_base: errore.FactoryTaggedErrorClass<"PluginServerMissingError", "usePluginServer must run inside a Halo plugin view", Error>;
export declare class PluginServerMissingError extends PluginServerMissingError_base {
}
export declare function usePluginServer<T extends AnyRouter>(): RouterClient<T>;
export {};
