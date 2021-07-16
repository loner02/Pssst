using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Dynamic;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace speechServer
{
    #region Delegates
    public delegate Task<dynamic> MessageEvent(object sender, MessageEventArgs args);
    public delegate Task SpeechEvent(object sender, SpeechEventArgs args);
    #endregion

    #region Message and Data classes
    public class Message
    {
        public string cmd { get; set; }
        public string data { get; set; }
    }
    public class VoiceList
    {
        public string[] voices { get; set; }
        public int count { get; set; }
    }
    #endregion

    class Program
    {
        #region Fields
        private static PipeServer pipeServer;
        private static Dictionary<string, Profile> Profiles;
        private static bool __debug;
        #endregion

        static void Main(string[] args)
        {
            __debug = ((args.Length > 0) && (args[0].Contains("debug"))) ? true : false;

            Console.WriteLine("PSSST Speech Server");
            Console.WriteLine("Press ENTER key to quit.\n\n");

            Profiles = new Dictionary<string, Profile>();

            pipeServer = new PipeServer("", __debug);
            pipeServer.messageReceived += PipeServer_messageReceived;
            pipeServer.Listen();

            Console.ReadLine();
            // TODO: cleanup code here
        }

        private async static Task<dynamic> PipeServer_messageReceived(object sender, MessageEventArgs args)
        {
            var serializer = new JavaScriptSerializer();
            var msg = serializer.Deserialize<Message>(args.msg);
            dynamic result = new ExpandoObject();
            
            switch (msg.cmd)
            {
                case "query":
                case "request":
                    // create local profile
                    Profile profile = new Profile(msg.data, __debug);
                    Profiles.Add(profile.Id, profile);
                    profile.Pipe.messageReceived += LocalServer_messageReceived;
                    profile.Voice.textSpoken += Voice_textSpoken;
   
                    result.local = profile.Pipename;
                    profile.Pipe.Listen();
                    break;
                case "quit":
                    // TODO: close gracefully before exit
                    Environment.Exit(0);
                    break;
                default:
                    Console.WriteLine("[ERROR] Invalid command: " + msg.cmd);
                    break;
            }
            return await Task.FromResult<dynamic>(result);
        }

        private async static Task<dynamic> LocalServer_messageReceived(object sender, MessageEventArgs args)
        {
            var serializer = new JavaScriptSerializer();
            var msg = serializer.Deserialize<Message>(args.msg);
            dynamic result = new ExpandoObject();
            LocalServer pipe = (LocalServer)sender;
            Profile profile = Profiles[pipe.Id];            

            switch (msg.cmd)
            {
                case "getVoices":
                    pipe.AddToLog("[" + pipe.Id + "]", "Getting voice list...");
                    if (profile.Voice != null)
                    {
                        if (msg.data != String.Empty) profile.Gender = msg.data;
                        dynamic voices = await profile.Voice.getVoices(msg);
                        if (__debug)
                        {
                            for (int i = 0; i < voices.count; i++)
                                pipe.AddToLog("[" + pipe.Id + "]", voices.voices[i]);
                        }
                        await pipe.SendToClient("getVoicesResponse", voices.voices);
                    }
                    break;
                case "setVoice":
                    if (profile.Voice != null)
                    {
                        UInt16 index = Convert.ToUInt16(msg.data);
                        profile.CurrentVoice = index;
                        pipe.AddToLog("[" + pipe.Id + "]", "Setting voice to " + profile.Voice.VoiceName);

                        await pipe.SendToClient("setVoiceResponse", "Success");
                    }

                    break;
                case "setVolume":
                    if (profile.Voice != null)
                    {
                        Int16 value = Convert.ToInt16(msg.data);
                        profile.Voice.Volume = value;
                        pipe.AddToLog("[" + pipe.Id + "]", "Setting volume to " + profile.Voice.Volume);

                        await pipe.SendToClient("setVolumeResponse", "Success");
                    }
                    break;
                case "setRate":
                    if (profile.Voice != null)
                    {
                        Int16 value = Convert.ToInt16(msg.data);
                        profile.Voice.Rate = value;
                        pipe.AddToLog("[" + pipe.Id + "]", "Setting rate to " + profile.Voice.Rate);

                        await pipe.SendToClient("setRateResponse", "Success");
                    }
                    break;
                case "speak":
                    if (profile.Voice != null)
                    {
                        profile.Speak = msg.data.ToString();
                    }
                    break;
                case "disconnect":
                    profile.Voice.Close();
                    profile.Pipe.Close();
                    Profiles.Remove(pipe.Id);
                    break;

                default:
                    Console.WriteLine("[ERROR] Invalid command: " + msg.cmd);
                    break;
            }

            return await Task.FromResult<dynamic>(result);
        }

        private async static Task Voice_textSpoken(object sender, SpeechEventArgs args)
        {
            dynamic response = new ExpandoObject();
            Voice voice = (Voice)sender;
            Profile profile = Profiles[voice.Id];

            SpeechStreamData stream = profile.Voice.getStream(args.id);
            response.Text = stream.Text;
            response.VisemeList = stream.VisemeList;
            response.Length = stream.Length;

            await profile.Pipe.SendToClient("speakResponse", response);
            await profile.Pipe.SendToClient("stream", stream.AudioStream, false);
        }

    }

}
