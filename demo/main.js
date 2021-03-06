const SerialPort = require('@serialport/stream');
SerialPort.Binding = require('..');

document.addEventListener('DOMContentLoaded', async () => {

    const ports = await SerialPort.list();
    console.log("Available ports", ports);

    const decoder = new TextDecoder();

    let port;

    document.querySelector('button[name="open"]').onclick = async () => {
        if (port) {
            return;
        }
        
        const nativePort = await navigator.serial.requestPort();
        let sendTimer;

        port = new SerialPort(nativePort, {baudRate: 115200});

        port.on('open', () => {
            console.log("port open!");
            port.set({}, () => {
                port.get((err, signals) => {
                    console.log("signals", signals);
                });
            });
        });

        port.on('data', (data) => {
            console.log("recv", JSON.stringify(decoder.decode(data)));
        });

        port.on('end', () => {
            console.log("stream ended");
        });

        port.on('close', () => {
            console.log("port closed");
            clearInterval(sendTimer);
        });

        sendTimer = setInterval(() => {
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
