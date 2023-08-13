import { EventEmitter } from "events";
import { Socket } from "net";
import debug from "debug";
import Messenger from "./lib/messenger";
import Frame from "./lib/frame";
import { COMMANDS, SUPPORTED_PROTOCOLS } from "./lib/constants";
import { DeviceError } from "./lib/helpers";

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

class Device extends EventEmitter implements Device {
  private readonly _messenger: Messenger;

  private readonly _socket: Socket;

  private _state: Record<string, string | number | boolean | unknown>;

  private _lastHeartbeat: Date;

  private readonly _heartbeatInterval: number;

  constructor({
    ip,
    id,
    gwId = id,
    key,
    version = 3.3,
    port = 6668,
    heartbeatInterval = 1000,
  }: DeviceOptions) {
    super();

    // Check protocol version
    if (!SUPPORTED_PROTOCOLS.includes(version)) {
      throw new Error(`Protocol version ${version} is unsupported.`);
    }

    // Copy arguments
    Object.assign(this, { ip, port, key, id, gwId, version });

    // Create messenger
    this._messenger = new Messenger({ key, version });

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

  connect(): void {
    if (this.connected) {
      // Already connected, don't have to do anything
      return;
    }

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

  get(): object {
    return this._state;
  }

  set(dps: object): void {
    const timestamp = Math.round(new Date().getTime() / 1000);

    const frame = new Frame();

    frame.command = COMMANDS.CONTROL;
    frame.setPayload({
      gwId: this.gwId,
      devId: this.id,
      uid: "",
      t: timestamp,
      dps,
    });

    frame.encrypt(this.key);

    this.send(this._messenger.encode(frame));
  }

  update(): void {
    const frame = new Frame();

    frame.command = COMMANDS.DP_QUERY;
    frame.setPayload({
      gwId: this.gwId,
      devId: this.id,
    });

    const request = this._messenger.encode(frame);

    this.send(request);
  }

  send(frame: Frame): void {
    this._log("Sending:", frame.packet.toString("hex"));

    this._socket.write(frame.packet);
  }

  private _recursiveHeartbeat(): void {
    if (
      new Date().getTime() - this._lastHeartbeat.getTime() >
      this._heartbeatInterval * 2
    ) {
      // Heartbeat timeout
      // Should we emit error on timeout?
      return this.disconnect();
    }

    const frame = new Frame();

    frame.command = COMMANDS.HEART_BEAT;

    this.send(this._messenger.encode(frame));

    setTimeout(this._recursiveHeartbeat.bind(this), this._heartbeatInterval);
  }

  private _handleSocketConnect(): void {
    this.connected = true;

    this._log("Connected.");

    this.emit("connected");

    this._lastHeartbeat = new Date();

    // Fetch default property
    this.update();

    // Start heartbeat pings
    this._recursiveHeartbeat();
  }

  private _handleSocketClose(): void {
    this.connected = false;

    this._log("Disconnected.");

    this.emit("disconnected");
  }

  private _handleSocketData(data: Buffer): void {
    this._log("Received:", data.toString("hex"));

    const packets = this._messenger.splitPackets(data);
    packets.forEach((packet) => {
      try {
        const frame = this._messenger.decode(packet);

        // Emit Frame as data event
        this.emit("rawData", frame);

        // Check return code
        if (frame.returnCode !== 0) {
          // As a non-zero return code should not occur during normal operation, we throw here instead of emitting an error
          throw new DeviceError(frame.payload.toString("ascii"));
        }

        // Check if it's a heartbeat packet
        if (frame.command === COMMANDS.HEART_BEAT) {
          this._lastHeartbeat = new Date();
          return;
        }

        // Atempt to convert to JSON
        let parsedData;

        try {
          parsedData = JSON.parse(frame.payload.toString("ascii"));
          this.emit("data", parsedData);
        } catch (_) {
          // Not JSON data
          return;
        }

        if ("dps" in parsedData) {
          // State update event
          this._state = { ...this._state, ...parsedData.dps };
          this.emit("state-change", this._state);
        }
      } catch (error) {
        this.emit("error", error);
      }
    });
  }

  private _handleSocketError(error: Error): void {
    this._log("Error from socket:", error);
  }

  private _log(...message: any[]): void {
    const d = debug("@tuyapi/driver");

    d(`${this.ip}:`, ...message);
  }
}

export default Device;
