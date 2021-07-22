# PSSST: Personal Speech Services SysTem

```
Disclaimer: This is a proof-of-concept project for personal use, e.g. Private/Home networks, 
and not meant for production or enterprise deployment.
```

## What does PSSST do?

PSSST aims to provide personal speech services to any modern web client.

Currently, TTS (text-to-speech) or Speech Synthesis is supported, even for devices without speech services or voices installed.

STT (speech-to-text) or Speech Recognition to follow.

## Why do this?

Web Speech API (according to documentation) is experimental with limited browser support. It relies on the speech services installed on the device.

Google Cloud Speech services isn't free. Neither is Microsoft Azure Cognitive services. And so are dozens of others that offer multiple languages and voices.

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
-  Automatically converts the audio stream to MP3 for smaller size and wider browser support. Uses LAME encoder.

### Speech Server

-  A server with TTS capability or application.
-  Currently implemented as a .Net console app that interface to System.Speech library on Windows.
-  Currently supports SAPI5 voices (32-bits or 64-bits).
-  Also outputs viseme data, making it possible for animated avatars to speak in sync with the audio. (Windows backend only)

## Installation

Note: It is recommended to put the Speech and Web servers on the same machine. If on different machines, change the communication method between the two from Named Pipe to TCP (or network) Pipes.

Preliminary: Download PSSST source code from Github. Copy to desired location on the server

### Speech Server

On a Windows platform:

-  Recommended platform: Windows 10 x64 (choice of platform depends on available speech library)
-  If needed, install .Net Runtime library. The default Speech server was built using .Net Framework 4.6.1 for compatibility with older systems.
-  MS Windows come with pre-installed voices. Install 3rd party SAPI5 voices if desired.
-  Build Speech server source (from /server/src/SpeechServer) using MS Visual Studio 2015 or higher. Copy the executable to /server/win folder.
-  Open a console terminal and start the Speech server. The server will wait for connections via Net Pipes.

On a Linux platform:

-  Recommended platform: Ubuntu 20.04
-  Choose between MIMIC or FLITE as TTS engine.
    -  Flite
        ```
        > sudo apt install flite
        ```
        -  Or build the source from: https://github.com/festvox/flite
    - Mimic (fork of flite)
        -  Download and build mimic: https://github.com/MycroftAI/mimic1
        -  Install mimic system-wide. In mimic1 folder
        ```
        > sudo make install
        ```
-  Install additional voices if desired: http://www.festvox.org/flite/packed/flite-2.0/voices/. Place in /server/linux/voices.
    -  Make sure voices are compatible with the version of mimic or flite. Mimic using version 2.1 voices may result in segmentaion fault. Flite 2.1 seems to be ok with voice versions 2.0/2.1.
    -  flitevox voices do not seem to have description in metadata unlike SAPI voices (or do they?). Manually add description in 'voices.json'. Some built-in voices of flite/mimic have already been added to 'voices.json'.
-  Open a console terminal and start the Speech server. The server will wait for connections via Net Pipes.

### Web & Socket Server

On a Windows platform:

-  Recommended platform: Windows 10 x64. Assumed colocated on same machine as Speech server.
-  Install node.js, if not yet installed.
-  Install node.js dependencies
```
> cd <PSSST installation folder>
> mkdir node_modules
> npm install express socket.io node-lame 
```
-  Optional, modify webpage under /client folder
-  Run the app. The server will wait for client connection via socket.io.

On a Linux platform:

-  Recommended platform: Ubunty 20.04. Assumed colocated on same machine as Speech server.
-  Install lame encoder if not yet installed
```
> sudo apt install lame
```
-  Follow same procedure as Windows platform.
-  No code changes are necessary.

### Web Client

-  Use any device with a modern browser (PC, tablet, phone, etc.)
-  Connect the client and server to the same network
-  On the device browser, connect to the web server

## Usage

-  Run the Speech server
```
> cd <PSSST installation folder>

for Windows backend:
> .\server\win\speechServer.exe [--debug]

for Linux backend:
> node ./server/linux/app.js [options]

Options:
--tts=[flite | mimic]   Select TTS engine. Default is flite
--debug                 Output debug messages on console
```
-  Run the Web & Socket server
```
> node app.js
```
-  Open the web client on a browser
```
http://server-address:3000
or
http://localhost:3000 if on the server machine
```
-  If using the default webpage:
    -  Input Name and Gender
    -  Click Connect. This automatically retrieves available voices from the server
    -  Set desired Voice and other settings
    -  Type text to be spoken on the Input box. Press ENTER when done.
    -  Listen for the spoken text with the selected voice
    -  Monitor Response box for viseme and other speech info. 

## Limitations

No security or encryption implemented, as Private/Home networks are supposed to be Trusted networks anyway. It shouldn't be too hard though to implement one.

For TTS, only English language has been tested. And no spelling checks.

Linux voices sound less natural than Windows voices, at least the free ones. And no viseme data.

## Known Issues

Some SAPI5 voices do not allow multiple clients. So if a client is already using a particular voice or fails to properly disconnect, there will be no speech output for another client trying to use said voice. Microsoft voices (or 64-bit voices?) are apparently not affected by this issue.

On multiple sentences, Microsoft voices sometimes skip sentences (due to asynchronous nature of speaking?). Older SAPI5 voices are not affected by this issue.

On Linux, sometimes there's no speech output even though the command was sent to TTS engine successfully. Lost data?? Need to flush the sockets/buffer?? Wait until speak done??

## License

MIT