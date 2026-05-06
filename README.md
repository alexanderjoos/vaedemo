# Preference Reward Model VAE

This demo visualizes the reward-modeling stage of RLHF: it shows how human preferences shift sampling away from the original prior before those preferences are used to retrain the base model.

In standard RLHF-style pipelines, a reward model is trained from human preferences and then used to optimize the main model. This project isolates that intermediate stage live in the browser:

- the VAE is trained offline first
- the decoder stays frozen during the demo
- the user gives pairwise preferences
- the browser updates a small reward model
- the sampler over latent space shifts away from the original prior based on the learned reward signal

So this is best understood as a preference-reward-model demo, not full RLHF fine-tuning.

The latent view is inspired by the [CS4782 MNIST viewer](https://www.cs.cornell.edu/courses/cs4782/2026sp/demos/vae/vae_viewer.html): click or drag to move around a 2D latent space and decode a digit at that point. The purple heatmap shows where the current preference-guided sampler is concentrating probability mass while the decoder itself stays fixed.
## Quickstart

If you only want to run the demo, no training is required. The exported model files are already included in `public/models/`.

Prerequisites:

- Node.js 20+ and npm

Run:

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

`decoder.onnx.data` is present when ONNX weights are stored externally.

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
decoder.onnx.data
metadata.json
latent_map.json
```

The preference-reward-model portion stays local in the browser. Colab is only for training and exporting the base decoder plus latent-map asset.

## Local Preference Loop

Once the exported files are back in `public/models/`, start the app locally:

```bash
npm install
npm run dev -- --host 127.0.0.1
```

Then open the local Vite URL and use the preference arena. Each click updates the in-browser reward model and the sampling distribution over latent space against the frozen decoder you trained in Colab.

What changes during the demo:

- reward model weights
- latent sampler mean and spread

What does not change during the demo:

- VAE encoder weights
- VAE decoder weights
- ONNX model files on disk

## Architecture

- `src/model/decoder.js`: loads `decoder.onnx` with `onnxruntime-web` and returns image candidates.
- `src/model/rewardModel.js`: image-based preference reward model.
- `src/model/latentPolicy.js`: reward-score-driven updates to the latent sampling distribution.
- `src/model/latentMap.js`: latent embedding asset loader for the CS4782-style visualization.
- `backend_training/`: offline PyTorch unconditional MNIST VAE training and ONNX export (`train_unconditional_mnist.py`, `export_decoder.py`).
