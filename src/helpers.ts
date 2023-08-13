import Device from "./device";

export function createPromise<T>() {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let resolve: (arg0: T) => void = () => { };
  let reject: (arg0: unknown) => void = () => { };

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

export function subscribeToEvent<T>(device: Device, event: string) {
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
