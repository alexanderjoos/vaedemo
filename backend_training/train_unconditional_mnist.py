"""Train an unconditional 2D VAE on MNIST for Cornell-style latent navigation."""

import argparse
from pathlib import Path

import torch
from torch.utils.data import DataLoader
from torchvision.utils import save_image

from data.mnist_rgb import MnistRgb64
from models.vae import VAE, vae_loss


def parse_args():
    parser = argparse.ArgumentParser(description="Train a 2D unconditional VAE on MNIST (RGB-normalized).")
    parser.add_argument("--data-dir", type=Path, default=Path("backend_training/.data"))
    parser.add_argument("--checkpoint", type=Path, default=Path("backend_training/checkpoints/mnist_vae.pt"))
    parser.add_argument("--preview", type=Path, default=Path("backend_training/checkpoints/mnist_recon_preview.png"))
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--lr", type=float, default=2e-4)
    parser.add_argument("--beta", type=float, default=0.004, help="KL weight (moderate for separated clusters)")
    parser.add_argument("--latent-dim", type=int, default=2)
    parser.add_argument("--image-size", type=int, default=64)
    parser.add_argument("--num-workers", type=int, default=2)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--device", choices=["auto", "cpu", "cuda", "mps"], default="auto")
    return parser.parse_args()


def resolve_device(name):
    if name != "auto":
        return torch.device(name)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def save_preview(model, batch_images, out_path, device):
    images = batch_images[:8].to(device)
    model.eval()
    with torch.no_grad():
        recon, _, _ = model(images)
        grid = torch.cat([images, recon], dim=0)
        grid = (grid + 1.0) / 2.0
        out_path.parent.mkdir(parents=True, exist_ok=True)
        save_image(grid, out_path, nrow=8)
    model.train()


def main():
    args = parse_args()
    torch.manual_seed(args.seed)
    device = resolve_device(args.device)

    dataset = MnistRgb64(
        root=args.data_dir,
        train=True,
        image_size=args.image_size,
        download=True,
    )
    loader = DataLoader(
        dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=args.num_workers,
        pin_memory=device.type == "cuda",
        drop_last=True,
    )

    model = VAE(latent_dim=args.latent_dim).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr)

    args.checkpoint.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(1, args.epochs + 1):
        total_loss = 0.0
        total_recon = 0.0
        total_kl = 0.0

        for images, _labels in loader:
            images = images.to(device)

            optimizer.zero_grad(set_to_none=True)
            recon, mu, logvar = model(images)
            loss, recon_loss, kl = vae_loss(recon, images, mu, logvar, beta=args.beta)
            loss.backward()
            optimizer.step()

            total_loss += loss.item()
            total_recon += recon_loss.item()
            total_kl += kl.item()

        steps = max(1, len(loader))
        print(
            f"epoch {epoch:03d} "
            f"loss={total_loss / steps:.5f} "
            f"recon={total_recon / steps:.5f} "
            f"kl={total_kl / steps:.5f}"
        )

        if epoch == 1 or epoch == args.epochs or epoch % 5 == 0:
            save_preview(model, next(iter(loader))[0], args.preview, device)

    torch.save(
        {
            "model_state_dict": model.state_dict(),
            "latent_dim": args.latent_dim,
            "image_size": args.image_size,
            "output_range": [-1, 1],
            "conditioning": "none",
        },
        args.checkpoint,
    )
    print(f"saved checkpoint: {args.checkpoint}")
    print(f"saved preview: {args.preview}")


if __name__ == "__main__":
    main()
