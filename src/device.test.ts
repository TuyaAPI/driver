import Device from "./device";
import Frame, { Packet } from "./lib/frame";
import { subscribeToEvent } from "./helpers";
import { devices } from "./devices.conf";
import { COMMANDS } from "./lib/constants";

describe("device v3.3", () => {
  const deviceOpts = devices.filter((d) => d.version === 3.3)[0];
  const device = new Device({ ...deviceOpts, ip: deviceOpts.ip! });
  const [packets, packetRecevied] = subscribeToEvent<Packet>(device, "packet");
  const [data, dataReceived] = subscribeToEvent<Frame>(device, "rawData");
  const [states, stateChanged] = subscribeToEvent<unknown>(device, "state-change");
  device.on("packet", (packet) => {
    console.log("packet", packet);
  });

  it("can connect", async () => {
    const [_, connected] = subscribeToEvent(device, "connected");
    device.connect({ updateOnConnect: false, enableHeartbeat: false });

    await connected();
  });

  it("receives raw data", async () => {
    let data: Frame;
    device.update();
    do {
      const packet = await packetRecevied();
      data = await dataReceived();
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
    const data = await stateChanged();
    console.log("state changed", data);
  });

  it("can change state", async () => {
    const prev = device.getState();
    // const primary = prev[1];
    // const value = primary === 'open' ? 'close' : 'open';
    // const newState = { 1: value };

    const newState = { 7: !prev[7]}; // backlight (probably)
    
    console.log("newState", newState);
    device.setState(newState);
    console.log("states", states);
    
    // first, no change
    const state1 = await stateChanged();
    
    device.update();
    const state = await stateChanged();

    console.log("state", state);

    expect(state).toMatchObject(newState);
  });
});


describe("device v3.4", () => {
  const deviceOpts = devices.filter((d) => d.version === 3.4)[0];
  const device = new Device({ ...deviceOpts, ip: deviceOpts.ip! });

  device.on("packet", (packet) => {
    console.log("packet", packet);
  });
  const [packets, packetRecevied] = subscribeToEvent<Packet>(device, "packet");
  const [data, dataReceived] = subscribeToEvent<object>(device, "data");
  const [states, stateChanged] = subscribeToEvent<unknown>(device, "state-change");

  it("can connect", async () => {
    const [_, connected] = subscribeToEvent(device, "connected");
    device.connect({ updateOnConnect: false, enableHeartbeat: false });

    await connected();
    const packet = await packetRecevied();
    console.log("packet", packet);
  });

  it("receives data", async () => {
    device.update();
    const payload = await dataReceived();
    console.log("payload", payload);

    expect(payload).toHaveProperty("dps");
  });

  it("receives state change", async () => {
    device.update();
    const state = await stateChanged();
    console.log("state", state);

    expect(state).toMatchObject({
      "1": expect.any(Boolean),
    });
  });

  it("can change state", async () => {
    const prev = device.getState();
    const newState = { 1: !prev[1] };
    
    console.log("newState", newState);
    device.setState(newState);
    console.log("states", states);
    
    const state1 = await stateChanged();

    device.update();
    // then, change!
    const state = await stateChanged();

    console.log("state", state);

    expect(state).toMatchObject(newState);
  });
});


/*

options.data.toString()
'{"data":{"ctype":0,"devId":"bfbee61e344c952b34gfia","gwId":"bfbee61e344c952b34gfia","uid":"","dps":{"1":true}},"protocol":5,"t":1692426805}'
payload.toString("hex")

'332e340000000000000000000000007b2264617461223a7b226374797065223a302c226465764964223a2262666265653631653334346339353262333467666961222c2267774964223a2262666265653631653334346339353262333467666961222c22756964223a22222c22647073223a7b2231223a747275657d7d2c2270726f746f636f6c223a352c2274223a313639323432363830357d060606060606'

sessionKey.toString('hex')
'30bc1e8957ec28a2f70122d8c7cb326c'

encrypted.toString('hex')
'4f76d6bef9a7076a0f29c3fd6ecc137baa95fbfd70ca73916b8855798221457afd2c7ba1e6f354d777de4b2c44f3f16fd258d4ed09ffc99307630f9cb6c4da3fd6e8db2d202b65ebd08c3d6f70bcd8d2d258d4ed09ffc99307630f9cb6c4da3f3942e295e85c26ddf1bac04e0cd25a20f7448944d5e74bfb5450739cd1751f8e21563306a2a49d1d97dc75020659dc45b8f0f24f958da8b9de768fdbea13ea63'

data 332e340000000000000000000000007b2264617461223a7b226374797065223a302c226465764964223a2262666265653631653334346339353262333467666961222c2267774964223a2262666265653631653334346339353262333467666961222c22756964223a22222c22647073223a7b2231223a747275657d7d2c2270726f746f636f6c223a352c2274223a313639323432363830357d060606060606

encrypted 4f76d6bef9a7076a0f29c3fd6ecc137baa95fbfd70ca73916b8855798221457afd2c7ba1e6f354d777de4b2c44f3f16fd258d4ed09ffc99307630f9cb6c4da3fd6e8db2d202b65ebd08c3d6f70bcd8d2d258d4ed09ffc99307630f9cb6c4da3f3942e295e85c26ddf1bac04e0cd25a20f7448944d5e74bfb5450739cd1751f8e21563306a2a49d1d97dc75020659dc45b8f0f24f958da8b9de768fdbea13ea63

buffer.toString("hex")
'000055aa0000001c0000000d000000c44f76d6bef9a7076a0f29c3fd6ecc137baa95fbfd70ca73916b8855798221457afd2c7ba1e6f354d777de4b2c44f3f16fd258d4ed09ffc99307630f9cb6c4da3fd6e8db2d202b65ebd08c3d6f70bcd8d2d258d4ed09ffc99307630f9cb6c4da3f3942e295e85c26ddf1bac04e0cd25a20f7448944d5e74bfb5450739cd1751f8e21563306a2a49d1d97dc75020659dc45b8f0f24f958da8b9de768fdbea13ea6373a36bd6dfa964afe710f65f9273fdee49de0cd078b30cbb6996a177dd9c89490000aa55'
*/