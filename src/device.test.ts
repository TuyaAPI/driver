import Device from "./device";
import Frame from "./lib/frame";
import { subscribeToEvent } from "./helpers";
import { devices } from "./devices.conf";
import { COMMANDS } from "./lib/constants";

const deviceOpts = devices[0];

describe("device", () => {
  const device = new Device(deviceOpts);
  const dataReceived = subscribeToEvent<Frame>(device, "rawData");
  const stateChanged = subscribeToEvent<unknown>(device, "state-change");

  it("can connect", async () => {
    const connected = subscribeToEvent(device, "connected");
    device.connect();

    await connected;
  });

  it("receives raw data", async () => {
    let data: Frame;
    do {
      data = await dataReceived;
      console.log("rawData", data);
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
