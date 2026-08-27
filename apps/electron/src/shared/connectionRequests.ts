export type ConnectionRequest = {
  client: string;
  clientOwner: "org" | "user";
  owner: "org" | "user";
  connectionName: string;
  integration: string;
  template: string;
  identityLabel: string | undefined;
  newConnection: boolean | undefined;
};
