// Lightweight WebSocket mock helper for Cypress tests
// Usage in tests:
// cy.window().then((win) => {
//   const ws = setupWebSocketMock(win);
//   // ws.sendToApp({ type: 'online_users', users: ['alice'] });
//   // const sent = ws.getSent();
// });

export function setupWebSocketMock(win: Window) {
  const events: Array<{type: string, data: any}> = [];
  const sent: string[] = [];
  let onopen: ((this: WebSocket, ev: Event) => any) | null = null;
  let onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null = null;
  let onclose: ((this: WebSocket, ev: CloseEvent) => any) | null = null;
  let onerror: ((this: WebSocket, ev: Event) => any) | null = null;

  class MockWebSocket {
    readyState = 1; // OPEN
    url: string;
    constructor(url: string) {
      this.url = url;
      setTimeout(() => {
        if (onopen) onopen.call(this as any, new Event('open'));
      }, 10);
    }
    send(data: string) {
      sent.push(data);
    }
    close() {
      this.readyState = 3; // CLOSED
      if (onclose) onclose.call(this as any, new CloseEvent('close'));
    }
    // getters/setters for event handlers
    set onopen_cb(fn: any) { onopen = fn; }
    set onmessage_cb(fn: any) { onmessage = fn; }
    set onclose_cb(fn: any) { onclose = fn; }
    set onerror_cb(fn: any) { onerror = fn; }
  }

  // Replace global WebSocket with our mock
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const OriginalWebSocket = win.WebSocket;
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  win.WebSocket = MockWebSocket as any;

  function sendToApp(obj: any) {
    const msg = typeof obj === 'string' ? obj : JSON.stringify(obj);
    if (onmessage) {
      onmessage.call(null as any, new MessageEvent('message', {data: msg}));
    }
  }

  function getSent() { return sent.slice(); }

  function restore() {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    win.WebSocket = OriginalWebSocket;
  }

  return { sendToApp, getSent, restore };
}
