import Device from "./device";

const deviceOpts = {
  ip: "192.168.1.61",
  id: "bfbe514d26008475bd3o1r",
  key: "d1b4fdb900ec83d4",
  version: 3.3
};
function createPromise() {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let resolveFn: (arg0: unknown) => void = () => {};
  let rejectFn: (arg0: unknown) => void = () => {};

  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return { promise, resolveFn, rejectFn };
}

describe("device", () => {
  const device = new Device(deviceOpts);
  const {
    promise: dataReceived,
    resolveFn: resolveData,
    rejectFn: rejectData,
  } = createPromise();
  device.on("data", (data) => {
    resolveData(data);
  });
  device.on("error", (err) => {
    console.error(err);
    rejectData(err);
  });
  device.on("disconnected", () => {
    console.log("disconnected");
    rejectData("disconnected");
  });
  it("can connect", async () => {
    const { promise, resolveFn } = createPromise();
    device.on("connected", () => {
      console.log("connected");
      resolveFn(true);
    });
    device.connect();

    await promise;
  });

  it("receives data", async () => {
    const data = await dataReceived;
    console.log("data", data);
  });
});
