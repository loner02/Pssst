using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace speechServer
{
    class Profile
    {
        #region Fields
        private string _id;
        private LocalServer _pipe;
        private Voice _voice;
        private string _gender;
        //private string[] _voiceList;
        private UInt16 _currentVoice;
        #endregion

        public Profile (string id, bool debug=false)
        {
            // Communication pipe
            _pipe = new LocalServer(id, debug);
            _id = _pipe.Id;
            // Voice
            _gender = "Female";
            _voice = new Voice(_id, debug);
        }

        #region Getters/Setters
        public LocalServer Pipe
        {
            get { return _pipe; }
        }
        public string Pipename
        {
            get { return _pipe.PipeName; }
        }
        public string Id
        {
            get { return _id; }
        }
        public Voice Voice
        {
            get { return _voice; }
        }
        public string Gender
        {
            get { return _gender; }
            set { _gender = value; }
        }
        /*
        public string[] VoiceList
        {
            get { return _voiceList; }
            set
            {
                _voiceList = new string[value.Length];
                _voiceList = value;
            }
        }*/
        public UInt16 CurrentVoice
        {
            get { return _currentVoice; }
            set
            {
                _voice.setVoice((int)value);
                _currentVoice = value;
            }
        }

        public string Speak
        {
            set
            {
                string text = (string)value;
                // break into an array of sentences based on simple punctuations
                string[] sentences = Regex.Split(text, @"(?<=[\.!\?])\s+");
                //foreach (string sentence in sentences)
                //    _voice.speak(sentence);
                _voice.speak(sentences);
            }
        }
        #endregion

    }
}
