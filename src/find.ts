import { EventEmitter } from "events";
import * as dgram from "dgram";
import Messenger from "./lib/messenger";

import { createHash } from "crypto";

import { UDP_KEY } from "./lib/constants";

const UNIVERSAL_KEY = createHash("md5")
  .update(UDP_KEY, "utf8")
  .digest();

export type DiscoveryMessage = {
  ip: string;
  gwId: string;
  active?: number;
  ablilty?: number;
  encrypt?: boolean;
  productKey: string;
  version: string;
};


type FindEvents = 'broadcast'| 'rawBroadcastPlain' | 'rawBroadcastEncrypted' | 'error';
export class Find {
  private readonly _messenger: Messenger;
  private readonly _listener: dgram.Socket;
  private readonly _listenerEncrypted: dgram.Socket;
  private readonly events = new EventEmitter();
    
  constructor(version: number = 3.3) {
    

    this._messenger = new Messenger({ key: UNIVERSAL_KEY, version });

    this._listener = dgram.createSocket({ type: "udp4", reuseAddr: true });
    this._listenerEncrypted = dgram.createSocket({
      type: "udp4",
      reuseAddr: true,
    });

    this._listener.on("message", this._broadcastHandler.bind(this));

    this._listenerEncrypted.on(
      "message",
      this._broadcastHandlerEncrypted.bind(this)
    );
  }

  start(): void {
    this._listener.bind(6666);
    this._listenerEncrypted.bind(6667);
  }

  stop(): void {
    this._listener.close();
    this._listener.removeAllListeners();
    this._listenerEncrypted.close();
    this._listenerEncrypted.removeAllListeners();
  }

  public on(event: 'broadcast', listener: (message: DiscoveryMessage) => void): void;
  public on(event: 'rawBroadcastPlain', listener: (message: Buffer) => void): void;
  public on(event: 'rawBroadcastEncrypted', listener: (message: Buffer) => void): void;
  public on(event: 'error', listener: (error: unknown) => void): void;

  public on(eventName: FindEvents, listener: (...args: any[]) => void) {
    this.events.on(eventName, listener);
  }

  emit(event: 'broadcast', message: DiscoveryMessage): boolean;
  emit(event: 'rawBroadcastEncrypted', message: Buffer): boolean;
  emit(event: 'rawBroadcastPlain', message: Buffer): boolean;
  emit(event: 'error', error: unknown): boolean;

  emit(eventName: FindEvents, ...args: any[]): boolean {
    return this.events.emit(eventName, ...args);
  }

  private _broadcastHandler(message: Buffer): void {
    try {
      this.emit("rawBroadcastPlain", message);

      const frame = this._messenger.decode(message);
      //console.log(frame);
      const body = frame.payload.toString("ascii");
      console.log(body);
      const payload = JSON.parse(body) as DiscoveryMessage;

      this.emit("broadcast", payload);
    } catch (error) {
      console.log(error);
      // It's possible another application is
      // using ports 6666 or 6667, so we shouldn't
      // throw on failure.
      this.emit("error", error);
    }
  }

  private _broadcastHandlerEncrypted(message: Buffer): void {
    try {
      this.emit("rawBroadcastEncrypted", message);

      const frame = this._messenger.decode(message);
      const body = frame.payload.toString("ascii");
      console.log(body);
      const payload = JSON.parse(body);

      this.emit("broadcast", payload);
    } catch (error) {
      console.log(error);
      // It's possible another application is
      // using ports 6666 or 6667, so we shouldn't
      // throw on failure.
      this.emit("error", error);
    }
  }
}
