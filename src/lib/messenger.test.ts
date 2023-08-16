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
  it.only("can encode DPS query", () => {
    const input = {
      packet: {
        commandByte: 16,
        sequenceN: 5,
        payload: {
          gwId: "bfbee61e344c952b34gfia",
          devId: "bfbee61e344c952b34gfia",
          t: "1692160865",
          dps: {},
          uid: "bfbee61e344c952b34gfia",
        },
      },
      encoded:
        "000055aa0000000500000010000000a4b446b001db45a1b45c4f4d6e3034a092f53e8cff4f76282fd80e540346ce8574050f29c7d353c482ab758bd3095b09450668c9337d0dcc487147930d48ef2a7b2a1bb060da056c314ff6083e64c0e11f12f1c0e5644c25defa99d25cb7d643ef4aba6a596ba2aab3559cb582a4a5a27a53681f2a2af665515d0ea04ec3aab0f59664199d83f9b462d9038b58334087ea0c2e15c15a1bbc7133a845e9a85763a70000aa55",
    };

    const messenger = new Messenger({ key: ":P(t^(fU-i>PgrY-" });
    const encoded = messenger.encode({
      command: input.packet.commandByte,
      version: 3.4,
      payload: Buffer.from(JSON.stringify(input.packet.payload), "utf8"),
      sequenceN: input.packet.sequenceN,
    });

    expect(encoded.buffer.toString("hex")).toEqual(input.encoded);
  });
});
