const SerialPort = require('@serialport/stream');
SerialPort.Binding = require('..');

document.addEventListener('DOMContentLoaded', () => {
    const decoder = new TextDecoder();

    let port;

    document.querySelector('button[name="open"]').onclick = async () => {
        if (port) {
            return;
        }
        
        const nativePort = await navigator.serial.requestPort();

        port = new SerialPort(nativePort, {baudRate: 115200});

        port.on('open', () => {
            console.log("port open!");
        });

        port.on('data', (data) => {
            console.log("recv", JSON.stringify(decoder.decode(data)));
        });

        port.on('end', () => {
            console.log("stream ended");
        });

        setInterval(() => {
            port.write("HELLO\r\n");
        }, 100);
    };

    document.querySelector('button[name="close"]').onclick = async () => {
        if (!port) {
            return;
        }
        port.close();
        port = null;
        return;
    };
});
