/// <reference types="./expectjs" />
import type { Server } from "../..";
import {
  io as ioc,
  ManagerOptions,
  Socket as ClientSocket,
  SocketOptions,
} from "socket.io-client";
import request from "supertest";
import type { AddressInfo } from "node:net";
import type { DefaultEventsMap, EventsMap } from "../../lib/typed-events";

const expect = require("expect.js");
const i = expect.stringify;

// add support for Set/Map
const contain = expect.Assertion.prototype.contain;
expect.Assertion.prototype.contain = function (...args) {
  if (this.obj instanceof Set || this.obj instanceof Map) {
    args.forEach((obj) => {
      this.assert(
        this.obj.has(obj),
        function () {
          return "expected " + i(this.obj) + " to contain " + i(obj);
        },
        function () {
          return "expected " + i(this.obj) + " to not contain " + i(obj);
        },
      );
    });
    return this;
  }
  return contain.apply(this, args);
};

export function createClient<
  CTS extends EventsMap = DefaultEventsMap,
  STC extends EventsMap = DefaultEventsMap,
>(
  io: Server,
  nsp: string = "/",
  opts?: Partial<ManagerOptions & SocketOptions>,
): ClientSocket<STC, CTS> {
  const port = (io.httpServer.address() as AddressInfo).port;
  return ioc(`http://localhost:${port}${nsp}`, opts);
}

export function success(
  done: Function,
  io: Server,
  ...clients: ClientSocket[]
) {
  io.close();
  clients.forEach((client) => client.disconnect());
  done();
}

export function successFn(
  done: () => void,
  sio: Server,
  ...clientSockets: ClientSocket[]
) {
  return () => success(done, sio, ...clientSockets);
}

/**
 * Asserts a condition so that typescript will recognize the assertion!
 *
 * Uses expect's `ok` check on condition
 * @param condition
 */
export function assert(condition: any): asserts condition {
  expect(condition).to.be.ok();
}

export function getPort(io: Server): number {
  return (io.httpServer.address() as AddressInfo).port;
}

export function createPartialDone(count: number, done: (err?: Error) => void) {
  let i = 0;
  return () => {
    if (++i === count) {
      done();
    } else if (i > count) {
      done(new Error(`partialDone() called too many times: ${i} > ${count}`));
    }
  };
}

export function waitFor<T = unknown>(emitter, event) {
  return new Promise<T>((resolve) => {
    emitter.once(event, resolve);
  });
}

// TODO: update superagent as latest release now supports promises
export function eioHandshake(httpServer): Promise<string> {
  return new Promise((resolve) => {
    request(httpServer)
      .get("/socket.io/")
      .query({ transport: "polling", EIO: 4 })
      .end((err, res) => {
        const sid = JSON.parse(res.text.substring(1)).sid;
        resolve(sid);
      });
  });
}

export function eioPush(httpServer, sid: string, body: string): Promise<void> {
  return new Promise((resolve) => {
    request(httpServer)
      .post("/socket.io/")
      .send(body)
      .query({ transport: "polling", EIO: 4, sid })
      .expect(200)
      .end(() => {
        resolve();
      });
  });
}

export function eioPoll(httpServer, sid): Promise<string> {
  return new Promise((resolve) => {
    request(httpServer)
      .get("/socket.io/")
      .query({ transport: "polling", EIO: 4, sid })
      .expect(200)
      .end((err, res) => {
        resolve(res.text);
      });
  });
}
