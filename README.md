# RLHF Demo (Cornell-style MNIST latent map)

An interactive RLHF-style demo built with React, Vite, an unconditional 2D MNIST VAE in the browser (ONNX), and an image-based reward model.

You navigate latent space like the [CS4782 MNIST viewer](https://www.cs.cornell.edu/courses/cs4782/2026sp/demos/vae/vae_viewer.html): click or drag to change **z** and decode a single digit. The preference arena then shifts a **learned Gaussian sampler** over **z** (cyan vs purple prior ellipses on the scatter plot) while the decoder stays frozen.

## Run the Demo

```bash
npm install
npm run dev -- --host 127.0.0.1
```

The app expects these exported model files:

```text
public/models/decoder.onnx
public/models/metadata.json
public/models/latent_map.json
```

`decoder.onnx.data` is only present when weights are stored externally; the loader falls back to an embedded-weights model.

They are included in this repo after export.

## Train the Decoder Locally

Create or reuse the backend virtualenv, then train and export:

```bash
python3 -m venv backend_training/.venv
backend_training/.venv/bin/pip install torch torchvision onnx onnxscript
backend_training/.venv/bin/python backend_training/train_unconditional_mnist.py --epochs 20 --batch-size 256 --num-workers 0 --device cpu
backend_training/.venv/bin/python backend_training/export_decoder.py
```

For a quick visual check:

```bash
backend_training/.venv/bin/python backend_training/sample_grid.py --out backend_training/checkpoints/sample_grid.png --device cpu
```

## Train in Colab

Open `train_cvae_colab.ipynb` in Colab, switch to a GPU runtime, and run the notebook from top to bottom. The notebook calls the same backend scripts as local training and writes the same output paths.

Colab flow:

1. Put this repo in Colab so the notebook can see `backend_training/` and `public/models/`.
2. In Colab, choose `Runtime > Change runtime type > T4 GPU` or another GPU runtime.
3. Run the notebook cells to train, export, and zip the frontend model assets.
4. Copy the exported website files back into your local checkout under `public/models/`.

Copy these files back into `public/models/` if you train remotely:

```text
decoder.onnx
metadata.json
latent_map.json
```

The RLHF portion stays local in the browser. Colab is only for training and exporting the base decoder plus latent-map asset.

## Local RLHF Loop

Once the exported files are back in `public/models/`, start the app locally:

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Then open the local Vite URL and use the preference arena. Each click updates the in-browser reward model and latent policy against the frozen decoder you trained in Colab.

## Architecture

- `src/model/decoder.js`: loads `decoder.onnx` with `onnxruntime-web` and returns image candidates.
- `src/model/rewardModel.js`: image-based preference reward model.
- `src/model/latentPolicy.js`: reward-score-driven 2D latent policy updates.
- `src/model/latentMap.js`: latent embedding asset loader for the CS4782-style visualization.
- `src/model/analyzers.js`: post-hoc diagnostic image analyzers only.
- `backend_training/`: offline PyTorch unconditional MNIST VAE training and ONNX export (`train_unconditional_mnist.py`, `export_decoder.py`).

Analyzer scores are never passed into the reward model or latent policy.
