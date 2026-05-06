"""Grayscale MNIST resized to square RGB tensors for the unconditional VAE encoder."""

import torch
from torch.utils.data import Dataset
from torchvision import datasets, transforms
from torchvision.transforms import InterpolationMode


class MnistRgb64(Dataset):
    """MNIST as [3, H, W] in [-1, 1] (channels replicated). Labels are digit ints."""

    def __init__(self, root, train=True, image_size=64, download=True):
        self.image_size = image_size
        self.mnist = datasets.MNIST(
            root=root,
            train=train,
            download=download,
            transform=transforms.Compose(
                [
                    transforms.Resize(
                        (image_size, image_size),
                        interpolation=InterpolationMode.BILINEAR,
                    ),
                    transforms.ToTensor(),
                ]
            ),
        )

    def __len__(self):
        return len(self.mnist)

    def __getitem__(self, idx):
        digit_tensor, label = self.mnist[idx]
        gray = digit_tensor.expand(3, self.image_size, self.image_size).clone()
        image = gray * 2.0 - 1.0
        return image, int(label)
