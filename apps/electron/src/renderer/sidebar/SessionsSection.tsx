import { SidebarItem, SidebarSection } from "@halo/plugin-sdk/view";
import type { SessionSummary } from "@get-halo/shared/rpc";
import { useRoute } from "wouter";

export function SessionsSection({ sessions }: { sessions: SessionSummary[] }) {
  const [isDraft, draftParams] = useRoute("/draft/:draftId");
  const [isSaved, savedParams] = useRoute("/sessions/:sessionId");
  const rows = sessionRows({
    sessions,
    draftId: isDraft ? draftParams.draftId : undefined,
    openSessionId: isSaved ? savedParams.sessionId : undefined,
  });
  if (rows.length === 0) return undefined;
  return (
    <SidebarSection label="Sessions">
      {rows.map((row) => (
        <SidebarItem
          key={row.key}
          id={row.id}
          href={row.href}
          pageTitle={row.title}
        >
          {row.title}
        </SidebarItem>
      ))}
    </SidebarSection>
  );
}

type SessionRow = {
  key: string;
  id: string;
  href: string;
  title: string;
};

function sessionRows(args: {
  sessions: SessionSummary[];
  draftId: string | undefined;
  openSessionId: string | undefined;
}): SessionRow[] {
  const rows = args.sessions.map((session) => ({
    key: session.sessionId,
    id: `session:${session.sessionId}`,
    href: `/sessions/${session.sessionId}`,
    title: session.title ? session.title : "New session",
  }));

  if (args.draftId !== undefined) {
    return [
      {
        key: `draft:${args.draftId}`,
        id: `draft:${args.draftId}`,
        href: `/draft/${args.draftId}`,
        title: "New session",
      },
      ...rows,
    ];
  }

  if (
    args.openSessionId !== undefined &&
    rows.every((row) => row.key !== args.openSessionId)
  ) {
    return [
      {
        key: args.openSessionId,
        id: `session:${args.openSessionId}`,
        href: `/sessions/${args.openSessionId}`,
        title: "New session",
      },
      ...rows,
    ];
  }

  return rows;
}
