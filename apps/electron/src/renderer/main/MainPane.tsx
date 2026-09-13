import { Crossfade } from "maui";
import { style, useStyles } from "purse-styles";
import { Route, Switch, useLocation } from "wouter";
import type { SessionSummary } from "@get-halo/shared/rpc";
import { AgentPane, DraftAgentPane } from "./agent/AgentPane.tsx";
import { FilePane } from "./FilePane.tsx";
import { ExtensionPane } from "./ExtensionPane.js";

export function MainPane({ sessions }: { sessions: SessionSummary[] }) {
  const [location] = useLocation();
  const pane = useStyles(fill);

  return (
    <Crossfade direction="left" contentKey={location} className={pane}>
      <Switch>
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

const fill = style({
  minWidth: 0,
  minHeight: 0,
  width: "100%",
  height: "100%",
  "& > *": {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    width: "100%",
    height: "100%",
  },
  "& > * > *": {
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,
    height: "100%",
  },
});
