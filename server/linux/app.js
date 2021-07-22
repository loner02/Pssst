const net = require("net");
const fs = require("fs");
const readline = require("readline").createInterface(
    {input: process.stdin}
)
const { PipeServer, LocalServer } = require("./pipeserver");

console.log ("PSSST Speech Server");
console.log ("Press Ctrl-C to exit.\n\n");

var __debug = false;
var __tts = "flite";
var args = process.argv.slice(2);
for (let arg of args) {
    if (arg == "--debug")
        __debug = true;
    else if (arg.includes("--tts")) {
        __tts = (arg.split('='))[1];
    }
}
if (__debug) console.log(`Using ${__tts} as speech synthesis engine.`)

var Profiles = new Map(); // <string, profile>
var pipeServer = new PipeServer("", __debug);
pipeServer.Profiles = Profiles;
pipeServer.TTS = __tts;
pipeServer.Listen();

process.on("SIGINT", () => {
    console.log("TODO: cleanup");
    let files = fs.readdirSync("/tmp");
    files.forEach((file) => {
        if (file.includes("Pipe.Server") || file.includes(".wav"))
            fs.unlink("/tmp/"+file, (err) => {});
    })
    process.exit(0);
})

// TODO: not reached
readline.question("", () => {
    readline.close();
})