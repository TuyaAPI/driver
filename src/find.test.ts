import { createHash } from "crypto";
import { Find, DiscoveryMessage } from "./find";
import Messenger from "./lib/messenger";
import { devices } from "./devices.conf";
import { createPromise } from "./helpers";
import Device from "./device";

const UDP_KEY = "yGAdlopoPVldABfn";
const UDP_HASHED_KEY = createHash("md5")
  .update(UDP_KEY, "utf8")
  .digest();

describe("find", () => {
  let find: Find;
  beforeEach(() => {
    find = new Find();
  });
  afterEach(() => {
    try {
      find.stop();
    } catch (err) {}
  });

  it("broadcastEncrypted", async () => {
    const { promise, resolve } = createPromise();
    find.on("rawBroadcastEncrypted", (message) => {
      try {
        console.log(`broadcastEncrypted: ${message.toString("base64")}.`);
        const messenger = new Messenger({ key: UDP_HASHED_KEY });
        const decoded = messenger.decode(message);
        const { payload, ...meta } = decoded;
        console.log({
          frame: message.toString("base64"),
          meta: JSON.stringify(meta),
          payload: payload.toString("base64"),
          data: payload.toString("utf8"),
        });
        try {
          const data = JSON.parse(payload.toString("ascii"));
          resolve(data);
        } catch (err) {
          //console.log(err);
        }
      } catch (err) {
        console.error(err);
      }
    });
    find.start();

    await promise;
  });

  it("broadcast", async () => {
    const { promise, resolve } = createPromise();
    find.on("broadcast", (message) => {
      try {
        console.log("broadcast", message);
        try {
          resolve(message);
        } catch (err) {
          //console.log(err);
        }
      } catch (err) {
        console.error(err);
      }
    });
    find.start();

    await promise;
  });
});

describe("device list", () => {
  const find = new Find();
  const { promise: allFound, resolve: resolveFound } = createPromise();
  const { promise: allQueried, resolve: resloveQueried } = createPromise();
  const found: Record<string, Device> = {};
  let toFind = [...devices];
  let toQuery = [...devices];

  find.on("broadcast", (message: DiscoveryMessage) => {
    const deviceConfig = devices.find((device) => device.id === message.gwId);
    if (!deviceConfig) {
      console.log(`unknown device ${message.gwId}`);
      return;
    }
    console.log(
      `found ${message.gwId} at ${message.ip}, ${toFind.length} left`
    );
    console.log(message);

    const dev = new Device({
      ...deviceConfig,
      ip: message.ip,
      version: Number.parseFloat(message.version),
    });

    found[message.gwId] = dev;

    dev.connect({ enableHeartbeat: false, updateOnConnect: true });
    dev.on("state-change", (data) => {
      toQuery = toQuery.filter((device) => device.id !== message.gwId);
      if (toQuery.length === 0) {
        resloveQueried(found);
      }
    });
    //dev.update();

    toFind = toFind.filter((device) => device.id !== message.gwId);
    if (toFind.length === 0) {
      resolveFound(found);
    }
  });

  it("finds all devices", async () => {
    find.start();
    await allFound;
  });

  it("queries all devices", async () => {
    const timeout = new Promise((resolve) => setTimeout(resolve, 9000));
    const finished = await Promise.race([allQueried, timeout]);
    if (toQuery.length > 0) {
      const missingState = toQuery;
      console.log("missing state for", missingState);
    }

    console.log(
      Object.entries(found).map(
        ([id, dev]) => dev.getState() || `no state for ${id}`
      )
    );
    expect(toQuery).toEqual([]);
  });
});
