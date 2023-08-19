// https://github.com/jasonacox/tinytuya

import { EventEmitter } from "events";
import { Socket } from "net";
import debug from "debug";
import Messenger from "./lib/messenger";
import Frame, { Packet } from "./lib/frame";
import { COMMANDS, SUPPORTED_PROTOCOLS } from "./lib/constants";
import { DeviceError } from "./lib/helpers";
import * as crypto from "crypto";
import { encrypt, hmac } from "./lib/crypto";

interface Device {
  readonly ip: string;
  readonly port: number;
  readonly key: string;
  readonly id: string;
  readonly gwId: string;
  readonly version: number;
  connected: boolean;
}

export type DeviceOptions = {
  ip: string;
  port?: number;
  key: string | Buffer;
  id: string;
  gwId?: string;
  version?: number;
  heartbeatInterval?: number;
};

export type DataPoint = string | number | boolean | unknown;
export type DataPointSet = Record<string, DataPoint>;

export type DeviceEvents =
  | "connected"
  | "disconnected"
  | "error"
  | "packet"
  | "rawData"
  | "data"
  | "state-change";

class Device {
  public messenger: Messenger;

  private readonly _socket: Socket;

  private _state: DataPointSet;

  private _lastHeartbeat: Date;

  private readonly _heartbeatInterval: number;

  private updateOnConnect: boolean = true;
  private enableHeartbeat: boolean = true;

  private events = new EventEmitter();
  private _tmpLocalKey?: Buffer;
  private _currentSequenceN: number = 0;
  private sessionKey?: Buffer;

  constructor({
    ip,
    id,
    gwId = id,
    key,
    version = 3.3,
    port = 6668,
    heartbeatInterval = 1000,
  }: DeviceOptions) {
    // Check protocol version
    if (!SUPPORTED_PROTOCOLS.includes(version)) {
      throw new Error(`Protocol version ${version} is unsupported.`);
    }

    // Copy arguments
    Object.assign(this, { ip, port, key, id, gwId, version });

    // Create messenger
    this.messenger = new Messenger({ key, version });

    // Init with empty state
    this._state = {};

    // Starts disconnecteds
    this.connected = false;

    // Init socket
    this._socket = new Socket();

    // Set last heartbeat
    this._lastHeartbeat = new Date();

    // Set up heartbeating interval
    this._heartbeatInterval = heartbeatInterval;

    // Set up socket handlers
    this._socket.on("connect", this._handleSocketConnect.bind(this));
    this._socket.on("close", this._handleSocketClose.bind(this));
    this._socket.on("data", this._handleSocketData.bind(this));
    this._socket.on("error", this._handleSocketError.bind(this));
  }

  connect({
    updateOnConnect,
    enableHeartbeat,
  }: {
    updateOnConnect?: boolean;
    enableHeartbeat?: boolean;
  } = {}): void {
    if (this.connected) {
      // Already connected, don't have to do anything
      return;
    }
    this.updateOnConnect = updateOnConnect ?? this.updateOnConnect;
    this.enableHeartbeat = enableHeartbeat ?? this.enableHeartbeat;
    // Connect to device
    this._log("Connecting...");
    this._socket.connect(this.port, this.ip);

    // TODO: we should probably set a timeout on connect. Otherwise we just rely
    // on TCP to retry sending SYN packets.
  }

  disconnect(): void {
    if (this.connected) {
      this._socket.destroy();
    }
  }

  getState(): DataPointSet {
    return this._state;
  }

