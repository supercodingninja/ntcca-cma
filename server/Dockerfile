# Notation converter: MuseScore headless + tiny Node API.
# Converts .mscz / .musicxml / .xml / .mxl -> PDF (and PNG) for the app.
# .sib is proprietary: those uploads get an honest "export MusicXML from
# Sibelius first" message until a licensed Sibelius pipeline is available.
FROM node:20-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends musescore3 fonts-freefont-ttf \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY package.json ./
RUN npm install --omit=dev
COPY index.js live.js ./

ENV PORT=10000
EXPOSE 10000
CMD ["node", "index.js"]
