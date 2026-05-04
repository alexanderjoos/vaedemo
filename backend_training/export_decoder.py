import argparse
import json
import random
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from data.colored_mnist import ColoredMNIST
from models.cvae import ConditionalVAE


def parse_args():
    parser = argparse.ArgumentParser(description="Export the cVAE decoder to ONNX.")
    parser.add_argument("--checkpoint", type=Path, default=Path("backend_training/checkpoints/cvae.pt"))
    parser.add_argument("--onnx-out", type=Path, default=Path("public/models/decoder.onnx"))
    parser.add_argument("--metadata-out", type=Path, default=Path("public/models/metadata.json"))
    parser.add_argument("--latent-map-out", type=Path, default=Path("public/models/latent_map.json"))
    parser.add_argument("--data-dir", type=Path, default=Path("backend_training/.data"))
    parser.add_argument("--latent-map-samples-per-digit", type=int, default=250)
    parser.add_argument("--latent-map-batch-size", type=int, default=256)
    parser.add_argument("--opset", type=int, default=17)

    return parser.parse_args()


def compute_digit_stats(points_by_digit):
    stats = []

    for digit, points in enumerate(points_by_digit):
        point_tensor = torch.tensor(points, dtype=torch.float32)
        mean = point_tensor.mean(dim=0)
        centered = point_tensor - mean
        rms_radius = torch.sqrt(torch.mean(torch.sum(centered.pow(2), dim=1)))
        std = float(torch.clamp(rms_radius / (2 ** 0.5), min=0.25))

        stats.append(
            {
                "digit": digit,
                "mean": [round(float(mean[0]), 5), round(float(mean[1]), 5)],
                "std": round(std, 5),
                "points": [[round(float(x), 5), round(float(y), 5)] for x, y in points],
            }
        )

    return stats


def export_latent_map(model, args, image_size):
    random.seed(7)
    torch.manual_seed(7)

    dataset = ColoredMNIST(
        root=args.data_dir,
        train=True,
        image_size=image_size,
        download=True,
    )
    loader = DataLoader(
        dataset,
        batch_size=args.latent_map_batch_size,
        shuffle=False,
        num_workers=0,
        drop_last=False,
    )

    points_by_digit = [[] for _ in range(10)]

    with torch.no_grad():
        for images, labels, label_ids in loader:
            mu, _ = model.encode(images, labels)

            for idx, label_id in enumerate(label_ids.tolist()):
                if len(points_by_digit[label_id]) >= args.latent_map_samples_per_digit:
                    continue

                point = mu[idx].tolist()
                points_by_digit[label_id].append(point)

            if all(len(points) >= args.latent_map_samples_per_digit for points in points_by_digit):
                break

    if not all(points_by_digit):
        raise RuntimeError("Could not collect latent points for every digit.")

    stats = compute_digit_stats(points_by_digit)
    extent = max(abs(value) for item in stats for point in item["points"] for value in point)

    payload = {
        "latent_dim": 2,
        "extent": round(float(max(2.8, extent + 0.35)), 5),
        "digits": stats,
    }

    args.latent_map_out.parent.mkdir(parents=True, exist_ok=True)
    args.latent_map_out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"exported latent map: {args.latent_map_out}")


def main():
    args = parse_args()
    checkpoint = torch.load(args.checkpoint, map_location="cpu")
    latent_dim = int(checkpoint.get("latent_dim", 2))
    image_size = int(checkpoint.get("image_size", 64))

    model = ConditionalVAE(latent_dim=latent_dim)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    args.onnx_out.parent.mkdir(parents=True, exist_ok=True)
    args.metadata_out.parent.mkdir(parents=True, exist_ok=True)

    z = torch.zeros(1, latent_dim, dtype=torch.float32)
    y = torch.zeros(1, 10, dtype=torch.float32)
    y[0, 0] = 1.0

    torch.onnx.export(
        model.decoder,
        (z, y),
        args.onnx_out,
        input_names=["z", "digit_onehot"],
        output_names=["image"],
        dynamic_axes={
            "z": {0: "batch"},
            "digit_onehot": {0: "batch"},
            "image": {0: "batch"},
        },
        opset_version=args.opset,
    )

    metadata = {
        "latent_dim": latent_dim,
        "image_size": image_size,
        "digits": list(range(10)),
        "output_range": [-1, 1],
    }
    args.metadata_out.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    export_latent_map(model, args, image_size)

    print(f"exported decoder: {args.onnx_out}")
    print(f"exported metadata: {args.metadata_out}")


if __name__ == "__main__":
    main()
