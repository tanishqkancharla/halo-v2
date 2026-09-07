import { SidebarItem, SidebarSection } from "@halo/plugin-sdk/view";
import { Text } from "maui";
import { useExtensionsQuery, useWorkspaceQuery } from "../api/ApiProvider.tsx";

export function ExtensionsSection() {
  const workspace = useWorkspaceQuery().data;
  const extensions = useExtensionsQuery(workspace);

  if (extensions.isError) {
    return (
      <SidebarSection label="Extensions">
        <Text role="alert">{extensions.error.message}</Text>
      </SidebarSection>
    );
  }
  if (extensions.data === undefined || extensions.data.length === 0)
    return undefined;

  return (
    <SidebarSection label="Extensions">
      {extensions.data.map((extension) => (
        <SidebarItem
          key={extension.id}
          id={`extension:${extension.id}`}
          href={`/extensions/${encodeURIComponent(extension.id)}`}
          pageTitle={extension.id}
        >
          {extension.id}
        </SidebarItem>
      ))}
    </SidebarSection>
  );
}
