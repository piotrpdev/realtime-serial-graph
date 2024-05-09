// Based on https://github.com/danchitnis/webgl-plot-examples/blob/b50ef3146db16b82a04f7279aae799d81c10f0f1/vanilla/src/randomness.ts
// (MIT License, Copyright (c) 2019 Danial Chitnis)

import { default as Dygraph } from 'dygraphs';

const devicePixelRatio = window.devicePixelRatio || 1;

let serialReader: ReadableStreamDefaultReader<Uint8Array>;
const serialDecoder = new TextDecoder();
let serialBuffer: string = "";
let serialPoints: Array<Array<any>> = [];

const chart = new Dygraph(document.getElementById("chart")!, serialPoints,
      {
        drawPoints: false,
        showRoller: true,
        rollPeriod: 5,
        valueRange: [200, 600],
        labels: ['Time', 'Random'],
        xlabel: 'Time (hh:mm:ss)',
        ylabel: 'Pulse (0-1023)',
      });

setInterval(() => {
  if (serialPoints.length > 0) {
    // chart.load({
    //   columns: [
    //     ['data1', ...(serialPoints.slice(-1000))],
    //   ],
    // });

    chart.updateOptions({ 'file': serialPoints.slice(-300) });

    // serialPoints = [];
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

    const serialData = serialDecoder.decode(value);
    serialBuffer += serialData;

    serialBuffer = serialBuffer.replace(/\<(.*?)\>/g, (_, p1) => {
      serialPoints.push([new Date(), parseInt(p1)]);

      return "";
    });
  }
}

document.getElementById("portButton")?.addEventListener("click", async () => {
  if (!(navigator as any).serial) {
    console.error("Web Serial API not supported.");
    return;
  }

  try {
    const port = await (navigator as any).serial.requestPort()
    await port.open({ baudRate: 9600 });
    serialReader = port.readable.getReader();

    getAndAddSerialPoint();
  } catch (e) {
    console.error(e)
  }
});
