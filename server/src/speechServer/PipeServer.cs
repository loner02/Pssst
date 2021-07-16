using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Dynamic;
using System.Threading.Tasks;
using System.IO;
using System.IO.Pipes;
using System.Web.Script.Serialization;
using System.Collections.ObjectModel;
using System.Reflection;

namespace speechServer
{
    public class PipeMessage
    {
        public const int MessageBufferSize = 8 * 1024 * 1024;
        public PipeMessage()
        {
            Encoding = Encoding.UTF8;
            MessageBytes = Encoding.GetBytes(string.Empty.PadRight(MessageBufferSize, '\0'));
        }

        public PipeMessage(string message)
        {
            Encoding = Encoding.UTF8;
            SetMessageInBuffer(message);
        }

        public byte[] MessageBytes { get; set; }
        public Encoding Encoding { get; set; }

        public string Message
        {
            get { return GetMessageFromBuffer(); }
            set { SetMessageInBuffer(value); }
        }

        public void SetMessageInBuffer(string message)
        {
            if (string.IsNullOrEmpty(message))
            {
                MessageBytes = new byte[MessageBufferSize];
                return;
            }

            var msg = $"{message.TrimEnd().TrimEnd('\0')}";
            var bytes = Encoding.GetBytes(msg.PadRight(MessageBufferSize, '\0'));
            MessageBytes = bytes;
        }
        public string GetMessageFromBuffer()
        {
            var msg = $"{Encoding.GetString(MessageBytes).TrimEnd().TrimEnd('\0')}";
            return msg;
        }

        public bool IsNullOrEmpty()
        {
            var msg = GetMessageFromBuffer().Trim().Trim('\0');
            return string.IsNullOrEmpty(msg);
        }

        public void Clear()
        {
            MessageBytes = Encoding.GetBytes(string.Empty.PadRight(MessageBufferSize, '\0'));
        }
    }

    public class MessageEventArgs : EventArgs
    {
        private string _args = "";
        public MessageEventArgs(string msg = "")
        {
            _args = msg;
        }
        public string msg
        {
            get { return _args; }
            set { _args = value; }
        }
    }

    public class ExpandoJsonConverter : JavaScriptConverter
    {
        public override object Deserialize(IDictionary<string, object> dictionary, Type type, JavaScriptSerializer serializer)
        {
            var instance = Activator.CreateInstance(type);
            FieldInfo[] typeFields = type.GetFields(BindingFlags.Public | BindingFlags.Instance);
            foreach (FieldInfo fieldinfo in typeFields)
                fieldinfo.SetValue(instance, dictionary[fieldinfo.Name]);
            return instance;
        }
        public override IDictionary<string, object> Serialize(object obj, JavaScriptSerializer serializer)
        {
            var result = new Dictionary<string, object>();
            var dictionary = obj as IDictionary<string, object>;
            foreach (var item in dictionary)
                result.Add(item.Key, item.Value);
            return result;
        }
        public override IEnumerable<Type> SupportedTypes
        {
            get
            {
                return new ReadOnlyCollection<Type>(new Type[] { typeof(ExpandoObject) });
            }
        }
    }

    public class PipeServer : PipeClass
    {
        #region Fields
        public event MessageEvent messageReceived;
        
        #endregion

        public PipeServer(string id="", bool debug=false)
        {
            PipeName = "PSSST.Pipe.Server";
            Connected = false;
            _pipe = null;
            __debug = debug;
        }

        public override async Task Listen()
        {
            AddToLog("[PipeServer]", "Waiting for query...");

            _pipeMessage = new PipeMessage();
            while (!Connected)
            {
                try
                {
                    _pipe = new NamedPipeServerStream(PipeName,
                                    PipeDirection.InOut,
                                    1,
                                    PipeTransmissionMode.Message, //Byte,
                                    PipeOptions.Asynchronous | PipeOptions.WriteThrough,
                                    PipeMessage.MessageBufferSize, PipeMessage.MessageBufferSize);

                    await Task.Run(() => {
                        try
                        {
                            _pipe.WaitForConnection();
                        }
                        catch (Exception e)
                        {
                            // pipe has closed from other thread
                            //throw new Exception(e.Message);
                            _pipe = null;
                            Connected = false;
                        }
                    });

                    if (_pipe != null)
                    {
                        AddToLog("[PipeServer]", "Received query.");
                        Connected = true;

                        // wait for client info
                        await GetMessage();

                        // fire message event
                        if (__debug) AddToLog("[PipeServer]", _pipeMessage.Message);
                        MessageEventArgs args = new MessageEventArgs(_pipeMessage.Message);
                        dynamic result = await messageReceived?.Invoke(this, args);

                        // send acknowledgement with local pipe path
                        await SendMessage("{\"cmd\":\"requestAck\", \"data\":\"" + result.local + "\"}");

                        // clear pipe
                        _pipeMessage.Clear();
                        _pipe.Close();
                        Connected = false;
                    }
                }
                catch (AggregateException e)
                {
                    throw new AggregateException(e.Message);
                }
            }
        }
    }


