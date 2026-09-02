import { SidebarItem, SidebarSection } from "@halo/plugin-sdk/view";
import type { SessionSummary } from "@get-halo/shared/rpc";

export function SessionsSection({ sessions }: { sessions: SessionSummary[] }) {
  if (sessions.length === 0) return undefined;
  return (
    <SidebarSection label="Sessions">
      {sessions.map((session) => {
        const title = session.title ? session.title : session.sessionId;
        return (
          <SidebarItem
            key={session.sessionId}
            id={`session:${session.sessionId}`}
            href={`/sessions/${session.sessionId}`}
            pageTitle={title}
          >
            {title}
          </SidebarItem>
        );
      })}
    </SidebarSection>
  );
}
