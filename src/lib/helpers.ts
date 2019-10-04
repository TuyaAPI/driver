class DeviceError extends Error {
  constructor(m: string) {
    super(`Error from device: ${m}`);
    Error.captureStackTrace(this, DeviceError);
  }
}

export {DeviceError};
