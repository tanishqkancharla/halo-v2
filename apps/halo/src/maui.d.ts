import type {
  ButtonHTMLAttributes,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SVGProps,
} from "react";
import type { StyleElement } from "purse-styles";

type Space = 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16;
type ThemePreference = "system" | "light" | "dark";
type ResolvedTheme = Exclude<ThemePreference, "system">;

export function MauiProvider(props: { children: ReactNode }): ReactNode;

export function useTheme(): {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

export const colors: {
  accent: Record<number, string>;
  accentAlpha: Record<number, string>;
  gray: Record<number, string>;
  grayAlpha: Record<number, string>;
};

export const backgroundColor: {
  app: string;
  element: string;
  elementHover: string;
  elementActive: string;
};

export const radius: {
  sm: StyleElement;
  md: StyleElement;
  lg: StyleElement;
  circle: StyleElement;
};

export const shadow: {
  subtle: StyleElement;
};

export const shadowVars: {
  subtle: string;
};

export function focusRing(
  selector?: string,
  existingShadow?: string,
): StyleElement;

export const spacing: {
  padding: (options: {
    all?: Space;
    x?: Space;
    y?: Space;
    top?: Space;
    right?: Space;
    bottom?: Space;
    left?: Space;
  }) => StyleElement;
  value: (step: Space) => string;
};

export function text(
  size: "2xs" | "xs" | "sm" | "md" | "lg" | "xl",
  weight: 400 | 500 | 600 | 700,
  color: "lowContrast" | "highContrast" | "accent" | "onAccent",
): StyleElement;

export const motion: {
  standard: (...properties: string[]) => StyleElement;
};

export function Badge(
  props: HTMLAttributes<HTMLSpanElement> & { children?: ReactNode },
): ReactNode;

export function Button(
  props: ButtonHTMLAttributes<HTMLButtonElement> & {
    children: ReactNode;
    variant?: "default" | "quiet";
  },
): ReactNode;

export function TextField(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
    onChange?: (value: string) => void;
  },
): ReactNode;

export function Select(props: {
  label?: string;
  selectedKey?: string | number | null;
  onSelectionChange?: (key: string | number) => void;
  children: ReactNode;
}): ReactNode;

export function SelectItem(props: {
  id: string | number;
  children: ReactNode;
}): ReactNode;

type FlexProps = {
  gap?: Space;
  children?: ReactNode;
  alignItems?: CSSProperties["alignItems"];
  style?: CSSProperties;
} & ({ row: true; column?: never } | { column: true; row?: never });

export function Flex(props: FlexProps): ReactNode;
export function Spacer(): ReactNode;
export function H1(props: { children: string }): ReactNode;
export function H2(props: { children: string }): ReactNode;
export function P(props: { children: ReactNode }): ReactNode;

export const Icons: {
  Clock: (props: SVGProps<SVGSVGElement>) => ReactNode;
};
