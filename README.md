# FujoCoded Guestbook Lexicon

This repository contains a "sample" of an ATproto lexicon that defines
everything needed to build a guestbook program.

The structure is as follows:

- `lexicons/` contains the lexicons definitions.
  - `lexicons/com/fujocoded` contains our own definitions
  - `lexicons/com/atproto` contains the ATproto base definitions which are
    necessary for the program to work
- `client/` contains sample client applications that allow you to create
  a guestbook, list submissions on one, or post your own comments
  - `client/cli` contains a sample application using a command line interface
  - `client/web` contains a sample application using a web interface
- `appview/` contains the guestbook AppView that collects guestbook-related
  events as they happen on the network and offers a shared interface for guestbook applications to use
  - `appview/ingester.ts` listens to the stream of ATproto events on the network,
    grabs anything guestbook-related, and adds it to the AppView's database
  - `appview/index.ts` implements the query portion of the guestbook lexicon, offering
    applications a way to fetch guestbook-related informations
  - `appview/site/` an Astro-based implementation of a default guestbook client
    that allows people to embed a guestbook on their site

Right now, this is mostly a sample and teaching repo. You can watch us build
this live (or recorded) by [following Ms Boba on
Twitch](https://www.twitch.tv/essentialrandomness).

---

⊹₊ ˚‧︵‿₊୨ ᰔ ୧₊‿︵‧ ˚ ₊⊹ <br />
[Support FujoCoded on Patreon for More of This™!](https://www.patreon.com/fujocoded) <br />
⊹₊ ˚‧︵‿₊୨ ᰔ ୧₊‿︵‧ ˚ ₊⊹

---

## Using the CLI Client

The CLI client allows you to create, edit, delete and submit to guestbooks
through a terminal.

### 1. Generate the Lexicon API

The first step to use the client is to generate the lexicon API using the
definitions in the `lexicons/` folder. You can do this using the
[@atproto/lex-cli](https://www.npmjs.com/package/@atproto/lex-cli) package.
This creates all the code we need to safely and more easily handle guestbook
operations.

```bash
npx @atproto/lex-cli gen-api ./client/generated/api ./lexicons/**/*.json
```

### 2. Get an App Password

> Note: this is deprecated but Ms Boba doesn't care because she doesn't want
> to implement OAuth right now.

[Follow the instructions here](https://blueskyfeeds.com/en/faq-app-password).
You will need to add this in a `.env` file within `client/`.

```
APP_PASSWORD=your_password
```

### 2. Create your Guestbook

> Remember: you need to `npm install` the dependencies first!

1. Open `client/cli/create-guestbook.ts` and change things around to your desired data.
2. <u>ENTER THE CLIENT DIRECTORY</u> (`cd client`)
3. Run `npm run guestbook:create`

### 3. Post a Submission to your Guestbok (or Someone Else's)

1. Open `client/cli/create-submission.ts` and change things around to your desired data.
2. <u>ENTER THE CLIENT DIRECTORY</u> (`cd client`)
3. Run `npm run guestbook:submit`

You can see all the submissions as they happen with the following code:
`websocat wss://jetstream2.us-east.bsky.network/subscribe\?wantedCollections=com.fujocoded.guestbook.submission | jq 'select(.kind == "commit")'`

## Get an AppView Up

The AppView listens to guestbook-related events in the network and aggregates
data for consumption by applications and other clients.

### Generate the AppView Server definitions

The first step to creating an AppView the client is to generate the
endpoint definitions for our server by using the definitions in the `lexicons/`
folder. You can do this with the
[@atproto/lex-cli](https://www.npmjs.com/package/@atproto/lex-cli) package.
This creates all the code we need to provide applications with server
endpoints that respect the ATproto specifications and match the definitions
in our lexicon.

```bash
npx @atproto/lex-cli gen-server ./client/generated/server ./lexicons/**/*.json
```

### Generate a public/private key pair

The DID document for your AppView will need a public/private key pair to ensure
applications know you are who you say you are. Here's how you can generate one:

1. Enter the AppView directory with `cd appview/`
2. Generate the private key: `openssl ecparam -name secp256k1 -genkey -noout -out private_key.pem`
3. Generate the public key: `openssl ec -in private_key.pem -pubout -out public_key.pem`

### Create the database and initialize its schema

To save the guestbook events in the network and all details about existing guestbooks
we need a database with the right tables! You can create such a database by:

1. Add a `DB_FILE_NAME` property in your `.env` file (e.g. `DB_FILE_NAME=appview.db`)
2. Run `npx drizzle-kit push`

### Bring the ingestor up

To aggregate events on the network our AppView needs to listen to events on the
network, which it does through `appview/ingestor.ts`.

1. Enter the AppView directory with `cd appview/`
2. Run the ingestor with `npm run dev:ingestor`

### Bring the AppView server up

Now we run the actual AppView server so applications can ask for the data they
need.

1. Enter the appview directory `cd appview/`
2. Run `npm run dev` to start serving the AppView

#### Make the AppView server publicly available

IMPORTANT: To make the AppView work, it needs to be reachable from the external
internet at a specific address. If you have tailscale, you can use serve/funnel
to create this address. You can also use ngrok, or cloudflare tunnels.

1. Run `tailscale serve https / http://localhost:3003/`
2. Run `tailscale funnel 443 on`
3. Run `tailscale serve status` and use the address from the funnel

#### Configure the public address of your AppView server

1. Save the <u>public</u> address of your AppView server in the `.env`
   file under `appview/` (e.g. `APPVIEW_DOMAIN=worktop.tail2ad46.ts.net`)

## Putting your Guestbook on your Website

Right now, you can't (unless you want to implement the whole thing from scratch)!
Come to the streams and stay tuned for more functionality around this.

## ⚠️⚠️⚠️ DANGER: Deleting Everything ⚠️⚠️⚠️

Experimented too much and hate leaving a mess around? Delete everything with
`npm run guestbook:dangerously-delete-everything`, which will (again) DELETE EVERYTHING.

To use it you should:

1. Take the above steps to install the `cli` commands
2. Enter the client directory with `cd client/`
3. Run `npm run guestbook:dangerously-delete-everything`

If you want to be more targeted with what you delete and to set
the right values for your user, you can modify `client/cli/delete-everything.ts`.
Good luck!

## TODO-list!

- [x] Get someone else to write in the lexicon!
- [ ] Display other lexicons

### Lexicon

- [ ] Allow guestbooks moderation (e.g. delete entry)
- [ ] Allow blocking users
- [ ] Allow restricting which URLs a guestbook is displayable on

### AppView

- [x] Return handles of users
- [x] Return avatars of users
- [ ] Accept guestbook submissions from HTML
- [x] Improve HTML generation
- [ ] Check out CORS
- [ ] Allow creating guestbooks
- [ ] Move Astro-based client to client directory

### Client CLI

- [ ] Get rid of app passwords
- [ ] Allow global configuration
- [ ] Create initialization script
- [ ] Test that it's still working

#### Client HTML iframe

- [ ] Allow submission via form

#### Others

- [ ] Create Astro plugin
- [ ] Create guestbook webcomponent(?)

### Ingestor

- [x] Catch up with cursor
- [ ] Change timing of cursor save to consider all operations
- [ ] Handle identity/account events
- [ ] Handle deletions
