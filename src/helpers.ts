import Device, { DeviceEvents } from "./device";
import Frame, { Packet } from "./lib/frame";

export function createPromise<T>() {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  let resolve: (arg0: T) => void = () => {};
  let reject: (arg0: unknown) => void = () => {};

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

export function subscribeToEvent<T>(
  device: Device,
  event: DeviceEvents
): [T[], () => Promise<T>] {
  const queue: T[] = [];
  let {
    promise: nextItemPromise,
    resolve: resolveNextItem,
    reject: rejectNextItem,
  } = createPromise<void>();

  device.on(event as any, (data: unknown) => {
    queue.push(data as T);
    resolveNextItem();
  });
  device.on("error", (err) => {
    rejectNextItem(err);
  });
  device.on("disconnected", () => {
    rejectNextItem("disconnected");
  });

  const factory = () => {
    const { promise, resolve, reject } = createPromise<T>();
    const resolveItem = () => {
      const { promise: np, resolve: nres, reject: nrej } = createPromise<
        void
      >();
      nextItemPromise = np;
      resolveNextItem = nres;
      rejectNextItem = nrej;

      resolve(queue.shift()!);
    };
    if (queue.length > 0) {
      resolveItem();
      return promise;
    } else {
      nextItemPromise.then(resolveItem);
      return promise;
    }
  };

  return [queue, factory];
}
