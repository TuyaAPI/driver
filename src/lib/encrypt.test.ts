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
});
