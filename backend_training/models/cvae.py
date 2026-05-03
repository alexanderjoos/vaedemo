import torch
from torch import nn
import torch.nn.functional as F


class ConditionalEncoder(nn.Module):
    def __init__(self, latent_dim=2, num_classes=10):
        super().__init__()
        self.conv = nn.Sequential(
            nn.Conv2d(3 + num_classes, 32, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(32),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(32, 64, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(64),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(64, 128, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(128),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(128, 256, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(256),
            nn.LeakyReLU(0.2, inplace=True),
        )
        self.fc_mu = nn.Linear(256 * 4 * 4, latent_dim)
        self.fc_logvar = nn.Linear(256 * 4 * 4, latent_dim)

    def forward(self, x, y):
        batch, _, height, width = x.shape
        y_map = y.view(batch, -1, 1, 1).expand(-1, -1, height, width)
        h = self.conv(torch.cat([x, y_map], dim=1)).flatten(1)

        return self.fc_mu(h), self.fc_logvar(h)


class ConditionalDecoder(nn.Module):
    def __init__(self, latent_dim=2, num_classes=10):
        super().__init__()
        self.fc = nn.Sequential(
            nn.Linear(latent_dim + num_classes, 256 * 4 * 4),
            nn.ReLU(inplace=True),
        )
        self.deconv = nn.Sequential(
            nn.ConvTranspose2d(256, 128, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.ConvTranspose2d(128, 64, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.ConvTranspose2d(64, 32, kernel_size=4, stride=2, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.ConvTranspose2d(32, 3, kernel_size=4, stride=2, padding=1),
            nn.Tanh(),
        )

    def forward(self, z, y):
        h = self.fc(torch.cat([z, y], dim=1)).view(-1, 256, 4, 4)

        return self.deconv(h)


class ConditionalVAE(nn.Module):
    def __init__(self, latent_dim=2, num_classes=10):
        super().__init__()
        self.latent_dim = latent_dim
        self.num_classes = num_classes
        self.encoder = ConditionalEncoder(latent_dim=latent_dim, num_classes=num_classes)
        self.decoder = ConditionalDecoder(latent_dim=latent_dim, num_classes=num_classes)

    def encode(self, x, y):
        return self.encoder(x, y)

    def reparameterize(self, mu, logvar):
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)

        return mu + eps * std

    def decode(self, z, y):
        return self.decoder(z, y)

    def forward(self, x, y):
        mu, logvar = self.encode(x, y)
        z = self.reparameterize(mu, logvar)
        recon = self.decode(z, y)

        return recon, mu, logvar


def vae_loss(recon, target, mu, logvar, beta=0.001):
    recon_loss = F.mse_loss(recon, target, reduction="mean")
    kl = -0.5 * torch.mean(1 + logvar - mu.pow(2) - logvar.exp())

    return recon_loss + beta * kl, recon_loss, kl
