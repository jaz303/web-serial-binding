const { WebSerialDuplexStream } = require('..');

document.addEventListener('DOMContentLoaded', () => {
	const decoder = new TextDecoder();

	let stream;

	document.querySelector('button[name="open"]').onclick = async () => {
		if (stream) {
			return;
		}
		
		const port = await navigator.serial.requestPort();
		await port.open({baudRate: 115200});

		stream = new WebSerialDuplexStream(port);

		stream.on('data', (data) => {
			console.log("recv", JSON.stringify(decoder.decode(data)));
		});

		stream.on('end', () => {
			console.log("stream ended");
		});

		setInterval(() => {
			stream.write("HELLO\r\n");
		}, 100);
	};

	document.querySelector('button[name="close"]').onclick = async () => {
		if (!stream) {
			return;
		}
		stream.destroy();
		stream = null;
		return;
	};
});
