import { useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "./UserContext.jsx";
import { uniqBy } from "lodash";
import axios from "axios";
import Contact from "./Contact.jsx";
import Avatar from "./Avatar.jsx";
import Logo from "./Logo.jsx";
import Picker from "@emoji-mart/react";
import toast, { Toaster } from "react-hot-toast";
import { FiMenu, FiX, FiPaperclip, FiSend, FiSmile, FiMic, FiLogOut } from "react-icons/fi";

export default function Chat() {
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const outgoingQueueRef = useRef([]);

  const [onlinePeople, setOnlinePeople] = useState({});
  const [offlinePeople, setOfflinePeople] = useState({});
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [newMessageText, setNewMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [searchQuery, setSearchQuery] = useState(""); // ✅ search state

  const { username, id, setId, setUsername } = useContext(UserContext);
  const divUnderMessages = useRef();

  // WebSocket connection
  useEffect(() => {
    connectWebSocket();
    return () => {
      clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line
  }, []);

  function connectWebSocket() {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;
    const url =
      (window.location.protocol === "https:" ? "wss" : "ws") +
      "://" +
      window.location.hostname +
      ":4040";
    const socket = new WebSocket(url);
    wsRef.current = socket;

    socket.addEventListener("open", () => {
      setWsConnected(true);
      reconnectAttemptsRef.current = 0;
      flushQueue();
    });

    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", () => {
      setWsConnected(false);
      scheduleReconnect();
    });
    socket.addEventListener("error", (err) => {
      console.error("WebSocket error", err);
    });
  }

  function scheduleReconnect() {
    reconnectAttemptsRef.current += 1;
    const timeout = Math.min(30000, 1000 * Math.pow(1.5, reconnectAttemptsRef.current));
    reconnectTimerRef.current = setTimeout(connectWebSocket, timeout);
  }

  function flushQueue() {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    while (outgoingQueueRef.current.length > 0) {
      const msg = outgoingQueueRef.current.shift();
      wsRef.current.send(JSON.stringify(msg));
    }
  }

  function handleMessage(ev) {
    try {
      const data = JSON.parse(ev.data);

      if (Array.isArray(data.online)) {
        const online = {};
        data.online.forEach(({ userId, username }) => (online[userId] = { username }));
        setOnlinePeople(online);
        return;
      }

      if (data._id || data.text || data.file) {
        setMessages((prev) => {
          const exists = prev.find((m) => m._id === data._id);
          if (exists) return prev;
          return [...prev, data];
        });
      }
    } catch (err) {
      console.error("Malformed WS message", err, ev.data);
    }
  }

  const logout = () => {
    axios
      .post("/logout", {}, { withCredentials: true })
      .then(() => {
        wsRef.current?.close();
        setWsConnected(false);
        setId(null);
        setUsername(null);
        toast.success("Logged out!");
      })
      .catch(() => toast.error("Logout failed"));
  };

  const sendMessage = (ev, file = null) => {
    if (ev) ev.preventDefault();
    if (!newMessageText && !file) return;
    if (!selectedUserId) return toast.error("Select contact first");

    const payload = { recipient: selectedUserId, text: newMessageText || "", file };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(payload));
    } else {
      outgoingQueueRef.current.push(payload);
      connectWebSocket();
      toast("Message queued...", { icon: "⏳" });
    }
    setNewMessageText("");
  };

  const sendFile = (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => sendMessage(null, { name: file.name, data: reader.result });
    ev.target.value = "";
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorder?.stop();
      setIsRecording(false);
      toast.success("Recording stopped");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const audioData = reader.result;
          sendMessage(null, { name: "voice.webm", data: audioData });
        };
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      toast("Recording started...", { icon: "🎙️" });
    } catch {
      toast.error("Microphone not available");
    }
  };

  useEffect(() => divUnderMessages.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  useEffect(() => {
    axios
      .get("/people", { withCredentials: true })
      .then((res) => {
        const offline = {};
        res.data
          .filter((p) => String(p._id) !== String(id) && !Object.keys(onlinePeople).includes(String(p._id)))
          .forEach((p) => (offline[p._id] = p));
        setOfflinePeople(offline);
      })
      .catch(console.error);
  }, [onlinePeople, id]);

  useEffect(() => {
    if (!selectedUserId) return setMessages([]);
    axios
      .get("/messages/" + selectedUserId, { withCredentials: true })
      .then((res) => setMessages(uniqBy(res.data, "_id")))
      .catch(console.error);
  }, [selectedUserId]);

  const allPeople = Object.keys({ ...onlinePeople, ...offlinePeople })
    .map((userId) => {
      const user = onlinePeople[userId] || offlinePeople[userId];
      return { id: userId, username: user?.username || "Unknown", online: !!onlinePeople[userId] };
    })
    .sort((a, b) => (b.online === a.online ? 0 : b.online ? -1 : 1));

  const filteredPeople = allPeople.filter((user) =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 relative">
      <Toaster position="top-right" />

      {/* Sidebar */}
      <div
        className={`fixed md:relative z-50 inset-0 md:inset-auto transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 transition-transform duration-300 ease-in-out bg-white w-72 md:w-1/3 border-r flex flex-col shadow-lg`}
      >
        <div className="flex justify-between items-center p-4 border-b bg-green-600 text-white">
          <Logo />
          <button className="md:hidden text-2xl" onClick={() => setSidebarOpen(false)}>
            <FiX />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-2">
          {/* Search Bar */}
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full mb-2 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-green-400"
          />

          {/* Contacts */}
          {filteredPeople.map((user) => (
            <Contact
              key={user.id}
              id={user.id}
              username={user.username}
              online={user.online}
              selected={user.id === selectedUserId}
              onClick={() => {
                setSelectedUserId(user.id);
                setSidebarOpen(false);
              }}
            />
          ))}
        </div>

        <div className="p-2 flex items-center justify-between border-t bg-gray-50">
          <span className="text-sm text-gray-600 truncate flex items-center gap-2">
            <Avatar username={username} online={true} /> {username}
          </span>
          <button
            onClick={logout}
            className="text-sm flex items-center gap-1 bg-red-100 py-1 px-2 text-red-600 border rounded-md hover:bg-red-200"
          >
            <FiLogOut /> Logout
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex flex-col flex-1 relative">
        <div className="flex items-center justify-between p-3 border-b bg-green-600 text-white shadow-sm">
          <button className="text-2xl md:hidden" onClick={() => setSidebarOpen(true)}>
            <FiMenu />
          </button>
          <div className="flex flex-col text-left">
            <span className="font-semibold text-white text-base md:text-lg">
              {selectedUserId
                ? onlinePeople[selectedUserId]?.username || offlinePeople[selectedUserId]?.username || "Unknown"
                : "Select Contact"}
            </span>
            {selectedUserId && (
              <span className="text-xs text-gray-200">{onlinePeople[selectedUserId] ? "Online" : "Offline"}</span>
            )}
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-3 bg-gray-100">
          {uniqBy(messages, "_id").map((msg) => (
            <div key={msg._id || Math.random()} className={`flex ${String(msg.sender) === String(id) ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl text-sm shadow-md ${
                  String(msg.sender) === String(id)
                    ? "bg-green-500 text-white rounded-br-none"
                    : "bg-white text-gray-800 rounded-bl-none"
                }`}
              >
                {typeof msg.text === "string" && msg.text.startsWith("data:audio/") ? (
                  <audio controls className="mt-2 max-w-xs" src={msg.text} />
                ) : (
                  <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>
                )}
                {msg.file && (
                  <a
                    href={(axios.defaults.baseURL || "") + "/uploads/" + (msg.file.name || msg.file)}
                    target="_blank"
                    rel="noreferrer"
                    className="block mt-2 underline text-blue-600 text-sm truncate"
                  >
                    {msg.file.name || msg.file}
                  </a>
                )}
              </div>
            </div>
          ))}
          <div ref={divUnderMessages}></div>
        </div>

        {selectedUserId && (
          <div className="flex items-center gap-2 p-2 border-t bg-white">
            <button onClick={() => setShowEmojiPicker((v) => !v)} className="text-2xl text-gray-500">
              <FiSmile />
            </button>
            <input
              type="text"
              value={newMessageText}
              onChange={(e) => setNewMessageText(e.target.value)}
              className="flex-grow border rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Type a message..."
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage(e)}
            />
            <label className="cursor-pointer text-gray-500">
              <FiPaperclip size={22} />
              <input type="file" className="hidden" onChange={sendFile} />
            </label>
            <button onClick={toggleRecording} className={`p-2 rounded-full ${isRecording ? "bg-red-500 text-white" : "bg-gray-200 text-gray-700"}`}>
              <FiMic />
            </button>
            <button onClick={sendMessage} className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600">
              <FiSend />
            </button>
          </div>
        )}

        {showEmojiPicker && (
          <div className="absolute bottom-20 left-2 z-50 md:left-10">
            <Picker onEmojiSelect={(emoji) => setNewMessageText((prev) => prev + emoji.native)} />
          </div>
        )}
      </div>
    </div>
  );
}
