import { useState, useRef, useEffect } from "react";
import "./App.css";

export default function App() {
  const [port, setPort] = useState(null);
  const [writer, setWriter] = useState(null);
  const [reader, setReader] = useState(null);
  const [uartData, setUartData] = useState("");
  const [msg, setMsg] = useState("");
  const [status, setStatus] = useState("Disconnected");

  // Parsed device info
  const [deviceInfo, setDeviceInfo] = useState({
    macId: "",
    fwVersion: "",
    serialNumber: "",
    ssid: "",
  });

  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [uartData]);

  // Parse terminal data into device info
  const parseDeviceInfo = (data) => {
  const info = { macId: "", fwVersion: "", serialNumber: "", ssid: "" };

  // Split data by lines ending with #
  const lines = data.split("#");

  lines.forEach((line) => {
    line = line.trim();
    if (line.startsWith("*MAC:")) {
      // Example: *MAC:D4:8A:FC:C3:F0:34:999999
      const macLine = line.replace("*MAC:", "").trim();
      const parts = macLine.split(":");
      // MAC is first 6 parts, serial is last
      if (parts.length >= 7) {
        info.macId = parts.slice(0, 6).join(":");
        info.serialNumber = parts[6];
      }
    } else if (line.startsWith("*FW:")) {
      // Example: *FW:*Kwikpay_040925_VER_1.24 Naico Ltd
      const fwLine = line.replace("*FW:", "").trim();
      // Remove any leading '*' if present
      info.fwVersion = fwLine.replace(/^\*/, "").split(" ")[0]; 
    }
    // Optionally, parse SSID if present in some line
    else if (line.startsWith("*SSID:")) {
      info.ssid = line.replace("*SSID:", "").trim();
    }
  });

  setDeviceInfo(info);
};


  // Connect to UART
 const connectSerial = async () => {
  try {
    const selectedPort = await navigator.serial.requestPort();
    await selectedPort.open({ baudRate: 115200 });
    setPort(selectedPort);
    setStatus("Connected");

    // Setup writer
    const writer = selectedPort.writable.getWriter();
    setWriter(writer);

    // 🟢 Automatically send *RST# every time we connect/reconnect
    await writer.write(new TextEncoder().encode("*RST#\n"));

    // Setup reader
    const reader = selectedPort.readable.getReader();
    setReader(reader);

    const decoder = new TextDecoder();

    const readLoop = async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            const text = decoder.decode(value);
            setUartData((prev) => prev + text);
            parseDeviceInfo(text); // Update device info
          }
        }
      } catch (err) {
        console.error("Read loop stopped:", err);
      } finally {
        reader.releaseLock();
      }
    };

    readLoop();
  } catch (err) {
    console.error("Error connecting to UART:", err);
    setStatus("Error");
  }
};


  // Disconnect UART
  const disconnectSerial = async () => {
    try {
      if (reader) {
        await reader.cancel();
        reader.releaseLock();
        setReader(null);
      }
      if (writer) {
        writer.releaseLock();
        setWriter(null);
      }
      if (port) {
        await port.close();
        setPort(null);
      }
      setUartData("");
      setDeviceInfo({ macId: "", fwVersion: "", serialNumber: "", ssid: "" });
      setStatus("Disconnected");
      console.log("✅ Disconnected and cleared data");
    } catch (err) {
      console.error("Error disconnecting:", err);
    }
  };

  const sendSerial = async () => {
    if (!writer || !msg) return;
    try {
      await writer.write(new TextEncoder().encode(msg + "\n"));
      setMsg("");
    } catch (err) {
      console.error("Send error:", err);
    }
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">UART Dashboard</h1>

        {/* Status */}
        <p className={`status ${status === "Connected" ? "connected" : "disconnected"}`}>
          Status: {status}
        </p>

        {/* Connect / Disconnect */}
        {!port ? (
          <div className="center">
            <button onClick={connectSerial} className="btn connect">
              Connect UART
            </button>
          </div>
        ) : (
          <div className="center">
            <button onClick={disconnectSerial} className="btn disconnect">
              Disconnect
            </button>
          </div>
        )}

        {/* Send */}
        <div className="send-section">
          <input
            type="text"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="Enter UART command"
            className="input"
          />
          <button onClick={sendSerial} className="btn send" disabled={!writer || !msg}>
            Send
          </button>
          <button
            onClick={() => {
              setUartData("");
              setDeviceInfo({ macId: "", fwVersion: "", serialNumber: "", ssid: "" });
            }}
            className="btn clear"
            disabled={!uartData}
          >
            Clear Terminal
          </button>
        </div>

        {/* Device Info Cards */}
        <div className="info-cards">
          <div className="info-card">
            <strong>MAC ID:</strong> {deviceInfo.macId || "-"}
          </div>
          <div className="info-card">
            <strong>FW Version:</strong> {deviceInfo.fwVersion || "-"}
          </div>
          <div className="info-card">
            <strong>Serial Number:</strong> {deviceInfo.serialNumber || "-"}
          </div>
          <div className="info-card">
            <strong>SSID:</strong> {deviceInfo.ssid || "-"}
          </div>
        </div>

        {/* Terminal */}
        <h2 className="subtitle">Incoming UART Data:</h2>
        <div className="terminal" ref={terminalRef}>
          <pre>{uartData || "No data yet..."}</pre>
        </div>
      </div>
    </div>
  );
}
