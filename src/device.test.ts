import Device from "./device";
import Frame, { Packet } from "./lib/frame";
import { subscribeToEvent } from "./helpers";
import { devices } from "./devices.conf";
import { COMMANDS } from "./lib/constants";

const deviceOpts = devices[0];

describe("device", () => {
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
      })

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
