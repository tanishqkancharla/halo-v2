export function requestWindowPort(args: {
  request: string;
  provide: string;
}): Promise<MessagePort> {
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (event.data !== args.provide) return;
      window.removeEventListener("message", onMessage);
      resolve(event.ports[0]!);
    };
    window.addEventListener("message", onMessage);
    window.postMessage(args.request, "*");
  });
}
