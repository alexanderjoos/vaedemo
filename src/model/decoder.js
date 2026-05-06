import * as ort from "onnxruntime-web";

import { IMAGE_SIZE, sampleLatent } from "./generator";

const DECODER_URL = "/models/decoder.onnx";
const DECODER_DATA_URL = "/models/decoder.onnx.data";
const METADATA_URL = "/models/metadata.json";

let sessionPromise = null;
let metadataPromise = null;
let runQueue = Promise.resolve();

const uid = () => Math.random().toString(36).slice(2, 10);

async function createSessionWithWeightsBundlingFallback() {
  try {
    return await ort.InferenceSession.create(DECODER_URL, {
      executionProviders: ["wasm"],
      externalData: [
        {
          path: "decoder.onnx.data",
          data: DECODER_DATA_URL,
        },
      ],
    });
  } catch {
    return ort.InferenceSession.create(DECODER_URL, {
      executionProviders: ["wasm"],
    });
  }
}

export async function loadDecoder() {
  if (!sessionPromise) {
    sessionPromise = createSessionWithWeightsBundlingFallback().catch((error) => {
      sessionPromise = null;
      throw error;
    });
  }

  return sessionPromise;
}

async function runDecoder(feeds) {
  const session = await loadDecoder();
  const run = runQueue.then(() => session.run(feeds));
  runQueue = run.catch(() => {});
  return run;
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
        output_range: [-1, 1],
        conditioning: "none",
        decoder_inputs: ["z"],
      }));
  }

  return metadataPromise;
}

function isUnconditional(metadata) {
  return metadata.conditioning === "none";
}

function oneHotDigit(digit) {
  const oneHot = new Float32Array(10);
  oneHot[digit] = 1;

  return oneHot;
}

function tensorToImageData(
  tensor,
  imageSize = IMAGE_SIZE,
  outputRange = [-1, 1],
  batchIndex = 0
) {
  const rgba = new Uint8ClampedArray(imageSize * imageSize * 4);
  const channels = 3;
  const channelSize = imageSize * imageSize;
  const batchOffset = batchIndex * channels * channelSize;
  const [lo, hi] = outputRange;
  const scale = hi - lo || 1;

  for (let y = 0; y < imageSize; y += 1) {
    for (let x = 0; x < imageSize; x += 1) {
      const pixel = y * imageSize + x;
      const out = pixel * 4;

      for (let c = 0; c < channels; c += 1) {
        const value = tensor.data[batchOffset + c * channelSize + pixel];
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

export async function decodeCandidate({ digit, z = sampleLatent(), source = "base" } = {}) {
  const metadata = await loadDecoderMetadata();
  const latentDim = metadata.latent_dim || 2;
  const imageSize = metadata.image_size || IMAGE_SIZE;
  const outputRange = metadata.output_range || [-1, 1];

  const zTensor = new ort.Tensor("float32", Float32Array.from(z), [1, latentDim]);
  const feeds = { z: zTensor };

  if (!isUnconditional(metadata)) {
    const d = digit ?? 0;
    feeds.digit_onehot = new ort.Tensor("float32", oneHotDigit(d), [1, 10]);
  }

  const outputs = await runDecoder(feeds);
  const output = outputs.image || outputs.output || Object.values(outputs)[0];
  const imageData = tensorToImageData(output, imageSize, outputRange);

  return {
    id: uid(),
    digit: digit ?? null,
    z,
    imageData,
    dataUrl: imageDataToDataUrl(imageData),
    source,
  };
}

export async function decodeCandidates(specs) {
  return Promise.all(specs.map((spec) => decodeCandidate(spec)));
}

export async function generateCandidateBatch({ count = 3, latentParams = null } = {}) {
  const mean = latentParams?.mean ?? [0, 0];
  const std = latentParams?.std ?? 0.78;

  return decodeCandidates(
    Array.from({ length: count }, () => ({
      source: "preference",
      z: sampleLatent(mean, std),
    }))
  );
}

export async function generateSamplesBase(count, mean = [0, 0], std = 0.78) {
  return decodeCandidates(
    Array.from({ length: count }, () => ({
      source: "base",
      z: sampleLatent(mean, std),
    }))
  );
}

/** @deprecated Prefer generateSamplesBase — kept for notebooks / older call sites */
export async function generateSamples(count, mean = [0, 0], std = 0.78, source = "base") {
  return decodeCandidates(
    Array.from({ length: count }, () => ({
      source,
      z: sampleLatent(mean, std),
    }))
  );
}

export async function generateEvaluationBaseSamples(count = 24, latentParams = null) {
  const mean = latentParams?.mean ?? [0, 0];
  const std = latentParams?.std ?? 0.78;

  return decodeCandidates(
    Array.from({ length: count }, () => ({
      source: "eval_base",
      z: sampleLatent(mean, std),
    }))
  );
}
