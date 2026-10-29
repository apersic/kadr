# Run Kadr

Kadr is a local chat for three Instagram posts. You name a brand. Kadr reads that brand's website and Instagram profile, writes one prompt, and asks an image model for a square post, a carousel, and a story. Nothing is published.

The prompt text is `server/prompt.mjs`.

## Install and start

You need Node and Google Chrome. Kadr opens the Instagram profile in the Chrome installed on this machine.

In this folder, install the dependencies.

```
npm install
```

Create `.env` next to `package.json`.

```
IMAGE_PROVIDER=pollinations
IMAGE_MODEL=flux
IMAGE_API_KEY=
```

Put your Pollinations key in `IMAGE_API_KEY`. `flux` is the model that still returns an image when the paid balance is 0. `gptimage-large` is the stronger model on the same service. To use it, add credit at https://enter.pollinations.ai/top-up. Then set `IMAGE_MODEL=gptimage-large`.

Start the app.

```
npm run dev
```

Open http://localhost:5174/. The server uses that port and will not pick another one.

## Use a brief

Answer the questions in the chat. Brand, website, Instagram, and products are required. The rest can be skipped.

To try a real brand, choose **GymBeam** or type GymBeam. That brief uses https://gymbeam.hr/ and https://www.instagram.com/gymbeamhr/.

When the posts appear, **Provjereno** stays closed. Open it to read what Kadr checked. **Predložak koji je otišao modelu** is also closed. **Copy message** copies one prompt that lists every image in that run.

## Check the project

These are the commands in `.github/workflows/prod_build.yaml`. Node comes from `.nvmrc`.

```
npm run typecheck
npm run lint
npm run test
npm run build
```
