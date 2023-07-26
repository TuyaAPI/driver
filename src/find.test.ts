import { createHash } from "crypto";
import Find, { DiscoveryMessage } from "./find";
import Messenger from "./lib/messenger";
import { devices } from "./devices.conf";

const UDP_KEY = "yGAdlopoPVldABfn";
const UDP_HASHED_KEY = createHash("md5")
  .update(UDP_KEY, "utf8")
  .digest();

function createPromise() {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let resolveFn: (arg0: unknown) => void = () => {};

  const promise = new Promise((resolve, reject) => {
    resolveFn = resolve;
  });

  return { promise, resolveFn };
}

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
    const { promise, resolveFn } = createPromise();
    find.on("broadcastEncrypted", (frame: Buffer) => {
      try {
        console.log(`broadcastEncrypted: ${frame.toString("base64")}.`);
        const messenger = new Messenger({ key: UDP_HASHED_KEY });
        const decoded = messenger.decode(frame);
        const payload = decoded.payload;
        console.log(`payload`, payload);
        console.log(`decoded base64: ${payload.toString("base64")}`);
        console.log(`decoded ascii: ${payload.toString("utf8")}`);
        try {
          const data = JSON.parse(payload.toString("ascii"));
          resolveFn(data);
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
    const { promise, resolveFn } = createPromise();
    find.on("broadcast", (message: unknown) => {
      try {
        console.log("broadcast", message);
        try {
          resolveFn(message);
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
  it("finds all devices", async () => {
    const { promise, resolveFn } = createPromise();
    const found: Record<string, DiscoveryMessage> = {};
    let toFind = [...devices];
    find.on("broadcast", (message: DiscoveryMessage) => {
        found[message.gwId] = message;
        toFind = toFind.filter((device) => device.id !== message.gwId);
        console.log(`found ${message.gwId}, ${toFind.length} left`);
        if (toFind.length === 0) {
            resolveFn(found);
        }
    });
    find.start();
    await promise;
  });
});