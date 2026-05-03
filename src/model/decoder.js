import * as ort from "onnxruntime-web";

import { IMAGE_SIZE, sampleLatent } from "./generator";

const DECODER_URL = "/models/decoder.onnx";
const METADATA_URL = "/models/metadata.json";

let sessionPromise = null;
let metadataPromise = null;

const uid = () => Math.random().toString(36).slice(2, 10);

export async function loadDecoder() {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(DECODER_URL, {
      executionProviders: ["wasm"],
    });
  }

  return sessionPromise;
}

export async function loadDecoderMetadata() {
  if (!metadataPromise) {
    metadataPromise = fetch(METADATA_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`metadata load failed: ${response.status}`);
        return response.json();
      })
      .catch(() => ({
        latent_dim: 2,
        image_size: IMAGE_SIZE,
        digits: [...Array(10).keys()],
        output_range: [-1, 1],
      }));
  }

  return metadataPromise;
}

function oneHotDigit(digit) {
  const oneHot = new Float32Array(10);
  oneHot[digit] = 1;

  return oneHot;
}

function tensorToImageData(tensor, imageSize = IMAGE_SIZE, outputRange = [-1, 1]) {
  const rgba = new Uint8ClampedArray(imageSize * imageSize * 4);
  const channels = 3;
  const channelSize = imageSize * imageSize;
  const [lo, hi] = outputRange;
  const scale = hi - lo || 1;

  for (let y = 0; y < imageSize; y += 1) {
    for (let x = 0; x < imageSize; x += 1) {
      const pixel = y * imageSize + x;
      const out = pixel * 4;

      for (let c = 0; c < channels; c += 1) {
        const value = tensor.data[c * channelSize + pixel];
        rgba[out + c] = Math.round(Math.max(0, Math.min(1, (value - lo) / scale)) * 255);
      }

      rgba[out + 3] = 255;
    }
  }

  return new ImageData(rgba, imageSize, imageSize);
}

function imageDataToDataUrl(imageData) {
  const canvas = document.createElement("canvas");
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const ctx = canvas.getContext("2d");
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}

export async function decodeCandidate({
  digit,
  z = sampleLatent(),
  source = "base",
} = {}) {
  const [session, metadata] = await Promise.all([loadDecoder(), loadDecoderMetadata()]);
  const latentDim = metadata.latent_dim || 2;
  const imageSize = metadata.image_size || IMAGE_SIZE;
  const outputRange = metadata.output_range || [-1, 1];

  const zTensor = new ort.Tensor("float32", Float32Array.from(z), [1, latentDim]);
  const digitTensor = new ort.Tensor("float32", oneHotDigit(digit), [1, 10]);
  const outputs = await session.run({
    z: zTensor,
    digit_onehot: digitTensor,
  });
  const output = outputs.image || outputs[session.outputNames[0]];
  const imageData = tensorToImageData(output, imageSize, outputRange);

  return {
    id: uid(),
    digit,
    z,
    imageData,
    dataUrl: imageDataToDataUrl(imageData),
    source,
  };
}

export async function decodeCandidates(specs) {
  return Promise.all(specs.map((spec) => decodeCandidate(spec)));
}

function shuffledDigits() {
  return [...Array(10).keys()].sort(() => Math.random() - 0.5);
}

export async function generateCandidateBatch({ count = 3 } = {}) {
  const digits = shuffledDigits().slice(0, count);

  return decodeCandidates(
    digits.map((digit) => ({
      digit,
      source: "base",
      z: sampleLatent([0, 0], 0.78),
    }))
  );
}

export async function generateSamplesForDigit(digit, count) {
  return decodeCandidates(
    Array.from({ length: count }, () => ({
      digit,
      source: "base",
      z: sampleLatent([0, 0], 0.78),
    }))
  );
}

export async function generateEvaluationBaseSamples(countPerDigit = 2) {
  const specs = [];

  for (let digit = 0; digit <= 9; digit += 1) {
    for (let i = 0; i < countPerDigit; i += 1) {
      specs.push({
        digit,
        source: "base",
        z: sampleLatent([0, 0], 0.78),
      });
    }
  }

  return decodeCandidates(specs);
}
