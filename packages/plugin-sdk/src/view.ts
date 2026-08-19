import type { AnyRouter, RouterClient } from "@orpc/server";
import * as errore from "errore";
import { createContext, createElement, type ReactNode } from "react";

export type * from "maui";
// Maui also exports Link and Switch. Plugin views use wouter's.
export {
  Avatar,
  Badge,
  Blockquote,
  Button,
  Checkbox,
  CodeBlock,
  CollectionPopover,
  DARK_THEME,
  Dialog,
  Divider,
  Flex,
  FuzzyString,
  Gap,
  H1,
  H2,
  H3,
  H4,
  Icons,
  Label,
  Li,
  ListBox,
  ListBoxItem,
  MauiProvider,
  Menu,
  MenuItem,
  MenuTrigger,
  NumberField,
  Ol,
  Overlay,
  P,
  Padding,
  Panel,
  Prose,
  QuietTextField,
  RadioOption,
  RadioOptionGroup,
  SearchField,
  Select,
  SelectItem,
  Slider,
  Spacer,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextField,
  Tooltip,
  Ul,
  avatar,
  background,
  backgroundColor,
  baseTextStyle,
  border,
  borderColor,
  colors,
  flex,
  flexItem,
  focusRing,
  fontFamily,
  grid,
  gridItem,
  icon,
  iconSizeValues,
  labelText,
  monospace,
  motion,
  motionDurationMs,
  motionEasing,
  motionStreamDurationMs,
  navigationItem,
  prose,
  proseHtml,
  proseMaxWidth,
  proseRhythm,
  proseStreamingMarkers,
  radius,
  shadow,
  shadowVars,
  sizing,
  spacing,
  text,
  themeFoucScript,
  themeStorageKey,
  useButton,
  useProseSize,
  useTheme,
  visuallyHidden,
} from "maui";
export { style, useStyles } from "purse-styles";
export {
  Link,
  Redirect,
  Route,
  Router,
  Switch,
  useLocation,
  useParams,
  useRoute,
} from "wouter";

export type PluginRuntimeValue = {
  pluginId: string;
};

const PluginRuntimeContext = createContext<PluginRuntimeValue | undefined>(
  undefined,
);

export function PluginRuntimeProvider(args: {
  pluginId: string;
  children: ReactNode;
}) {
  return createElement(
    PluginRuntimeContext.Provider,
    { value: { pluginId: args.pluginId } },
    args.children,
  );
}

export class PluginRuntimeMissingError extends errore.createTaggedError({
  name: "PluginRuntimeMissingError",
  message: "usePluginServer must run inside a Halo plugin view",
}) {}

export function usePluginServer<S extends AnyRouter>(): RouterClient<S> {
  throw new PluginRuntimeMissingError();
}
