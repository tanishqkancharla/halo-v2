import { type AriaRole, type ReactNode } from "react";
export declare const sidebarPadding: import("purse-styles").StyleElement;
export declare const sidebarSection: import("purse-styles").StyleElement;
type SidebarSectionProps = {
    label: string;
    children: ReactNode;
    className?: string;
    role?: AriaRole;
};
export declare function SidebarSection(props: SidebarSectionProps): import("react").DetailedReactHTMLElement<{
    className: string;
}, HTMLElement>;
export {};