    public class LocalServer : PipeClass
    {
        #region Fields
        private string _id;
        public event MessageEvent messageReceived;
        #endregion

        public LocalServer (string id="", bool debug=false)
        {
            __debug = debug;
            string suffix = string.Format("{0:X6}", new Random().Next(0x1000000));
            _id = id + suffix;
            PipeName = _id + ".Pipe.Server";

            Connected = false;
            _pipe = new NamedPipeServerStream(PipeName,
                                PipeDirection.InOut,
                                1,
                                PipeTransmissionMode.Byte,
                                PipeOptions.Asynchronous | PipeOptions.WriteThrough,
                                PipeMessage.MessageBufferSize, PipeMessage.MessageBufferSize);
        }

        public string Id
        {
            get { return _id; }
        }
        public override async Task Listen()
        {
            // wait for connection
            AddToLog("[" + _id + "]", PipeName + " waiting for connection...");
            await Task.Run(() => { _pipe.WaitForConnection(); });
            AddToLog("[" + _id + "]", "Connection established.");
            Connected = true;

            // listen for messages
            _pipeMessage = new PipeMessage();
            while (Connected)
            {
                await GetMessage();

                // fire message event
                if (__debug) AddToLog("[" + _id + "]", _pipeMessage.Message);
                MessageEventArgs args = new MessageEventArgs(_pipeMessage.Message);
                dynamic result = await messageReceived?.Invoke(this, args);

                _pipeMessage.Clear();
            }
        }

        public async Task SendToClient(string cmd, dynamic data, bool json=true)
        {
            dynamic response = new ExpandoObject();
            response.cmd = cmd;
            response.data = data;
            if (json)
            {
                var serializer = new JavaScriptSerializer();
                serializer.RegisterConverters(new JavaScriptConverter[] { new ExpandoJsonConverter() });
                string jsonString = serializer.Serialize(response);
                await SendMessage(jsonString);
            }
            else
            {
                await SendMessage(response.data);
            }
        }
    }

    public abstract class PipeClass
    {
        protected NamedPipeServerStream _pipe;
        protected PipeMessage _pipeMessage;
        protected bool __debug = false;

        public virtual string PipeName { get; set; }
        public virtual bool Connected { get; set; }

        public virtual void Close()
        {
            _pipe.Dispose();
            _pipe.Close();
            Connected = false;
        }

        public virtual async Task Listen() { }  // for overriding on inherited class

        public virtual async Task SendMessage(string message)
        {
            if (_pipe.IsConnected)
            {
                Connected = true;
                var msg = new PipeMessage(message);

                await Task.Run(() => {
                    _pipe.Write(msg.MessageBytes, 0, message.Length);
                });
            }
            else
            {
                Connected = false;
                throw new Exception("[PipeServer] No client connected to pipe.");
            }
        }

        public virtual async Task SendMessage(dynamic input)
        {
            if (_pipe.IsConnected)
            {
                Connected = true;
                byte[] buffer = ((MemoryStream)input).ToArray();
                await Task.Run(() => {
                    _pipe.Write(buffer, 0, buffer.Length);
                });
            }
            else
            {
                Connected = false;
                throw new Exception("[PipeServer] No client connected to pipe.");
            }
        }

        public virtual async Task GetMessage()
        {
            if (_pipe.IsConnected)
            {
                Connected = true;
                await Task.Run(() => {
                    _pipe.Read(_pipeMessage.MessageBytes, 0, PipeMessage.MessageBufferSize);
                });
            }
            else
            {
                Connected = false;
                throw new Exception("[PipeServer] No client connected to pipe.");
            }
        }

        public virtual void AddToLog(string src, string msg)
        {
            string timestamp = DateTime.Now.ToString("yyMMddHHmmss");
            Console.WriteLine("{0} {1} {2}", timestamp, src, msg);
        }

    }
}
