import argparse
from pathlib import Path

import torch
from torchvision.utils import save_image

try:
    from backend_training.models.vae import VAE
except ModuleNotFoundError:
    from models.vae import VAE


def parse_args():
    parser = argparse.ArgumentParser(description="Sample a latent grid from the trained VAE decoder.")
    parser.add_argument("--checkpoint", type=Path, default=Path("backend_training/checkpoints/vae.pt"))
    parser.add_argument("--out", type=Path, default=Path("backend_training/checkpoints/sample_grid.png"))
    parser.add_argument("--grid-size", type=int, default=9)
    parser.add_argument("--extent", type=float, default=2.5)
    parser.add_argument("--device", choices=["cpu", "cuda", "mps"], default="cpu")

    return parser.parse_args()


def main():
    args = parse_args()
    checkpoint = torch.load(args.checkpoint, map_location=args.device)
    latent_dim = int(checkpoint.get("latent_dim", 2))

    if latent_dim != 2:
        raise ValueError("sample_grid.py expects latent_dim=2.")

    model = VAE(latent_dim=latent_dim).to(args.device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    xs = torch.linspace(-args.extent, args.extent, args.grid_size, device=args.device)
    ys = torch.linspace(args.extent, -args.extent, args.grid_size, device=args.device)
    z = torch.stack(
        [torch.tensor([x, y], device=args.device) for y in ys for x in xs],
        dim=0,
    )
    with torch.no_grad():
        images = model.decode(z)
        images = (images + 1.0) / 2.0

    args.out.parent.mkdir(parents=True, exist_ok=True)
    save_image(images, args.out, nrow=args.grid_size)
    print(f"saved sample grid: {args.out}")


if __name__ == "__main__":
    main()
