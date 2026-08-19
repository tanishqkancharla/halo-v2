declare module "electron-squirrel-startup" {
  const started: boolean;
  export default started;
}

declare module "*?raw" {
  const content: string;
  export default content;
}
