import type { AnyRouter, RouterClient } from "@orpc/server";
import { Route, Switch } from "wouter";
import type { SessionSummary } from "@repo/shared/rpc";
import type { LoadedPluginView } from "../evaluatePluginView.js";
import { AgentPane, DraftAgentPane } from "./agent/AgentPane.tsx";
import { FilePane } from "./FilePane.tsx";
import { MissingPluginPane, PluginPane } from "./PluginPane.tsx";

export function MainPane({
  sessions,
  pluginViews,
  pluginServers,
}: {
  sessions: SessionSummary[];
  pluginViews: LoadedPluginView[];
  pluginServers: Record<string, RouterClient<AnyRouter>>;
}) {
  return (
    <Switch>
      <Route path="/files/*">
        {(params) => <FilePane path={decodeURIComponent(params["*"])} />}
      </Route>
      <Route path="/draft/:draftId">
        {(params) => <DraftAgentPane draftId={params.draftId} />}
      </Route>
      <Route path="/sessions/:sessionId">
        {(params) => (
          <AgentPane sessionId={params.sessionId} sessions={sessions} />
        )}
      </Route>
      <Route path="/plugins/:pluginId" nest>
        {(params) => {
          const plugin = pluginViews.find(
            (item) => item.id === params.pluginId,
          );
          if (plugin === undefined || plugin.Routes === undefined) {
            return <MissingPluginPane pluginId={params.pluginId} />;
          }
          return (
            <PluginPane plugin={plugin} server={pluginServers[plugin.id]} />
          );
        }}
      </Route>
    </Switch>
  );
}
