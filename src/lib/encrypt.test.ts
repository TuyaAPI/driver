import { encrypt } from "./crypto";

describe("encrypt post 3.4", () => {
  it("encrypt session key negotiate request", () => {
    const input = {
      data: "e9b2a19ff6ef095b2ccd29b037bfe6e410101010101010101010101010101010",
      encrypted:
        "34ce16bca7570e7597d5493a37a6ff942188ccb36e134b49fe7507cb54ddd7d6",
    };

    const encrypted = encrypt(
      ":P(t^(fU-i>PgrY-",
      Buffer.from(input.data, "hex"),
      3.4
    );

    expect(encrypted.toString("hex")).toEqual(input.encrypted);
  });
  it("can encrypt post 3.4", () => {
    const input = {
      data:
        "7b2267774964223a2262666265653631653334346339353262333467666961222c226465764964223a2262666265653631653334346339353262333467666961222c2274223a2231363932313631383237222c22647073223a7b7d2c22756964223a2262666265653631653334346339353262333467666961227d0505050505",
      encrypted:
        "0546cb3d6377fd30fde03ee435026a00e330a67893e3f5a30d49df67f5b51cb77dff71ff243a202bbab971636dfe75546ca029b094c43c4e5f69055f4e01ea2620021eba4fa86d3467e2c07269fb82f466741807afdd3c58702043635a1b116e455479f1624c75ea8433c6394ff5fe20006b005a4f18998ca5abb8a88ced7af5",
    };

    const encrypted = encrypt(
      ":P(t^(fU-i>PgrY-",
      Buffer.from(input.data, "hex"),
      3.4
    );

    expect(encrypted.toString("hex")).toEqual(input.encrypted);
  });
});
