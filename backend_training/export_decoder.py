import argparse
import json
from pathlib import Path

import torch

from models.cvae import ConditionalVAE


def parse_args():
    parser = argparse.ArgumentParser(description="Export the cVAE decoder to ONNX.")
    parser.add_argument("--checkpoint", type=Path, default=Path("backend_training/checkpoints/cvae.pt"))
    parser.add_argument("--onnx-out", type=Path, default=Path("public/models/decoder.onnx"))
    parser.add_argument("--metadata-out", type=Path, default=Path("public/models/metadata.json"))
    parser.add_argument("--opset", type=int, default=17)

    return parser.parse_args()


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

    print(f"exported decoder: {args.onnx_out}")
    print(f"exported metadata: {args.metadata_out}")


if __name__ == "__main__":
    main()
