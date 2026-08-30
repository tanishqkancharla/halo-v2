import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

export type SidebarNavigation = {
  section: string;
  page: string;
};

const SidebarNavigationContext = createContext<SidebarNavigation | undefined>(
  undefined,
);
const SetSidebarNavigationContext = createContext<
  Dispatch<SetStateAction<SidebarNavigation | undefined>> | undefined
>(undefined);
export const SidebarSectionContext = createContext<string | undefined>(
  undefined,
);

export function SidebarNavigationProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [navigation, setNavigation] = useState<SidebarNavigation | undefined>();
  return createElement(
    SetSidebarNavigationContext.Provider,
    { value: setNavigation },
    createElement(
      SidebarNavigationContext.Provider,
      { value: navigation },
      children,
    ),
  );
}

export function useSidebarNavigation() {
  return useContext(SidebarNavigationContext);
}

export function useRegisterSidebarNavigation(args: {
  active: boolean;
  page?: string;
}) {
  const section = useContext(SidebarSectionContext);
  const setNavigation = useContext(SetSidebarNavigationContext);

  useEffect(() => {
    if (!args.active || args.page === undefined || section === undefined) {
      return undefined;
    }
    if (setNavigation === undefined) return undefined;
    setNavigation({ section, page: args.page });
    return () => setNavigation(undefined);
  }, [args.active, args.page, section, setNavigation]);
}
