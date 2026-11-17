# FLUJOS RGV floodmaps app

## Releases

In order to download a working zip file of the app for deployment, make sure to create a release. To trigger a release you have to create a pull request from the `main` branch to the `release` branch.

[Create a new release](https://github.com/flujos-rgv/rgvflood/compare/release...main)

## Container deployment

The app is a static export, so the container is just nginx serving the built files (about 280 MB, mostly flood tiles).

- **Build:** `.github/workflows/container.yml` builds the image on every push to `main` and publishes it to `ghcr.io/uw-madison-dsi/rgvflood:latest`. Pull requests build the image without publishing it.
- **Mapbox token:** read at build time from the `NEXT_PUBLIC_MAPBOX_TOKEN` repository secret and baked into the client JavaScript. Use a public token restricted by URL. The build fails if the token is missing.
- **Server:** `deploy/rgvflood.container` is a Podman Quadlet unit (Podman 4.4+). The server pulls new images itself via `podman-auto-update.timer`, so nothing needs inbound access to the server to deploy. Install steps are in the comments at the top of that file.

To build and run locally:

```shell
docker build --build-arg NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token -t rgvflood .
docker run --rm -p 8080:80 rgvflood
```

## Next steps (TODO)

- [x] Add final mapbox token (NEXT_PUBLIC_MAPBOX_TOKEN)
- [ ] Add tailwindcss as a styling solution
- [ ] Refactor to use next js app directory
