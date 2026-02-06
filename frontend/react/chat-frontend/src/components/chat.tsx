import {useEffect, useRef, useState} from "react";
import './chat.css';

interface Message {
  id?: string;
  from: string;
  to?: string; // username for private, undefined for public
  group?: string; // group name for group messages
  content: string;
  chatType: "public" | "private" | "group";
  timestamp?: number;
  displayTime?: string;
  isOptimistic?: boolean;
  fileUrl?: string; // URL for attached file
  fileName?: string; // Original file name
  fileType?: string; // MIME type
}

export function Chat() {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

  // Debug online users changes
  useEffect(() => {
    console.log("Online users state changed to:", onlineUsers);
  }, [onlineUsers]);
  // Helper to convert unknown incoming user items to a string label without using `any`.
  function toSafeString(item: unknown): string {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      const obj = item as Record<string, unknown>;
      return String(obj['username'] ?? obj['name'] ?? obj['id'] ?? JSON.stringify(obj));
    }
    return String(item);
  }

  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('closed');
  const [groups, setGroups] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChatType, setSelectedChatType] = useState<"public" | "private" | "group">("public");
  const [selectedId, setSelectedId] = useState<string | null>(null); // username or group name when not public
  const [messageInput, setMessageInput] = useState("");
  const [groupNameInput, setGroupNameInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  // cache of profile picture URLs (username -> url|null)
  const [avatarCache, setAvatarCache] = useState<Record<string, string | null>>({});
  const [uploadingFile, setUploadingFile] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // fetch profile pic for a given username and cache the result (or null on failure)
  async function fetchAvatar(userToFetch: string) {
    if (!userToFetch) return;
    // don't refetch if we already have an entry (including explicit null)
    if (Object.prototype.hasOwnProperty.call(avatarCache, userToFetch)) return;
    if (!token) {
      setAvatarCache((p) => ({...p, [userToFetch]: null}));
      return;
    }
    try {
      const resp = await fetch(`http://10.5.0.50:3000/user/profile-pic/${encodeURIComponent(userToFetch)}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        const data = await resp.json();
        const url = data?.profilePicUrl || data?.url || null;
        setAvatarCache((p) => ({...p, [userToFetch]: url}));
      } else {
        setAvatarCache((p) => ({...p, [userToFetch]: null}));
      }
    } catch (err) {
      console.error('Error fetching avatar for', userToFetch, err);
      setAvatarCache((p) => ({...p, [userToFetch]: null}));
    }
  }

  // ensure avatars for visible messages are fetched and cached
  useEffect(() => {
    const users = Array.from(new Set(messages.map((m) => m.from)));
    users.forEach((u) => {
      if (u && !Object.prototype.hasOwnProperty.call(avatarCache, u)) {
        fetchAvatar(u);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // If there's no token or username, go back to login page
  useEffect(() => {
    if (!token || !username) {
      window.location.href = "/";
    }
  }, [token, username]);

  // trying ti load previous messages
  useEffect(() => {
    if (!token) return;

    async function loadMessages() {
      try {
        const response = await fetch("http://10.5.0.50:3000/messages", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },


        });

        if (response.ok) {
          const data = await response.json();
          console.log("Loaded messages from DB:", data);

          //  return
          const list = Array.isArray(data?.messages) ? data.messages : (Array.isArray(data) ? data : []);
          if (Array.isArray(list)) {
            const loadedMessages: Message[] = list.map((msg: unknown) => {
              const msgObj = msg as Record<string, unknown>;
              return {
                id: String(msgObj.messageId || msgObj.id || msgObj._id || ''),
                from: String(msgObj.senderEmail || msgObj.from || msgObj.sender || msgObj.username || 'unknown'),
                to: msgObj.recipientEmail ? String(msgObj.recipientEmail) : (msgObj.recipientId ? String(msgObj.recipientId) : undefined),
                group: msgObj.groupId ? String(msgObj.groupId) : (msgObj.group || msgObj.room) as string | undefined,
                content: String(msgObj.content || msgObj.message || msgObj.body || ''),
                chatType: (msgObj.groupId || msgObj.group) ? 'group' : (msgObj.recipientId || msgObj.recipientEmail ? 'private' : 'public') as "public" | "private" | "group",
                timestamp: msgObj.createdAt ? Date.parse(String(msgObj.createdAt)) : (msgObj.timestamp ? Number(msgObj.timestamp) : Date.now()),
                displayTime: msgObj.createdAt ? new Date(String(msgObj.createdAt)).toLocaleTimeString() : new Date().toLocaleTimeString(),
                fileUrl: msgObj.fileUrl ? String(msgObj.fileUrl) : undefined,
                fileName: msgObj.fileName ? String(msgObj.fileName) : undefined,
                fileType: msgObj.fileType ? String(msgObj.fileType) : undefined,
              };
            });
            setMessages(loadedMessages);
          }
        } else {
          console.error("Failed to load messages:", response.status);
        }
      } catch (error) {
        console.error("Error loading messages:", error);
      }
    }

    loadMessages();
  }, [token]);

  // Load profile picture on mount
  useEffect(() => {
    if (!token || !username) return;

    async function loadProfilePic() {
      try {
        const response = await fetch(`http://10.5.0.50:3000/user/profile-pic/${username}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.profilePicUrl) {
            setProfilePic(data.profilePicUrl);
          }
        }
      } catch (error) {
        console.error("Error loading profile picture:", error);
      }
    }

    loadProfilePic();
  }, [token, username]);

  // Connect to WebSocket and set up handlers
  useEffect(() => {
    let mounted = true;

    function normalizeAndPush(raw: Record<string, unknown>) {
      const obj = raw || {};
      const typeField = String(obj['chatType'] ?? obj['type'] ?? '').toLowerCase();
      // treat several alternative type names as message-like
      const messageLike = ['message', 'public_message', 'private_message', 'group_message', 'broadcast', 'new_message', 'msg', 'chat_message'];
      let chatType: Message['chatType'] = 'public';
      if (String(obj['chatType'] ?? '').toLowerCase() === 'private' || typeField === 'private_message') chatType = 'private';
      else if (String(obj['chatType'] ?? '').toLowerCase() === 'group' || typeField === 'group_message') chatType = 'group';
      else if (!messageLike.includes(typeField) && (obj['to'] || obj['recipient'])) chatType = 'private';
      else if (!messageLike.includes(typeField) && (obj['group'] || obj['room'])) chatType = 'group';

      const from = String(obj['from'] ?? obj['sender'] ?? obj['user'] ?? '');
      const to = obj['to'] ? String(obj['to']) : obj['recipient'] ? String(obj['recipient']) : undefined;
      const group = obj['group'] ? String(obj['group']) : obj['room'] ? String(obj['room']) : undefined;
      const content = String(obj['content'] ?? obj['message'] ?? obj['body'] ?? '');
      const timestamp = typeof obj['timestamp'] === 'number' ? (obj['timestamp'] as number) : Date.now();
      const fileUrl = obj['fileUrl'] ? String(obj['fileUrl']) : undefined;
      const fileName = obj['fileName'] ? String(obj['fileName']) : undefined;
      const fileType = obj['fileType'] ? String(obj['fileType']) : undefined;

      const incoming: Message = {
        id: obj['id'] ? String(obj['id']) : undefined,
        from: from || 'unknown',
        to,
        group,
        content,
        chatType,
        timestamp,
        displayTime: new Date(timestamp).toLocaleTimeString(),
        fileUrl,
        fileName,
        fileType,
      };

      //no duplicate
      setMessages((prev) => {
        if (incoming.id) {
          const exists = prev.some((pm) => pm.id && pm.id === incoming.id);
          if (exists) return prev;
        }

        // Try to find a matching optimistic message by signature (content, chatType, to/group)
        // Be lenient about the 'from' field because server may return a slightly different representation.
        const optimisticIndex = prev.findIndex((pm) => {
          if (!pm.isOptimistic) return false;
          if ((pm.content || '') !== (incoming.content || '')) return false;
          if (pm.chatType !== incoming.chatType) return false;
          if (incoming.chatType === 'private' && (pm.to ?? '') !== (incoming.to ?? '')) return false;
          if (incoming.chatType === 'group' && (pm.group ?? '') !== (incoming.group ?? '')) return false;
          // allow 'from' mismatch; prefer replacement if pm.from equals local username or incoming.from equals local username
          if (pm.from === username || incoming.from === username) return true;
          // otherwise, allow replacement if pm.from equals incoming.from exactly
          return pm.from === incoming.from;
        });

        if (optimisticIndex !== -1) {
          const next = prev.slice();
          // replace optimistic with server-confirmed incoming
          next[optimisticIndex] = incoming;
          return next;
        }

        // otherwise append incoming message
        return [...prev, incoming];
      });
    }

    function connect() {
      if (!token || !username) return;
      setWsStatus('connecting');
      try {
        const ws = new WebSocket("ws://10.5.0.50:6969");
        wsRef.current = ws;

        // Helper function to send raw WebSocket messages
        function sendMessage(obj: Record<string, unknown>) {
          if (ws.readyState === WebSocket.OPEN) {
            const out = token ? {...obj, token} : obj;
            console.debug("Sending WS payload:", out);
            ws.send(JSON.stringify(out));
          } else {
            console.warn("WebSocket not open, cannot send", obj);
          }
        }

        ws.onopen = () => {
          console.log("WebSocket opened");
          setWsStatus('open');

          // Send a simple auth message - adapt to your server protocol if needed
          const authMsg = {type: "auth", token, username};
          ws.send(JSON.stringify(authMsg));

          // Wait a bit for auth to process, then request state
          setTimeout(() => {
            // Request online users from server first
            console.log("Requesting online users from server...");
            ws.send(JSON.stringify({type: "get_online_users"}));

            // Request groups list from server
            console.log("Requesting groups from server...");
            ws.send(JSON.stringify({type: "get_groups"}));

            // Ask server for initial state (online users, groups, recent messages)
            ws.send(JSON.stringify({type: "get_state"}));

            // Then notify server that this user has joined (after we get the current state)
            setTimeout(() => {
              ws.send(JSON.stringify({type: "user_joined", username}));

              // Request all existing users to identify themselves
              console.log("Requesting existing users to identify themselves...");
              ws.send(JSON.stringify({type: "request_presence", from: username}));
            }, 1000);
          }, 100);
        };

        ws.onmessage = (ev) => {
          try {
            const raw = JSON.parse(ev.data as string) as Record<string, unknown>;

            // If server sends nested payloads like {data: {...}} or {payload: {...}}, unwrap them
            let data: unknown = raw;
            if (raw && typeof raw === 'object') {
              const rawObj = raw as Record<string, unknown>;
              if (rawObj['data'] && typeof rawObj['data'] === 'object') data = rawObj['data'] as Record<string, unknown>;
              else if (rawObj['payload'] && typeof rawObj['payload'] === 'object') data = rawObj['payload'] as Record<string, unknown>;
            }

            // For safe indexing below, create a guarded object reference (may be empty)
            const dataObj = (data && typeof data === 'object' && !Array.isArray(data)) ? (data as Record<string, unknown>) : {} as Record<string, unknown>;

            // Quick debug to help diagnose mismatched event names / shapes
            console.debug('WS incoming:', data);

            // If the server sends the online users as a bare array
            if (Array.isArray(data)) {
              console.log("Received online users as bare array:", data);
              if (mounted) {
                const users = (data as unknown[]).map(toSafeString);
                // Filter out current user from online users list
                const filteredUsers = users.filter(u => u !== username);
                console.log("Filtered online users (excluding self):", filteredUsers);
                setOnlineUsers(filteredUsers);
              }
              return;
            }

            // Determine type from 'type' or 'event'
            const tRaw = dataObj['type'] ?? dataObj['event'] ?? '';
            const t = String(tRaw).toLowerCase();

            // Handle a few common aliases/variants for groups update
            if (['groups', 'group_list', 'grouplist', 'all_groups'].includes(t)) {
              if (mounted) {
                const arr = Array.isArray(dataObj['groups']) ? (dataObj['groups'] as unknown[])
                  : Array.isArray(dataObj['list']) ? (dataObj['list'] as unknown[])
                  : Array.isArray(dataObj['payload']) ? (dataObj['payload'] as unknown[])
                  : [];
                console.log(`Received ${t} with groups:`, arr);
                if (arr.length) {
                  const groupNames = arr.map(toSafeString);
                  setGroups(groupNames);
                }
              }
              return;
            }

            // Handle a few common aliases/variants for an online-users update
            if (['online_users', 'onlineusers', 'online-users', 'users', 'users_online', 'user_list', 'userlist', 'presence'].includes(t)) {
              if (mounted) {
                // try several common property names that might hold the user list
                const arr = Array.isArray(dataObj['users']) ? (dataObj['users'] as unknown[])
                  : Array.isArray(dataObj['list']) ? (dataObj['list'] as unknown[])
                  : Array.isArray(dataObj['payload']) ? (dataObj['payload'] as unknown[])
                  : [];
                console.log(`Received ${t} with users:`, arr);
                if (arr.length) {
                  const users = arr.map(toSafeString);
                  // Filter out current user from online users list
                  const filteredUsers = users.filter(u => u !== username);
                  console.log("Filtered online users (excluding self):", filteredUsers);
                  setOnlineUsers(filteredUsers);
                }
              }
              return;
            }

            switch (String(t).toLowerCase()) {
              case "online_users":
                console.log("Received online_users message:", dataObj);
                if (mounted && Array.isArray(dataObj['users'])) {
                  const users = (dataObj['users'] as unknown[]).map(toSafeString);
                  console.log("Setting online users:", users);
                  // Filter out current user from online users list
                  const filteredUsers = users.filter(u => u !== username);
                  console.log("Filtered online users (excluding self):", filteredUsers);
                  setOnlineUsers(filteredUsers);
                }
                break;
              case "groups":
                if (mounted && Array.isArray(dataObj['groups'])) setGroups(dataObj['groups'] as string[]);
                break;
              case "group_created":
              case "new_group": {
                // A new group was created by someone - add it to our list
                const groupName = dataObj['group'] ?? dataObj['name'] ?? dataObj['groupName'];
                if (mounted && groupName) {
                  const name = toSafeString(groupName);
                  console.log("New group created:", name);
                  setGroups((g) => Array.from(new Set([...g, name])));
                }
                break;
              }
              case "group_deleted":
              case "group_removed": {
                // A group was deleted - remove it from our list
                const groupName = dataObj['group'] ?? dataObj['name'] ?? dataObj['groupName'];
                if (mounted && groupName) {
                  const name = toSafeString(groupName);
                  console.log("Group deleted:", name);
                  setGroups((g) => g.filter(x => x !== name));
                }
                break;
              }
              case "message":
              case "public_message":
              case "private_message":
              case "group_message":
              case "broadcast":
              case "new_message":
              case "msg":
              case "chat_message": {
                // dataObj is a guarded Record<string, unknown> when the payload is an object
                normalizeAndPush(dataObj);
                break;
              }
              case "user_joined": {
                // accept several field names for the joining user
                const u = dataObj['user'] ?? dataObj['username'] ?? dataObj['name'];
                if (mounted && u) {
                  const joinedUser = toSafeString(u);
                  // Only add if it's not the current user
                  if (joinedUser !== username) {
                    setOnlineUsers((uarr) => Array.from(new Set([...uarr, joinedUser])));
                    console.log("User joined:", joinedUser);
                  }
                }
                break;
              }
              case "user_left": {
                const u = dataObj['user'] ?? dataObj['username'] ?? dataObj['name'];
                if (mounted && u) setOnlineUsers((uarr) => uarr.filter(x => x !== toSafeString(u)));
                break;
              }
              case "request_presence": {
                // Another user is asking for presence info - respond with our username
                const requester = dataObj['from'] ?? dataObj['user'] ?? dataObj['username'];
                if (mounted && requester && requester !== username) {
                  console.log("Received presence request from:", requester, "- responding with our presence");
                  sendMessage({type: "presence_response", username: username, to: requester});
                }
                break;
              }
              case "presence_response": {
                // Another user is responding to our presence request
                const respondingUser = dataObj['username'] ?? dataObj['user'] ?? dataObj['from'];
                if (mounted && respondingUser) {
                  const user = toSafeString(respondingUser);
                  if (user !== username) {
                    console.log("Received presence response from:", user);
                    setOnlineUsers((uarr) => Array.from(new Set([...uarr, user])));
                  }
                }
                break;
              }
              case "error": {
                console.error("Server error:", dataObj['message']);
                break;
              }
              default:
                // Unknown message type - attempt to normalize if it looks like a message
                if (data && typeof data === 'object' && (dataObj['content'] || dataObj['message'] || dataObj['sender'] || dataObj['body'])) {
                  normalizeAndPush(dataObj);
                } else if (Array.isArray(dataObj['users'])) {
                  // fallback: some servers send {users: [...] } with no type
                  if (mounted) {
                    const users = (dataObj['users'] as unknown[]).map(toSafeString);
                    // Filter out current user from online users list
                    const filteredUsers = users.filter(u => u !== username);
                    console.log("Fallback: filtered online users (excluding self):", filteredUsers);
                    setOnlineUsers(filteredUsers);
                  }
                } else {
                  console.log("WS message (unhandled)", raw);
                }
            }
          } catch (err) {
            console.error("Invalid WS message", err);
          }
        };

        ws.onclose = () => {
          console.log("WebSocket closed, will attempt to reconnect in 3s");
          setWsStatus('closed');
          if (!mounted) return;
          // Attempt reconnect
          reconnectRef.current = window.setTimeout(() => connect(), 3000);
        };

        ws.onerror = (ev) => {
          console.error("WebSocket error", ev);
          setWsStatus('error');
          // close socket to trigger reconnect flow
          try { ws.close(); } catch (err) { console.debug(err); }
        };
      } catch (err) {
        console.error("Failed to create WebSocket", err);
        setWsStatus('error');
      }
    }

    connect();

    return () => {
      mounted = false;
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [token, username]);

  function sendRaw(obj: Record<string, unknown>) {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not open, cannot send", obj);
      return;
    }
    const out = token ? {...obj, token} : obj;
    // Debug: log outgoing payload
    console.debug("Sending WS payload:", out);
    ws.send(JSON.stringify(out));
  }

  async function saveMessageToDb(messageData: {
    from: string;
    to?: string;
    group?: string;
    content: string;
    chatType: "public" | "private" | "group";
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
  }) {
    if (!token) return;

    try {
      const response = await fetch("http://10.5.0.50:3000/message/save", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...messageData,
          timestamp: Date.now(),
        }),
      });

      if (response.ok) {
        const savedMessage = await response.json();
        console.log("Message saved to DB:", savedMessage);
      } else {
        console.error("Failed to save message:", response.status);
      }
    } catch (error) {
      console.error("Error saving message to DB:", error);
    }
  }

  async function sendMessage() {
    if (!messageInput.trim() && !selectedFile) return;
    if (!username) return;

    const content = messageInput.trim();
    let fileUrl: string | undefined;
    let fileName: string | undefined;
    let fileType: string | undefined;

    // Upload file if selected
    if (selectedFile) {
      const uploadResult = await uploadFile(selectedFile);
      if (uploadResult) {
        fileUrl = uploadResult.url;
        fileName = uploadResult.fileName;
        fileType = uploadResult.fileType;

        // If no message text was provided, use the file name as the message content
         //if (!content) {
        //   content = fileName;
         //}
      } else {
        console.error("File upload failed");
        return;
      }
    }

    if (selectedChatType === "public") {
      const payload = {type: "public_message", from: username, content, fileUrl, fileName, fileType};
      sendRaw(payload);
      setMessages((m) => [...m, {from: username, content, chatType: "public", timestamp: Date.now(), displayTime: new Date().toLocaleTimeString(), isOptimistic: true, fileUrl, fileName, fileType}]);

      // Save to database
      saveMessageToDb({
        from: username,
        content,
        chatType: "public",
        fileUrl,
        fileName,
        fileType,
      });
    } else if (selectedChatType === "private" && selectedId) {
      const payload = {type: "private_message", from: username, to: selectedId, content, fileUrl, fileName, fileType};
      sendRaw(payload);
      setMessages((m) => [...m, {from: username, to: selectedId, content, chatType: "private", timestamp: Date.now(), displayTime: new Date().toLocaleTimeString(), isOptimistic: true, fileUrl, fileName, fileType}]);

      // Save to database
      saveMessageToDb({
        from: username,
        to: selectedId,
        content,
        chatType: "private",
        fileUrl,
        fileName,
        fileType,
      });
    } else if (selectedChatType === "group" && selectedId) {
      const payload = {type: "group_message", from: username, group: selectedId, content, fileUrl, fileName, fileType};
      sendRaw(payload);
      setMessages((m) => [...m, {from: username, group: selectedId, content, chatType: "group", timestamp: Date.now(), displayTime: new Date().toLocaleTimeString(), isOptimistic: true, fileUrl, fileName, fileType}]);

      // Save to database
      saveMessageToDb({
        from: username,
        group: selectedId,
        content,
        chatType: "group",
        fileUrl,
        fileName,
        fileType,
      });
    }

    setMessageInput("");
    setSelectedFile(null);
  }

  async function uploadFile(file: File): Promise<{url: string, fileName: string, fileType: string} | null> {
    if (!token) return null;

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("http://10.5.0.50:3000/file/upload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log("File uploaded:", data);
        return {
          url: data.fileUrl || data.url,
          fileName: file.name,
          fileType: file.type,
        };
      } else {
        console.error("Failed to upload file:", response.status);
        return null;
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      return null;
    } finally {
      setUploadingFile(false);
    }
  }

  async function uploadProfilePic(file: File) {
    if (!token || !username) return;

    try {
      const formData = new FormData();
      formData.append("profilePic", file);

      const response = await fetch("http://10.5.0.50:3000/user/profile-pic", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Profile picture uploaded:", data);
        if (data.profilePicUrl) {
          setProfilePic(data.profilePicUrl);
        }
      } else {
        console.error("Failed to upload profile picture:", response.status);
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  }

  function handleProfilePicSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      uploadProfilePic(e.target.files[0]);
    }
  }

  function removeSelectedFile() {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function createGroup() {
    const name = groupNameInput.trim();
    if (!name) return;
    sendRaw({type: "create_group", group: name});
    setGroupNameInput("");
    // optimistically add
    setGroups((g) => Array.from(new Set([...g, name])));
  }

  function selectPublic() {
    setSelectedChatType("public");
    setSelectedId(null);
  }

  function selectUser(user: string) {
    setSelectedChatType("private");
    setSelectedId(user);
  }

  function selectGroup(name: string) {
    setSelectedChatType("group");
    setSelectedId(name);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    if (wsRef.current) wsRef.current.close();
    window.location.href = "/";
  }

  // Expose a manual refresh so the user can ask the server for current state
  function refreshServerState() {
    console.log("Manually refreshing server state...");
    sendRaw({type: 'get_online_users'});
    sendRaw({type: 'get_groups'});
    sendRaw({type: 'get_state'});
  }
  // Filter messages to display for current chat
  // Deduplicate messages when computing visibleMessages: create a signature for messages and prefer non-optimistic (server-confirmed) messages over optimistic ones, preserving order. This prevents the sender from seeing duplicate messages.
  // Only deduplicate by server-assigned id. Messages without an id (optimistic or otherwise)
  // are shown as separate messages so sending the same content twice creates two messages.

  const visibleMessages = (() => {
    // First, filter messages for the selected chat
    const filtered = messages.filter((m) => {
      if (selectedChatType === "public") return m.chatType === "public";
      if (selectedChatType === "private" && selectedId) {
        return (
          m.chatType === "private" && ((m.from === selectedId && m.to === username) || (m.from === username && m.to === selectedId))
        );
      }
      if (selectedChatType === "group" && selectedId) {
        return m.chatType === "group" && m.group === selectedId;
      }
      return false;
    });

    // Build visible list while avoiding duplicates only when a server id is present.
    const seenIds = new Set<string>();
    const out: Message[] = [];
    for (const m of filtered) {
      if (m.id) {
        if (seenIds.has(m.id)) continue; // skip duplicate with same server id
        seenIds.add(m.id);
        out.push(m);
      } else {
        // no server id -> always show (preserve user intent to send the same message twice)
        out.push(m);
      }
    }

    return out;
  })();

  return (
    <div className="chat-root">
      <div className="left">
        <div className="profile-section">
          <div className="profile-pic-container"  >
            {profilePic ? (
              <img src={profilePic} style={{width:'120px', border:'1px solid white', borderRadius:'10px'}} alt="Profile" className="profile-pic" />
            ) : (
              <div className="profile-pic-placeholder">
                {username?.charAt(0).toUpperCase()}
              </div>
            )}
            <label htmlFor="profile-pic-upload" className="profile-pic-upload-btn">
              📷
              <input
                id="profile-pic-upload"
                type="file"
                accept="image/*"
                onChange={handleProfilePicSelect}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          <div className="user-info">
            <strong>{username ?? '(none)'}</strong>
          </div>
        </div>

        <h2>Online users <span style={{fontSize: 12, color: '#3ff10e'}}>({onlineUsers.length})</span></h2>
        <div className={"online-users"}>
          <button onClick={selectPublic} className="public-btn">
             Public chat
           </button>
          <div className="ws-status">WS: <strong>{wsStatus}</strong>
            <button className="refresh-btn" onClick={refreshServerState}>Refresh users</button>
           </div>
          {onlineUsers.length === 0 && <div className="no-users">No users online</div>}
          {onlineUsers.map((u) => (
            <div key={u} className="user-row">
              <button
                onClick={() => selectUser(u)}
                className={`user-btn ${selectedChatType === 'private' && selectedId === u ? 'selected' : ''}`}
              >
                {u}
              </button>
            </div>
          ))}

        </div>

        <h2>Groups</h2>
        <div className="groups">
          <input
            type="text"
            id="group-name-input"
            placeholder="Enter group name"
            value={groupNameInput}
            onChange={(e) => setGroupNameInput(e.target.value)}
          />
          <button id="create-group-button" className="create-btn" onClick={createGroup}>
            Create Group
          </button>
        </div>
        <div id="groups" className="groups-list">
          {groups.map((g) => (
            <div key={g} className="group-row">
              <button
                onClick={() => selectGroup(g)}
                className={`group-btn ${selectedChatType === 'group' && selectedId === g ? 'selected' : ''}`}
              >
                {g}
              </button>
            </div>
          ))}
        </div>

        <div className="logout-wrap">
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      <div className="main" style={{flex: 1}}>
        <h1>Chat - {selectedChatType === "public" ? "Public" : selectedChatType === "private" ? `Chat with ${selectedId}` : `Group: ${selectedId}`}</h1>

        <div className="messages">
          {visibleMessages.length === 0 && <div style={{color: "#888"}}>No messages yet</div>}
          {visibleMessages.map((m, idx) => {
            const isOwn = m.from === username;
            const avatarUrl = avatarCache[m.from] ?? null;
            const initial = (m.from && String(m.from).charAt(0).toUpperCase()) || '?';
            return (
              <div key={m.id || idx} className={`message-row ${isOwn ? 'own' : ''}`}>
                {/* avatar on left for others */}
                {!isOwn && (
                  avatarUrl ? (
                    <img src={avatarUrl} alt={`${m.from} avatar`} className="message-avatar" />
                  ) : (
                    <div className="message-avatar message-avatar-fallback">{initial}</div>
                  )
                )}

                <div className={`message-bubble ${isOwn ? 'own' : ''}`}>
                  <div className="from">{m.from}</div>
                  {m.content && <div className="content">{m.content}</div>}
                  {m.fileUrl && (
                    <div className="file-attachment">
                      {m.fileType?.startsWith('image/') ? (
                        <img src={m.fileUrl} alt={m.fileName} className="message-image" />
                      ) : (
                        <div className="file-info">
                          <span className="file-icon">📎</span>
                          <span className="file-name">{m.fileName}</span>
                        </div>
                      )}
                      <a href={m.fileUrl} download={m.fileName} className="download-link">
                        Download
                      </a>
                    </div>
                  )}
                  <div className="time">{m.displayTime}</div>
                </div>

                {/* avatar on right for own messages */}
                {isOwn && (
                  avatarUrl ? (
                    <img src={avatarUrl} alt={`${m.from} avatar`} className="message-avatar" />
                  ) : (
                    <div className="message-avatar message-avatar-fallback">{initial}</div>
                  )
                )}
              </div>
            );
          })}

        </div>

        {selectedFile && (
          <div className="file-preview">
            <span className="file-preview-name">📎 {selectedFile.name}</span>
            <button onClick={removeSelectedFile} className="file-remove-btn">✕</button>
          </div>
        )}

        <div className="input-row">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="file-upload"
          />
          <label htmlFor="file-upload" className="file-upload-btn" title="Attach file">
            📎
          </label>
          <input
            type="text"
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !uploadingFile) sendMessage();
            }}
            placeholder={selectedChatType === "public" ? "Message everyone..." : selectedChatType === "private" ? `Message ${selectedId}...` : `Message group ${selectedId}...`}
            className="message-input"
            disabled={uploadingFile}
          />
          <button onClick={sendMessage} className="send-btn" disabled={uploadingFile}>
            {uploadingFile ? "Uploading..." : "Send"}
          </button>
        </div>
       </div>
     </div>
   );
 }
