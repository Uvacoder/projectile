import { StringDecoder } from 'string_decoder';

// From zeit/hyper

// Max duration to batch session data before sending it to the renderer process.
const BATCH_DURATION_MS = 16;

// Max size of a session data batch. Note that this value can be exceeded by ~4k
// (chunk sizes seem to be 4k at the most)
const BATCH_MAX_SIZE = 200 * 1024;

// Data coming from the pty is sent to the renderer process for further
// vt parsing and rendering. This class batches data to minimize the number of
// IPC calls. It also reduces GC pressure and CPU cost: each chunk is prefixed
// with the window ID which is then stripped on the renderer process and this
// overhead is reduced with batching.
class EventEmit {
  constructor() {
    this.listeners = {};
  }

  on(name, callback) {
    if (!this.listeners[name]) this.listeners[name] = [];

    this.listeners[name].push(callback);
  }

  emit(name, param) {
    (this.listeners[name] || []).forEach((listener) => {
      listener(param);
    });
  }
}

export class DataBatcher extends EventEmit {
  constructor () {
    super();

    this.decoder = new StringDecoder('utf8');
    this.data = '';
    this.timeout = null;

    this.reset();
  }

  reset () {
    this.data = '';
    this.timeout = null;
  }

  write (chunk) {
    if (this.data.length + chunk.length >= BATCH_MAX_SIZE) {
      // We've reached the max batch size. Flush it and start another one
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
      this.flush();
    }

    this.data += this.decoder.write(chunk);

    if (!this.timeout) {
      this.timeout = setTimeout(() => this.flush(), BATCH_DURATION_MS);
    }
  }

  flush () {
    const data = this.data;

    this.reset();
    this.emit('flush', data);
  }
}
