# VAE RLHF Digit Demo

An interactive RLHF-style digit generation demo built with React, Vite, a browser ONNX decoder, and an image-based reward model.

The frontend lets you pick preferred generated digits. Each preference updates a reward model, updates a 2D latent policy, and refreshes samples from a frozen conditional VAE decoder.

## Run the Demo

```bash
npm install
npm run dev -- --host 127.0.0.1
```

The app expects these exported model files:

```text
public/models/decoder.onnx
public/models/decoder.onnx.data
public/models/metadata.json
```

They are included in this repo after export.

## Train the Decoder Locally

Create or reuse the backend virtualenv, then train and export:

```bash
python3 -m venv backend_training/.venv
backend_training/.venv/bin/pip install torch torchvision onnx onnxscript
backend_training/.venv/bin/python backend_training/train_cvae.py --epochs 20 --batch-size 128 --num-workers 0 --device cpu
backend_training/.venv/bin/python backend_training/export_decoder.py
```

For a quick visual check:

```bash
backend_training/.venv/bin/python backend_training/sample_grid.py --digit 7 --out backend_training/checkpoints/sample_grid_digit7.png --device cpu
```

## Train in Colab

Open `train_cvae_colab.ipynb` in Colab, use a GPU runtime, and run the notebook. It calls the same backend scripts and writes the same output paths.

Copy these files back into `public/models/` if you train remotely:

```text
decoder.onnx
decoder.onnx.data
metadata.json
```

## Architecture

- `src/model/decoder.js`: loads `decoder.onnx` with `onnxruntime-web` and returns image candidates.
- `src/model/rewardModel.js`: image-based preference reward model.
- `src/model/latentPolicy.js`: reward-score-driven 2D latent policy updates.
- `src/model/analyzers.js`: post-hoc diagnostic image analyzers only.
- `backend_training/`: offline PyTorch cVAE training and ONNX export.

Analyzer scores are never passed into the reward model or latent policy.
