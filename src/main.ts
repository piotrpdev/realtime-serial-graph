// https://developer.chrome.com/docs/capabilities/serial

import 'dygraphs/dist/dygraph.css';

import { default as Dygraph } from "dygraphs";

let serialPort: SerialPort;
let serialReader: ReadableStreamDefaultReader<number>;
const serialDecoder = new TextDecoderStream();
let serialPoints: Array<Array<any>> = [];

class ChevronTransformer implements Transformer<string, number> {
  chunks = "";

  extractAndQueue(controller: TransformStreamDefaultController<number>) {
    this.chunks = this.chunks.replace(/\<(.*?)\>/g, (_, p1) => {
      controller.enqueue(parseInt(p1));

      return "";
    });
  }

  transform(
    chunk: string,
    controller: TransformStreamDefaultController<number>
  ) {
    this.chunks += chunk;

    this.extractAndQueue(controller);
  }

  flush(controller: TransformStreamDefaultController<number>) {
    this.extractAndQueue(controller);
  }
}

const chart = new Dygraph(document.getElementById("chart")!, serialPoints, {
  drawPoints: false,
  showRoller: true,
  rollPeriod: 5,
  valueRange: [200, 600],
  labels: ["Time", "Pulse"],
  xlabel: "Time (hh:mm:ss)",
  ylabel: "Pulse (0-1023)",
});

setInterval(() => {
  if (serialPoints.length > 0) {
    serialPoints = serialPoints.slice(-300);

    chart.updateOptions({ file: serialPoints });
  }
}, 10);

async function getAndAddSerialPoint() {
  while (true) {
    const { value, done } = await serialReader.read();

    if (done) {
      console.log("Stream complete");
      serialReader.releaseLock();
      break;
    }

    serialPoints.push([new Date(), value]);
  }
}

document.getElementById("portButton")?.addEventListener("click", async () => {
  if ("serial" in navigator === false) {
    console.error("Web Serial API not supported.");
    return;
  }

  try {
    serialPort = await navigator.serial.requestPort();
    await serialPort.open({ baudRate: 9600 });
    serialPort.readable?.pipeTo(serialDecoder.writable);
    serialReader = serialDecoder.readable
      ?.pipeThrough(new TransformStream(new ChevronTransformer()))
      .getReader();

    getAndAddSerialPoint();
  } catch (e) {
    console.error(e);
  }
});
