// Based on https://github.com/danchitnis/webgl-plot-examples/blob/b50ef3146db16b82a04f7279aae799d81c10f0f1/vanilla/src/randomness.ts
// (MIT License, Copyright (c) 2019 Danial Chitnis)

import { WebglPlot, ColorRGBA, WebglLine } from "webgl-plot";

const canvas = document.getElementById("my_canvas") as HTMLCanvasElement;

const devicePixelRatio = window.devicePixelRatio || 1;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;

const lineColor = new ColorRGBA(0, 0, 0, 1);
const numX = Math.round(canvas.width);
const wglp = new WebglPlot(canvas);

let numLines = 1;
let scaleY = 1;

let fpsDivder = 1;
let fpsCounter = 0;

let serialReader: ReadableStreamDefaultReader<Uint8Array>;
const serialDecoder = new TextDecoder();
let serialBuffer: string = "";
let serialPoints: Array<number> = [];

async function newFrame() {
  if (fpsCounter === 0) {
    await plot();

    wglp.gScaleY = scaleY;
    wglp.update();
  }

  fpsCounter++;

  if (fpsCounter >= fpsDivder) {
    fpsCounter = 0;
  }
}

async function plot() {
  wglp.linesData.forEach(async (line) => {
    if (serialPoints.length === 0) return;

    (line as WebglLine).shiftAdd(new Float32Array(serialPoints.map((v) => v / 1023)));
    serialPoints = [];
  });
}

function getAndAddSerialPoint() {
  serialReader.read().then(({ value, done }) => {
    if (done) {
      console.log("Stream complete");
      return;
    }

    const serialData = serialDecoder.decode(value);
    serialBuffer += serialData;

    serialBuffer = serialBuffer.replace(/\<(.*?)\>/g, (_, p1) => {
      serialPoints.push(parseInt(p1));
      newFrame();
      return "";
    });

    getAndAddSerialPoint();
  });
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

    wglp.removeAllLines();

    const line = new WebglLine(lineColor, numX);
    line.arrangeX();
    wglp.addLine(line);

    getAndAddSerialPoint();
  } catch (e) {
    console.error(e)
  }
});
