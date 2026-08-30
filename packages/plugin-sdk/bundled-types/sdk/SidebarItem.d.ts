import { type ComponentType, type ReactNode, type SVGProps } from "react";
type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
type SidebarItemProps = {
    href: string;
    children: ReactNode;
    icon?: IconComponent;
    trailing?: ReactNode;
    className?: string;
};
export declare function SidebarItem(props: SidebarItemProps): import("react").DetailedReactHTMLElement<{
    className: string;
    role: "listitem";
}, HTMLElement>;
export {};
