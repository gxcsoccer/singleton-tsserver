'use strict';

const { Transform, Writable } = require('stream');

const BLANK = Buffer.from(' ', 'utf8')[0];
const BACK_SLASH_R = Buffer.from('\r', 'utf8')[0];
const BACK_SLASH_N = Buffer.from('\n', 'utf8')[0];
const CONTENT_LENGTH = 'Content-Length: ';
const CONTENT_LENGTH_SIZE = Buffer.byteLength(CONTENT_LENGTH, 'utf8');

class TsServerEncoder extends Transform {
  writeMessage(msg) {
    this.write(JSON.stringify(msg));
  }

  _transform(chunk, encoding, callback) {
    const size = Buffer.byteLength(chunk, 'utf8');
    callback(null, Buffer.from(`${CONTENT_LENGTH}${size}\r\n\r\n${chunk}\r\n`));
  }
}

exports.TsServerEncoder = TsServerEncoder;

class TsServerDecoder extends Writable {
  _write(chunk, encoding, callback) {
    // 合并 buf 中的数据
    this._buf = this._buf ? Buffer.concat([ this._buf, chunk ]) : chunk;
    try {
      let unfinish = false;
      do {
        unfinish = this._decode();
      } while (unfinish);
      callback();
    } catch (err) {
      err.name = 'TsServerDecodeError';
      err.data = this._buf ? this._buf.toString('base64') : '';
      callback(err);
    }
  }

  _tryReadContentLength() {
    const bufLength = this._buf.length;
    let cur = 0;
    // we are utf8 encoding...
    while (cur < bufLength &&
      (this._buf[cur] === BLANK || this._buf[cur] === BACK_SLASH_R || this._buf[cur] === BACK_SLASH_N)
    ) {
      cur++;
    }
    if (bufLength < cur + CONTENT_LENGTH_SIZE) {
      return -1;
    }
    cur += CONTENT_LENGTH_SIZE;
    const start = cur;
    while (cur < bufLength && this._buf[cur] !== BACK_SLASH_R) {
      cur++;
    }
    if (cur + 3 >= bufLength || this._buf[cur + 1] !== BACK_SLASH_N || this._buf[cur + 2] !== BACK_SLASH_R || this._buf[cur + 3] !== BACK_SLASH_N) {
      return -1;
    }
    const data = this._buf.toString('utf8', start, cur);
    const result = parseInt(data, 10);
    if (cur + 4 + result > bufLength) {
      return -1;
    }
    this._buf = this._buf.slice(cur + 4);
    return result;
  }

  _decode() {
    const size = this._tryReadContentLength();

    const bufLength = this._buf.length;
    if (size === -1 || size > bufLength) {
      return false;
    }
    const msg = this._buf.toString('utf8', 0, size);
    this.emit('message', JSON.parse(msg));

    const restLen = bufLength - size;
    if (restLen) {
      this._buf = this._buf.slice(size);
      return true;
    }
    this._buf = null;
    return false;
  }
}

exports.TsServerDecoder = TsServerDecoder;
