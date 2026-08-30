import { type Dispatch, type ReactNode, type SetStateAction } from "react";
export type SidebarNavigation = {
    section: string;
    page: string;
};
export declare const SidebarSectionContext: import("react").Context<string | undefined>;
export declare function SidebarNavigationProvider({ children, }: {
    children: ReactNode;
}): import("react").FunctionComponentElement<import("react").ProviderProps<Dispatch<SetStateAction<SidebarNavigation | undefined>> | undefined>>;
export declare function useSidebarNavigation(): SidebarNavigation | undefined;
export declare function useRegisterSidebarNavigation(args: {
    active: boolean;
    page?: string;
}): void;
