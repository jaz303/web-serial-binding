const AbstractBinding = require('@serialport/binding-abstract');

function cancelError(message) {
    const err = new Error(message);
    err.canceled = true;
    return err;
}

function attachUsbId(dst, dstKey, id) {
    if (typeof id === 'number') {
        dst[dstKey] = ('000' + id.toString(16)).substr(-4);
    }
}

module.exports = class WebSerialBinding extends AbstractBinding {
    static list() {
        return navigator.serial.getPorts().then(portList => portList.map(path => {
            const entry = { path };

            const portInfo = path.getInfo();
            attachUsbId(entry, 'productId', portInfo.usbProductId);
            attachUsbId(entry, 'vendorId', portInfo.usbVendorId);

            return entry;
        }));
    }

    constructor(opts) {
        super();
        this.port = null;
        this.writeOperation = null;
        this.isOpen = false;
        this.cancelRead = null; // callback to cancel in-progress read operation
        this.unread = null; // unread bytes; set if last read exceeded size of destination buffer
    }

    async open(path, opts) {
        const port = (this.port = path);
        await super.open(path, opts);

        if (this.isOpen) {
            throw new Error('Open: binding is already open');
        }

        await port.open(this._getOpenOptions(opts));
        port.openOpt = { ...opts };
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

        if (this.cancelRead) {
            await this.cancelRead();
        }

        await port.close();
        delete this.port;
    }

    async read(buffer, offset, length) {
        let reader;

        const op = super.read(buffer, offset, length).then(async () => {
            if (!this.isOpen) {
                throw cancelError('Read cancelled');
            }
            let src = this.unread;
            if (!src) {
                reader = this.port.readable.getReader();
                try {
                    const { value, done } = await reader.read();
                    if (done) {
                        return { bytesRead: 0, buffer }; // cancelled
                    }
                    src = value;
                } finally {
                    reader.releaseLock();
                    reader = null;
                    this.cancelRead = null;
                }
            }
            const bytesRead = Math.min(src.length, length);
            buffer.set(src.subarray(0, bytesRead), offset);
            this.unread = (bytesRead < src.length) ? src.subarray(bytesRead) : null;
            return { bytesRead, buffer };
        });

        this.cancelRead = () => {
            if (reader) {
                reader.cancel();    
            }
            return op;
        };

        return op;
    }

    async write(buffer) {
        if (this.writeOperation) {
            throw new Error('Overlapping writes are not supported and should be queued by the serialport object');
        }
        this.writeOperation = super.write(buffer).then(async () => {
            if (!this.isOpen) {
                throw new Error('Write cancelled');
            }
            const writer = this.port.writable.getWriter();
            try {
                await writer.write(buffer);    
            } finally {
                writer.releaseLock();
                this.writeOperation = null;    
            }
        });
        return this.writeOperation;
    }

    async update(opts) {
        // Can't see anything in the Web Serial API for changing
        // baud rate on an open connection. Better to throw an
        // error rather than silently ignore.
        throw new Error("update() is not supported");
    }

    async set(signals) {
        await super.set(signals);
        await this.port.setSignals({
            dataTerminalReady    : signals.dtr,
            requestToSend        : signals.rts,
            break                : signals.brk  
        });
    }

    async get() {
        await super.get();
        const signals = await this.port.getSignals();
        return {
            cts: signals.clearToSend,
            dsr: signals.dataSetReady,
            dcd: signals.dataCarrierDetect
        };
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
