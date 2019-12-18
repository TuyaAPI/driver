import {EventEmitter} from 'events';
import * as dgram from 'dgram';
import Messenger from './lib/messenger';

class Find extends EventEmitter {
  private readonly _messenger: Messenger;
  private readonly _listener: dgram.Socket;
  private readonly _listenerEncrypted: dgram.Socket;

  constructor() {
    super();

    this._messenger = new Messenger({key: '', version: 0});

    this._listener = dgram.createSocket({type: 'udp4', reuseAddr: true});
    this._listenerEncrypted = dgram.createSocket({type: 'udp4', reuseAddr: true});

    this._listener.on('message', this._broadcastHandler.bind(this));

    this._listenerEncrypted.on('message', this._broadcastHandler.bind(this));
  }

  start(): void {
    this._listener.bind(6666);
    this._listenerEncrypted.bind(6667);
  }

  stop(): void {
    this._listener.close();
    this._listener.removeAllListeners();
    this._listenerEncrypted.close();
    this._listenerEncrypted.removeAllListeners();
  }

  private _broadcastHandler(message: Buffer): void {
    try {
      const frame = this._messenger.decode(message);

      const payload = JSON.parse(frame.payload.toString('ascii'));

      this.emit('broadcast', payload);
    } catch (error) {
      console.log(error);
      // It's possible another application is
      // using ports 6666 or 6667, so we shouldn't
      // throw on failure.
      this.emit('error', error);
    }
  }
}

export default Find;
