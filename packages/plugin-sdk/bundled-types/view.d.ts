export type ReactNode = unknown;
type JsxElement = { readonly __haloJsx?: true };

export type FlexProps = {
  column?: boolean;
  row?: boolean;
  gap?: number;
  children?: ReactNode;
};

export function Flex(props: FlexProps): JsxElement;
export function Gap(props: { size?: number; children?: ReactNode }): JsxElement;
export function H1(props: { children?: ReactNode }): JsxElement;
export function H2(props: { children?: ReactNode }): JsxElement;
export function H3(props: { children?: ReactNode }): JsxElement;
export function H4(props: { children?: ReactNode }): JsxElement;
export function P(props: { children?: ReactNode }): JsxElement;
export function Button(props: {
  children?: ReactNode;
  onClick?: () => void;
}): JsxElement;
export function Divider(props?: Record<string, never>): unknown;
export function Spacer(props?: Record<string, never>): unknown;
export function Avatar(props: unknown): unknown;
export function Badge(props: unknown): unknown;
export function Blockquote(props: unknown): unknown;
export function Checkbox(props: unknown): unknown;
export function CodeBlock(props: unknown): unknown;
export function CollectionPopover(props: unknown): unknown;
export function Dialog(props: unknown): unknown;
export function FuzzyString(props: unknown): unknown;
export function Icons(props: unknown): unknown;
export function Label(props: unknown): unknown;
export function Li(props: unknown): unknown;
export function ListBox(props: unknown): unknown;
export function ListBoxItem(props: unknown): unknown;
export function MauiProvider(props: unknown): unknown;
export function Menu(props: unknown): unknown;
export function MenuItem(props: unknown): unknown;
export function MenuTrigger(props: unknown): unknown;
export function NumberField(props: unknown): unknown;
export function Ol(props: unknown): unknown;
export function Overlay(props: unknown): unknown;
export function Padding(props: unknown): unknown;
export function Panel(props: unknown): unknown;
export function Prose(props: unknown): unknown;
export function QuietTextField(props: unknown): unknown;
export function RadioOption(props: unknown): unknown;
export function RadioOptionGroup(props: unknown): unknown;
export function SearchField(props: unknown): unknown;
export function Select(props: unknown): unknown;
export function SelectItem(props: unknown): unknown;
export function Slider(props: unknown): unknown;
export function Table(props: unknown): unknown;
export function TableBody(props: unknown): unknown;
export function TableCell(props: unknown): unknown;
export function TableHead(props: unknown): unknown;
export function TableHeaderCell(props: unknown): unknown;
export function TableRow(props: unknown): unknown;
export function TextField(props: unknown): unknown;
export function Tooltip(props: unknown): unknown;
export function Ul(props: unknown): unknown;

export const DARK_THEME: unknown;
export const avatar: unknown;
export const background: unknown;
export const backgroundColor: unknown;
export const baseTextStyle: unknown;
export const border: unknown;
export const borderColor: unknown;
export const colors: unknown;
export const flex: unknown;
export const flexItem: unknown;
export const focusRing: unknown;
export const fontFamily: unknown;
export const grid: unknown;
export const gridItem: unknown;
export const icon: unknown;
export const iconSizeValues: unknown;
export const labelText: unknown;
export const monospace: unknown;
export const motion: unknown;
export const motionDurationMs: unknown;
export const motionEasing: unknown;
export const motionStreamDurationMs: unknown;
export const navigationItem: unknown;
export const prose: unknown;
export const proseHtml: unknown;
export const proseMaxWidth: unknown;
export const proseRhythm: unknown;
export const proseStreamingMarkers: unknown;
export const radius: unknown;
export const shadow: unknown;
export const shadowVars: unknown;
export const sizing: unknown;
export const spacing: unknown;
export const text: unknown;
export const themeFoucScript: unknown;
export const themeStorageKey: unknown;
export function useButton(...args: unknown[]): unknown;
export function useProseSize(...args: unknown[]): unknown;
export function useTheme(...args: unknown[]): unknown;
export const visuallyHidden: unknown;

export function style(...args: unknown[]): unknown;
export function useStyles(...args: unknown[]): unknown;

export function Link(props: {
  href: string;
  children?: ReactNode;
  className?: string;
}): JsxElement;
export function Redirect(props: { to: string }): JsxElement;
export function Route(props: {
  path: string;
  component?: (props: unknown) => unknown;
  children?: ReactNode;
}): JsxElement;
export function Router(props: { children?: ReactNode }): JsxElement;
export function Switch(props: { children?: ReactNode }): JsxElement;
export function useLocation(): unknown;
export function useParams(): unknown;
export function useRoute(pattern: string): unknown;

export function SidebarItem(props: {
  href: string;
  children?: ReactNode;
  icon?: unknown;
  trailing?: ReactNode;
  className?: string;
}): JsxElement;

export function SidebarSection(props: {
  label: string;
  children?: ReactNode;
  className?: string;
  role?: string;
}): JsxElement;

export const sidebarPadding: unknown;
export const sidebarSection: unknown;

export type PluginRuntimeValue = {
  pluginId: string;
  server?: unknown;
};

export function PluginRuntimeProvider(args: {
  pluginId: string;
  server?: unknown;
  children: ReactNode;
}): unknown;

export function usePluginServer<T = unknown>(): T;
