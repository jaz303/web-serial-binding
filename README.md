# web-serial-duplex-stream

`web-serial-duplex-stream` provides a class that bridges a Web Serial port to a traditional node.js stream.

## Usage

```javascript
const {WebSerialDuplexStream} = require('web-serial-duplex-stream');

// Open a port from the browser
const port = await navigator.serial.requestPort();
await port.open({baudRate: 115200});

// Create the stream
const stream = new WebSerialDuplexStream(port);

stream.on('data', (buf) => {
	console.log("data received", buf);
});

stream.write(Buffer.from("hello!\r\n"));
```