  setState(dps: DataPointSet): void {
    function payload33({ gwId, devId }: { gwId: string; devId: string }) {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const payload = {
        gwId,
        devId,
        uid: "",
        t: timestamp,
        dps,
      };
      const command = COMMANDS.CONTROL;
      return { payload, command };
    }

    function payload34({ gwId, devId }: { gwId: string; devId: string }) {
      const timestamp = Math.round(new Date().getTime() / 1000);
      const payload = {
        data: {
          ctype: 0,
          gwId,
          devId,
          uid: "",
          dps,
        },
        protocol: 5,
        t: timestamp,
      };
      const command = COMMANDS.CONTROL_NEW;
      return { payload, command };
    }

    const { payload, command } =
      this.version <= 3.3
        ? payload33({ gwId: this.gwId, devId: this.id })
        : payload34({ gwId: this.gwId, devId: this.id });

    const frame: Frame = {
      version: this.version,
      command,
      payload: Buffer.from(JSON.stringify(payload)),
      sequenceN: ++this._currentSequenceN,
    };

    this.send(this.messenger.encode(frame));
  }

  update(): void {
    const payload = {
      gwId: this.gwId,
      devId: this.id,
      t: Math.round(new Date().getTime() / 1000).toString(),
      dps: {},
      uid: this.id,
    };
    const command =
      this.version >= 3.4 ? COMMANDS.DP_QUERY_NEW : COMMANDS.DP_QUERY;
    const frame: Frame = {
      version: this.version,
      command,
      payload: Buffer.from(JSON.stringify(payload)),
      sequenceN: ++this._currentSequenceN,
    };

    const request = this.messenger.encode(frame);
    this.send(request);
  }

  send(packet: Packet): void {
    this._log("Sending:", packet.buffer.toString("hex"));

    this._socket.write(packet.buffer);
  }

  private _recursiveHeartbeat(): void {
    if (
      new Date().getTime() - this._lastHeartbeat.getTime() >
      this._heartbeatInterval * 2
    ) {
      console.log("Heartbeat timeout - disconnecting");
      // Heartbeat timeout
      // Should we emit error on timeout?
      return this.disconnect();
    }

    const frame: Frame = {
      version: this.version,
      command: COMMANDS.HEART_BEAT,
      payload: Buffer.alloc(0),
    };

    this.send(this.messenger.encode(frame));

    setTimeout(this._recursiveHeartbeat.bind(this), this._heartbeatInterval);
  }

  private requestSessionKey() {
    // Negotiate session key
    // 16 bytes random + 32 bytes hmac
    try {
      this._tmpLocalKey = crypto.randomBytes(16);
      const packet = this.messenger.encode({
        payload: this._tmpLocalKey,
        command: COMMANDS.SESS_KEY_NEG_START,
        version: this.version,
        sequenceN: ++this._currentSequenceN,
      });

      this._log("Protocol 3.4: Negotiate Session Key - Send Msg 0x03");
      this.send(packet);
    } catch (error) {
      this._log("Error binding key for protocol 3.4: " + error);
    }

    return;
  }

  private _handleSocketConnect(): void {
    this.connected = true;

    this._log("Connected.");
    this._currentSequenceN = 0;

    if (this.version >= 3.4) {
      this.requestSessionKey();
    } else {
      this.afterConnect();
    }
  }

  private afterConnect() {
    this.emit("connected");

    this._lastHeartbeat = new Date();

    if (this.enableHeartbeat) {
      // Start heartbeat pings
      this._recursiveHeartbeat();
    }

    if (this.updateOnConnect) {
      // Fetch default property
      this.update();
    }
  }

  private _handleSocketClose(): void {
    this.connected = false;

    this._log("Disconnected.");

    this.emit("disconnected");
  }

