<div style="text-align: center;">

  <img src="public/banner.png" alt="PolarLearn Banner" />

---

  <img src="https://img.shields.io/badge/Created_By-PolarNL-%2338bdf8?style=for-the-badge" alt="Created By Badge" />
  <img src="https://img.shields.io/badge/Created_Using-React_Router-%23F44250?style=for-the-badge" alt="Created Using Badge" />
  <img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fpolarnl%2FPolarLearn-v2%2Frefs%2Fheads%2Fv2%2Fpackage.json&query=%24.version&style=for-the-badge&label=Version" alt="GitHub package.json version (branch)" />
  <img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/polarnl/polarlearn-v2?style=for-the-badge&color=yellow">

  <a href="https://discord.gg/3hTGFmKyZn">
    <img src="https://img.shields.io/discord/1335193685264044123?style=for-the-badge&label=DISCORD" alt="Discord" />
  </a>

</div>

# PolarLearn

PolarLearn is a free and open-source learning platform designed to provide the best learning experience for students.

## Features
- **Open Source**: We are transparent about our code and we welcome contributions from the community.
- **Lists**: Learn with lists of flashcards, quizzes, and more.
- **Forum**: Ask questions, share knowledge, and connect with other learners with (almost) zero restrictions on what you can discuss, wether it's about your personal life, tech or recent news, we allow it!

## Hosting and/or development setup

If you want to set up PolarLearn for hosting, follow these instructions:

> [!NOTE]
> If you want to deploy PolarLearn for your organization, it is highly recommended to use something more professional, like [Dokploy](https://dokploy.com/) or Kubernetes. This guide only shows how to get PolarLearn up and running, it does not show how to actually scale it for production workloads.

### Method 1: Vite

### Prerequisites
- PostgreSQL >=16
- NodeJS LTS
- (preferably) pnpm >=11.x.x

### Instructions

First install all the project dependencies:
```bash
pnpm i
```
If pnpm prompts you about unapproved builds, please approve them first before continuing.

Then, make a copy of `.env.example` and name it `.env`. Replace the variables accordingly:
#### Mandatory variables
- `DATABASE_URL`: This is the PostgreSQL connection string.
- `APP_BASE`: This is the full URL of where PolarLearn gets reached. For example: `APP_BASE=https://staging.internal.polarlearn.nl/`, or `APP_BASE=http://localhost:5173`.
- `APP_LANG`: Language of the app. `nl` is currently the only supported variable as we currently don't need other languages.
- `SECRET`: A long random string used for cryptographically signing authentication tokens and other things inside the app. You can generate it using `openssl rand -base64 32`.

#### Optional variables
- `SMTP_HOST`: The domain or IP where your SMTP server (postfix, mailcow) resides.
- `SMTP_PORT`: The port used to reach the SMTP server.
- `SMTP_SECURE`: Wether to not send the email traffic in plaintext.
- `SMTP_USER`: Username for SMTP authentication.
- `SMTP_PASS`: Password for SMTP authentication.
- `SMTP_FROM`: From which e-mail address to send the emails (optional, depends on server)

- `S3_BUCKET`: Name of the storage bucket.
- `S3_REGION`: Region of the storage bucket (optional only if you're selfhosting, check the docs for your server/provider)
- `S3_ENDPOINT`: The endpoint for the S3 server, for example `https://cdn.polarlearn.nl`.
- `S3_ACCESS_KEY_ID`: The access key ID for the S3 bucket.
- `S3_SECRET_ACCESS_KEY`: The access key for the S3 bucket.

- `LOKI_HOST`: URL where Loki resides.
- `LOKI_BASIC_AUTH`: The username and password used for authenticating with Loki. Example: `polarnl-loki:superdupercoolpassword123`

Generate the prisma client and synchronize the postgres database by executing:
```
pnpm dbsync
```

You are now ready to boot PolarLearn. You can do this in two ways:

Starting the development server:
```
pnpm dev
```
Do this when you're modifying PolarLearn's source code. This enables live refresh/hot module reloading. Do note this is slower.

Starting the production server:

```
pnpm build && pnpm start
```
Do this when you are testing or deploying PolarLearn. This will be faster than the development server, however you will not have HMR.

### Method 2: Docker

### Prerequisites
- Docker
- PostgreSQL >=16

### Instructions
Run:
```bash
docker run ghcr.io/polarnl/polarlearn-v2 \
  -p 3000:3000 \
  -e DATABASE_URL=postgresql://...
```
Please refer to method 1 for the environment variables.


## Contributing
We welcome contributions from the community! If you would like to contribute, please check CONTRIBUTING.md for guidelines on how to get started.

## License
This project is licensed under the Affero GNU General Public License v3.0 (AGPL-3.0). See LICENSE for more details.

## Contact
If you have any questions or suggestions, feel free to reach out to us through our mail (andrei.k@polarnl.org), our Discord server (click the badge above), or shoot us an issue on GitHub!
