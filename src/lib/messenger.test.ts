import { COMMANDS, UDP_KEY } from "./constants";
import Frame from "./frame";
import Messenger from "./messenger";

import { createHash } from "crypto";

const UNIVERSAL_KEY = createHash("md5")
  .update(UDP_KEY, "utf8")
  .digest();

describe("protocol 3.3", () => {
  it("can decode broadcast", () => {
    const input = {
      frame:
        "AABVqgAAAAAAAAATAAAAnAAAAADQl2ZnbzNp6xC16fEy/YAqdO3bqjfIm2YzgR4oqDPNGUkgruSBq37e8AhNjH9AS6etLK70Ds0Q1H11egdOEWXAwvuEWbEVX8ddS/Zpn5LLpMC6UgFIBF52BfoEmN/qWqsZjni2+HCSDQHYTMJCZR4opuPCzflgPNiqgj90c42UlG7ajupA6TseP8FKJXDhgnkuc+dEAACqVQ==",
      key: UNIVERSAL_KEY,
      payload:
        "eyJpcCI6IjE5Mi4xNjguMS41NSIsImd3SWQiOiJiZjkzNDZjNjYzNWRmYjRiMzhzajJwIiwiYWN0aXZlIjoyLCJhYmxpbHR5IjowLCJlbmNyeXB0Ijp0cnVlLCJwcm9kdWN0S2V5IjoiYWFjenR1dGJ1NjlnZHBkZiIsInZlcnNpb24iOiIzLjMifQ==",
      data: {
        ablilty: 0,
        active: 2,
        encrypt: true,
        gwId: "bf9346c6635dfb4b38sj2p",
        ip: "192.168.1.55",
        productKey: "aacztutbu69gdpdf",
        version: "3.3",
      },
    };
    const messenger = new Messenger({ key: input.key });
    const decoded = messenger.decode(Buffer.from(input.frame, "base64"));
    expect(decoded).toMatchObject({
      command: COMMANDS.UDP_NEW,
      version: 3.3,
      returnCode: 0,
      payload: Buffer.from(input.payload, "base64"),
    } as Frame);

    const data = JSON.parse(decoded.payload.toString("ascii"));
    expect(data).toMatchObject(input.data);
  });

  it("can decode data frame", () => {
    const input = {
      frame:
        "AABVqgAAAAAAAAAKAAAAPAAAAAAxXeK4ivlg3DwMnPGShB/OSNiTIZLjfdY4Sw1DZMw0HKF5TWtTgF10/Tg7n33uYgzIDCOcAACqVQ==",
      key: "c427112a82bbc7ae",
      meta: '{"version":3.3,"command":10,"returnCode":0}',
      payload: "eyJkcHMiOnsiMSI6ZmFsc2UsIjciOjAsIjE0Ijoib2ZmIn19",
      data: { dps: { "1": false, "7": 0, "14": "off" } },
    };

    const messenger = new Messenger({ key: input.key });
    const decoded = messenger.decode(Buffer.from(input.frame, "base64"));

    expect(decoded).toMatchObject({
      version: 3.3,
      command: 10,
      returnCode: 0,
      payload: Buffer.from(input.payload, "base64"),
    });

    const data = JSON.parse(decoded.payload.toString("ascii"));
    expect(data).toMatchObject(input.data);
  });

  it("can decode own frame", () => {
    const key = "c427112a82bbc7ae";

    const messenger = new Messenger({ key });
    const frame: Frame = {
      command: COMMANDS.DP_QUERY,
      payload: Buffer.from(JSON.stringify({}), "utf8"),
      version: 3.3,
    };

    const encoded = messenger.encode(frame);
    const decoded = messenger.decode(encoded.buffer);

    expect(decoded).toMatchObject(frame);
  });

  it("can encode 3.3", () => {
    const payload = { devId: "002004265ccf7fb1b659", dps: { 1: true, 2: 0 } };

    const messenger = new Messenger({ key: "bbe88b3f4106d354" });

    const encoded = messenger.encode({
      command: COMMANDS.DP_QUERY,
      version: 3.3,
      payload: Buffer.from(JSON.stringify(payload), "utf8"),
    });

    expect(encoded.buffer.toString("base64")).toEqual(
      "AABVqgAAAAAAAAAKAAAASM6wPDit69yTIlF6Vw1mrjaaWOAJtnPK2erG+GH9eTIzyLy7WILHEXvMIKna/snRTnRLFLfvV1r7z5Z2CkLoDcHv/pbSAACqVQ=="
    );
  });
});

describe("protocol 3.4", () => {
  it("can encode 3.4", () => {
    const payload = { devId: "002004265ccf7fb1b659", dps: { 1: true, 2: 0 } };

    const messenger = new Messenger({ key: "bbe88b3f4106d354" });

    const encoded = messenger.encode({
      command: COMMANDS.DP_QUERY,
      version: 3.4,
      payload: Buffer.from(JSON.stringify(payload), "utf8"),
    });

    expect(encoded.buffer.toString("base64")).toEqual(
      "AABVqgAAAAAAAAAKAAAAZM6wPDit69yTIlF6Vw1mrjaaWOAJtnPK2erG+GH9eTIzyLy7WILHEXvMIKna/snRTnRLFLfvV1r7z5Z2CkLoDcFOimZpyKDTXr3LCUCvrohlOJtaQLNCDG3MmZjvy8F/ugAAqlU="
    );
  });
  it("can encode 3.4", () => {
    const payload = { devId: "002004265ccf7fb1b659", dps: { 1: true, 2: 0 } };

    const messenger = new Messenger({ key: "bbe88b3f4106d354" });

    const encoded = messenger.encode({
      command: COMMANDS.DP_QUERY,
      version: 3.4,
      payload: Buffer.from(JSON.stringify(payload), "utf8"),
      sequenceN: 2,
    });

    expect(encoded.buffer.toString("base64")).toEqual(
      "AABVqgAAAAIAAAAKAAAAZM6wPDit69yTIlF6Vw1mrjaaWOAJtnPK2erG+GH9eTIzyLy7WILHEXvMIKna/snRTnRLFLfvV1r7z5Z2CkLoDcGDOrbIwhkRDi/6WrOc7gg/JaSL0q80uhalRAGzLgkr5QAAqlU="
    );
  });
});