  private _handleSocketData(data: Buffer): void {
    this._log("Received:", data.toString("hex"));

    const packets = this.messenger.splitPackets(data);
    packets.forEach((packet) => {
      try {
        this.emit("packet", packet);
        const frame = this.messenger.decode(packet.buffer);

        // Emit Frame as data event
        this.emit("rawData", frame);

        this._handleFrame(frame);
      } catch (error) {
        this.emit("error", error);
      }
    });
  }
  private _handleFrame(frame: Frame) {
    if (frame.returnCode !== 0) {
      //console.log("Non-zero return code:", frame.returnCode);
      this.emit(
        "error",
        new DeviceError(
          `non-zero return code (${frame.returnCode}) ${frame.payload.toString(
            "ascii"
          )}`
        )
      );
    }

    if (frame.command === COMMANDS.HEART_BEAT) {
      this._lastHeartbeat = new Date();
      return;
    }

    if (frame.command == COMMANDS.SESS_KEY_NEG_RES) {
      if (!this._tmpLocalKey) {
        throw new Error("No local key set");
      }

      if (this.sessionKey) {
        this._log("Session key accepted");
      }
      // 16 bytes _tmpRemoteKey and hmac on _tmpLocalKey
      const _tmpRemoteKey = frame.payload.subarray(0, 16);
      const localHmac = frame.payload.subarray(16, 16 + 32);
      this._log(
        "Protocol 3.4: Local Random Key: " + this._tmpLocalKey.toString("hex")
      );
      this._log(
        "Protocol 3.4: Remote Random Key: " + _tmpRemoteKey.toString("hex")
      );

      const calcLocalHmac = hmac(this.key, this._tmpLocalKey).toString("hex");
      const expLocalHmac = localHmac.toString("hex");
      if (expLocalHmac !== calcLocalHmac) {
        const err = new Error(
          `HMAC mismatch(keys): expected ${expLocalHmac}, was ${calcLocalHmac}. ${frame.payload.toString(
            "hex"
          )}`
        );
        this.emit("error", err);

        return;
      }

      // Send response 0x05
      const buffer = this.messenger.encode({
        version: this.version,
        payload: hmac(this.key, _tmpRemoteKey),
        command: COMMANDS.SESS_KEY_NEG_FINISH,
        sequenceN: ++this._currentSequenceN,
      });

      this.send(buffer);

      // Calculate session key
      this.sessionKey = Buffer.from(this._tmpLocalKey);
      for (let i = 0; i < this._tmpLocalKey.length; i++) {
        this.sessionKey[i] = this._tmpLocalKey[i] ^ _tmpRemoteKey[i];
      }

      this.sessionKey = encrypt(this.key, this.sessionKey, this.version);
      this._log(
        "Protocol 3.4: Session Key: " + this.sessionKey.toString("hex")
      );
      this._log("Protocol 3.4: Initialization done");

      this.messenger = new Messenger({
        key: this.sessionKey,
        version: this.version,
      });

      this.afterConnect();

      return;
    }

    let parsedData;

    try {
      parsedData = JSON.parse(frame.payload.toString("ascii")) as object;
      this.emit("data", parsedData);
    } catch (_) {
      // Not JSON data
      return;
    }

    if ("dps" in parsedData) {
      // State update event
      this._state = { ...this._state, ...(parsedData as { dps: object }).dps };
      this.emit("state-change", this._state);
    }
  }

  private _handleSocketError(error: Error): void {
    this._log("Error from socket:", error);
  }

  private _log(...message: any[]): void {
    const d = debug("@tuyapi/driver");

    d(`${this.ip}:`, ...message);
  }

  emit(event: "connected" | "disconnected"): boolean;
  emit(event: "error", error: unknown): boolean;
  emit(event: "rawData", frame: Frame): boolean;
  emit(event: "data", message: object): boolean;
  emit(event: "state-change", state: DataPointSet): boolean;
  emit(event: "packet", packet: Packet): boolean;

  emit(eventName: DeviceEvents, ...args: any[]): boolean {
    return this.events.emit(eventName, ...args);
  }

  on(event: "connected" | "disconnected", handler: () => void): void;
  on(event: "error", handler: (error: unknown) => void): void;
  on(event: "rawData", handler: (frame: Frame) => void): void;
  on(event: "data", handler: (message: object) => void): void;
  on(event: "state-change", handler: (state: DataPointSet) => void): void;
  on(event: "packet", handler: (packet: Packet) => void): void;

  on(event: DeviceEvents, listener: (message: any) => void) {
    this.events.on(event, listener);
  }
}

export default Device;
