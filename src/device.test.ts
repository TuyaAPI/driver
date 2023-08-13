import Device from "./device";
import Frame from "./lib/frame";

const deviceOpts = {
  ip: "192.168.1.61",
  id: "bfbe514d26008475bd3o1r",
  key: "d1b4fdb900ec83d4",
  version: 3.3
};
function createPromise<T>() {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let resolve: (arg0: T) => void = () => {};
  let reject: (arg0: unknown) => void = () => {};

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function subscribeToEvent<T>(device: Device, event: string) {
  const { promise, resolve, reject } = createPromise<T>();
  device.on(event, (data) => {
    resolve(data as T);
  });
  device.on("error", (err) => {
    reject(err);
  });
  device.on("disconnected", () => {
    reject("disconnected");
  });
  
  return promise;
}

describe("device", () => {
  const device = new Device(deviceOpts);
  const dataReceived = subscribeToEvent<Frame>(device, "rawData");

  it("can connect", async () => {
    const { promise, resolve: resolveFn } = createPromise();
    device.on("connected", () => {
      console.log("connected");
      resolveFn(true);
    });
    device.connect();

    await promise;
  });

  it("receives raw data", async () => {
    const data = await dataReceived;
    console.log("rawData", data);

    const json = JSON.parse(data.payload.toString("ascii"));
    console.log("json", json);

    expect(json).toHaveProperty("dps");
  });
});
