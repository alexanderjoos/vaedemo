import colorsys
import random

import torch
from torch.utils.data import Dataset
from torchvision import datasets, transforms
from torchvision.transforms import InterpolationMode


class ColoredMNIST(Dataset):
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
        digit, label = self.mnist[idx]
        mask = digit.clamp(0.0, 1.0)

        hue_choices = [
            random.uniform(195, 250),
            random.uniform(260, 305),
            random.uniform(5, 55),
            random.uniform(85, 160),
            random.uniform(0, 360),
        ]
        hue = random.choice(hue_choices)
        saturation = random.uniform(0.58, 1.0)
        lightness = random.uniform(0.48, 0.78)
        bg_hue = (hue + random.uniform(-35, 35)) % 360
        bg_lightness = random.uniform(0.05, 0.14)

        stroke_rgb = torch.tensor(
            colorsys.hls_to_rgb(hue / 360.0, lightness, saturation),
            dtype=torch.float32,
        ).view(3, 1, 1)
        bg_rgb = torch.tensor(
            colorsys.hls_to_rgb(bg_hue / 360.0, bg_lightness, 0.45),
            dtype=torch.float32,
        ).view(3, 1, 1)

        color_jitter = torch.empty(3, 1, 1).uniform_(0.92, 1.08)
        image = bg_rgb * (1.0 - mask) + (stroke_rgb * color_jitter).clamp(0.0, 1.0) * mask

        if random.random() < 0.7:
            noise = torch.randn_like(image) * random.uniform(0.005, 0.035)
            image = (image + noise).clamp(0.0, 1.0)

        one_hot = torch.zeros(10, dtype=torch.float32)
        one_hot[label] = 1.0

        # The cVAE trains in tanh image space so exported decoder output is [-1, 1].
        image = image * 2.0 - 1.0

        return image, one_hot, label
