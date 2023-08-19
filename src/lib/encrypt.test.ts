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

  it("encrypts dps set", () => {
    const input = {
      data: "332e340000000000000000000000007b2264617461223a7b226374797065223a302c226465764964223a2262666265653631653334346339353262333467666961222c2267774964223a2262666265653631653334346339353262333467666961222c22756964223a22222c22647073223a7b2231223a747275657d7d2c2270726f746f636f6c223a352c2274223a313639323432363830357d060606060606",
      encrypted:
        "4f76d6bef9a7076a0f29c3fd6ecc137baa95fbfd70ca73916b8855798221457afd2c7ba1e6f354d777de4b2c44f3f16fd258d4ed09ffc99307630f9cb6c4da3fd6e8db2d202b65ebd08c3d6f70bcd8d2d258d4ed09ffc99307630f9cb6c4da3f3942e295e85c26ddf1bac04e0cd25a20f7448944d5e74bfb5450739cd1751f8e21563306a2a49d1d97dc75020659dc45b8f0f24f958da8b9de768fdbea13ea63",
    };
    const sessionKey = Buffer.from('30bc1e8957ec28a2f70122d8c7cb326c', 'hex');
    const encrypted = encrypt(
      sessionKey,
      Buffer.from(input.data, "hex"),
      3.4
    );

    expect(encrypted.toString("hex")).toEqual(input.encrypted);
  });
});
