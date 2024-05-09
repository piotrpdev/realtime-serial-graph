// https://developer.chrome.com/docs/capabilities/serial

import 'dygraphs/dist/dygraph.css';
import 'papercss/dist/paper.min.css';
import './style.css';

import { default as Dygraph } from "dygraphs";
let chart: Dygraph;

let serialStartDate: Date;
let serialPort: SerialPort;
let serialStreamClosed: Promise<void>;
let serialReader: ReadableStreamDefaultReader<number>;
let serialDecoder: TextDecoderStream;
let serialPoints: Array<Array<number>>;

let keepReading = false;
let refreshGraphInterval: number | undefined;

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

async function startSerialReadLoop() {
  try {
    while (serialPort.readable && keepReading) {
      const { value, done } = await serialReader.read();
  
      if (done) {
        console.debug("Stream complete");
        serialReader.releaseLock();
        break;
      }
  
      const timeElapsed = new Date().getTime() - serialStartDate.getTime();
  
      serialPoints.push([timeElapsed / 1000, value]);
    }
  } catch (e) {
    console.error(e);
  } finally {
    serialReader.releaseLock();
  }
}

async function initSerial() {
  console.debug("Requesting serial port...");
  serialPort = await navigator.serial.requestPort();

  console.debug("Opening serial port...");
  await serialPort.open({ baudRate: 9600 });

  if (serialPort.readable == null) {
    throw new Error("Serial port is not readable.");
  }

  console.debug("Creating serial decoder...");
  serialDecoder = new TextDecoderStream();

  console.debug("Piping serial port to decoder...");
  serialStreamClosed = serialPort.readable.pipeTo(serialDecoder.writable);

  console.debug("Creating serial reader...");
  serialReader = serialDecoder.readable
    .pipeThrough(new TransformStream(new ChevronTransformer()))
    .getReader();

  serialStartDate = new Date();
}

document.getElementById("portButton")?.addEventListener("click", async () => {
  console.debug("Checking for serial API support...")
  if ("serial" in navigator === false) {
    console.error("Web Serial API not supported.");
    return;
  }

  try {
    if (!keepReading) {
      console.debug("Initializing serial stuff...");
      await initSerial();

      serialPoints = [[0, 0]];

      console.debug("Creating chart...");
      chart = new Dygraph(document.getElementById("chart")!, serialPoints, {
        drawPoints: false,
        // @ts-ignore
        resizable: "both",
        rollPeriod: 5,
        valueRange: [200, 600],
        title: "Pulse Sensor Data",
        labels: ["Time", "Pulse"],
        axisLabelWidth: 60,
        xAxisHeight: 40,
        xlabel: "Time (s)",
        ylabel: "Pulse (0-1023)",
      });

      console.debug("Creating refresh graph interval...");
      refreshGraphInterval = setInterval(() => {
        if (serialPoints.length > 0) {
          serialPoints = serialPoints.slice(-1000);
      
          chart.updateOptions({ file: serialPoints });
        }
      }, 10);

      document.getElementById("portButton")!.textContent = "Stop";
  
      console.debug("Starting serial read loop...");
      keepReading = true;
      await startSerialReadLoop();
    } else {
      console.debug("Stopping serial read loop...");
      keepReading = false;

      console.debug("Cancelling serial reader...");
      await serialReader.cancel();

      console.debug("Clearing refresh graph interval...");
      clearInterval(refreshGraphInterval);

      console.debug("Waiting before closing port...");
      setTimeout(async () => {
        try {
          console.debug("Waiting for serial stream to close...");
          await serialStreamClosed;
        } catch (e) {
          console.debug("Error closing serial stream, this is fine apparently", e);
        } finally {
          console.debug("Closing serial port...");
          await serialPort.close();
        }
      }, 100);

      console.debug("Resetting button text...");
      document.getElementById("portButton")!.textContent = "Start";
    }
  } catch (e) {
    console.error(e);
  }
});
