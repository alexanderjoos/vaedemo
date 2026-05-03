# Offline cVAE Training

Install the Python dependencies in your preferred environment:

```bash
pip install torch torchvision onnx
```

Train the 2D conditional VAE:

```bash
python backend_training/train_cvae.py --epochs 20
```

Export the decoder for the Vite frontend:

```bash
python backend_training/export_decoder.py
```

This writes:

- `backend_training/checkpoints/cvae.pt`
- `public/models/decoder.onnx`
- `public/models/metadata.json`

Sample a generated latent grid for visual inspection:

```bash
python backend_training/sample_grid.py --digit 7 --out backend_training/checkpoints/sample_grid_digit7.png
```
