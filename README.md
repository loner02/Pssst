# PSSST: Personal Speech Service SysTem

```
Disclaimer: This is a proof-of-concept project for personal use, e.g. Private/Home networks, and not meant for enterprise deployment.
```

## What does PSSST do?

PSSST aims to provide personal speech services to any modern web client.

Currently, TTS (text-to-speech) is supported, even for devices without speech or voice installed.

## Why do this?

Web Speech API (according to documentation) is supported on Chrome only. (It's a Google thing.)

Google Speech services isn't free. Neither is Microsoft Azure Cognitive services.

If you're on a Private/Home network, you don't need to go online or pay for subscription to have speech services. You can setup one for your personal use.

## How does this work?

The system is composed of three blocks: the Web client, the Web & Socket server, and the Speech server.

-  Web client: Any device with a modern web browser. This is the user interface.
-  Web & Socket server: This provides the interface between the client and the speech server. It uses socket.io to communicate with the client and net pipes to communicate with the speech server.
-  Speech server: This performs the actual speech synthesis and sends an audio stream back to the client.

To initiate the TTS service, clients send a request thru a common pipe. Once granted, a dedicated local pipe will be assigned for each client. Each client can then select from the available voices and set its volume or rate. Text sent for the server to "speak" will be returned as an audio stream which the browser can then playback.

Why separate the servers into two? Answer: modularity. This makes it easier to modify the servers depending on the platform. Say for example, I want to change the web server from node.js to python. Or move the speech server from windows to linux.

## Features

### Web Client

-  Any device with a modern web browser (e.g PC, tablet, phone) and speaker.
-  Some devices may have limitations with respect to UI and/or audio. This is beyond the scope of PSSST.

### Web & Socket Server

-  A web server with support for socket.io and net pipes.
-  Currently implemented using node.js, with express, socket.io and node-lame modules.
-  Automatically converts the audio stream to MP3 for smaller size and wider browser support.

### Speech Server

-  A server with TTS capability or application.
-  Currently implemented as a .Net console app that interface to System.Speech library on Windows.
-  Currently supports SAPI5 voices (32-bits or 64-bits).
-  Also outputs viseme data, making it possible for animated avatars to speak in sync with the audio.

## How to use?

-  First, if not provided, build the Speech server source. This was built using MS Visual Studio and .Net Framework 4.6.1.
-  On separate console terminals, run Speech server and Web & Socket server (no particular order necessary)
```
> speechServer.exe [--debug]

> node app.js
```
-  Open a web browser (on a device connected to the same network) and connect to server. E.g.
```
http://<server-address>:3000
localhost:3000
```

## Limitations

No security or encryption implemented, as Private/Home networks are supposed to be Trusted networks anyway. It shouldn't be too hard though to implement one.

## Known Issues

Some SAPI5 voices do not allow multiple clients. So if a client is already using a particular voice or fails to properly disconnect, there will be no speech output for another client trying to use said voice. Microsoft voices (or 64-bit voices?) are apparently not affected by this issue.

## License

MIT