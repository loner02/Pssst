using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Dynamic;
using System.Threading.Tasks;
using System.IO;
using System.Speech.Synthesis;

namespace speechServer
{
    public class VisemeData
    {
        public int type { get; set; }
        public double position { get; set; }
        public double duration { get; set; }
    }
    public class SpeechStreamData
    {
        public string Text { get; set; }
        public List<VisemeData> VisemeList { get; set; }
        public MemoryStream AudioStream { get; set; }
        public long Length { get; set; }
        //public bool Ready { get; set; }
    }
    public class SpeechEventArgs : EventArgs
    {
        public int id { get; set; }
    }

    class Voice
    {
        #region Fields
        private string _id;
        private bool __debug;
        private int currentStream;

        private SpeechSynthesizer _synth;
        public event SpeechEvent textSpoken;

        private List<InstalledVoice> voiceList;
        //private SpeechStreamData _speechData;
        private Dictionary<int, SpeechStreamData> _speechStream;
        #endregion

        public Voice(string id="", bool debug=false)
        {
            _id = id;
            __debug = debug;
            _synth = new SpeechSynthesizer();
            if (_synth != null)
            {
                voiceList = new List<InstalledVoice>();

                // Register for events.
                _synth.StateChanged += new EventHandler<StateChangedEventArgs>(synth_StateChanged);
                _synth.SpeakStarted += new EventHandler<SpeakStartedEventArgs>(synth_SpeakStarted);
                _synth.SpeakProgress += new EventHandler<SpeakProgressEventArgs>(synth_SpeakProgress);
                _synth.VoiceChange += new EventHandler<VoiceChangeEventArgs>(synth_VoiceChange);
                _synth.SpeakCompleted += new EventHandler<SpeakCompletedEventArgs>(synth_SpeakCompleted);
                _synth.VisemeReached += new EventHandler<VisemeReachedEventArgs>(synth_VisemeReached);

                // Create speech stream data
                _speechStream = new Dictionary<int, SpeechStreamData>();
                //_speechData = new SpeechStreamData();
            }
        }

        public string Id
        {
            get { return _id; }
        }
        public string VoiceName
        {
            get { return _synth.Voice.Name; }
        }
        public int Volume
        {
            get { return _synth.Volume; }
            set { _synth.Volume = Math.Max(0, Math.Min(100, value)); }
        }
        public int Rate
        {
            get { return _synth.Rate; }
            set { _synth.Rate = Math.Max(-10, Math.Min(10, value)); }
        }

        public void Close()
        {
            _speechStream.Clear();
            _synth.Dispose();
        }

        public async Task<dynamic> getVoices(dynamic input)
        {
            dynamic result = new ExpandoObject();
            string gender = (input.data != String.Empty) ? input.data : "Female";
            foreach (InstalledVoice voice in _synth.GetInstalledVoices())
            {
                VoiceInfo info = voice.VoiceInfo;
                if (voice.Enabled && info.Gender.ToString().Equals(gender))
                    voiceList.Add(voice);
            }
            string[] voices = new string[voiceList.Count];
            for (int i = 0; i < voiceList.Count; i++)
                voices[i] = voiceList[i].VoiceInfo.Name;
            result.voices = voices;
            result.count = voiceList.Count;
            return await Task.FromResult<dynamic>(result);
        }

        public void setVoice(int index)
        {
            string voice = voiceList[index].VoiceInfo.Name;
            _synth.SelectVoice(voice);
        }

        public SpeechStreamData getStream(int id)
        {
            return _speechStream[id];
        }

        public void speak(string[] sentences)
        {
            // speechStreamData holds audio data, esp if multiple streams overlap
            // TODO: what if simultaneous speaking??? indicate busy flag??
            
            _speechStream.Clear();

            for (int index=0; index<sentences.Length; index++)
            {
                currentStream = index;
                _speechStream.Add(index, new SpeechStreamData());
                _speechStream[index].Text = sentences[index];
                _speechStream[index].VisemeList = new List<VisemeData>();
                _speechStream[index].AudioStream = new MemoryStream();

                _synth.SetOutputToWaveStream(_speechStream[index].AudioStream);
                _synth.Speak(sentences[index]); // or SpeakAsync
            }
            /*
            foreach (string sentence in sentences)
            {
                _speechData.Text = sentence;
                _speechData.VisemeList = new List<VisemeData>();
                _speechData.AudioStream = new MemoryStream();

                _synth.SetOutputToWaveStream(_speechData.AudioStream);
                _synth.Speak(sentence);
            }*/
        }


        #region Private Methods
        private async void synth_StateChanged(object sender, StateChangedEventArgs e)
        {
            if (__debug) Console.WriteLine("Current state of the synthesizer: " + e.State);
            // synth.state: 0 1 2: ready, speaking, paused
            if ((e.State==0) && (_speechStream.Count>0))
            {
                _synth.SetOutputToNull();

                // process _speechStream here
                SpeechStreamData speechData = _speechStream[currentStream];
                speechData.Length = speechData.AudioStream.Length;
                speechData.AudioStream.Seek(0, SeekOrigin.Begin);

                SpeechEventArgs args = new SpeechEventArgs();
                args.id = currentStream;
                await textSpoken?.Invoke(this, args);
            }
        }

        private void synth_SpeakStarted(object sender, SpeakStartedEventArgs e)
        {
            if (__debug) Console.WriteLine("Speak operation started");
        }

        private void synth_SpeakProgress(object sender, SpeakProgressEventArgs e)
        {
            if (__debug) Console.WriteLine("Current word being spoken: " + e.Text);
        }

        private void synth_VoiceChange(object sender, VoiceChangeEventArgs e)
        {
            if (__debug) Console.WriteLine("Name of the new voice: " + e.Voice.Name);
        }
        
        // Note: SpeakCompleted is only fired on SpeakAsync
        // However, if using SpeakAsync, need to wait for completion of current stream
        // Alternative is use the StateChanged event. StateChanged is fired every Speak stream
        private void synth_SpeakCompleted(object sender, SpeakCompletedEventArgs e)
        {
            if (__debug) Console.WriteLine("Speak operation completed");
            //_synth.SetOutputToNull(); // check status if speaking
        }

        private void synth_VisemeReached(object sender, VisemeReachedEventArgs e)
        {
            if (__debug) Console.WriteLine("Current viseme reached: {0} {1} {2}", e.Viseme, e.AudioPosition.TotalMilliseconds, e.Duration.TotalMilliseconds);
            VisemeData vd = new VisemeData();
            vd.type = e.Viseme;
            vd.position = e.AudioPosition.TotalMilliseconds;
            vd.duration = e.Duration.TotalMilliseconds;
            _speechStream[currentStream].VisemeList.Add(vd);
            //_speechData.VisemeList.Add(vd);
        }
        #endregion
    }
}
