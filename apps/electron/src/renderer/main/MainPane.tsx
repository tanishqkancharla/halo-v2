import { Route, Switch, useLocation } from "wouter";
import type { SessionSummary } from "@get-halo/shared/rpc";
import { Crossfade } from "../components/Crossfade.tsx";
import { AgentPane, DraftAgentPane } from "./agent/AgentPane.tsx";
import { FilePane } from "./FilePane.tsx";
import { ExtensionPane } from "./ExtensionPane.js";

export function MainPane({ sessions }: { sessions: SessionSummary[] }) {
  const [location] = useLocation();

  return (
    <Crossfade contentKey={location} direction="left">
      <Switch location={location}>
        <Route path="/extensions/:extensionId">
          {(params) => (
            <ExtensionPane
              extensionId={decodeURIComponent(params.extensionId)}
            />
          )}
        </Route>
        <Route path="/files/*">
          {(params) => <FilePane path={decodeURIComponent(params["*"])} />}
        </Route>
        <Route path="/draft/:draftId">
          {(params) => (
            <DraftAgentPane key={params.draftId} draftId={params.draftId} />
          )}
        </Route>
        <Route path="/sessions/:sessionId">
          {(params) => (
            <AgentPane sessionId={params.sessionId} sessions={sessions} />
          )}
        </Route>
      </Switch>
    </Crossfade>
  );
}
