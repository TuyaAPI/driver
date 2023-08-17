import Device from "./device";
import Frame, { Packet } from "./lib/frame";
import { subscribeToEvent } from "./helpers";
import { devices } from "./devices.conf";
import { COMMANDS } from "./lib/constants";

describe("device v3.3", () => {
  const deviceOpts = devices.filter((d) => d.version === 3.3)[0];
  const device = new Device({ ...deviceOpts, ip: deviceOpts.ip! });
  const packetRecevied = subscribeToEvent<Packet>(device, "packet");
  const dataReceived = subscribeToEvent<Frame>(device, "rawData");
  const stateChanged = subscribeToEvent<unknown>(device, "state-change");

  it("can connect", async () => {
    const connected = subscribeToEvent(device, "connected");
    device.connect({ updateOnConnect: false, enableHeartbeat: false });

    await connected;
  });

  it("receives raw data", async () => {
    let data: Frame;
    device.update();
    do {
      const packet = await packetRecevied;
      data = await dataReceived;
      const { payload, ...meta } = data;
      console.log({
        frame: packet.buffer.toString("base64"),
        meta: JSON.stringify(meta),
        payload: payload.toString("base64"),
        data: payload.toString("utf8"),
      });
    } while (data.command !== COMMANDS.DP_QUERY);

    const json = JSON.parse(data.payload.toString("ascii"));
    console.log("json", json);

    expect(json).toHaveProperty("dps");
  });

  it("receives state change", async () => {
    device.update();
    const data = await stateChanged;
    console.log("state changed", data);
  });
});

describe.only("device v3.4", () => {
  const deviceOpts = devices.filter((d) => d.version === 3.4)[0];
  const device = new Device({ ...deviceOpts, ip: deviceOpts.ip! });

  const packetRecevied = subscribeToEvent<Packet>(device, "packet");
  const rawDataReceived = subscribeToEvent<Frame>(device, "rawData");
  const dataReceived = subscribeToEvent<object>(device, "data");
  const stateChanged = subscribeToEvent<unknown>(device, "state-change");

  it("can connect", async () => {
    const connected = subscribeToEvent(device, "connected");
    device.connect({ updateOnConnect: false, enableHeartbeat: false });

    await connected;
    const packet = await packetRecevied;
    console.log("packet", packet);
  });

  it("receives data", async () => {
    device.update();
    const payload = await dataReceived;
    console.log("payload", payload);

    expect(payload).toHaveProperty("dps");
  });

  it("receives state change", async () => {
    device.update();
    const state = await stateChanged;
    console.log("state", state);

    expect(state).toMatchObject({
      "1": expect.any(Boolean),
    });
  });
});
