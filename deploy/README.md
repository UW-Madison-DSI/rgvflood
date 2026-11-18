# Server deployment

How the public instance at https://sage-050798.cci.wisc.edu is set up, and how to rebuild it from scratch.

## Overview

The server is a Rocky Linux VM on UW-Madison's Campus Computing Infrastructure (CCI), public IP `128.104.50.38`. First deployed 2026-11-17, HTTPS added 2026-11-18.

```
browser
  |  https (443), http (80) redirects to https
  v
host nginx            /etc/nginx/conf.d/rgvflood.conf
  |  holds the Let's Encrypt certificate (certbot)
  v  http://127.0.0.1:8080
rgvflood container    ghcr.io/uw-madison-dsi/rgvflood:latest
  nginx serving the static site (pages, tiles, data)
```

Why it is built this way:

- **Static site in a container.** The app has no backend, so the image is nginx plus the exported files. Building it on GitHub keeps Node, the repo, and the Mapbox token off the server.
- **The server pulls its own updates.** Deploys need no inbound access to the server, which matters on a campus network where SSH from GitHub is not available.
- **HTTPS on the host, not in the image.** Certificates are tied to a hostname. Keeping them on the host means the same image can run anywhere.

## How updates reach the server

1. A change is merged to `main`.
2. `.github/workflows/container.yml` builds the image and pushes it to GitHub Container Registry. The image is public, so the server needs no registry login.
3. `podman-auto-update.timer` on the server checks the registry daily, pulls a newer image if there is one, restarts the service, and rolls back if the new container fails to start.

The two files in this directory that are installed on the server (`rgvflood.container` and `host-nginx.conf`) are not part of the image. If you change them here, copy them to the server by hand.

## What is on the server

| Path | Purpose |
|---|---|
| `/etc/containers/systemd/rgvflood.container` | Podman Quadlet unit, from `deploy/rgvflood.container`. Defines the `rgvflood` systemd service. |
| `/etc/nginx/conf.d/rgvflood.conf` | Host nginx proxy, from `deploy/host-nginx.conf`. Certbot has since added the port 443 server and the http redirect to the installed copy. |
| `/etc/letsencrypt/` | Certificate and renewal settings, managed by certbot. |

Also in place: firewalld allows `http` and `https`, the SELinux boolean `httpd_can_network_connect` is on (so nginx can reach the container), and the campus firewall allows inbound 80 and 443 from off campus (opened by CCI on request, 2026-11-18).

## Common commands

```shell
systemctl status rgvflood nginx           # are both running
journalctl -u rgvflood -n 50              # container logs
sudo systemctl restart rgvflood           # restart the site
sudo podman auto-update                   # pull a new image now
systemctl list-timers podman-auto-update.timer certbot-renew.timer
sudo certbot certificates                 # certificate expiry
sudo certbot renew --dry-run              # test renewal
```

After editing the `.container` file run `sudo systemctl daemon-reload`. After editing the nginx config run `sudo nginx -t && sudo systemctl reload nginx`.

## Rebuilding from scratch

On a fresh Rocky Linux 9 VM with a public hostname and inbound 80/443 open:

```shell
B=https://raw.githubusercontent.com/UW-Madison-DSI/rgvflood/main/deploy

# Packages
sudo dnf install -y podman nginx epel-release
sudo dnf install -y certbot python3-certbot-nginx
sudo firewall-cmd --permanent --add-service=http --add-service=https
sudo firewall-cmd --reload

# Container, on 127.0.0.1:8080
sudo curl -fsSL -o /etc/containers/systemd/rgvflood.container $B/rgvflood.container
sudo systemctl daemon-reload
sudo systemctl start rgvflood
sudo systemctl enable --now podman-auto-update.timer

# Host nginx proxy
sudo curl -fsSL -o /etc/nginx/conf.d/rgvflood.conf $B/host-nginx.conf
sudo setsebool -P httpd_can_network_connect 1
sudo nginx -t && sudo systemctl enable --now nginx

# HTTPS with automatic renewal
sudo certbot --nginx -d sage-050798.cci.wisc.edu --redirect
sudo systemctl enable --now certbot-renew.timer
sudo certbot renew --dry-run
```

For a different hostname, change `server_name` in the nginx config and the `-d` argument, and add the hostname to the Mapbox token's URL restrictions.

## Mapbox token

The basemap and address search need a public Mapbox token. It is stored as the `NEXT_PUBLIC_MAPBOX_TOKEN` Actions secret on this repository and baked into the site's JavaScript when the image is built, so it is visible to every visitor. It is protected by a URL restriction in the Mapbox dashboard, currently `sage-050798.cci.wisc.edu`. Changing the token means updating the secret and re-running the workflow.

## Known gaps

- `src/pages/_document.js` still loads the original project's Plausible analytics tag (`data-domain="flujos-rgv"`), so visits here are reported to that account.
- The hostname is the VM's default name. A friendlier one would need a DNS record, a new certificate, and an addition to the Mapbox token restrictions.
