const AbstractBinding = require('@serialport/binding-abstract');

// TODO: error in-progress reads when port is closed
// TODO: error in-progress writes when port is closed

function cancelError(message) {
    const err = new Error(message);
    err.canceled = true;
    return err;
}

module.exports = class WebSerialBinding extends AbstractBinding {
    static list() {
        return navigator.serial.getPorts().then(port => {
            return {
                path: port
            }
        });
    }

    constructor(opts) {
        super();

        this.port = null;
        this.writeOperation = null;
        
        this._writer = null;
        this._reader = null;
        this._unread = null;
    }

    async open(path, opts) {
        const port = (this.port = path);
        await super.open(path, opts);

        if (this.isOpen) {
            throw new Error('Open: binding is already open');
        }

        await port.open(this._getOpenOptions(opts));

        port.openOpt = { ...opts };
        this._writer = this.port.writable.getWriter();
        this._reader = this.port.readable.getReader();
        this.isOpen = true;
    }

    async close() {
        const port = this.port;
        if (!port) {
            throw new Error('already closed');
        }
        await super.close();
        delete port.openOpt;
        this.isOpen = false;
        delete this.port;
        // TODO: cancel pending read
    }

    async read(buffer, offset, length) {
        await super.read(buffer, offset, length);
        
        if (!this.isOpen) {
            throw cancelError('Read cancelled');
        }

        if (!this._unread) {
            const chunk = await this._reader.read();
            if (chunk.done) {
                // TODO: how to signal EOF?
                return; 
            }
            this._unread = chunk.value;
        }

        const src = this._unread;

        const bytesRead = Math.min(src.length, length);
        buffer.set(src.subarray(0, bytesRead), offset);
        
        this._unread = (bytesRead < src.length) ? src.subarray(bytesRead) : null;
        
        return { bytesRead, buffer };
    }

    async write(buffer) {
        if (this.writeOperation) {
            throw new Error('Overlapping writes are not supported and should be queued by the serialport object');
        }
        this.writeOperation = super.write(buffer).then(async () => {
            if (!this.isOpen) {
                throw new Error('Write cancelled');
            }
            await this._writer.write(buffer);
            this.writeOperation = null;
        });
        return this.writeOperation;
    }

    async update(opts) {
        await super.update(opts);
        throw new Error("update() is not yet implemented");
    }

    async set(opts) {
        await super.update(opts);
        throw new Error("set() is not yet implemented");
    }

    async get() {
        await super.get();
        throw new Error("get() is not yet implemented");
    }

    async getBaudRate() {
        await super.getBaudRate();
        return {
            baudRate: this.port.openOpt.baudRate
        };
    }

    async flush() {
        await super.flush();
        console.log("flush!");
        // TODO
    }

    async drain() {
        await super.drain();
        await this.writeOperation;
    }

    _getOpenOptions(opts) {
        if (opts.xon || opts.xoff || opts.xany) {
            throw new Error("unsupported flow control setting");
        }

        // Generally the range of supported values by serialport
        // is a superset of those supported by Web Serial. We'll
        // pass the options values to Web Serial and allow it
        // to perform the validation.
        return {
            baudRate    : opts.baudRate,

            // Valid serialport values: 5, 6, 7, 8
            // Valid Web Serial values: 7, 8
            dataBits    : opts.dataBits,

            // Valid serialport values: 1, 2
            // Valid Web Serial values: 1, 2
            stopBits    : opts.stopBits,

            // Valid serialport values: none, even, mark, odd, space
            // Valid Web Serial values: none, even, odd
            parity      : opts.parity,

            flowControl : opts.rtscts ? 'hardware' : 'none'
        };
    }
}

