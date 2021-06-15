const { Duplex } = require('stream');

exports.WebSerialDuplexStream = class WebSerialDuplexStream extends Duplex {
	constructor(serialPort) {
		super();
		this._serialPort = serialPort;
		this._writer = serialPort.writable.getWriter();
		this._reader = serialPort.readable.getReader();
	}

	_write(buffer, encoding, cb) {
		this._writer.write(buffer).then(() => {
			cb();
		}).catch((err) => {
			cb(err || new Error("unknown write error"));
		});
	}

	_read(n) {
		this._readNextChunk();
	}

	_readNextChunk() {
		this._reader.read().then(chunk => {
			if (chunk.done) {
				this.push(null);
				return;
			}
			if (this.push(chunk.value)) {
				this._readNextChunk();
			}
		}).catch(err => {
			this.destroy(err);
		});
	}
}
