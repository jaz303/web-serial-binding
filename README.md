# web-serial-binding

`web-serial-binding` provides a Web Serial binding for [`node-serialport`](https://github.com/serialport/node-serialport).

Status: basic read/write functionality in place, working on closing/cancellation.

## Usage

```javascript
const SerialPort = require('@serialport/stream');
SerialPort.Binding = require('web-serial-binding');

// Open a port from the browser
const nativePort = await navigator.serial.requestPort();

// Create the serial port
const port = new SerialPort(nativePort, {baudRate: 115200});

port.on('open', () => {
    console.log("port opened!");
});

port.on('data', (buf) => {
    console.log("data received", buf);
});

setInterval(() => {
    port.write("hello!\r\n");
}, 1000);

```
